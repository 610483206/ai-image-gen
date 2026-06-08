import type { User } from "@supabase/supabase-js";

export type UserRole = "user" | "admin";
export type AccountStatus = "active" | "disabled";

export interface AppProfile {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  daily_quota: number;
  created_at: string;
  updated_at: string;
}

export interface QuotaSnapshot {
  date: string;
  dailyQuota: number;
  usedCount: number;
  reservedCount: number;
  remaining: number;
  resetAt: string;
}

export interface AuthUserContext {
  user: User;
  profile: AppProfile;
  quota: QuotaSnapshot;
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  daily_quota: number;
  created_at: string;
  updated_at: string;
  today_count: number;
  reserved_count: number;
  total_count: number;
}