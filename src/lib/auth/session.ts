import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  getDefaultDailyQuota,
  isBootstrapAdminEmail,
} from "@/lib/supabase/admin";
import type { AppProfile, AuthUserContext, QuotaSnapshot } from "@/lib/auth/types";

export class ApiAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "auth_error") {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.code = code;
  }
}

export function getQuotaDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getQuotaResetAt(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export function jsonAuthError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "服务异常" },
    { status: 500 }
  );
}

export function isApiAuthError(error: unknown): error is ApiAuthError {
  return error instanceof ApiAuthError;
}

async function ensureUserProfile(user: User): Promise<AppProfile> {
  const admin = createSupabaseAdminClient();
  const email = user.email || "";
  const bootstrapAdmin = isBootstrapAdminEmail(email);
  const defaultQuota = getDefaultDailyQuota();

  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw new ApiAuthError("读取用户资料失败", 500, "profile_read_failed");

  const payload = {
    id: user.id,
    email,
    role: bootstrapAdmin ? "admin" : (existing?.role || "user"),
    status: existing?.status || "active",
    daily_quota: existing?.daily_quota || defaultQuota,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) throw new ApiAuthError("同步用户资料失败", 500, "profile_sync_failed");
  return data as AppProfile;
}

export async function getQuotaSnapshot(userId: string, dailyQuota: number): Promise<QuotaSnapshot> {
  const admin = createSupabaseAdminClient();
  const date = getQuotaDate();

  const { data, error } = await admin
    .from("user_usage_daily")
    .select("used_count,reserved_count")
    .eq("user_id", userId)
    .eq("usage_date", date)
    .maybeSingle();

  if (error) throw new ApiAuthError("读取配额失败", 500, "quota_read_failed");

  const usedCount = Number(data?.used_count || 0);
  const reservedCount = Number(data?.reserved_count || 0);
  const remaining = Math.max(dailyQuota - usedCount - reservedCount, 0);

  return {
    date,
    dailyQuota,
    usedCount,
    reservedCount,
    remaining,
    resetAt: getQuotaResetAt(),
  };
}

export async function requireUser(): Promise<AuthUserContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new ApiAuthError("请先登录", 401, "not_authenticated");

  const profile = await ensureUserProfile(user);
  if (profile.status !== "active") {
    throw new ApiAuthError("账号已被禁用，请联系管理员", 403, "account_disabled");
  }

  const quota = await getQuotaSnapshot(user.id, profile.daily_quota);
  return { user, profile, quota };
}

export async function requireAdmin(): Promise<AuthUserContext> {
  const context = await requireUser();
  if (context.profile.role !== "admin") {
    throw new ApiAuthError("无管理员权限", 403, "admin_required");
  }
  return context;
}