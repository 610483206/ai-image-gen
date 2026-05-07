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
    const env = process.env as unknown as CloudflareEnv;
    const kv = env.TASKS_KV;

    if (!kv) {
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
    await kv.put(taskId, JSON.stringify(initialTask), { expirationTtl: 3600 }); // 1 小时过期

    // 立即返回任务 ID
    const response = NextResponse.json({
      success: true,
      taskId,
      message: "任务已提交，请轮询查询结果",
    });

    // 使用 waitUntil 在后台继续处理任务
    const processTask = async () => {
      try {
        // 更新状态为处理中
        const processingTask: TaskResult = {
          status: "processing",
          createdAt: initialTask.createdAt,
        };
        await kv.put(taskId, JSON.stringify(processingTask), {
          expirationTtl: 3600,
        });

        // 移除末尾斜杠
        const baseURL = rawBaseURL.replace(/\/+$/, "");
        const targetURL = `${baseURL}/images/generations`;

        // 构建请求体
        const requestBody: Record<string, unknown> = {
          model: modelId,
          prompt,
          n: 1,
          size,
          quality,
          response_format: "b64_json",
        };

        // 如果有参考图，添加到请求体（限制数量以减少请求大小）
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
        }

        const requestBodyStr = JSON.stringify(requestBody);

        // 发送请求到上游 API（不设置超时，让其自然完成）
        const response = await fetch(targetURL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: requestBodyStr,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage =
            errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;

          // 更新任务状态为失败
          const failedTask: TaskResult = {
            status: "failed",
            error: errorMessage,
            createdAt: initialTask.createdAt,
            completedAt: Date.now(),
          };
          await kv.put(taskId, JSON.stringify(failedTask), {
            expirationTtl: 3600,
          });
          return;
        }

        const data = await response.json();

        // 提取图片数据
        let imageBase64: string;
        let revisedPrompt: string | undefined;

        if (data.data && data.data[0]) {
          if (data.data[0].b64_json) {
            imageBase64 = data.data[0].b64_json;
          } else if (data.data[0].url) {
            // 如果返回的是 URL，需要下载并转换为 base64
            const imageResponse = await fetch(data.data[0].url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // Edge Runtime 兼容的 base64 编码
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
        const completedTask: TaskResult = {
          status: "completed",
          imageBase64,
          revisedPrompt,
          createdAt: initialTask.createdAt,
          completedAt: Date.now(),
        };
        await kv.put(taskId, JSON.stringify(completedTask), {
          expirationTtl: 3600,
        });
      } catch (error) {
        console.error("[API] 任务处理错误:", error);

        // 更新任务状态为失败
        const failedTask: TaskResult = {
          status: "failed",
          error: error instanceof Error ? error.message : "服务器内部错误",
          createdAt: initialTask.createdAt,
          completedAt: Date.now(),
        };
        await kv.put(taskId, JSON.stringify(failedTask), {
          expirationTtl: 3600,
        });
      }
    };

    // 在 Node.js 环境中使用 setTimeout 模拟 waitUntil
    // Cloudflare Workers 会自动处理异步任务
    setTimeout(processTask, 0);

    return response;
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
