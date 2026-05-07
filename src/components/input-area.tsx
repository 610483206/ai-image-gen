"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppStore, ASPECT_RATIO_PRESETS, QUALITY_OPTIONS } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Paperclip,
  Send,
  Square,
  X,
  ClipboardPaste,
  Loader2,
  Plus,
} from "lucide-react";
import { ImageLightbox } from "@/components/image-lightbox";

export function InputArea() {
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
    sendMessage,
    cancelGeneration,
    conversations,
    currentConversationId,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  /** 是否有运行中的任务 */
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const hasRunningTasks = currentConversation?.messages.some(
    (m) => m.role === "assistant" && m.tasks.some((t) => t.status === "running")
  );

  /** 处理文件上传 */
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file, index) => {
        if (draft.referenceImages.length >= 3) return;
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

  /** 处理粘贴上传 */
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputArea = dropZoneRef.current?.contains(target);
      const isTextarea = target.tagName === "TEXTAREA";

      if (!isInputArea && !isTextarea) return;

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
        e.stopPropagation();
        const dataTransfer = new DataTransfer();
        imageFiles.forEach((file) => dataTransfer.items.add(file));
        handleFileUpload(dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [handlePaste]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleSend = async () => {
    if (!draft.prompt.trim() && draft.referenceImages.length === 0) return;
    setIsSending(true);
    try {
      await sendMessage();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft.prompt, adjustTextareaHeight]);

  return (
    <div
      ref={dropZoneRef}
      className={`border-t bg-card shrink-0 transition-colors ${
        isDragging ? "bg-primary/5 border-primary" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 拖拽提示 */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="text-primary font-medium">松开鼠标上传图片</div>
        </div>
      )}

      {/* 主输入区域 */}
      <div className="p-4">
        {/* 参考图槽位 - 圆形样式 */}
        {draft.referenceImages.length > 0 && (
          <div className="flex gap-3 mb-3 items-center">
            {draft.referenceImages.map((img) => (
              <div
                key={img.id}
                className="relative group shrink-0 cursor-pointer"
                onClick={() => setPreviewImage(img.preview)}
              >
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-transparent transition-all duration-300 group-hover:border-primary group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                  <img
                    src={img.preview}
                    alt="参考图"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDraftReferenceImage(img.id);
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 hover:scale-110"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-primary/50 hover:text-primary/50 transition-all duration-300 hover:scale-105"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* 输入框和发送按钮 */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={draft.prompt}
              onChange={(e) => {
                setDraftPrompt(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="描述你想要的图片或修改建议..."
              className="min-h-[52px] max-h-[160px] resize-none rounded-2xl bg-muted/50 border-border/50 focus:bg-muted transition-colors"
              maxLength={20000}
              rows={1}
            />
          </div>

          {/* 发送/停止按钮 - 圆形 */}
          {hasRunningTasks ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-12 w-12 rounded-full shrink-0"
              onClick={cancelGeneration}
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/25"
              disabled={!draft.prompt.trim() && draft.referenceImages.length === 0 || isSending}
              onClick={handleSend}
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 参数工具栏 */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        {/* 上传按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full text-xs gap-1.5 border-dashed"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          上传参考图
        </Button>

        {/* 比例下拉 */}
        <select
          value={draft.selectedRatio}
          onChange={(e) => setDraftRatio(e.target.value)}
          className="h-8 px-3 rounded-full border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          {ASPECT_RATIO_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">自定义</option>
        </select>

        {draft.selectedRatio === "custom" && (
          <Input
            value={draft.customRatio}
            onChange={(e) => setDraftCustomRatio(e.target.value)}
            placeholder="宽:高"
            className="h-8 w-20 text-xs rounded-full"
          />
        )}

        {/* 画质下拉 */}
        <select
          value={draft.quality}
          onChange={(e) => setDraftQuality(e.target.value as "low" | "medium" | "high" | "auto")}
          className="h-8 px-3 rounded-full border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 并发数下拉 */}
        <select
          value={draft.concurrency}
          onChange={(e) => setDraftConcurrency(Number(e.target.value))}
          className="h-8 px-3 rounded-full border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}条
            </option>
          ))}
        </select>

        {/* 风控保险 */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={draft.riskGuard}
              onChange={(e) => setDraftRiskGuard(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
          </div>
          <span className="text-xs text-muted-foreground">风控</span>
        </label>
      </div>

      {/* 提示信息 */}
      <div className="px-4 pb-3 flex items-center gap-1 text-xs text-muted-foreground/60">
        <ClipboardPaste className="h-3 w-3" />
        <span>粘贴 (Ctrl+V) · 拖拽 · Enter 发送</span>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

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
