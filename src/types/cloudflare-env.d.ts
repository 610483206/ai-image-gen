// Cloudflare Workers 类型声明
// 这些类型在 Cloudflare Pages 环境中自动可用

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

type CloudflareEnv = {
  TASKS_KV: KVNamespace;
};
