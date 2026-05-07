import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  saveConversation,
  deleteConversation as dbDeleteConversation,
  getConversations,
  saveImageRecord,
  cleanupAllExpired,
  type ConversationRecord,
} from "@/lib/db";

// ==================== 类型定义 ====================

/** API 配置 */
interface ApiConfig {
  baseURL: string;
  apiKey: string;
  modelId: string;
}

/** 画质等级 */
export type QualityLevel = "low" | "medium" | "high" | "auto";

/** 图片尺寸 */
export type ImageSize =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "2048x2048"
  | "2048x1152"
  | "1152x2048"
  | "3840x2160"
  | "2160x3840"
  | "auto";

/** 比例预设 */
export interface AspectRatioPreset {
  label: string;
  value: string;
  size: ImageSize;
}

/** 比例预设列表 */
export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { label: "自动", value: "auto", size: "auto" },
  { label: "1:1 (1K)", value: "1:1", size: "1024x1024" },
  { label: "1:1 (2K)", value: "1:1-2k", size: "2048x2048" },
  { label: "3:2", value: "3:2", size: "1536x1024" },
  { label: "2:3", value: "2:3", size: "1024x1536" },
  { label: "16:9", value: "16:9", size: "2048x1152" },
  { label: "9:16", value: "9:16", size: "1152x2048" },
  { label: "16:9 (4K)", value: "16:9-4k", size: "3840x2160" },
  { label: "9:16 (4K)", value: "9:16-4k", size: "2160x3840" },
  { label: "4:3", value: "4:3", size: "1536x1024" },
  { label: "3:4", value: "3:4", size: "1024x1536" },
];

/** 画质选项 */
export const QUALITY_OPTIONS = [
  { label: "低质量", value: "low" as QualityLevel },
  { label: "中等", value: "medium" as QualityLevel },
  { label: "高质量", value: "high" as QualityLevel },
  { label: "自动", value: "auto" as QualityLevel },
];

/** 参考图片（内存态，含 File 对象） */
export interface ReferenceImage {
  id: string;
  file: File;
  preview: string; // base64 data URL
}

/** 参考图片（持久化态，仅含数据） */
export interface ImageRef {
  id: string;
  name: string;
  data: string; // base64 data URL
}

/** 任务状态 */
export type TaskStatus = "pending" | "running" | "success" | "failed";

/** 生图任务 */
export interface GenerateTask {
  id: string;
  prompt: string;
  status: TaskStatus;
  imageBase64?: string;
  revisedPrompt?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  abortController?: AbortController;
}

/** 会话 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

/** 消息 */
export type Message =
  | {
      id: string;
      role: "user";
      prompt: string;
      referenceImages: ImageRef[];
      params: MessageParams;
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      replyTo: string;
      tasks: GenerateTask[];
      params: MessageParams;
      createdAt: number;
      durationMs?: number;
    };

/** 消息参数 */
export interface MessageParams {
  size: string;
  quality: QualityLevel;
  concurrency: number;
  riskGuard: boolean;
}

/** 输入区草稿 */
export interface Draft {
  prompt: string;
  referenceImages: ReferenceImage[];
  selectedRatio: string;
  customRatio: string;
  quality: QualityLevel;
  concurrency: number;
  riskGuard: boolean;
}

// ==================== 工具函数 ====================

/** API Key 混淆存储：简单 Base64 编码 */
function encodeApiKey(key: string): string {
  return typeof window !== "undefined" ? btoa(key) : key;
}

/** API Key 反混淆 */
function decodeApiKey(encoded: string): string {
  try {
    return typeof window !== "undefined" ? atob(encoded) : encoded;
  } catch {
    return encoded;
  }
}

/** 生成唯一 ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 轮询任务状态 */
async function pollTaskStatus(
  taskId: string,
  signal?: AbortSignal
): Promise<{ success: boolean; imageBase64?: string; revisedPrompt?: string; error?: string }> {
  const maxAttempts = 120; // 最多轮询 120 次（约 10 分钟）
  const pollInterval = 5000; // 每 5 秒轮询一次

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error("已取消");
    }

    try {
      const response = await fetch(`/api/task/${taskId}`, { signal });
      const result = await response.json();

      if (result.status === "completed") {
        return {
          success: true,
          imageBase64: result.imageBase64,
          revisedPrompt: result.revisedPrompt,
        };
      } else if (result.status === "failed") {
        return {
          success: false,
          error: result.error || "任务失败",
        };
      }

      // 继续轮询（pending 或 processing）
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch {
      if (signal?.aborted) {
        throw new Error("已取消");
      }
      // 网络错误，继续重试
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  return {
    success: false,
    error: "任务超时，请重试",
  };
}

/** 从首条用户消息生成会话标题 */
function generateTitle(prompt: string): string {
  const cleaned = prompt.replace(/\n/g, " ").trim();
  if (cleaned.length <= 20) return cleaned || "新会话";
  return cleaned.slice(0, 20) + "…";
}

/** 获取实际图片尺寸 */
export function getImageSize(
  ratio: string,
  customRatio: string
): ImageSize {
  if (ratio === "auto") return "auto";

  const preset = ASPECT_RATIO_PRESETS.find((p) => p.value === ratio);
  if (preset) {
    return preset.size;
  }

  // 自定义比例处理
  if (ratio === "custom" && customRatio) {
    const parts = customRatio.split(":");
    if (parts.length === 2) {
      const w = parseInt(parts[0]);
      const h = parseInt(parts[1]);
      if (w > 0 && h > 0) {
        const aspect = w / h;
        if (aspect > 1.5) return "3840x2160";
        if (aspect > 1.2) return "2048x1152";
        if (aspect < 0.67) return "2160x3840";
        if (aspect < 0.8) return "1152x2048";
        return "2048x2048";
      }
    }
  }

  return "1024x1024";
}

// ==================== Store 定义 ====================

/** 应用状态 */
interface AppState {
  // ===== 配置（持久化）=====
  apiConfig: ApiConfig;
  setApiConfig: (config: Partial<ApiConfig>) => void;

  // ===== 会话列表（持久化到 IndexedDB）=====
  conversations: Conversation[];
  currentConversationId: string | null;

  // ===== 输入区草稿（不持久化）=====
  draft: Draft;
  setDraftPrompt: (prompt: string) => void;
  addDraftReferenceImage: (image: ReferenceImage) => void;
  removeDraftReferenceImage: (id: string) => void;
  clearDraftReferenceImages: () => void;
  setDraftRatio: (ratio: string) => void;
  setDraftCustomRatio: (ratio: string) => void;
  setDraftQuality: (quality: QualityLevel) => void;
  setDraftConcurrency: (concurrency: number) => void;
  setDraftRiskGuard: (enabled: boolean) => void;
  resetDraft: () => void;

  // ===== 会话管理 =====
  newConversation: () => void;
  switchConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  loadConversations: () => Promise<void>;

  // ===== 消息操作 =====
  sendMessage: () => Promise<void>;
  setImageAsReference: (imageUrl: string) => void;
  regenerateMessage: (assistantMessageId: string) => Promise<void>;
  regenerateSingleImage: (
    assistantMessageId: string,
    taskIndex: number
  ) => Promise<void>;
  cancelGeneration: () => void;
  removeMessage: (messageId: string) => void;

  // ===== 设置弹窗 =====
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // ===== AbortController 管理 =====
  abortControllers: Map<string, AbortController>;
}

/** 草稿默认值 */
const defaultDraft: Draft = {
  prompt: "",
  referenceImages: [],
  selectedRatio: "auto",
  customRatio: "",
  quality: "high",
  concurrency: 1,
  riskGuard: true,
};

/** 获取当前会话 */
function getCurrentConversation(state: AppState): Conversation | null {
  if (!state.currentConversationId) return null;
  return (
    state.conversations.find((c) => c.id === state.currentConversationId) ||
    null
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ===== 配置默认值 =====
      apiConfig: {
        baseURL: "https://www.packyapi.com/v1",
        apiKey: encodeApiKey(
          "sk-NxGQfgLXuWfImEsZAKE94NKVQwVrrrNs2PTYoilARiP8CYNs"
        ),
        modelId: "gpt-image-2",
      },
      setApiConfig: (config) =>
        set((state) => ({
          apiConfig: {
            ...state.apiConfig,
            ...config,
            apiKey: config.apiKey
              ? encodeApiKey(config.apiKey)
              : state.apiConfig.apiKey,
          },
        })),

      // ===== 会话列表 =====
      conversations: [],
      currentConversationId: null,

      // ===== 草稿 =====
      draft: { ...defaultDraft },
      setDraftPrompt: (prompt) =>
        set((state) => ({ draft: { ...state.draft, prompt } })),
      addDraftReferenceImage: (image) =>
        set((state) => ({
          draft: {
            ...state.draft,
            referenceImages: [...state.draft.referenceImages, image].slice(
              0,
              5
            ),
          },
        })),
      removeDraftReferenceImage: (id) =>
        set((state) => ({
          draft: {
            ...state.draft,
            referenceImages: state.draft.referenceImages.filter(
              (img) => img.id !== id
            ),
          },
        })),
      clearDraftReferenceImages: () =>
        set((state) => ({
          draft: { ...state.draft, referenceImages: [] },
        })),
      setDraftRatio: (ratio) =>
        set((state) => ({ draft: { ...state.draft, selectedRatio: ratio } })),
      setDraftCustomRatio: (ratio) =>
        set((state) => ({ draft: { ...state.draft, customRatio: ratio } })),
      setDraftQuality: (quality) =>
        set((state) => ({ draft: { ...state.draft, quality } })),
      setDraftConcurrency: (concurrency) =>
        set((state) => ({ draft: { ...state.draft, concurrency } })),
      setDraftRiskGuard: (enabled) =>
        set((state) => ({ draft: { ...state.draft, riskGuard: enabled } })),
      resetDraft: () => set({ draft: { ...defaultDraft } }),

      // ===== 会话管理 =====
      newConversation: () => {
        const id = generateId();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: "新会话",
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: id,
          draft: { ...defaultDraft },
        }));
      },

      switchConversation: (id) => {
        set({ currentConversationId: id, draft: { ...defaultDraft } });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
        // 持久化
        const conv = get().conversations.find((c) => c.id === id);
        if (conv) {
          saveConversationToDB(conv);
        }
      },

      deleteConversation: (id) => {
        set((state) => {
          const remaining = state.conversations.filter((c) => c.id !== id);
          const newCurrentId =
            state.currentConversationId === id
              ? remaining[0]?.id || null
              : state.currentConversationId;
          return {
            conversations: remaining,
            currentConversationId: newCurrentId,
          };
        });
        dbDeleteConversation(id);
      },

      loadConversations: async () => {
        // 清理过期数据
        await cleanupAllExpired();
        // 加载会话
        const records = await getConversations();
        const conversations: Conversation[] = records.map((r) => ({
          id: r.id,
          title: r.title,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          messages: r.messages.map((m) => {
            const params: MessageParams = {
              size: m.params.size,
              quality: (m.params.quality as QualityLevel) || "low",
              concurrency: m.params.concurrency,
              riskGuard: m.params.riskGuard,
            };
            if (m.role === "user") {
              return {
                id: m.id,
                role: "user" as const,
                prompt: m.prompt,
                referenceImages: m.referenceImages.map((img) => ({
                  id: img.id,
                  name: img.name,
                  data: img.data,
                })),
                params,
                createdAt: m.createdAt,
              };
            }
            // 从对应的 user message 获取 prompt
            const userMsg = r.messages.find(
              (um) => um.id === m.replyTo && um.role === "user"
            );
            const prompt = userMsg?.role === "user" ? userMsg.prompt : "";
            return {
              id: m.id,
              role: "assistant" as const,
              replyTo: m.replyTo,
              tasks: m.tasks.map((t) => ({
                id: t.id,
                prompt,
                status: t.status,
                imageBase64: t.imageBase64,
                revisedPrompt: t.revisedPrompt,
                error: t.error,
                createdAt: t.createdAt,
                startedAt: t.startedAt,
                completedAt: t.completedAt,
              })),
              params,
              createdAt: m.createdAt,
              durationMs: m.durationMs,
            };
          }),
        }));

        set((state) => ({
          conversations,
          currentConversationId:
            state.currentConversationId ||
            conversations[0]?.id ||
            null,
        }));
      },

      // ===== 消息操作 =====

      /**
       * 发送消息并触发生图
       *
       * 多轮对话策略：
       * 1. 以图为锚的多轮（主要方式）：用户点击上一轮某张 AI 生成图的 ✏️ 按钮
       *    → 该图自动作为参考图填入 draft → 用户输入修改指令 → 走 /images/edits 接口
       * 2. 纯文本追问的多轮（兜底）：如果用户没有"以此为参考"，则把上一轮 assistant
       *    消息的全部生成图自动作为本轮的参考图（取最多前 5 张），同时把本轮 prompt
       *    与上一轮 prompt 用换行拼接成新 prompt，发送给 /images/edits
       */
      sendMessage: async () => {
        const state = get();
        const { draft, currentConversationId } = state;

        if (!draft.prompt.trim() && draft.referenceImages.length === 0) return;

        // 确保有当前会话
        let convId = currentConversationId;
        if (!convId) {
          const id = generateId();
          const now = Date.now();
          const conversation: Conversation = {
            id,
            title: "新会话",
            createdAt: now,
            updatedAt: now,
            messages: [],
          };
          set((s) => ({
            conversations: [conversation, ...s.conversations],
            currentConversationId: id,
          }));
          convId = id;
        }

        const conversation = get().conversations.find((c) => c.id === convId);
        if (!conversation) return;

        // 确定本轮的参考图和 prompt
        const finalPrompt = draft.prompt;
        let finalRefImages: ReferenceImage[] = [...draft.referenceImages];

        // 查找上一轮 assistant 消息
        const lastAssistantMsg = [...conversation.messages]
          .reverse()
          .find((m) => m.role === "assistant") as
          | (Message & { role: "assistant" })
          | undefined;

        if (lastAssistantMsg && finalRefImages.length === 0) {
          // 策略 2：自动带上一轮结果作为参考图
          const successTasks = lastAssistantMsg.tasks.filter(
            (t) => t.status === "success" && t.imageBase64
          );
          if (successTasks.length > 0) {
            // 取最多前 5 张
            const autoRefImages: ReferenceImage[] = successTasks
              .slice(0, 5)
              .map((t, i) => ({
                id: `auto-${t.id}`,
                file: new File([], `previous-${i + 1}.png`, {
                  type: "image/png",
                }),
                preview: `data:image/png;base64,${t.imageBase64}`,
              }));
            finalRefImages = autoRefImages;
            // 不再合并 prompt，只用当前用户的指令
            // 图片编辑场景下，模型只需要参考图和当前修改指令
          }
        }

        // 创建 user message
        const userMessage: Message = {
          id: generateId(),
          role: "user",
          prompt: finalPrompt,
          referenceImages: finalRefImages.map((img) => ({
            id: img.id,
            name: img.file?.name || "image.png",
            data: img.preview,
          })),
          params: {
            size: getImageSize(draft.selectedRatio, draft.customRatio),
            quality: draft.quality,
            concurrency: draft.concurrency,
            riskGuard: draft.riskGuard,
          },
          createdAt: Date.now(),
        };

        // 更新会话标题（如果是第一条消息）
        const isFirstMessage = conversation.messages.length === 0;
        const title = isFirstMessage
          ? generateTitle(draft.prompt)
          : conversation.title;

        // 添加 user message 到会话
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  title,
                  updatedAt: Date.now(),
                  messages: [...c.messages, userMessage],
                }
              : c
          ),
          draft: { ...defaultDraft },
        }));

        // 创建 assistant message（初始状态，tasks 全部 pending）
        const tasks: GenerateTask[] = Array.from(
          { length: draft.concurrency },
          () => ({
            id: generateId(),
            prompt: finalPrompt,
            status: "pending" as TaskStatus,
            createdAt: Date.now(),
          })
        );

        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          replyTo: userMessage.id,
          tasks,
          params: {
            size: getImageSize(draft.selectedRatio, draft.customRatio),
            quality: draft.quality,
            concurrency: draft.concurrency,
            riskGuard: draft.riskGuard,
          },
          createdAt: Date.now(),
        };

        // 添加 assistant message
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: [...c.messages, assistantMessage],
                }
              : c
          ),
        }));

        // 执行生图任务
        const startTime = Date.now();
        const abortControllers = new Map<string, AbortController>();

        // 更新任务状态为 running
        const updateTaskStatus = (
          taskId: string,
          updates: Partial<GenerateTask>
        ) => {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessage.id && m.role === "assistant"
                        ? {
                            ...m,
                            tasks: (m as Message & { role: "assistant" }).tasks.map(
                              (t: GenerateTask) =>
                                t.id === taskId ? { ...t, ...updates } : t
                            ),
                          }
                        : m
                    ),
                  }
                : c
            ),
          }));
        };

        // 执行单个任务（异步轮询模式）
        const executeTask = async (task: GenerateTask) => {
          const abortController = new AbortController();
          abortControllers.set(task.id, abortController);

          updateTaskStatus(task.id, {
            status: "running",
            startedAt: Date.now(),
          });

          try {
            // 准备参考图数据
            const refImagesData = finalRefImages.map((img) => ({
              data: img.preview,
              name: img.file?.name || "image.png",
              type: img.file?.type || "image/png",
            }));

            // 第一步：提交任务获取任务 ID
            const submitResponse = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseURL: state.apiConfig.baseURL,
                apiKey: getDecodedApiKey(),
                modelId: state.apiConfig.modelId,
                prompt: finalPrompt,
                size: userMessage.params.size,
                quality: userMessage.params.quality,
                referenceImages:
                  refImagesData.length > 0 ? refImagesData : undefined,
              }),
              signal: abortController.signal,
            });

            const submitResult = await submitResponse.json();

            if (!submitResult.success || !submitResult.taskId) {
              throw new Error(submitResult.error || "提交任务失败");
            }

            // 第二步：轮询任务状态
            const result = await pollTaskStatus(
              submitResult.taskId,
              abortController.signal
            );

            if (result.success) {
              updateTaskStatus(task.id, {
                status: "success",
                imageBase64: result.imageBase64,
                revisedPrompt: result.revisedPrompt,
                completedAt: Date.now(),
              });

              // 保存到 IndexedDB
              await saveImageRecord(
                task.id,
                finalPrompt,
                result.imageBase64!,
                result.revisedPrompt,
                userMessage.params.size,
                userMessage.params.quality,
                assistantMessage.id,
                convId!
              );
            } else {
              // 风控保险：如果开启且是内容审核失败，静默处理
              if (
                draft.riskGuard &&
                result.error?.includes("content_policy_violation")
              ) {
                updateTaskStatus(task.id, {
                  status: "failed",
                  error: "内容审核未通过（风控保险已拦截）",
                  completedAt: Date.now(),
                });
              } else {
                throw new Error(result.error || "生成失败");
              }
            }
          } catch (error: unknown) {
            if (
              error instanceof Error &&
              (error.name === "AbortError" || error.message === "已取消")
            ) {
              updateTaskStatus(task.id, {
                status: "failed",
                error: "已取消",
                completedAt: Date.now(),
              });
            } else {
              updateTaskStatus(task.id, {
                status: "failed",
                error:
                  error instanceof Error ? error.message : "未知错误",
                completedAt: Date.now(),
              });
            }
          } finally {
            abortControllers.delete(task.id);
          }
        };

        // 并发执行所有任务
        const promises = tasks.map((task) => executeTask(task));
        await Promise.allSettled(promises);

        // 更新 assistant message 的 durationMs
        const durationMs = Date.now() - startTime;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, durationMs }
                      : m
                  ),
                }
              : c
          ),
        }));

        // 保存会话到 IndexedDB
        const updatedConv = get().conversations.find(
          (c) => c.id === convId
        );
        if (updatedConv) {
          await saveConversationToDB(updatedConv);
        }
      },

      setImageAsReference: (imageUrl) => {
        // 将图片 URL 转为 ReferenceImage 并添加到 draft
        const id = generateId();
        // imageUrl 可能是 data:image/png;base64,... 或纯 base64
        const preview = imageUrl.startsWith("data:")
          ? imageUrl
          : `data:image/png;base64,${imageUrl}`;

        // 从 preview 创建一个虚拟 File 对象
        const file = new File([], "reference.png", { type: "image/png" });

        set((state) => ({
          draft: {
            ...state.draft,
            referenceImages: [
              ...state.draft.referenceImages,
              { id, file, preview },
            ].slice(0, 5),
          },
        }));
      },

      regenerateMessage: async (assistantMessageId) => {
        const state = get();
        const conv = getCurrentConversation(state);
        if (!conv) return;

        const assistantMsg = conv.messages.find(
          (m) => m.id === assistantMessageId && m.role === "assistant"
        ) as (Message & { role: "assistant" }) | undefined;
        if (!assistantMsg) return;

        const userMsg = conv.messages.find(
          (m) => m.id === assistantMsg.replyTo
        );
        if (!userMsg || userMsg.role !== "user") return;

        // 重置所有任务状态为 pending
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId && m.role === "assistant"
                      ? {
                          ...m,
                          tasks: (m as Message & { role: "assistant" }).tasks.map(
                            (t: GenerateTask) => ({
                              ...t,
                              status: "pending" as TaskStatus,
                              imageBase64: undefined,
                              error: undefined,
                              startedAt: undefined,
                              completedAt: undefined,
                            })
                          ),
                        }
                      : m
                  ),
                }
              : c
          ),
        }));

        // 重新执行生成（复用 sendMessage 的逻辑，但不创建新消息）
        // 这里简化处理：直接调用 API 重新生成
        const refImages = userMsg.referenceImages;
        const refImagesData = refImages.map((img) => ({
          data: img.data,
          name: img.name,
          type: "image/png",
        }));

        const executeTask = async (task: GenerateTask, index: number) => {
          const abortController = new AbortController();

          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conv.id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId && m.role === "assistant"
                        ? {
                            ...m,
                            tasks: (
                              m as Message & { role: "assistant" }
                            ).tasks.map((t: GenerateTask, i: number) =>
                              i === index
                                ? {
                                    ...t,
                                    status: "running" as TaskStatus,
                                    startedAt: Date.now(),
                                  }
                                : t
                            ),
                          }
                        : m
                    ),
                  }
                : c
            ),
          }));

          try {
            // 第一步：提交任务获取任务 ID
            const submitResponse = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseURL: state.apiConfig.baseURL,
                apiKey: getDecodedApiKey(),
                modelId: state.apiConfig.modelId,
                prompt: userMsg.prompt,
                size: userMsg.params.size,
                quality: userMsg.params.quality,
                referenceImages:
                  refImagesData.length > 0 ? refImagesData : undefined,
              }),
              signal: abortController.signal,
            });

            const submitResult = await submitResponse.json();

            if (!submitResult.success || !submitResult.taskId) {
              throw new Error(submitResult.error || "提交任务失败");
            }

            // 第二步：轮询任务状态
            const result = await pollTaskStatus(
              submitResult.taskId,
              abortController.signal
            );

            if (result.success) {
              set((s) => ({
                conversations: s.conversations.map((c) =>
                  c.id === conv.id
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMessageId && m.role === "assistant"
                            ? {
                                ...m,
                                tasks: (
                                  m as Message & { role: "assistant" }
                                ).tasks.map((t: GenerateTask, i: number) =>
                                  i === index
                                    ? {
                                        ...t,
                                        status: "success" as TaskStatus,
                                        imageBase64: result.imageBase64,
                                        revisedPrompt: result.revisedPrompt,
                                        completedAt: Date.now(),
                                      }
                                    : t
                                ),
                              }
                            : m
                        ),
                      }
                    : c
                ),
              }));
            } else {
              throw new Error(result.error || "生成失败");
            }
          } catch (error: unknown) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === conv.id
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId && m.role === "assistant"
                          ? {
                              ...m,
                              tasks: (
                                m as Message & { role: "assistant" }
                              ).tasks.map((t: GenerateTask, i: number) =>
                                i === index
                                  ? {
                                      ...t,
                                      status: "failed" as TaskStatus,
                                      error:
                                        error instanceof Error
                                          ? error.message
                                          : "未知错误",
                                      completedAt: Date.now(),
                                    }
                                  : t
                              ),
                            }
                          : m
                      ),
                    }
                  : c
              ),
            }));
          }
        };

        // 并发重新生成所有任务
        const tasks = assistantMsg.tasks;
        await Promise.allSettled(
          tasks.map((task, index) => executeTask(task, index))
        );

        // 保存会话
        const updatedConv = get().conversations.find(
          (c) => c.id === conv.id
        );
        if (updatedConv) {
          await saveConversationToDB(updatedConv);
        }
      },

      regenerateSingleImage: async (assistantMessageId, taskIndex) => {
        const state = get();
        const conv = getCurrentConversation(state);
        if (!conv) return;

        const assistantMsg = conv.messages.find(
          (m) => m.id === assistantMessageId && m.role === "assistant"
        ) as (Message & { role: "assistant" }) | undefined;
        if (!assistantMsg) return;

        const userMsg = conv.messages.find(
          (m) => m.id === assistantMsg.replyTo
        );
        if (!userMsg || userMsg.role !== "user") return;

        const task = assistantMsg.tasks[taskIndex];
        if (!task) return;

        // 重置该任务状态
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId && m.role === "assistant"
                      ? {
                          ...m,
                          tasks: (
                            m as Message & { role: "assistant" }
                          ).tasks.map((t: GenerateTask, i: number) =>
                            i === taskIndex
                              ? {
                                  ...t,
                                  status: "pending" as TaskStatus,
                                  imageBase64: undefined,
                                  error: undefined,
                                  startedAt: undefined,
                                  completedAt: undefined,
                                }
                              : t
                          ),
                        }
                      : m
                  ),
                }
              : c
          ),
        }));

        // 执行单个任务重新生成
        const refImages = userMsg.referenceImages;
        const refImagesData = refImages.map((img) => ({
          data: img.data,
          name: img.name,
          type: "image/png",
        }));

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId && m.role === "assistant"
                      ? {
                          ...m,
                          tasks: (
                            m as Message & { role: "assistant" }
                          ).tasks.map((t: GenerateTask, i: number) =>
                            i === taskIndex
                              ? { ...t, status: "running" as TaskStatus, startedAt: Date.now() }
                              : t
                          ),
                        }
                      : m
                  ),
                }
              : c
          ),
        }));

        try {
          const abortController = new AbortController();

          // 第一步：提交任务获取任务 ID
          const submitResponse = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              baseURL: state.apiConfig.baseURL,
              apiKey: getDecodedApiKey(),
              modelId: state.apiConfig.modelId,
              prompt: userMsg.prompt,
              size: userMsg.params.size,
              quality: userMsg.params.quality,
              referenceImages:
                refImagesData.length > 0 ? refImagesData : undefined,
            }),
            signal: abortController.signal,
          });

          const submitResult = await submitResponse.json();

          if (!submitResult.success || !submitResult.taskId) {
            throw new Error(submitResult.error || "提交任务失败");
          }

          // 第二步：轮询任务状态
          const result = await pollTaskStatus(
            submitResult.taskId,
            abortController.signal
          );

          if (result.success) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === conv.id
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId && m.role === "assistant"
                          ? {
                              ...m,
                              tasks: (
                                m as Message & { role: "assistant" }
                              ).tasks.map((t: GenerateTask, i: number) =>
                                i === taskIndex
                                  ? {
                                      ...t,
                                      status: "success" as TaskStatus,
                                      imageBase64: result.imageBase64,
                                      revisedPrompt: result.revisedPrompt,
                                      completedAt: Date.now(),
                                    }
                                  : t
                              ),
                            }
                          : m
                      ),
                    }
                  : c
              ),
            }));
          } else {
            throw new Error(result.error || "生成失败");
          }
        } catch (error: unknown) {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conv.id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMessageId && m.role === "assistant"
                        ? {
                            ...m,
                            tasks: (
                              m as Message & { role: "assistant" }
                            ).tasks.map((t: GenerateTask, i: number) =>
                              i === taskIndex
                                ? {
                                    ...t,
                                    status: "failed" as TaskStatus,
                                    error:
                                      error instanceof Error
                                        ? error.message
                                        : "未知错误",
                                    completedAt: Date.now(),
                                  }
                                : t
                            ),
                          }
                        : m
                    ),
                  }
                : c
            ),
          }));
        }

        // 保存会话
        const updatedConv = get().conversations.find(
          (c) => c.id === conv.id
        );
        if (updatedConv) {
          await saveConversationToDB(updatedConv);
        }
      },

      cancelGeneration: () => {
        // 取消所有运行中的任务
        // 这里通过遍历会话中的任务，找到 running 状态的并标记为 failed
        const state = get();
        const conv = getCurrentConversation(state);
        if (!conv) return;

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) => {
                    if (m.role !== "assistant") return m;
                    const am = m as Message & { role: "assistant" };
                    return {
                      ...am,
                      tasks: am.tasks.map((t) =>
                        t.status === "running" || t.status === "pending"
                          ? {
                              ...t,
                              status: "failed" as TaskStatus,
                              error: "已取消",
                              completedAt: Date.now(),
                            }
                          : t
                      ),
                    };
                  }),
                }
              : c
          ),
        }));
      },

      removeMessage: (messageId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.currentConversationId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== messageId),
                }
              : c
          ),
        }));
      },

      // ===== 设置弹窗 =====
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      // ===== AbortController 管理 =====
      abortControllers: new Map(),
    }),
    {
      name: "ai-image-gen-storage",
      // 只持久化配置相关字段
      partialize: (state) => ({
        apiConfig: {
          baseURL: state.apiConfig.baseURL,
          apiKey: state.apiConfig.apiKey,
        },
      }),
    }
  )
);

/** 获取解混淆后的 API Key */
export function getDecodedApiKey(): string {
  const state = useAppStore.getState();
  return decodeApiKey(state.apiConfig.apiKey);
}

/** 将会话保存到 IndexedDB */
async function saveConversationToDB(conversation: Conversation): Promise<void> {
  const record: ConversationRecord = {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
    messages: conversation.messages.map((m) => {
      if (m.role === "user") {
        return {
          id: m.id,
          role: "user" as const,
          prompt: m.prompt,
          referenceImages: m.referenceImages,
          params: m.params,
          createdAt: m.createdAt,
        };
      }
      return {
        id: m.id,
        role: "assistant" as const,
        replyTo: m.replyTo,
        tasks: m.tasks.map((t) => ({
          id: t.id,
          status: t.status,
          imageBase64: t.imageBase64,
          revisedPrompt: t.revisedPrompt,
          error: t.error,
          createdAt: t.createdAt,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
        })),
        params: m.params,
        createdAt: m.createdAt,
        durationMs: m.durationMs,
      };
    }),
  };

  await saveConversation(record);
}
