import { jsonAuthError, requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

function normalizeQuota(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

export async function PATCH(
  request: Request,
  context: { params: { userId: string } }
) {
  try {
    await requireAdmin();
    const { userId } = context.params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.dailyQuota !== undefined || body.daily_quota !== undefined) {
      const quota = normalizeQuota(body.dailyQuota ?? body.daily_quota);
      if (quota === null) {
        return Response.json({ success: false, error: "每日配额必须是非负整数" }, { status: 400 });
      }
      updates.daily_quota = quota;
    }

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "disabled") {
        return Response.json({ success: false, error: "账号状态无效" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: "没有可更新字段" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw new Error("更新用户失败");

    return Response.json({ success: true, user: data });
  } catch (error) {
    return jsonAuthError(error);
  }
}
