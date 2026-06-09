import { NextRequest } from "next/server";
import { jsonAuthError, requireAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminUserRow } from "@/lib/auth/types";
import {
  getAdminUpstreamConfigSnapshot,
  saveDefaultUpstreamImageConfig,
} from "@/lib/generation/upstream-config";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    if (request.nextUrl.searchParams.get("resource") === "upstream-config") {
      const config = await getAdminUpstreamConfigSnapshot();
      return Response.json({ success: true, config });
    }

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

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    if (request.nextUrl.searchParams.get("resource") !== "upstream-config") {
      return Response.json({ success: false, error: "不支持的管理员资源" }, { status: 404 });
    }

    const body = await request.json();
    const config = await saveDefaultUpstreamImageConfig(body);
    return Response.json({ success: true, config });
  } catch (error) {
    return jsonAuthError(error);
  }
}
