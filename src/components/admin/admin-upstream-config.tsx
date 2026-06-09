"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, RefreshCw, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface UpstreamConfigSnapshot {
  baseURL: string;
  modelId: string;
  useFullUrl: boolean;
  hasApiKey: boolean;
  source: "database" | "environment";
  updatedAt: string | null;
}

export function AdminUpstreamConfig() {
  const [config, setConfig] = useState<UpstreamConfigSnapshot | null>(null);
  const [baseURL, setBaseURL] = useState("");
  const [modelId, setModelId] = useState("gpt-image-2");
  const [apiKey, setApiKey] = useState("");
  const [useFullUrl, setUseFullUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const applyConfig = (nextConfig: UpstreamConfigSnapshot) => {
    setConfig(nextConfig);
    setBaseURL(nextConfig.baseURL);
    setModelId(nextConfig.modelId || "gpt-image-2");
    setUseFullUrl(nextConfig.useFullUrl);
    setApiKey("");
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users?resource=upstream-config", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "读取默认上游配置失败");
      applyConfig(data.config as UpstreamConfigSnapshot);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取默认上游配置失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    if (!baseURL.trim()) {
      toast.error("Base URL 不能为空");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/users?resource=upstream-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseURL: baseURL.trim(),
          apiKey: apiKey.trim(),
          modelId: modelId.trim(),
          useFullUrl,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "保存默认上游配置失败");
      applyConfig(data.config as UpstreamConfigSnapshot);
      toast.success("默认上游配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存默认上游配置失败");
    } finally {
      setIsSaving(false);
    }
  };

  const testDefaultConfig = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestMessage("");

    try {
      const response = await fetch("/api/test-connection", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "连接失败");
      setTestResult("success");
      setTestMessage("连接成功");
    } catch (error) {
      setTestResult("error");
      setTestMessage(error instanceof Error ? error.message : "连接失败");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-xl shadow-black/5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="h-4 w-4" /> 默认上游配置
          </div>
          <h2 className="text-xl font-semibold tracking-tight">平台生图 API</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            普通用户使用平台默认配置时不会看到默认 Base URL 或 API Key。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config && (
            <Badge variant="secondary" className="h-9 rounded-xl px-3">
              {config.source === "database" ? "数据库配置" : "环境变量兜底"}
            </Badge>
          )}
          <Button variant="outline" className="h-9 rounded-xl" onClick={() => void loadConfig()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="adminBaseURL">Base URL</Label>
          <Input
            id="adminBaseURL"
            value={baseURL}
            onChange={(event) => setBaseURL(event.target.value)}
            disabled={isLoading}
            placeholder="https://api.openai.com/v1"
            className="h-10 rounded-xl bg-background/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminApiKey">API Key</Label>
          <Input
            id="adminApiKey"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            disabled={isLoading}
            placeholder={config?.hasApiKey ? "已配置，留空保持当前密钥" : "首次保存必须填写"}
            className="h-10 rounded-xl bg-background/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminModelId">模型 ID</Label>
          <Input
            id="adminModelId"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={isLoading}
            placeholder="gpt-image-2"
            className="h-10 rounded-xl bg-background/60 lg:w-44"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <Switch id="adminUseFullUrl" checked={useFullUrl} onCheckedChange={setUseFullUrl} disabled={isLoading} />
          <Label htmlFor="adminUseFullUrl" className="cursor-pointer text-sm font-normal">
            完整 URL 模式
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => void testDefaultConfig()}
            disabled={isTesting || isLoading}
          >
            {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
            测试默认连接
          </Button>
          <Button className="h-10 rounded-xl" onClick={() => void saveConfig()} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存默认配置
          </Button>
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
            testResult === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {testResult === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {testMessage}
        </div>
      )}
    </section>
  );
}
