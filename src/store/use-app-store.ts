import { create } from "zustand";
import { persist } from "zustand/middleware";

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

/** 参考图片 */
export interface ReferenceImage {
  id: string;
  file: File;
  preview: string; // base64 data URL
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

/** 应用状态 */
interface AppState {
  // 配置
  apiConfig: ApiConfig;
  setApiConfig: (config: Partial<ApiConfig>) => void;

  // 提示词
  prompt: string;
  setPrompt: (prompt: string) => void;

  // 参考图
  referenceImages: ReferenceImage[];
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;

  // 比例设置
  selectedRatio: string;
  customRatio: string;
  setSelectedRatio: (ratio: string) => void;
  setCustomRatio: (ratio: string) => void;

  // 画质
  quality: QualityLevel;
  setQuality: (quality: QualityLevel) => void;

  // 并发数
  concurrency: number;
  setConcurrency: (concurrency: number) => void;

  // 风控保险
  riskInsurance: boolean;
  setRiskInsurance: (enabled: boolean) => void;

  // 任务队列
  tasks: GenerateTask[];
  addTask: (task: GenerateTask) => void;
  updateTask: (id: string, updates: Partial<GenerateTask>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;

  // 设置弹窗
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 配置默认值
      apiConfig: {
        baseURL: "https://www.packyapi.com/v1",
        apiKey: encodeApiKey("sk-NxGQfgLXuWfImEsZAKE94NKVQwVrrrNs2PTYoilARiP8CYNs"),
        modelId: "gpt-image-2",
      },
      setApiConfig: (config) =>
        set((state) => ({
          apiConfig: {
            ...state.apiConfig,
            ...config,
            // 存储时混淆 apiKey
            apiKey: config.apiKey
              ? encodeApiKey(config.apiKey)
              : state.apiConfig.apiKey,
          },
        })),

      // 提示词
      prompt: "",
      setPrompt: (prompt) => set({ prompt }),

      // 参考图
      referenceImages: [],
      addReferenceImage: (image) =>
        set((state) => ({
          referenceImages: [...state.referenceImages, image].slice(0, 5),
        })),
      removeReferenceImage: (id) =>
        set((state) => ({
          referenceImages: state.referenceImages.filter((img) => img.id !== id),
        })),
      clearReferenceImages: () => set({ referenceImages: [] }),

      // 比例设置
      selectedRatio: "auto",
      customRatio: "",
      setSelectedRatio: (ratio) => set({ selectedRatio: ratio }),
      setCustomRatio: (ratio) => set({ customRatio: ratio }),

      // 画质
      quality: "low",
      setQuality: (quality) => set({ quality }),

      // 并发数
      concurrency: 1,
      setConcurrency: (concurrency) => set({ concurrency }),

      // 风控保险
      riskInsurance: true,
      setRiskInsurance: (enabled) => set({ riskInsurance: enabled }),

      // 任务队列
      tasks: [],
      addTask: (task) =>
        set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),
      clearTasks: () => set({ tasks: [] }),

      // 设置弹窗
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
    }),
    {
      name: "ai-image-gen-storage",
      // 只持久化配置相关字段，不持久化任务和参考图
      partialize: (state) => ({
        apiConfig: {
          baseURL: state.apiConfig.baseURL,
          // 读取时反混淆
          apiKey: state.apiConfig.apiKey,
        },
        selectedRatio: state.selectedRatio,
        customRatio: state.customRatio,
        quality: state.quality,
        concurrency: state.concurrency,
        riskInsurance: state.riskInsurance,
      }),
    }
  )
);

/** 获取解混淆后的 API Key */
export function getDecodedApiKey(): string {
  const state = useAppStore.getState();
  return decodeApiKey(state.apiConfig.apiKey);
}
