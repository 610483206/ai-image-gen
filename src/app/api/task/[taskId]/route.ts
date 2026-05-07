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
 * 查询任务状态 API
 * 前端轮询此接口获取生图任务结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "缺少任务 ID" },
        { status: 400 }
      );
    }

    // 获取 KV 绑定
    const kv = process.env.TASKS_KV as unknown as KVNamespace;

    if (!kv) {
      console.error("[API] KV 绑定未找到");
      return NextResponse.json(
        { success: false, error: "KV 存储未配置" },
        { status: 500 }
      );
    }

    // 从 KV 获取任务状态
    const taskData = await kv.get(taskId);

    if (!taskData) {
      return NextResponse.json(
        { success: false, error: "任务不存在或已过期" },
        { status: 404 }
      );
    }

    const task: TaskResult = JSON.parse(taskData);

    // 根据任务状态返回不同的响应
    if (task.status === "completed") {
      return NextResponse.json({
        success: true,
        status: "completed",
        imageBase64: task.imageBase64,
        revisedPrompt: task.revisedPrompt,
        processingTime: task.completedAt
          ? task.completedAt - task.createdAt
          : undefined,
      });
    } else if (task.status === "failed") {
      return NextResponse.json({
        success: false,
        status: "failed",
        error: task.error,
      });
    } else {
      // pending 或 processing
      return NextResponse.json({
        success: true,
        status: task.status,
        message:
          task.status === "pending" ? "任务等待处理中..." : "任务处理中...",
      });
    }
  } catch (error) {
    console.error("[API] 查询任务状态错误:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "服务器内部错误",
      },
      { status: 500 }
    );
  }
}
