import { NextRequest } from "next/server";
import { jsonAuthError, requireUser } from "@/lib/auth/session";
import {
  completeGenerationQuota,
  markGenerationUpstreamTask,
  releaseGenerationQuota,
  reserveGenerationQuota,
} from "@/lib/generation/quota";
import { getUpstreamImageConfig } from "@/lib/generation/upstream-config";

export const runtime = "nodejs";

interface Env {
  IMAGES_BUCKET: KVNamespace;
}

/** 从完整 URL 中提取 origin（域名+协议） */
function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

/** 解码 base64 为 Uint8Array */
function decodeBase64(base64Data: string): Uint8Array {
  const base64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  if (!base64 || base64.length < 100) throw new Error("图片数据无效或过小");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** 将 base64 图片存入 Cloudflare KV，返回公网 URL */
async function uploadImageToKV(
  base64Data: string,
  kv: KVNamespace | undefined,
  origin: string
): Promise<string> {
  const bytes = decodeBase64(base64Data);

  if (kv) {
    const key = `img/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (kv as any).put(key, arrayBuffer, { expirationTtl: 600 });
    return `${origin}/api/image/${key}`;
  }

  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const formData = new FormData();
  formData.append("file", new Blob([arrayBuffer], { type: "image/jpeg" }), "image.jpg");
  const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: formData });
  const text = await res.text();
  if (!res.ok) throw new Error(`上传失败: HTTP ${res.status}`);
  const result = JSON.parse(text);
  if (result.status !== "success" || !result.data?.url) throw new Error(`上传异常: ${text.slice(0, 200)}`);
  return result.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

/**
 * 流式生图 API
 * 使用 SSE 保持连接活跃，避免 Cloudflare 100 秒超时
 */
export async function POST(request: NextRequest, context?: { env?: Env }) {
  let authContext: Awaited<ReturnType<typeof requireUser>>;
  let body: Record<string, unknown>;

  try {
    authContext = await requireUser();
    body = await request.json();
  } catch (error) {
    return jsonAuthError(error);
  }

  const IMAGES_BUCKET = context?.env?.IMAGES_BUCKET;
  let upstreamConfig: ReturnType<typeof getUpstreamImageConfig>;
  try {
    upstreamConfig = getUpstreamImageConfig();
  } catch (error) {
    return jsonAuthError(error);
  }
  const {
    baseURL: rawBaseURL,
    apiKey,
    modelId,
    useFullUrl,
  } = upstreamConfig;

  const {
    clientTaskId,
    prompt,
    size = "1024x1024",
    quality = "auto",
    referenceImages = [],
  } = body;

  if (typeof clientTaskId !== "string" || !clientTaskId || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json(
      { success: false, error: "缺少必要参数：clientTaskId、prompt" },
      { status: 400 }
    );
  }

  const imageRefs = Array.isArray(referenceImages) ? referenceImages : [];

  try {
    await reserveGenerationQuota({
      userId: authContext.user.id,
      clientTaskId,
      prompt,
      size: String(size),
      quality: String(quality),
    });
  } catch (error) {
    return jsonAuthError(error);
  }

  let quotaReserved = true;
  const releaseReservedQuota = async (message: string) => {
    if (!quotaReserved) return;
    quotaReserved = false;
    await releaseGenerationQuota(authContext.user.id, clientTaskId, message).catch(() => null);
  };

  const completeReservedQuota = async (upstreamTaskId?: string) => {
    if (!quotaReserved) return;
    await completeGenerationQuota(authContext.user.id, clientTaskId, upstreamTaskId);
    quotaReserved = false;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const sendEvent = (data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const heartbeat = setInterval(() => {
        sendEvent({ type: "heartbeat", timestamp: Date.now() });
      }, 15000);

      try {
        sendEvent({ type: "start", message: "开始处理请求..." });

        const baseURL = rawBaseURL.replace(/\/+$/, "");
        const hasRefImages = imageRefs.length > 0;

        let response: Response;

        if (!useFullUrl && hasRefImages) {
          const targetURL = `${baseURL}/images/edits`;

          sendEvent({ type: "progress", message: "正在准备参考图..." });

          const formData = new FormData();
          formData.append("prompt", prompt);
          formData.append("model", modelId);
          if (size) formData.append("size", String(size));
          if (quality) formData.append("quality", String(quality));
          formData.append("n", "1");

          const limitedImages = imageRefs.slice(0, 3);
          for (let idx = 0; idx < limitedImages.length; idx++) {
            const img = limitedImages[idx] as { data: string; name: string; type: string };
            try {
              const bytes = decodeBase64(img.data);
              const mimeType = img.type || "image/png";
              const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";
              const fileName = img.name || `image-${idx + 1}${ext}`;
              const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
              const blob = new Blob([arrayBuffer], { type: mimeType });
              const fieldName = limitedImages.length === 1 ? "image" : "image[]";
              formData.append(fieldName, blob, fileName);
              sendEvent({ type: "progress", message: `第 ${idx + 1} 张参考图已准备` });
            } catch (imgErr) {
              const errMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
              sendEvent({ type: "progress", message: `第 ${idx + 1} 张参考图处理失败: ${errMsg}` });
            }
          }

          sendEvent({ type: "progress", message: "正在调用上游 API（图片编辑模式）..." });

          response = await fetch(targetURL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          });
        } else {
          const targetURL = useFullUrl ? baseURL : `${baseURL}/images/generations`;

          const requestBody: Record<string, unknown> = {
            model: modelId,
            prompt,
            n: 1,
            size,
            quality,
          };

          if (useFullUrl && hasRefImages) {
            const limitedImages = imageRefs.slice(0, 3);
            sendEvent({ type: "progress", message: `正在上传 ${limitedImages.length} 张参考图...` });

            const imageUrls: string[] = [];
            const requestOrigin = new URL(request.url).origin;
            for (let idx = 0; idx < limitedImages.length; idx++) {
              const img = limitedImages[idx] as { data: string; name: string; type: string };
              try {
                const url = await uploadImageToKV(img.data, IMAGES_BUCKET, requestOrigin);
                imageUrls.push(url);
                sendEvent({ type: "progress", message: `第 ${idx + 1} 张图上传成功` });
              } catch (uploadErr) {
                const errMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                sendEvent({ type: "progress", message: `第 ${idx + 1} 张图上传失败: ${errMsg}` });
              }
            }

            if (imageUrls.length > 0) {
              requestBody.images = imageUrls;
              sendEvent({ type: "progress", message: `已上传 ${imageUrls.length} 张参考图` });
            } else {
              sendEvent({ type: "progress", message: "所有参考图上传失败，将仅使用文本生成" });
            }
          }

          sendEvent({ type: "progress", message: "正在调用上游 API..." });

          response = await fetch(targetURL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.msg || errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;
          await releaseReservedQuota(errorMessage);
          sendEvent({ type: "error", error: errorMessage });
          return;
        }

        sendEvent({ type: "progress", message: "正在处理返回数据..." });
        const rawData = await response.json();

        const taskId = rawData.task_id ?? rawData.data?.task_id;
        if (taskId !== undefined) {
          const upstreamTaskId = String(taskId);
          await markGenerationUpstreamTask(authContext.user.id, clientTaskId, upstreamTaskId);
          sendEvent({ type: "progress", message: "检测到异步任务，开始轮询结果..." });

          const apiOrigin = useFullUrl ? extractOrigin(rawBaseURL) : baseURL;
          const maxPolls = 48;
          const pollInterval = 5000;

          for (let i = 0; i < maxPolls; i++) {
            await new Promise((r) => setTimeout(r, pollInterval));

            try {
              const statusUrl = `${apiOrigin}/v1/media/status?task_id=${upstreamTaskId}`;
              const statusRes = await fetch(statusUrl, {
                headers: { Authorization: `Bearer ${apiKey}` },
              });

              if (!statusRes.ok) {
                sendEvent({ type: "progress", message: `轮询失败(${statusRes.status})，重试中...` });
                continue;
              }

              const statusData = await statusRes.json();

              if (statusData.is_final) {
                if (statusData.state === "failed") {
                  const errorMessage = statusData.error || "任务失败";
                  await releaseReservedQuota(errorMessage);
                  sendEvent({ type: "error", error: errorMessage });
                  return;
                }

                if (statusData.state === "success" && statusData.result_url) {
                  sendEvent({ type: "progress", message: "正在下载图片..." });
                  const imageResponse = await fetch(statusData.result_url);
                  const arrayBuffer = await imageResponse.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);
                  let binary = "";
                  for (let j = 0; j < uint8Array.length; j++) {
                    binary += String.fromCharCode(uint8Array[j]);
                  }
                  const imageBase64 = btoa(binary);

                  await completeReservedQuota(upstreamTaskId);
                  sendEvent({ type: "complete", success: true, imageBase64 });
                  return;
                }
              }

              const apiProgress = statusData.progress && statusData.progress !== "0" && statusData.progress !== "0%" ? statusData.progress : null;
              const displayProgress = apiProgress || `${Math.round(((i + 1) / maxPolls) * 100)}%`;
              sendEvent({ type: "progress", message: `生成中... ${displayProgress}` });
            } catch (pollErr) {
              const pollErrMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
              sendEvent({ type: "progress", message: `轮询异常: ${pollErrMsg}` });
            }
          }

          sendEvent({ type: "error", error: "任务超时，请稍后重试", taskId: upstreamTaskId });
          return;
        }

        let imageBase64: string;
        let revisedPrompt: string | undefined;

        if (rawData.data && rawData.data[0]) {
          if (rawData.data[0].b64_json) {
            imageBase64 = rawData.data[0].b64_json;
          } else if (rawData.data[0].url) {
            sendEvent({ type: "progress", message: "正在下载图片..." });
            const imageResponse = await fetch(rawData.data[0].url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let j = 0; j < uint8Array.length; j++) {
              binary += String.fromCharCode(uint8Array[j]);
            }
            imageBase64 = btoa(binary);
          } else {
            await releaseReservedQuota("API 返回的图片数据格式不正确");
            sendEvent({ type: "error", error: "API 返回的图片数据格式不正确" });
            return;
          }
          revisedPrompt = rawData.data[0].revised_prompt;
        } else {
          await releaseReservedQuota("API 未返回图片数据");
          sendEvent({ type: "error", error: "API 未返回图片数据" });
          return;
        }

        await completeReservedQuota();
        sendEvent({ type: "complete", success: true, imageBase64, revisedPrompt });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "服务器内部错误";
        await releaseReservedQuota(errorMessage);
        sendEvent({ type: "error", error: errorMessage });
      } finally {
        clearInterval(heartbeat);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}