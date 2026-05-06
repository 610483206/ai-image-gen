/**
 * IndexedDB 工具：存储生成历史
 * 图片保留 3 天，过期自动清理
 */

const DB_NAME = "ai-image-gen";
const DB_VERSION = 1;
const STORE_NAME = "images";
const EXPIRY_DAYS = 3;

interface ImageRecord {
  id: string;
  prompt: string;
  imageBase64: string;
  revisedPrompt?: string;
  size: string;
  quality: string;
  createdAt: number;
  expiresAt: number;
}

/** 打开数据库连接 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
  });
}

/** 保存图片记录 */
export async function saveImageRecord(
  id: string,
  prompt: string,
  imageBase64: string,
  revisedPrompt: string | undefined,
  size: string,
  quality: string
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

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
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("expiresAt");

  const now = Date.now();
  const range = IDBKeyRange.lowerBound(now);
  const request = index.getAll(range);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const records = request.result as ImageRecord[];
      // 按创建时间倒序
      records.sort((a, b) => b.createdAt - a.createdAt);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/** 删除图片记录 */
export async function deleteImageRecord(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 清理过期记录 */
export async function cleanupExpiredRecords(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
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

export type { ImageRecord };
