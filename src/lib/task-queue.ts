import { toast } from "sonner";

/**
 * 并发任务队列管理器
 *
 * 注意：v2 中此文件保留用于兼容，主要生图逻辑已移至 store 的 sendMessage 方法
 */
export class TaskQueue {
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * 取消所有正在运行的任务
   */
  cancelAll(): void {
    this.abortControllers.forEach((controller) => {
      controller.abort();
    });
    this.abortControllers.clear();
    toast.info("已取消所有任务");
  }
}

// 单例实例
export const taskQueue = new TaskQueue();
