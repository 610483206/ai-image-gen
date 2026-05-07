import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * 流式生图 API
 * 使用 SSE 保持连接活跃，避免 Cloudflare 100 秒超时
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
      // 发送 SSE 事件的辅助函数
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 心跳定时器，每 15 秒发送一次心跳
      const heartbeat = setInterval(() => {
        sendEvent({ type: "heartbeat", timestamp: Date.now() });
      }, 15000);

      try {
        // 发送开始事件
        sendEvent({ type: "start", message: "开始处理请求..." });

        // 移除末尾斜杠
        const baseURL = rawBaseURL.replace(/\/+$/, "");
        const targetURL = `${baseURL}/images/generations`;
        sendEvent({ type: "progress", message: "正在调用上游 API..." });

        // 构建请求体
        const requestBody: Record<string, unknown> = {
          model: modelId,
          prompt,
          n: 1,
          size,
          quality,
          response_format: "b64_json",
        };

        // 如果有参考图，添加到请求体
        if (referenceImages.length > 0) {
          const limitedImages = referenceImages.slice(0, 3);
          const images = limitedImages.map(
            (img: { data: string; name: string; type: string }) => {
              const base64Data = img.data.includes(",")
                ? img.data.split(",")[1]
                : img.data;
              return base64Data;
            }
          );
          requestBody.image = images;
          sendEvent({ type: "progress", message: `已添加 ${images.length} 张参考图` });
        }

        sendEvent({ type: "progress", message: "等待上游 API 响应..." });

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
            errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;
          sendEvent({ type: "error", error: errorMessage });
          controller.close();
          return;
        }

        sendEvent({ type: "progress", message: "正在处理返回数据..." });
        const data = await response.json();

        // 提取图片数据
        let imageBase64: string;
        let revisedPrompt: string | undefined;

        if (data.data && data.data[0]) {
          if (data.data[0].b64_json) {
            imageBase64 = data.data[0].b64_json;
          } else if (data.data[0].url) {
            sendEvent({ type: "progress", message: "正在下载图片..." });
            const imageResponse = await fetch(data.data[0].url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            imageBase64 = btoa(binary);
          } else {
            sendEvent({ type: "error", error: "API 返回的图片数据格式不正确" });
            controller.close();
            return;
          }
          revisedPrompt = data.data[0].revised_prompt;
        } else {
          sendEvent({ type: "error", error: "API 未返回图片数据" });
          controller.close();
          return;
        }

        // 发送完成事件
        sendEvent({
          type: "complete",
          success: true,
          imageBase64,
          revisedPrompt,
        });
      } catch (error) {
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "服务器内部错误",
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
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
