"use client";

import {
  useAppStore,
  ASPECT_RATIO_PRESETS,
  QUALITY_OPTIONS,
} from "@/store/use-app-store";
import { ImageLightbox } from "@/components/image-lightbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Plus,
  X,
  Sparkles,
  Settings,
  Loader2,
  StopCircle,
  ClipboardPaste,
  ZoomIn,
  Sun,
  Moon,
  FileText,
  Ratio,
  Gem,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useRef, useCallback, useState, useEffect } from "react";
import { useTheme } from "next-themes";

export function LeftPanel() {
  const {
    draft,
    setDraftPrompt,
    addDraftReferenceImage,
    removeDraftReferenceImage,
    setDraftRatio,
    setDraftCustomRatio,
    setDraftQuality,
    setDraftConcurrency,
    setDraftRiskGuard,
    setSettingsOpen,
    sendMessage,
    cancelGeneration,
    conversations,
    currentConversationId,
  } = useAppStore();

  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  /** 获取当前会话中是否有运行中的任务 */
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const hasRunningTasks = currentConversation?.messages.some(
    (m) =>
      m.role === "assistant" &&
      m.tasks.some((t) => t.status === "running")
  );

  /** 处理文件上传 */
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file, index) => {
        if (draft.referenceImages.length >= 5) return;
        if (!file.type.startsWith("image/")) return;
        if (file.size > 10 * 1024 * 1024) return;

        const fileName = file.name || `image_${Date.now()}_${index}.png`;
        const properFile = new File([file], fileName, {
          type: file.type || "image/png",
        });

        const reader = new FileReader();
        reader.onload = (e) => {
          addDraftReferenceImage({
            id: crypto.randomUUID(),
            file: properFile,
            preview: e.target?.result as string,
          });
        };
        reader.readAsDataURL(properFile);
      });
    },
    [draft.referenceImages.length, addDraftReferenceImage]
  );

  /** 处理拖拽上传 */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  /** 处理粘贴上传 */
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        const dataTransfer = new DataTransfer();
        imageFiles.forEach((file) => dataTransfer.items.add(file));
        handleFileUpload(dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  // 注册全局粘贴事件
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className="studio-panel premium-scroll flex h-dvh w-[320px] shrink-0 flex-col overflow-y-auto border-y-0 border-l-0">
      {/* Logo + 标题 */}
      <div className="flex items-center justify-between border-b soft-divider p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-base font-semibold tracking-normal">AI 绘画工作台</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* 提示词 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" /> 提示词
          </Label>
          <Textarea
            value={draft.prompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder="一只穿着宇航服的猫咪站在月球表面，赛博朋克风格..."
            className="min-h-[120px] resize-none rounded-2xl bg-background/60"
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {draft.prompt.length}/20000
          </p>
        </div>

        {/* 参考图上传 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-primary" /> 参考图
            <Badge variant="secondary" className="ml-auto text-xs">
              {draft.referenceImages.length}/5
            </Badge>
          </Label>

          {/* 图片网格 */}
          <div
            className="flex gap-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {draft.referenceImages.map((img) => (
              <div
                key={img.id}
                className="relative group flex-1 cursor-pointer"
                onClick={() => setPreviewImage(img.preview)}
              >
                <img
                  src={img.preview}
                  alt="参考图"
                  className="w-full aspect-square rounded-2xl object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDraftReferenceImage(img.id);
                  }}
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                  aria-label="移除参考图"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {draft.referenceImages.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-background/45 transition-colors hover:border-primary hover:bg-primary/5",
                  draft.referenceImages.length === 0
                    ? "w-full aspect-square"
                    : "w-16 h-16"
                )}
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
                {draft.referenceImages.length === 0 && (
                  <span className="text-xs text-muted-foreground mt-1">
                    添加图片
                  </span>
                )}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ClipboardPaste className="h-3 w-3" />
            <span>支持粘贴 (Ctrl+V) · 拖拽 · 点击上传</span>
          </div>
        </div>

        {/* 比例设置 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Ratio className="h-4 w-4 text-primary" /> 比例
          </Label>
          <select
            value={draft.selectedRatio}
            onChange={(e) => setDraftRatio(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ASPECT_RATIO_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}{" "}
                {preset.value !== "auto" ? `(${preset.size})` : ""}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>

          {draft.selectedRatio === "custom" && (
            <Input
              value={draft.customRatio}
              onChange={(e) => setDraftCustomRatio(e.target.value)}
              placeholder="宽:高 (如 21:9)"
              className="mt-2"
            />
          )}
        </div>

        {/* 画质选择 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Gem className="h-4 w-4 text-primary" /> 画质
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDraftQuality(opt.value)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-center text-sm transition-all",
                  draft.quality === opt.value
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border/50 bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 并发数 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Layers3 className="h-4 w-4 text-primary" /> 并发数: {draft.concurrency}
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={draft.concurrency}
              onChange={(e) => setDraftConcurrency(Number(e.target.value))}
              className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
            />
            <span className="w-8 text-center text-sm font-medium">
              {draft.concurrency}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* 风控保险 */}
        <div className="flex items-center justify-between py-2">
          <Label className="flex cursor-pointer items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" /> 风控保险
          </Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={draft.riskGuard}
              onChange={(e) => setDraftRiskGuard(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="space-y-2 border-t soft-divider p-4">
        {hasRunningTasks ? (
          <Button
            className="h-12 w-full rounded-2xl text-base"
            variant="destructive"
            onClick={cancelGeneration}
          >
            <StopCircle className="mr-2 h-5 w-5" />
            取消全部
          </Button>
        ) : (
          <Button
            className="h-12 w-full rounded-2xl bg-primary text-base text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            disabled={!draft.prompt.trim() || isGenerating}
            onClick={async () => {
              setIsGenerating(true);
              try {
                await sendMessage();
              } finally {
                setIsGenerating(false);
              }
            }}
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-5 w-5" />
            )}
            {isGenerating ? "生成中..." : "开始生成"}
          </Button>
        )}
      </div>

      {/* 参考图预览灯箱 */}
      {previewImage && (
        <ImageLightbox
          src={previewImage}
          alt="参考图预览"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
