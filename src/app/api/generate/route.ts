import { NextRequest, NextResponse } from "next/server";

/**
 * 后端代理：转发生图请求到 OpenAI 兼容 API
 * 避免浏览器跨域和 APIKey 暴露在 Network 面板中
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      baseURL: rawBaseURL,
      apiKey,
      modelId = "gpt-image-1",
      prompt,
      size,
      quality,
      referenceImages = [],
    } = body;

    console.log("[API] 收到请求:", {
      baseURL: rawBaseURL,
      modelId,
      prompt: prompt?.substring(0, 50) + "...",
      size,
      quality,
      referenceImagesCount: referenceImages.length,
    });

    // 参数校验
    if (!rawBaseURL || !apiKey || !prompt) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数：baseURL、apiKey、prompt" },
        { status: 400 }
      );
    }

    // 移除末尾斜杠
    const baseURL = rawBaseURL.replace(/\/+$/, "");

    // 统一使用 /images/generations 接口
    const targetURL = `${baseURL}/images/generations`;
    console.log("[API] 使用 images/generations 接口");
    console.log("[API] 发送请求到:", targetURL);

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
      // 将 base64 图片转换为 image 字段格式
      const images = referenceImages.map(
        (img: { data: string; name: string; type: string }) => {
          // 从 data URL 中提取纯 base64 数据
          const base64Data = img.data.includes(",")
            ? img.data.split(",")[1]
            : img.data;
          return base64Data;
        }
      );
      requestBody.image = images;
      console.log("[API] 添加参考图数量:", images.length);
    }

    const requestBodyStr = JSON.stringify(requestBody);
    console.log("[API] 请求体大小:", (requestBodyStr.length / 1024 / 1024).toFixed(2), "MB");

    // 添加超时控制（5分钟）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    console.log("[API] 开始发送请求...");

    const response = await fetch(targetURL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBodyStr,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    console.log("[API] 上游 API 响应状态:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("[API] 上游 API 错误:", errorData);
      const errorMessage =
        errorData?.error?.message || `API 请求失败: HTTP ${response.status}`;
      const errorCode = errorData?.error?.code || "api_error";

      return NextResponse.json(
        { success: false, error: errorMessage, code: errorCode },
        { status: response.status }
      );
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
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = buffer.toString("base64");
      } else {
        return NextResponse.json(
          { success: false, error: "API 返回的图片数据格式不正确" },
          { status: 500 }
        );
      }
      revisedPrompt = data.data[0].revised_prompt;
    } else {
      return NextResponse.json(
        { success: false, error: "API 未返回图片数据" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageBase64,
      revisedPrompt,
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
