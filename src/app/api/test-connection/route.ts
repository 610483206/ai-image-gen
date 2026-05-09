import { NextRequest } from "next/server";

export const runtime = "edge";

/** 测试 API 连接 - 通过服务端代理避免 CORS */
export async function POST(request: NextRequest) {
  const { baseURL, apiKey } = await request.json();

  if (!baseURL || !apiKey) {
    return Response.json(
      { success: false, error: "缺少 baseURL 或 apiKey" },
      { status: 400 }
    );
  }

  try {
    const url = `${baseURL.replace(/\/+$/, "")}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

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
