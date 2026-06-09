"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LockKeyhole, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";

interface PasswordAuthResponse {
  success?: boolean;
  error?: string;
  code?: string;
  isNewUser?: boolean;
  confirmationRequired?: boolean;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.43Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.9A6 6 0 0 1 6.07 12c0-.66.11-1.3.32-1.9V7.51H3.05a10 10 0 0 0 0 8.98l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.97c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.96 14.69 2 12 2a10 10 0 0 0-8.95 5.51l3.34 2.59C7.18 7.73 9.39 5.97 12 5.97Z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.09.68-.22.68-.49v-1.91c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.37 9.37 0 0 1 12 6.91c.85 0 1.7.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9v2.83c0 .27.18.58.69.48A10.12 10.12 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.toLowerCase().includes("rate limit")) return "请求太频繁，请稍后再试";
  if (message.toLowerCase().includes("invalid")) return "邮箱或密码不正确";
  return message || "登录失败，请稍后重试";
}

export function AuthCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) setNextPath(next);
    if (searchParams.get("error") === "auth_callback_failed") {
      toast.error("授权回调无效或已过期，请重新登录");
    }
  }, []);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = Boolean(normalizedEmail && password.length >= 6);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const getRedirectTo = () => {
    const redirectTo = new URL("/auth/callback", window.location.origin);
    return redirectTo.toString();
  };

  const postPasswordAuth = async (body: Record<string, string>) => {
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as PasswordAuthResponse | null;

    if (!response.ok || (!data?.success && !data?.confirmationRequired)) {
      throw new Error(data?.error || "登录失败，请稍后重试");
    }

    return data;
  };

  const showConfirmationSent = (message = "确认邮件已发送，请查看邮箱") => {
    document.cookie = `auth_next=${encodeURIComponent(nextPath)}; Max-Age=600; Path=/; SameSite=Lax`;
    setConfirmationPending(true);
    setResendCooldown(60);
    toast.success(message);
  };

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const data = await postPasswordAuth({ email: normalizedEmail, password });

      if (data.confirmationRequired) {
        showConfirmationSent();
        return;
      }

      toast.success(data.isNewUser ? "注册成功并登录" : "登录成功");
      window.location.assign(nextPath);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!canSubmit || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const data = await postPasswordAuth({
        action: "resend_confirmation",
        email: normalizedEmail,
        password,
      });
      if (data.confirmationRequired) {
        showConfirmationSent("确认邮件已重新发送");
        return;
      }
      toast.success("登录成功");
      window.location.assign(nextPath);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  const resetConfirmationNotice = () => {
    setConfirmationPending(false);
    setResendCooldown(0);
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOauthProvider(provider);
    try {
      document.cookie = `oauth_next=${encodeURIComponent(nextPath)}; Max-Age=600; Path=/; SameSite=Lax`;
      const { data, error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectTo(),
        },
      });

      if (error) throw error;
      if (data.url) window.location.assign(data.url);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setOauthProvider(null);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <CardTitle className="text-xl">登录 AI 绘画工作台</CardTitle>
          <CardDescription className="mt-2">
            老用户使用邮箱密码登录；新邮箱首次注册需要点击邮件确认链接。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handlePasswordLogin}>
          {confirmationPending && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              确认邮件已发送至 {normalizedEmail}，请点击邮件中的确认链接完成注册。确认成功后会自动登录，后续只需要邮箱密码。
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  resetConfirmationNotice();
                }}
                placeholder="you@example.com"
                className="h-11 rounded-2xl pl-9"
                autoComplete="email"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  resetConfirmationNotice();
                }}
                placeholder="至少 6 位字符"
                className="h-11 rounded-2xl pl-9"
                autoComplete="current-password"
                disabled={isSubmitting}
                minLength={6}
                required
              />
            </div>
          </div>
          <Button
            className="h-11 w-full rounded-2xl"
            type="submit"
            disabled={isSubmitting || isResending || oauthProvider !== null || !canSubmit}
          >
            {isSubmitting ? "处理中..." : "邮箱登录 / 新用户注册"}
          </Button>
          {confirmationPending && (
            <div className="grid gap-3">
              <Button
                className="h-10 rounded-2xl"
                type="button"
                variant="outline"
                onClick={() => void handleResendConfirmation()}
                disabled={isSubmitting || isResending || resendCooldown > 0 || !canSubmit}
              >
                {isResending ? "发送中..." : resendCooldown > 0 ? `重发 ${resendCooldown}s` : "重新发送确认邮件"}
              </Button>
            </div>
          )}
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border/70" />
          <span>或使用平台授权</span>
          <div className="h-px flex-1 bg-border/70" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-11 rounded-2xl"
            type="button"
            variant="outline"
            disabled={isSubmitting || isResending || oauthProvider !== null}
            onClick={() => void handleOAuthLogin("google")}
          >
            <GoogleIcon className="h-4 w-4" />
            Google
          </Button>
          <Button
            className="h-11 rounded-2xl"
            type="button"
            variant="outline"
            disabled={isSubmitting || isResending || oauthProvider !== null}
            onClick={() => void handleOAuthLogin("github")}
          >
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
