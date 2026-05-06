import { type GenerateTask, useAppStore, getDecodedApiKey } from "@/store/use-app-store";
import { saveImageRecord } from "@/lib/db";
import { toast } from "sonner";

/**
 * 并发任务队列管理器
 * 使用 Promise.allSettled 管理并发请求，每个任务独立状态追踪
 */
export class TaskQueue {
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * 批量创建并执行生图任务
   * @param count 任务数量
   * @param prompt 提示词
   * @param size 图片尺寸
   * @param quality 画质
   * @param referenceImages 参考图片（可选）
   */
  async executeBatch(
    count: number,
    prompt: string,
    size: string,
    quality: string,
    referenceImages?: { file: File; preview: string }[]
  ): Promise<void> {
    const store = useAppStore.getState();
    const apiKey = getDecodedApiKey();
    const baseURL = store.apiConfig.baseURL;
    const modelId = store.apiConfig.modelId || "gpt-image-1";

    console.log("[TaskQueue] 配置信息:", {
      baseURL,
      modelId,
      size,
      quality,
      hasReferenceImages: referenceImages && referenceImages.length > 0,
    });

    if (!apiKey) {
      toast.error("请先在设置中配置 API Key");
      store.setSettingsOpen(true);
      return;
    }

    if (!modelId) {
      toast.error("请先在设置中配置模型 ID");
      store.setSettingsOpen(true);
      return;
    }

    // 创建任务列表
    const tasks: GenerateTask[] = Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      prompt,
      status: "pending" as const,
      createdAt: Date.now(),
    }));

    // 添加任务到 store
    for (const task of tasks) {
      store.addTask(task);
    }

    // 并发执行任务
    const promises = tasks.map((task) =>
      this.executeSingleTask(
        task,
        baseURL,
        apiKey,
        modelId,
        prompt,
        size,
        quality,
        referenceImages
      )
    );

    await Promise.allSettled(promises);
  }

  /**
   * 执行单个生图任务
   */
  private async executeSingleTask(
    task: GenerateTask,
    baseURL: string,
    apiKey: string,
    modelId: string,
    prompt: string,
    size: string,
    quality: string,
    referenceImages?: { file: File; preview: string }[]
  ): Promise<void> {
    const store = useAppStore.getState();
    const abortController = new AbortController();
    this.abortControllers.set(task.id, abortController);

    // 更新任务状态为运行中
    store.updateTask(task.id, {
      status: "running",
      startedAt: Date.now(),
      abortController,
    });

    try {
      let response: Response;

      console.log("[Task] 开始执行任务:", {
        taskId: task.id,
        hasReferenceImages: referenceImages && referenceImages.length > 0,
        referenceImagesCount: referenceImages?.length || 0,
      });

      // 将参考图转换为 base64
      const referenceImagesBase64: { data: string; name: string; type: string }[] = [];
      if (referenceImages && referenceImages.length > 0) {
        for (const img of referenceImages) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(img.file);
          });
          referenceImagesBase64.push({
            data: base64,
            name: img.file.name || "image.png",
            type: img.file.type || "image/png",
          });
        }
      }

      // 统一使用 JSON 格式
      console.log("[Task] 发送 JSON 请求到 /api/generate");
      response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseURL,
          apiKey,
          modelId,
          prompt,
          size,
          quality,
          referenceImages: referenceImagesBase64,
        }),
        signal: abortController.signal,
      });

      const data = await response.json();

      if (data.success) {
        store.updateTask(task.id, {
          status: "success",
          imageBase64: data.imageBase64,
          revisedPrompt: data.revisedPrompt,
          completedAt: Date.now(),
        });

        // 保存到 IndexedDB
        try {
          await saveImageRecord(
            task.id,
            prompt,
            data.imageBase64,
            data.revisedPrompt,
            size,
            quality
          );
        } catch (dbError) {
          console.error("保存到 IndexedDB 失败:", dbError);
        }
      } else {
        // 检查是否是内容审核失败
        const isContentPolicyViolation =
          data.code === "content_policy_violation";

        if (isContentPolicyViolation && store.riskInsurance) {
          // 风控保险开启时，静默处理审核失败
          store.updateTask(task.id, {
            status: "failed",
            error: "内容审核未通过（风控保险已拦截）",
            completedAt: Date.now(),
          });
        } else {
          store.updateTask(task.id, {
            status: "failed",
            error: data.error || "生成失败",
            completedAt: Date.now(),
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        store.updateTask(task.id, {
          status: "failed",
          error: "已取消",
          completedAt: Date.now(),
        });
      } else {
        store.updateTask(task.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "请求失败",
          completedAt: Date.now(),
        });
      }
    } finally {
      this.abortControllers.delete(task.id);
    }
  }

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

  /**
   * 重试单个失败任务
   */
  async retryTask(taskId: string): Promise<void> {
    const store = useAppStore.getState();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== "failed") return;

    const apiKey = getDecodedApiKey();
    const baseURL = store.apiConfig.baseURL;
    const modelId = store.apiConfig.modelId;

    if (!apiKey) {
      toast.error("请先在设置中配置 API Key");
      store.setSettingsOpen(true);
      return;
    }

    // 重置任务状态
    store.updateTask(taskId, { status: "pending", error: undefined });

    const { selectedRatio, customRatio, quality, referenceImages } = store;
    const { getImageSize } = await import("@/store/use-app-store");
    const size = getImageSize(selectedRatio, customRatio);

    await this.executeSingleTask(
      { ...task, status: "pending" },
      baseURL,
      apiKey,
      modelId,
      task.prompt,
      size,
      quality,
      referenceImages.length > 0 ? referenceImages : undefined
    );
  }
}

// 单例实例
export const taskQueue = new TaskQueue();
