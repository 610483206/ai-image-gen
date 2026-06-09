import { requireUser, jsonAuthError } from "@/lib/auth/session";

export const runtime = "edge";

export async function GET() {
  try {
    const { profile, quota } = await requireUser();
    return Response.json({ success: true, profile, quota });
  } catch (error) {
    return jsonAuthError(error);
  }
}
