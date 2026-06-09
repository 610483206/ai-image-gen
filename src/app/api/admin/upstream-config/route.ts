import { NextRequest } from "next/server";
import { jsonAuthError, requireAdmin } from "@/lib/auth/session";
import {
  getAdminUpstreamConfigSnapshot,
  saveDefaultUpstreamImageConfig,
} from "@/lib/generation/upstream-config";

export const runtime = "edge";

export async function GET() {
  try {
    await requireAdmin();
    const config = await getAdminUpstreamConfigSnapshot();
    return Response.json({ success: true, config });
  } catch (error) {
    return jsonAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const config = await saveDefaultUpstreamImageConfig(body);
    return Response.json({ success: true, config });
  } catch (error) {
    return jsonAuthError(error);
  }
}
