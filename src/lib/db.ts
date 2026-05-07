/**
 * IndexedDB 工具：存储会话和图片
 * 会话和图片均保留 3 天，过期自动清理
 */

const DB_NAME = "ai-image-gen";
const DB_VERSION = 2;
const EXPIRY_DAYS = 3;

/** 图片记录 */
export interface ImageRecord {
  id: string;
  prompt: string;
  imageBase64: string;
  revisedPrompt?: string;
  size: string;
  quality: string;
  createdAt: number;
  expiresAt: number;
  /** 关联的 assistant message id */
  messageId?: string;
  /** 关联的会话 id */
  conversationId?: string;
}

/** 会话记录 */
export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  messages: MessageRecord[];
}

/** 消息记录 */
export type MessageRecord =
  | {
      id: string;
      role: "user";
      prompt: string;
      referenceImages: { id: string; name: string; data: string }[];
      params: {
        size: string;
        quality: string;
        concurrency: number;
        riskGuard: boolean;
      };
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      replyTo: string;
      tasks: {
        id: string;
        status: "pending" | "running" | "success" | "failed";
        imageBase64?: string;
        revisedPrompt?: string;
        error?: string;
        createdAt: number;
        startedAt?: number;
        completedAt?: number;
      }[];
      params: {
        size: string;
        quality: string;
        concurrency: number;
        riskGuard: boolean;
      };
      createdAt: number;
      durationMs?: number;
    };

/** 打开数据库连接 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // version 1 → 2: 新增 conversations 表
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("images")) {
          const imageStore = db.createObjectStore("images", {
            keyPath: "id",
          });
          imageStore.createIndex("createdAt", "createdAt", { unique: false });
          imageStore.createIndex("expiresAt", "expiresAt", { unique: false });
          imageStore.createIndex("messageId", "messageId", { unique: false });
          imageStore.createIndex("conversationId", "conversationId", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("conversations")) {
          const convStore = db.createObjectStore("conversations", {
            keyPath: "id",
          });
          convStore.createIndex("updatedAt", "updatedAt", { unique: false });
          convStore.createIndex("expiresAt", "expiresAt", { unique: false });
        }
      }
    };
  });
}

// ==================== 会话相关 ====================

/** 保存会话 */
export async function saveConversation(
  conversation: ConversationRecord
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("conversations", "readwrite");
  const store = tx.objectStore("conversations");
  store.put(conversation);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取所有未过期的会话 */
export async function getConversations(): Promise<ConversationRecord[]> {
  const db = await openDB();
  const tx = db.transaction("conversations", "readonly");
  const store = tx.objectStore("conversations");
  const index = store.index("expiresAt");

  const now = Date.now();
  const range = IDBKeyRange.lowerBound(now);
  const request = index.getAll(range);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result as ConversationRecord[];
      // 按更新时间倒序
      records.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/** 删除会话及其关联的图片 */
export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();

  // 先删除关联的图片
  const imageTx = db.transaction("images", "readwrite");
  const imageStore = imageTx.objectStore("images");
  const imageIndex = imageStore.index("conversationId");
  const imageRequest = imageIndex.openCursor(IDBKeyRange.only(id));

  await new Promise<void>((resolve, reject) => {
    imageRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    imageRequest.onerror = () => reject(imageRequest.error);
  });

  // 再删除会话
  const convTx = db.transaction("conversations", "readwrite");
  const convStore = convTx.objectStore("conversations");
  convStore.delete(id);

  return new Promise((resolve, reject) => {
    convTx.oncomplete = () => resolve();
    convTx.onerror = () => reject(convTx.error);
  });
}

/** 清理过期会话 */
export async function cleanupExpiredConversations(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction("conversations", "readwrite");
  const store = tx.objectStore("conversations");
  const index = store.index("expiresAt");

  const now = Date.now();
  const range = IDBKeyRange.upperBound(now);
  const request = index.openCursor(range);
  let count = 0;

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== 图片相关 ====================

/** 保存图片记录 */
export async function saveImageRecord(
  id: string,
  prompt: string,
  imageBase64: string,
  revisedPrompt: string | undefined,
  size: string,
  quality: string,
  messageId?: string,
  conversationId?: string
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");

  const now = Date.now();
  const record: ImageRecord = {
    id,
    prompt,
    imageBase64,
    revisedPrompt,
    size,
    quality,
    createdAt: now,
    expiresAt: now + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    messageId,
    conversationId,
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取所有未过期的图片记录 */
export async function getImageRecords(): Promise<ImageRecord[]> {
  const db = await openDB();
  const tx = db.transaction("images", "readonly");
  const store = tx.objectStore("images");
  const index = store.index("expiresAt");

  const now = Date.now();
  const range = IDBKeyRange.lowerBound(now);
  const request = index.getAll(range);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result as ImageRecord[];
      records.sort((a, b) => b.createdAt - a.createdAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/** 删除图片记录 */
export async function deleteImageRecord(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 清理过期图片 */
export async function cleanupExpiredImages(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction("images", "readwrite");
  const store = tx.objectStore("images");
  const index = store.index("expiresAt");

  const now = Date.now();
  const range = IDBKeyRange.upperBound(now);
  const request = index.openCursor(range);
  let count = 0;

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** 清理所有过期数据（会话 + 图片） */
export async function cleanupAllExpired(): Promise<{
  conversations: number;
  images: number;
}> {
  const conversations = await cleanupExpiredConversations();
  const images = await cleanupExpiredImages();
  return { conversations, images };
}
