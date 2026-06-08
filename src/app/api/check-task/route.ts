import { NextRequest } from "next/server";
import { jsonAuthError, requireUser } from "@/lib/auth/session";
import { completeGenerationQuota, releaseGenerationQuota } from "@/lib/generation/quota";
import { getUpstreamImageConfig } from "@/lib/generation/upstream-config";

export const runtime = "nodejs";

/** 从完整 URL 中提取 origin（域名+协议） */
function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

/**
 * 检查异步任务状态
 * 用于超时后重新检查任务结果，避免重复生成浪费 API 调用
 */
export async function POST(request: NextRequest) {
  let authContext: Awaited<ReturnType<typeof requireUser>>;
  let body: Record<string, unknown>;

  try {
    authContext = await requireUser();
    body = await request.json();
  } catch (error) {
    return jsonAuthError(error);
  }

  let upstreamConfig: ReturnType<typeof getUpstreamImageConfig>;
  try {
    upstreamConfig = getUpstreamImageConfig();
  } catch (error) {
    return jsonAuthError(error);
  }

  const { clientTaskId, taskId } = body;

  if (typeof clientTaskId !== "string" || !clientTaskId || typeof taskId !== "string" || !taskId) {
    return Response.json({ success: false, error: "缺少必要参数" }, { status: 400 });
  }

  try {
    const baseURL = upstreamConfig.baseURL.replace(/\/+$/, "");
    const apiOrigin = upstreamConfig.useFullUrl ? extractOrigin(upstreamConfig.baseURL) : baseURL;
    const statusUrl = `${apiOrigin}/v1/media/status?task_id=${taskId}`;

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${upstreamConfig.apiKey}` },
    });

    if (!statusRes.ok) {
      return Response.json({
        success: false,
        error: `查询失败: HTTP ${statusRes.status}`,
      });
    }

    const statusData = await statusRes.json();

    if (statusData.is_final) {
      if (statusData.state === "failed") {
        const errorMessage = statusData.error || "任务失败";
        await releaseGenerationQuota(authContext.user.id, clientTaskId, errorMessage);
        return Response.json({
          success: false,
          error: errorMessage,
        });
      }

      if (statusData.state === "success" && statusData.result_url) {
        const imageResponse = await fetch(statusData.result_url);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let j = 0; j < uint8Array.length; j++) {
          binary += String.fromCharCode(uint8Array[j]);
        }
        const imageBase64 = btoa(binary);

        await completeGenerationQuota(authContext.user.id, clientTaskId, taskId);

        return Response.json({
          success: true,
          imageBase64,
        });
      }
    }

    const progress = statusData.progress && statusData.progress !== "0" && statusData.progress !== "0%"
      ? statusData.progress
      : null;

    return Response.json({
      success: false,
      error: progress ? `任务进行中: ${progress}` : "任务仍在处理中，请稍后再试",
      inProgress: true,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "查询失败",
    });
  }
}