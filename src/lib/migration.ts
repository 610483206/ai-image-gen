/**
 * v1 → v2 数据迁移
 * 检测 localStorage 中 v1 的历史任务数据，转换为一个「历史记录」会话
 */

import { saveConversation, type ConversationRecord, type MessageRecord } from "./db";

const MIGRATION_KEY = "ai-image-gen-v2-migrated";

/** 检查是否已完成迁移 */
export function isMigrationDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MIGRATION_KEY) === "true";
}

/** 标记迁移完成 */
function markMigrationDone(): void {
  localStorage.setItem(MIGRATION_KEY, "true");
}

/** 从 v1 的 localStorage 读取历史任务数据 */
function readV1Tasks(): {
  id: string;
  prompt: string;
  imageBase64?: string;
  revisedPrompt?: string;
  error?: string;
  status: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  size?: string;
  quality?: string;
}[] {
  try {
    // v1 的 store 持久化在 localStorage key "ai-image-gen-storage"
    const raw = localStorage.getItem("ai-image-gen-storage");
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    // Zustand persist 的结构是 { state: {...}, version: N }
    const state = parsed?.state;
    if (!state?.tasks || !Array.isArray(state.tasks)) return [];

    return state.tasks;
  } catch {
    return [];
  }
}

/** 读取 v1 的配置（用于提取 size/quality 参数） */
function readV1Config(): { size: string; quality: string } {
  try {
    const raw = localStorage.getItem("ai-image-gen-storage");
    if (!raw) return { size: "auto", quality: "low" };
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    return {
      size: state?.selectedRatio || "auto",
      quality: state?.quality || "low",
    };
  } catch {
    return { size: "auto", quality: "low" };
  }
}

/** 执行迁移 */
export async function migrateV1ToV2(): Promise<boolean> {
  if (isMigrationDone()) return false;

  const v1Tasks = readV1Tasks();
  if (v1Tasks.length === 0) {
    markMigrationDone();
    return false;
  }

  const config = readV1Config();
  const now = Date.now();

  // 将 v1 任务按 prompt 分组，每组转为一轮对话
  // 但大多数情况下 v1 只有一批任务，所以直接转成一个会话
  const messages: MessageRecord[] = [];

  // 按 prompt 分组
  const promptGroups = new Map<string, typeof v1Tasks>();
  for (const task of v1Tasks) {
    const key = task.prompt || "(空提示词)";
    if (!promptGroups.has(key)) {
      promptGroups.set(key, []);
    }
    promptGroups.get(key)!.push(task);
  }

  for (const [prompt, tasks] of promptGroups) {
    const userMsgId = `migrated-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const assistantMsgId = `migrated-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 取最早任务的时间作为 user message 时间
    const earliest = Math.min(...tasks.map((t) => t.createdAt || now));

    messages.push({
      id: userMsgId,
      role: "user",
      prompt,
      referenceImages: [],
      params: {
        size: tasks[0]?.size || config.size,
        quality: tasks[0]?.quality || config.quality,
        concurrency: tasks.length,
        riskGuard: true,
      },
      createdAt: earliest,
    });

    messages.push({
      id: assistantMsgId,
      role: "assistant",
      replyTo: userMsgId,
      tasks: tasks.map((t) => ({
        id: t.id,
        status: (t.status === "success"
          ? "success"
          : t.status === "failed"
            ? "failed"
            : "pending") as "success" | "failed" | "pending",
        imageBase64: t.imageBase64,
        revisedPrompt: t.revisedPrompt,
        error: t.error,
        createdAt: t.createdAt || now,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
      })),
      params: {
        size: tasks[0]?.size || config.size,
        quality: tasks[0]?.quality || config.quality,
        concurrency: tasks.length,
        riskGuard: true,
      },
      createdAt: earliest + 1,
      durationMs: tasks.some((t) => t.completedAt && t.startedAt)
        ? Math.max(
            ...tasks.map((t) =>
              t.completedAt && t.startedAt ? t.completedAt - t.startedAt : 0
            )
          )
        : undefined,
    });
  }

  // 按时间排序消息
  messages.sort((a, b) => a.createdAt - b.createdAt);

  const conversation: ConversationRecord = {
    id: `migrated-${now}`,
    title: "历史记录",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 3 * 24 * 60 * 60 * 1000,
    messages,
  };

  await saveConversation(conversation);
  markMigrationDone();

  console.log(
    `[Migration] v1 → v2 完成，迁移了 ${v1Tasks.length} 个任务到会话「历史记录」`
  );
  return true;
}
