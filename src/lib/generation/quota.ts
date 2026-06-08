import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ApiAuthError, getQuotaResetAt } from "@/lib/auth/session";

interface ReserveQuotaParams {
  userId: string;
  clientTaskId: string;
  prompt: string;
  size: string;
  quality: string;
}

type RpcJson = Record<string, unknown> | null;

function readRpcError(data: RpcJson, fallback: string) {
  return typeof data?.error === "string" ? data.error : fallback;
}

export async function reserveGenerationQuota(params: ReserveQuotaParams) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reserve_generation_quota", {
    p_user_id: params.userId,
    p_client_task_id: params.clientTaskId,
    p_prompt: params.prompt,
    p_size: params.size,
    p_quality: params.quality,
  });

  if (error) throw new ApiAuthError("配额预占失败", 500, "quota_reserve_failed");

  const result = data as RpcJson;
  if (!result?.ok) {
    const reason = typeof result?.reason === "string" ? result.reason : "quota_rejected";
    const status = reason === "quota_exceeded" ? 429 : reason === "account_disabled" ? 403 : 400;
    const suffix = reason === "quota_exceeded" ? `，重置时间：${new Date(getQuotaResetAt()).toLocaleString("zh-CN")}` : "";
    throw new ApiAuthError(`${readRpcError(result, "无法预占生图额度")}${suffix}`, status, reason);
  }

  return result;
}

export async function markGenerationUpstreamTask(userId: string, clientTaskId: string, upstreamTaskId: string) {
  const admin = createSupabaseAdminClient();
  await admin.rpc("mark_generation_upstream_task", {
    p_user_id: userId,
    p_client_task_id: clientTaskId,
    p_upstream_task_id: upstreamTaskId,
  });
}

export async function completeGenerationQuota(
  userId: string,
  clientTaskId: string,
  upstreamTaskId?: string
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("complete_generation_quota", {
    p_user_id: userId,
    p_client_task_id: clientTaskId,
    p_upstream_task_id: upstreamTaskId || null,
  });

  if (error) throw new ApiAuthError("确认生图额度失败", 500, "quota_complete_failed");
  const result = data as RpcJson;
  if (!result?.ok) {
    throw new ApiAuthError(readRpcError(result, "确认生图额度失败"), 500, "quota_complete_rejected");
  }
}

export async function releaseGenerationQuota(userId: string, clientTaskId: string, errorMessage?: string) {
  const admin = createSupabaseAdminClient();
  await admin.rpc("release_generation_quota", {
    p_user_id: userId,
    p_client_task_id: clientTaskId,
    p_error_message: errorMessage || null,
  });
}