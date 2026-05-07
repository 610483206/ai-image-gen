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
    <div className="w-[320px] shrink-0 border-r bg-card flex flex-col h-screen overflow-y-auto">
      {/* Logo + 标题 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI 绘画</h1>
            <p className="text-xs text-muted-foreground">用文字创造画面</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* 提示词 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <span>📝</span> 提示词
          </Label>
          <Textarea
            value={draft.prompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder="一只穿着宇航服的猫咪站在月球表面，赛博朋克风格..."
            className="min-h-[120px] resize-none"
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {draft.prompt.length}/20000
          </p>
        </div>

        {/* 参考图上传 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <span>🖼️</span> 参考图
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
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDraftReferenceImage(img.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {draft.referenceImages.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-colors",
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
            <span>📐</span> 比例
          </Label>
          <select
            value={draft.selectedRatio}
            onChange={(e) => setDraftRatio(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <span>💎</span> 画质
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDraftQuality(opt.value)}
                className={cn(
                  "py-2 px-3 rounded-lg border-2 text-center text-sm transition-all",
                  draft.quality === opt.value
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-transparent bg-muted hover:border-muted-foreground/20"
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
            <span>⚡</span> 并发数: {draft.concurrency}
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
          <Label className="flex items-center gap-1.5 cursor-pointer">
            <span>🛡️</span> 风控保险
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
      <div className="p-4 border-t space-y-2">
        {hasRunningTasks ? (
          <Button
            className="w-full h-12 text-base"
            variant="destructive"
            onClick={cancelGeneration}
          >
            <StopCircle className="mr-2 h-5 w-5" />
            取消全部
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
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
