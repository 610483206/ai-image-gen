import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface TaskResult {
  status: "pending" | "processing" | "completed" | "failed";
  imageBase64?: string;
  revisedPrompt?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

// Cloudflare Workers 全局类型
declare global {
  // eslint-disable-next-line no-var
  var __CLOUDFLARE_WAIT_UNTIL__: ((promise: Promise<unknown>) => void) | undefined;
}

/**
 * 异步生图 API
 * 接收请求后立即返回任务 ID，后台处理生图任务
 * 前端通过轮询 /api/task/[taskId] 获取结果
 */
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { success: false, error: "缺少必要参数：baseURL、apiKey、prompt" },
        { status: 400 }
      );
    }

    // 生成任务 ID
    const taskId = crypto.randomUUID();

    // 获取 KV 绑定
    // Cloudflare Pages 通过 process.env 提供绑定
    const kv = process.env.TASKS_KV as unknown as KVNamespace;

    if (!kv) {
      console.error("[API] KV 绑定未找到");
      return NextResponse.json(
        { success: false, error: "KV 存储未配置" },
        { status: 500 }
      );
    }

    // 初始化任务状态
    const initialTask: TaskResult = {
      status: "pending",
      createdAt: Date.now(),
    };
    await kv.put(taskId, JSON.stringify(initialTask), { expirationTtl: 3600 });

    // 后台处理任务的函数
    const processTask = async () => {
      try {
        console.log("[API] 开始处理任务:", taskId);

        // 更新状态为处理中
        const processingTask: TaskResult = {
          status: "processing",
          createdAt: initialTask.createdAt,
        };
        await kv.put(taskId, JSON.stringify(processingTask), { expirationTtl: 3600 });

        // 移除末尾斜杠
        const baseURL = rawBaseURL.replace(/\/+$/, "");
        const targetURL = `${baseURL}/images/generations`;
        console.log("[API] 请求上游 API:", targetURL);

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
          console.log("[API] 参考图数量:", images.length);
        }

        const requestBodyStr = JSON.stringify(requestBody);
        console.log("[API] 请求体大小:", (requestBodyStr.length / 1024 / 1024).toFixed(2), "MB");

        // 发送请求到上游 API
        const response = await fetch(targetURL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: requestBodyStr,
        });

        console.log("[API] 上游响应状态:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;
          console.error("[API] 上游错误:", errorMessage);

          await kv.put(taskId, JSON.stringify({
            status: "failed",
            error: errorMessage,
            createdAt: initialTask.createdAt,
            completedAt: Date.now(),
          }), { expirationTtl: 3600 });
          return;
        }

        const data = await response.json();
        console.log("[API] 收到上游响应");

        // 提取图片数据
        let imageBase64: string;
        let revisedPrompt: string | undefined;

        if (data.data && data.data[0]) {
          if (data.data[0].b64_json) {
            imageBase64 = data.data[0].b64_json;
          } else if (data.data[0].url) {
            const imageResponse = await fetch(data.data[0].url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            imageBase64 = btoa(binary);
          } else {
            throw new Error("API 返回的图片数据格式不正确");
          }
          revisedPrompt = data.data[0].revised_prompt;
        } else {
          throw new Error("API 未返回图片数据");
        }

        // 更新任务状态为完成
        console.log("[API] 任务完成:", taskId);
        await kv.put(taskId, JSON.stringify({
          status: "completed",
          imageBase64,
          revisedPrompt,
          createdAt: initialTask.createdAt,
          completedAt: Date.now(),
        }), { expirationTtl: 3600 });
      } catch (error) {
        console.error("[API] 任务处理错误:", error);
        await kv.put(taskId, JSON.stringify({
          status: "failed",
          error: error instanceof Error ? error.message : "服务器内部错误",
          createdAt: initialTask.createdAt,
          completedAt: Date.now(),
        }), { expirationTtl: 3600 });
      }
    };

    // 使用 waitUntil 保持 Worker 运行直到任务完成
    // Cloudflare Workers 通过 globalThis 提供 waitUntil
    const waitUntil = (globalThis as Record<string, unknown>).__CLOUDFLARE_WAIT_UNTIL__
      || (globalThis as Record<string, unknown>).waitUntil;

    if (typeof waitUntil === "function") {
      console.log("[API] 使用 waitUntil 执行后台任务");
      waitUntil(processTask());
    } else {
      console.log("[API] waitUntil 不可用，使用 setTimeout");
      // 回退方案：使用 setTimeout（可能不完全可靠）
      setTimeout(() => {
        processTask().catch(console.error);
      }, 0);
    }

    // 立即返回任务 ID
    return NextResponse.json({
      success: true,
      taskId,
      message: "任务已提交，请轮询查询结果",
    });
  } catch (error) {
    console.error("[API] 生图代理错误:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "服务器内部错误",
      },
      { status: 500 }
    );
  }
}
