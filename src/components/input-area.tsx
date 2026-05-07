"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppStore, ASPECT_RATIO_PRESETS, QUALITY_OPTIONS } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Paperclip,
  Send,
  Square,
  X,
  ZoomIn,
  ClipboardPaste,
  Loader2,
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
      // 只在 textarea 获得焦点或输入区域内处理粘贴
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

  // 注册全局粘贴事件
  useEffect(() => {
    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [handlePaste]);

  /** 处理拖拽进入 */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /** 处理拖拽离开 */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开整个区域时才设置为 false
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

  /** 处理拖拽悬停 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /** 处理拖拽放下 */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  /** 发送消息 */
  const handleSend = async () => {
    if (!draft.prompt.trim() && draft.referenceImages.length === 0) return;
    setIsSending(true);
    try {
      await sendMessage();
    } finally {
      setIsSending(false);
    }
  };

  /** 键盘事件 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 自动调整 textarea 高度 */
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft.prompt, adjustTextareaHeight]);

  return (
    <div
      ref={dropZoneRef}
      className={`border-t bg-card p-4 shrink-0 transition-colors ${
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

      {/* 参考图槽位 */}
      {draft.referenceImages.length > 0 && (
        <div className="flex gap-2.5 mb-3 overflow-x-auto pb-1">
          {draft.referenceImages.map((img) => (
            <div
              key={img.id}
              className="relative group shrink-0 cursor-pointer"
              onClick={() => setPreviewImage(img.preview)}
            >
              <img
                src={img.preview}
                alt="参考图"
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                <ZoomIn className="h-4 w-4 text-white" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeDraftReferenceImage(img.id);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Badge variant="secondary" className="shrink-0 self-center text-xs">
            {draft.referenceImages.length}/3
          </Badge>
        </div>
      )}

      {/* 输入框 */}
      <div className="flex gap-2 items-end">
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
            className="min-h-[60px] max-h-[200px] resize-y pr-10"
            maxLength={20000}
            rows={2}
          />
          <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {draft.prompt.length}/20000
          </span>
        </div>

        {/* 发送/停止按钮 */}
        {hasRunningTasks ? (
          <Button
            variant="destructive"
            size="icon"
            className="h-[60px] w-11 shrink-0"
            onClick={cancelGeneration}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-[60px] w-11 shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            disabled={!draft.prompt.trim() && draft.referenceImages.length === 0 || isSending}
            onClick={handleSend}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* 参数工具栏 */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* 上传按钮（文字版） */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-3 w-3" />
          上传
        </Button>

        {/* 比例下拉 */}
        <select
          value={draft.selectedRatio}
          onChange={(e) => setDraftRatio(e.target.value)}
          className="h-7 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ASPECT_RATIO_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              📐 {preset.label}
            </option>
          ))}
          <option value="custom">📐 自定义</option>
        </select>

        {draft.selectedRatio === "custom" && (
          <Input
            value={draft.customRatio}
            onChange={(e) => setDraftCustomRatio(e.target.value)}
            placeholder="宽:高"
            className="h-7 w-20 text-xs"
          />
        )}

        {/* 画质下拉 */}
        <select
          value={draft.quality}
          onChange={(e) => setDraftQuality(e.target.value as "low" | "medium" | "high" | "auto")}
          className="h-7 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {QUALITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              💎 {opt.label}
            </option>
          ))}
        </select>

        {/* 并发数下拉 */}
        <select
          value={draft.concurrency}
          onChange={(e) => setDraftConcurrency(Number(e.target.value))}
          className="h-7 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              ⚡ 并发{n}
            </option>
          ))}
        </select>

        {/* 风控保险 */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-xs">🛡️</span>
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
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <ClipboardPaste className="h-3 w-3" />
        <span>支持粘贴 (Ctrl+V) · 拖拽 · Enter 发送 · Shift+Enter 换行</span>
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
