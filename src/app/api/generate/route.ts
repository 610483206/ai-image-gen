import { NextRequest } from "next/server";

export const runtime = "edge";

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

/** 构造 multipart body */
function buildMultipart(fieldName: string, fileName: string, fileBytes: Uint8Array, extraFields?: Record<string, string>): { body: Uint8Array; boundary: string } {
  const boundary = "----Boundary" + Math.random().toString(36).slice(2);
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  // 额外字段
  if (extraFields) {
    for (const [key, val] of Object.entries(extraFields)) {
      parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }
  }

  // 文件字段
  parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`));
  parts.push(fileBytes);
  parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  return { body, boundary };
}

/** 将 base64 图片上传到公网，返回可访问 URL */
async function uploadImageToPublicUrl(base64Data: string): Promise<string> {
  const bytes = decodeBase64(base64Data);
  const { body, boundary } = buildMultipart("file", "image.jpg", bytes);

  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`上传失败: HTTP ${res.status}`);

  const result = JSON.parse(text);
  if (result.status !== "success" || !result.data?.url) {
    throw new Error(`上传返回异常: ${text.slice(0, 200)}`);
  }
  // 页面 URL → 直接下载 URL: http://tmpfiles.org/12345/file.png → http://tmpfiles.org/dl/12345/file.png
  return result.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

/**
 * 流式生图 API
 * 使用 SSE 保持连接活跃，避免 Cloudflare 100 秒超时
 *
 * 同时支持两种协议：
 * - OpenAI 标准：同步返回图片（/v1/images/generations）
 * - 异步任务模式：返回 task_id 后需轮询（/v1/media/generate）
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    baseURL: rawBaseURL,
    apiKey,
    modelId = "gpt-image-2",
    prompt,
    size,
    quality,
    referenceImages = [],
    useFullUrl = false,
  } = body;

  // 参数校验
  if (!rawBaseURL || !apiKey || !prompt) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少必要参数：baseURL、apiKey、prompt" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 创建 SSE 流
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
        const targetURL = useFullUrl ? baseURL : `${baseURL}/images/generations`;

        // 构建请求体
        const requestBody: Record<string, unknown> = {
          model: modelId,
          prompt,
          n: 1,
          size,
          quality,
        };

        // 如果有参考图，先上传到公网获取 URL，再传给 API
        if (referenceImages.length > 0) {
          const limitedImages = referenceImages.slice(0, 3);
          sendEvent({ type: "progress", message: `正在上传 ${limitedImages.length} 张参考图...` });

          const imageUrls: string[] = [];
          for (let idx = 0; idx < limitedImages.length; idx++) {
            const img = limitedImages[idx] as { data: string; name: string; type: string };
            try {
              const url = await uploadImageToPublicUrl(img.data);
              imageUrls.push(url);
              sendEvent({ type: "progress", message: `第 ${idx + 1} 张图上传成功: ${url}` });
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

        // 发送请求到上游 API
        const response = await fetch(targetURL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.msg || errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;
          sendEvent({ type: "error", error: errorMessage });
          return;
        }

        sendEvent({ type: "progress", message: "正在处理返回数据..." });
        const rawData = await response.json();

        // ---- 检测异步任务模式（鸿蒙大模型中心等中转站） ----
        const taskId = rawData.task_id ?? rawData.data?.task_id;
        if (taskId !== undefined) {
          sendEvent({ type: "progress", message: "检测到异步任务，开始轮询结果..." });

          const apiOrigin = useFullUrl ? extractOrigin(rawBaseURL) : baseURL;
          const maxPolls = 120;
          const pollInterval = 3000;

          for (let i = 0; i < maxPolls; i++) {
            await new Promise((r) => setTimeout(r, pollInterval));

            try {
              const statusUrl = `${apiOrigin}/v1/media/status?task_id=${taskId}`;
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
                  sendEvent({ type: "error", error: statusData.error || "任务失败" });
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

                  sendEvent({ type: "complete", success: true, imageBase64 });
                  return;
                }
              }

              const apiProgress = statusData.progress && statusData.progress !== "0" && statusData.progress !== "0%" ? statusData.progress : null;
              const displayProgress = apiProgress || `${Math.round(((i + 1) / maxPolls) * 100)}%`;
              sendEvent({ type: "progress", message: `生成中... ${displayProgress}` });
            } catch {
              sendEvent({ type: "progress", message: "轮询异常，重试中..." });
            }
          }

          sendEvent({ type: "error", error: "任务超时，请重试" });
          return;
        }

        // ---- 标准同步模式（OpenAI 官方及兼容中转站） ----
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
            sendEvent({ type: "error", error: "API 返回的图片数据格式不正确" });
            return;
          }
          revisedPrompt = rawData.data[0].revised_prompt;
        } else {
          sendEvent({ type: "error", error: "API 未返回图片数据" });
          return;
        }

        sendEvent({ type: "complete", success: true, imageBase64, revisedPrompt });
      } catch (error) {
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "服务器内部错误",
        });
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
