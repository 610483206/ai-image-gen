"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore, getDecodedApiKey } from "@/store/use-app-store";

interface BalanceInfo {
  total: number;
  used: number;
  remaining: number;
  currency: string;
}

/**
 * 查询 API 余额 Hook
 * 尝试调用中转站的余额接口
 */
export function useBalance() {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiConfig } = useAppStore();

  const fetchBalance = useCallback(async () => {
    const apiKey = getDecodedApiKey();
    if (!apiKey) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 尝试常见的余额接口路径
      const baseURL = apiConfig.baseURL.replace(/\/+$/, "");
      const endpoints = [
        `${baseURL}/dashboard/billing/credit_grants`,
        `${baseURL}/v1/dashboard/billing/credit_grants`,
        `${baseURL}/billing/credit_grants`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            // 解析不同格式的余额数据
            if (data.total_available !== undefined) {
              setBalance({
                total: data.total_granted || 0,
                used: data.total_used || 0,
                remaining: data.total_available || 0,
                currency: "USD",
              });
              return;
            }
            if (data.balance !== undefined) {
              setBalance({
                total: data.balance,
                used: 0,
                remaining: data.balance,
                currency: data.currency || "USD",
              });
              return;
            }
          }
        } catch {
          // 继续尝试下一个端点
        }
      }

      // 如果所有端点都失败，设置为 null
      setBalance(null);
    } catch (err) {
      setBalance(null);
      setError("无法获取余额");
    } finally {
      setLoading(false);
    }
  }, [apiConfig.baseURL]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
