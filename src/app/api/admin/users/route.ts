import { jsonAuthError, requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminUserRow } from "@/lib/auth/types";

export const runtime = "edge";

export async function GET() {
  try {
    await requireAdmin();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("admin_user_overview")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error("读取用户列表失败");

    return Response.json({ success: true, users: (data || []) as AdminUserRow[] });
  } catch (error) {
    return jsonAuthError(error);
  }
}
