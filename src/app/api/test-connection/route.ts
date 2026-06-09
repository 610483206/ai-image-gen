import { NextRequest } from "next/server";
import { jsonAuthError, requireAdmin, requireUser } from "@/lib/auth/session";
import { getDefaultUpstreamImageConfig, resolveUpstreamImageConfig } from "@/lib/generation/upstream-config";

export const runtime = "edge";

/**
 * 从 URL 中提取 API 根地址
 * - 标准模式: "https://api.openai.com/v1" -> "https://api.openai.com/v1"
 * - 完整 URL 模式: "https://api.ai6800.com/v1/media/generate" -> "https://api.ai6800.com"
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

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function testConfig(config: Awaited<ReturnType<typeof getDefaultUpstreamImageConfig>>) {
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
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const userConfig = body.upstreamConfig ?? (body.baseURL || body.apiKey ? body : undefined);

  try {
    if (userConfig) {
      await requireUser();
      return await testConfig(await resolveUpstreamImageConfig(userConfig));
    }

    await requireAdmin();
    return await testConfig(await getDefaultUpstreamImageConfig());
  } catch (error) {
    return jsonAuthError(error);
  }
}
