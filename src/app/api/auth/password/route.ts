import { NextResponse } from "next/server";
import { ApiAuthError, jsonAuthError } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export async function POST(request: Request) {
  try {
    const { email, password } = await readPasswordAuthPayload(request);
    const supabase = createSupabaseServerClient();

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!loginError && loginData.user) {
      return NextResponse.json({ success: true, isNewUser: false });
    }

    if (!isInvalidLoginError(loginError)) {
      throw toPublicAuthError(loginError, "登录失败，请稍后重试");
    }

    const admin = createSupabaseAdminClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (isDuplicateUserError(createError)) {
        throw new ApiAuthError("邮箱或密码不正确", 400, "invalid_credentials");
      }

      throw toPublicAuthError(createError, "账号创建失败，请稍后重试");
    }

    const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (retryError || !retryData.user) {
      throw toPublicAuthError(retryError, "账号已创建，但自动登录失败，请重试");
    }

    return NextResponse.json({ success: true, isNewUser: true });
  } catch (error) {
    return jsonAuthError(error);
  }
}
