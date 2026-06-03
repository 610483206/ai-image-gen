import { NextRequest } from "next/server";

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
    // 完整 URL 模式下，只取 origin 作为根地址
    return parsed.origin;
  } catch {
    return cleaned;
  }
}

/** 测试 API 连接 - 通过服务端代理避免 CORS */
export async function POST(request: NextRequest) {
  const { baseURL, apiKey, useFullUrl = false } = await request.json();

  if (!baseURL || !apiKey) {
    return Response.json(
      { success: false, error: "缺少 baseURL 或 apiKey" },
      { status: 400 }
    );
  }

  try {
    const apiRoot = extractApiRoot(baseURL, useFullUrl);

    // 尝试标准 OpenAI /models 端点
    let res = await fetch(`${apiRoot}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // 如果 /v1/models 失败，尝试根路径 /models（部分中转站直接挂载在根路径）
    if (!res.ok) {
      res = await fetch(`${apiRoot}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    }

    if (res.ok) {
      return Response.json({ success: true });
    } else {
      const data = await res.json().catch(() => null);
      return Response.json({
        success: false,
        error: data?.error?.message || `HTTP ${res.status}`,
      });
    }
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : "网络错误",
    });
  }
}
