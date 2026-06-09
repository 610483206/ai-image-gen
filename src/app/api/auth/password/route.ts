import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ApiAuthError, jsonAuthError } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATION_FLOW = "password_confirmation_link";

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function readErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function isInvalidLoginError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();
  const code = readErrorCode(error);
  return code === "invalid_credentials" || message.includes("invalid login credentials");
}

function isEmailNotConfirmedError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();
  const code = readErrorCode(error);
  return code === "email_not_confirmed" || message.includes("email not confirmed");
}

function isDuplicateUserError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  );
}

function toPublicAuthError(error: unknown, fallback: string) {
  const message = readErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("rate limit")) {
    return new ApiAuthError("请求太频繁，请稍后再试", 429, "auth_rate_limited");
  }

  if (lowerMessage.includes("password")) {
    return new ApiAuthError("密码不符合要求，请至少输入 6 位字符", 400, "weak_password");
  }

  return new ApiAuthError(message || fallback, 400, "password_auth_failed");
}

function getEmailRedirectTo(request: Request) {
  const redirectTo = new URL("/auth/callback", request.url);
  return redirectTo.toString();
}

async function readPasswordAuthPayload(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL_PATTERN.test(email)) {
    throw new ApiAuthError("邮箱地址无效，请检查后重试", 400, "invalid_email");
  }

  if (password.length < 6) {
    throw new ApiAuthError("密码至少需要 6 位字符", 400, "weak_password");
  }

  return { email, password };
}

function isConfirmedUser(user: User) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string
): Promise<User | null> {
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw toPublicAuthError(error, "读取账号状态失败");

    const matchedUser = data.users.find((user) => user.email?.toLowerCase() === email);
    if (matchedUser) return matchedUser;

    if (!data.nextPage) return null;
    page = data.nextPage;
  }

  throw new ApiAuthError("账号状态查询超时，请稍后重试", 500, "auth_user_lookup_limited");
}

function registrationConfirmationResponse() {
  return NextResponse.json({
    success: false,
    code: "registration_confirmation_required",
    confirmationRequired: true,
  });
}

async function resendRegistrationConfirmation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  email: string,
  emailRedirectTo: string
) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo,
    },
  });

  if (error) throw toPublicAuthError(error, "确认邮件发送失败，请稍后重试");
  return registrationConfirmationResponse();
}

async function startRegistrationConfirmation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  email: string,
  password: string,
  emailRedirectTo: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        registration_flow: REGISTRATION_FLOW,
      },
    },
  });

  if (!error && data.session && data.user) {
    return NextResponse.json({ success: true, isNewUser: true });
  }

  if (!error) return registrationConfirmationResponse();

  if (isDuplicateUserError(error)) {
    return await resendRegistrationConfirmation(supabase, email, emailRedirectTo);
  }

  throw toPublicAuthError(error, "确认邮件发送失败，请稍后重试");
}

export async function POST(request: Request) {
  try {
    const { email, password } = await readPasswordAuthPayload(request);
    const supabase = createSupabaseServerClient();
    const emailRedirectTo = getEmailRedirectTo(request);

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!loginError && loginData.user) {
      return NextResponse.json({ success: true, isNewUser: false });
    }

    if (!isInvalidLoginError(loginError) && !isEmailNotConfirmedError(loginError)) {
      throw toPublicAuthError(loginError, "登录失败，请稍后重试");
    }

    const admin = createSupabaseAdminClient();
    const existingUser = await findAuthUserByEmail(admin, email);

    if (existingUser && isConfirmedUser(existingUser)) {
      throw new ApiAuthError("邮箱或密码不正确", 400, "invalid_credentials");
    }

    if (existingUser) {
      return await resendRegistrationConfirmation(supabase, email, emailRedirectTo);
    }

    return await startRegistrationConfirmation(supabase, email, password, emailRedirectTo);
  } catch (error) {
    return jsonAuthError(error);
  }
}
