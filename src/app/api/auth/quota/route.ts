import { getQuotaSnapshot, jsonAuthError, requireUser } from "@/lib/auth/session";

export const runtime = "edge";

export async function GET() {
  try {
    const { user, profile } = await requireUser();
    const quota = await getQuotaSnapshot(user.id, profile.daily_quota);
    return Response.json({ success: true, quota });
  } catch (error) {
    return jsonAuthError(error);
  }
}
