"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppProfile, QuotaSnapshot } from "@/lib/auth/types";

interface AuthContextValue {
  profile: AppProfile | null;
  quota: QuotaSnapshot | null;
  isLoading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setProfile(null);
        setQuota(null);
        return;
      }

      setProfile(data.profile);
      setQuota(data.quota);
    } catch {
      setProfile(null);
      setQuota(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      setProfile(null);
      setQuota(null);
      window.location.href = "/auth";
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleQuotaRefresh = () => {
      void refresh();
    };
    window.addEventListener("quota:refresh", handleQuotaRefresh);

    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          void refresh();
        }
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setQuota(null);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // 环境变量未配置时，页面会通过接口错误提示体现。
    }

    return () => {
      window.removeEventListener("quota:refresh", handleQuotaRefresh);
      unsubscribe?.();
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      quota,
      isLoading,
      isAdmin: profile?.role === "admin",
      refresh,
      signOut,
    }),
    [profile, quota, isLoading, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return context;
}