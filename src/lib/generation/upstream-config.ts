import { ApiAuthError } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UPSTREAM_SETTING_KEY = "upstream_image_config";

export interface UpstreamImageConfig {
  baseURL: string;
  apiKey: string;
  modelId: string;
  useFullUrl: boolean;
}

export interface UpstreamConfigSnapshot {
  baseURL: string;
  modelId: string;
  useFullUrl: boolean;
  hasApiKey: boolean;
  source: "database" | "environment";
  updatedAt: string | null;
}

function readBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function isPrivateIp(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "[::1]") return true;

  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function normalizeBaseURL(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiAuthError("Base URL 不能为空", 400, "invalid_upstream_base_url");
  }

  const baseURL = value.trim().replace(/\/+$/, "");
  if (!baseURL) {
    throw new ApiAuthError("Base URL 不能为空", 400, "invalid_upstream_base_url");
  }

  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new ApiAuthError("Base URL 格式不正确", 400, "invalid_upstream_base_url");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiAuthError("Base URL 仅支持 HTTP/HTTPS", 400, "invalid_upstream_base_url");
  }

  if (isPrivateIp(parsed.hostname)) {
    throw new ApiAuthError("Base URL 不能指向本机或内网地址", 400, "invalid_upstream_base_url");
  }

  return baseURL;
}

function normalizeApiKey(value: unknown, required = true): string {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new ApiAuthError("API Key 不能为空", 400, "invalid_upstream_api_key");
  }

  const apiKey = value.trim();
  if (!apiKey && required) {
    throw new ApiAuthError("API Key 不能为空", 400, "invalid_upstream_api_key");
  }
  return apiKey;
}

function normalizeModelId(value: unknown): string {
  if (typeof value !== "string") return "gpt-image-2";
  return value.trim() || "gpt-image-2";
}

function normalizeConfig(input: Record<string, unknown>, options?: { apiKeyRequired?: boolean }): UpstreamImageConfig {
  return {
    baseURL: normalizeBaseURL(input.baseURL),
    apiKey: normalizeApiKey(input.apiKey, options?.apiKeyRequired ?? true),
    modelId: normalizeModelId(input.modelId),
    useFullUrl: input.useFullUrl === true,
  };
}

function readEnvUpstreamImageConfig(): UpstreamImageConfig {
  const baseURL = process.env.UPSTREAM_API_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.UPSTREAM_API_KEY || process.env.OPENAI_API_KEY;
  const modelId = process.env.UPSTREAM_MODEL_ID || "gpt-image-2";
  const useFullUrl = readBoolean(process.env.UPSTREAM_USE_FULL_URL);

  if (!baseURL || !apiKey) {
    throw new ApiAuthError("平台生图 API 未配置", 500, "upstream_config_missing");
  }

  return normalizeConfig({ baseURL, apiKey, modelId, useFullUrl });
}

function parseStoredConfig(value: unknown): UpstreamImageConfig | null {
  if (!value || typeof value !== "object") return null;
  return normalizeConfig(value as Record<string, unknown>);
}

async function readStoredUpstreamImageConfig(): Promise<{ config: UpstreamImageConfig; updatedAt: string | null } | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value,updated_at")
    .eq("key", UPSTREAM_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.message.includes("app_settings")) return null;
    throw new ApiAuthError("读取平台生图配置失败", 500, "upstream_config_read_failed");
  }

  const config = parseStoredConfig(data?.value);
  if (!config) return null;
  return { config, updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null };
}

export function parseUserUpstreamConfig(value: unknown): UpstreamImageConfig | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") {
    throw new ApiAuthError("自定义上游配置格式不正确", 400, "invalid_upstream_config");
  }
  return normalizeConfig(value as Record<string, unknown>);
}

export async function getDefaultUpstreamImageConfig(): Promise<UpstreamImageConfig> {
  const stored = await readStoredUpstreamImageConfig();
  if (stored) return stored.config;
  return readEnvUpstreamImageConfig();
}

export async function resolveUpstreamImageConfig(userConfig: unknown): Promise<UpstreamImageConfig> {
  const customConfig = parseUserUpstreamConfig(userConfig);
  if (customConfig) return customConfig;
  return getDefaultUpstreamImageConfig();
}

export async function getAdminUpstreamConfigSnapshot(): Promise<UpstreamConfigSnapshot> {
  const stored = await readStoredUpstreamImageConfig();
  const config = stored?.config ?? readEnvUpstreamImageConfig();

  return {
    baseURL: config.baseURL,
    modelId: config.modelId,
    useFullUrl: config.useFullUrl,
    hasApiKey: Boolean(config.apiKey),
    source: stored ? "database" : "environment",
    updatedAt: stored?.updatedAt ?? null,
  };
}

export async function saveDefaultUpstreamImageConfig(input: unknown): Promise<UpstreamConfigSnapshot> {
  if (!input || typeof input !== "object") {
    throw new ApiAuthError("平台生图配置格式不正确", 400, "invalid_upstream_config");
  }

  const raw = input as Record<string, unknown>;
  const current = await getDefaultUpstreamImageConfig().catch(() => null);
  const apiKey = normalizeApiKey(raw.apiKey, false) || current?.apiKey || "";
  if (!apiKey) {
    throw new ApiAuthError("首次保存默认配置时必须填写 API Key", 400, "invalid_upstream_api_key");
  }

  const config = normalizeConfig(
    {
      baseURL: raw.baseURL,
      apiKey,
      modelId: raw.modelId,
      useFullUrl: raw.useFullUrl,
    },
    { apiKeyRequired: true }
  );

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert(
      {
        key: UPSTREAM_SETTING_KEY,
        value: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) throw new ApiAuthError("保存平台生图配置失败", 500, "upstream_config_save_failed");
  return getAdminUpstreamConfigSnapshot();
}
