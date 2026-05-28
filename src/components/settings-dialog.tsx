"use client";

import { useState } from "react";
import { useAppStore } from "@/store/use-app-store";
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

/** 常用模型 ID 预设 */
const MODEL_PRESETS = [
  { label: "GPT-Image 2", value: "gpt-image-2" },
];

export function SettingsDialog() {
  const { apiConfig, setApiConfig, settingsOpen, setSettingsOpen } =
    useAppStore();

  const [baseURL, setBaseURL] = useState(apiConfig.baseURL);
  const [useFullUrl, setUseFullUrl] = useState(apiConfig.useFullUrl ?? false);
  const [modelId, setModelId] = useState(apiConfig.modelId);
  // 解混淆显示
  const [apiKey, setApiKey] = useState(() => {
    try {
      return atob(apiConfig.apiKey);
    } catch {
      return apiConfig.apiKey;
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );
  const [testMessage, setTestMessage] = useState("");

  /** 测试连接 - 通过后端代理避免 CORS */
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestMessage("");

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseURL, apiKey, useFullUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResult("success");
        setTestMessage("连接成功！");
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

  /** 保存配置 */
  const handleSave = () => {
    setApiConfig({
      baseURL: baseURL.trim(),
      apiKey: apiKey.trim(),
      modelId: modelId.trim(),
      useFullUrl,
    });
    setSettingsOpen(false);
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>API 配置</DialogTitle>
          <DialogDescription>
            配置 OpenAI 兼容 API 的地址、密钥和模型。所有配置仅存储在浏览器本地。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* BaseURL */}
          <div className="space-y-2">
            <Label htmlFor="baseURL">Base URL</Label>
            <Input
              id="baseURL"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <p className="text-xs text-muted-foreground">
              支持 OpenAI 官方及任意兼容协议的中转地址
            </p>
            <div className="flex items-center gap-2">
              <Switch
                id="useFullUrl"
                checked={useFullUrl}
                onCheckedChange={setUseFullUrl}
              />
              <Label htmlFor="useFullUrl" className="text-sm font-normal cursor-pointer">
                完整 URL 模式
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {useFullUrl
                ? "已开启：直接使用填写的完整 URL 作为请求地址"
                : "关闭时自动在末尾拼接 /images/generations"}
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 模型 ID */}
          <div className="space-y-2">
            <Label htmlFor="modelId">模型 ID</Label>
            <Input
              id="modelId"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="gpt-image-1"
            />
            <div className="flex flex-wrap gap-1.5">
              {MODEL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setModelId(preset.value)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    modelId === preset.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-transparent"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              请根据你的中转站支持的模型 ID 进行配置
            </p>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult === "success"
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {testResult === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !baseURL || !apiKey}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            测试连接
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
