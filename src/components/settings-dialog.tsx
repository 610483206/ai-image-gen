"use client";

import { useEffect, useState } from "react";
import { useAppStore, type ApiConfigMode } from "@/store/use-app-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const MODEL_PRESETS = [{ label: "GPT-Image 2", value: "gpt-image-2" }];

function decodeStoredKey(value: string): string {
  try {
    return atob(value);
  } catch {
    return value;
  }
}

export function SettingsDialog() {
  const { apiConfig, setApiConfig, settingsOpen, setSettingsOpen } = useAppStore();

  const [mode, setMode] = useState<ApiConfigMode>(apiConfig.mode);
  const [baseURL, setBaseURL] = useState(apiConfig.baseURL);
  const [useFullUrl, setUseFullUrl] = useState(apiConfig.useFullUrl ?? false);
  const [modelId, setModelId] = useState(apiConfig.modelId);
  const [apiKey, setApiKey] = useState(() => decodeStoredKey(apiConfig.apiKey));
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (!settingsOpen) return;
    setMode(apiConfig.mode);
    setBaseURL(apiConfig.mode === "custom" ? apiConfig.baseURL : "");
    setUseFullUrl(apiConfig.mode === "custom" ? apiConfig.useFullUrl : false);
    setModelId(apiConfig.modelId || "gpt-image-2");
    setApiKey(apiConfig.mode === "custom" ? decodeStoredKey(apiConfig.apiKey) : "");
    setShowKey(false);
    setTestResult(null);
    setTestMessage("");
  }, [apiConfig, settingsOpen]);

  const isCustom = mode === "custom";

  const handleTestConnection = async () => {
    if (!isCustom) return;
    if (!baseURL.trim() || !apiKey.trim()) {
      setTestResult("error");
      setTestMessage("请先填写 Base URL 和 API Key");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestMessage("");

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upstreamConfig: {
            baseURL,
            apiKey,
            modelId,
            useFullUrl,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResult("success");
        setTestMessage("连接成功");
      } else {
        setTestResult("error");
        setTestMessage(data.error || "连接失败");
      }
    } catch (err) {
      setTestResult("error");
      setTestMessage(err instanceof Error ? err.message : "网络错误");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!isCustom) {
      setApiConfig({
        mode: "platform",
        baseURL: "",
        apiKey: "",
        modelId: "gpt-image-2",
        useFullUrl: false,
      });
      setSettingsOpen(false);
      return;
    }

    if (!baseURL.trim() || !apiKey.trim()) {
      setTestResult("error");
      setTestMessage("自定义上游需要填写 Base URL 和 API Key");
      return;
    }

    setApiConfig({
      mode: "custom",
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim(),
      modelId: modelId.trim(),
      useFullUrl,
    });
    setSettingsOpen(false);
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="studio-panel gap-5 rounded-2xl p-5 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-normal">API 配置</DialogTitle>
          <DialogDescription className="leading-relaxed">
            普通用户默认使用平台配置，默认 Base URL 和 API Key 不会在这里展示。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
            <Button
              type="button"
              variant={mode === "platform" ? "default" : "ghost"}
              className="h-9 rounded-lg"
              onClick={() => setMode("platform")}
            >
              平台默认
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "ghost"}
              className="h-9 rounded-lg"
              onClick={() => setMode("custom")}
            >
              自定义上游
            </Button>
          </div>

          {!isCustom ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              当前请求会使用管理员维护的平台默认上游配置。默认地址和密钥仅保存在服务端。
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="baseURL">Base URL</Label>
                <Input
                  id="baseURL"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="h-10 rounded-xl bg-background/60"
                />
                <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <Switch id="useFullUrl" checked={useFullUrl} onCheckedChange={setUseFullUrl} />
                  <Label htmlFor="useFullUrl" className="cursor-pointer text-sm font-normal">
                    完整 URL 模式
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {useFullUrl ? "直接使用完整 URL 作为请求地址" : "自动在末尾拼接 /images/generations"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-10 rounded-xl bg-background/60 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8 rounded-lg"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelId">模型 ID</Label>
                <Input
                  id="modelId"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="gpt-image-2"
                  className="h-10 rounded-xl bg-background/60"
                />
                <div className="flex flex-wrap gap-1.5">
                  {MODEL_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setModelId(preset.value)}
                      className={`min-h-8 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                        modelId === preset.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-muted/40 hover:bg-muted"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                testResult === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {testResult === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testMessage}
            </div>
          )}
        </div>

        <DialogFooter className="-mx-5 -mb-5 gap-2 rounded-b-2xl border-border/70 bg-muted/30 p-5 sm:gap-2">
          {isCustom && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !baseURL || !apiKey}
              className="h-10 rounded-xl"
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试连接
            </Button>
          )}
          <Button onClick={handleSave} className="h-10 rounded-xl shadow-lg shadow-primary/20">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
