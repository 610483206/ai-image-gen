import { jsonAuthError, requireAdmin } from "@/lib/auth/session";
import { getUpstreamImageConfig } from "@/lib/generation/upstream-config";

export const runtime = "nodejs";

/**
 * 从 URL 中提取 API 根地址
 * - 标准模式: "https://api.openai.com/v1" → "https://api.openai.com/v1"
 * - 完整 URL 模式: "https://api.ai6800.com/v1/media/generate" → "https://api.ai6800.com"
 */
function extractApiRoot(url: string, useFullUrl: boolean): string {
  const cleaned = url.replace(/\/+$/, "");
  if (!useFullUrl) return cleaned;

  try {
    const parsed = new URL(cleaned);
    return parsed.origin;
  } catch {
    return cleaned;
  }
}

/** 测试平台 API 连接 - 管理员专用 */
export async function POST() {
  try {
    await requireAdmin();
  } catch (error) {
    return jsonAuthError(error);
  }

  let config: ReturnType<typeof getUpstreamImageConfig>;
  try {
    config = getUpstreamImageConfig();
  } catch (error) {
    return jsonAuthError(error);
  }

  try {
    const apiRoot = extractApiRoot(config.baseURL, config.useFullUrl);

    let res = await fetch(`${apiRoot}/v1/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      res = await fetch(`${apiRoot}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
    }

    if (res.ok) {
      return Response.json({ success: true });
    }

    const data = await res.json().catch(() => null);
    return Response.json({
      success: false,
      error: data?.error?.message || `HTTP ${res.status}`,
    });
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : "网络错误",
    });
  }
}