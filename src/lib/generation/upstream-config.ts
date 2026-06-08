import { ApiAuthError } from "@/lib/auth/session";

export interface UpstreamImageConfig {
  baseURL: string;
  apiKey: string;
  modelId: string;
  useFullUrl: boolean;
}

function readBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

export function getUpstreamImageConfig(): UpstreamImageConfig {
  const baseURL = process.env.UPSTREAM_API_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.UPSTREAM_API_KEY || process.env.OPENAI_API_KEY;
  const modelId = process.env.UPSTREAM_MODEL_ID || "gpt-image-2";
  const useFullUrl = readBoolean(process.env.UPSTREAM_USE_FULL_URL);

  if (!baseURL || !apiKey) {
    throw new ApiAuthError("平台生图 API 未配置", 500, "upstream_config_missing");
  }

  return {
    baseURL,
    apiKey,
    modelId,
    useFullUrl,
  };
}