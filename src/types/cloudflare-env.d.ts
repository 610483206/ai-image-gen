// Cloudflare Workers KV 类型声明
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

// 扩展 process.env 类型
declare namespace NodeJS {
  interface ProcessEnv {
    TASKS_KV?: KVNamespace;
  }
}
