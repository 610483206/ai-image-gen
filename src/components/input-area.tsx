"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useAppStore, ASPECT_RATIO_PRESETS, QUALITY_OPTIONS } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Paperclip,
  ArrowUp,
  Square,
  X,
  Plus,
  Ratio,
  Gem,
  Layers3,
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
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const hasRunningTasks = currentConversation?.messages.some(
    (m) => m.role === "assistant" && m.tasks.some((t) => t.status === "running")
  );

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

  // 扇形展开计算
  const getFanStyle = (index: number, total: number, isHovering: boolean) => {
    if (total <= 1) return {};

    const spreadAngle = isHovering ? 50 : 15;
    const startAngle = -spreadAngle / 2;
    const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
    const angle = startAngle + angleStep * index;
    const translateY = isHovering ? -12 : -4;

    return {
      transform: `rotate(${angle}deg) translateY(${translateY}px)`,
      transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  };

  const imageCount = draft.referenceImages.length;

  return (
    <div
      ref={dropZoneRef}
      className={`relative shrink-0 border-t border-border/60 bg-card/80 backdrop-blur-xl transition-colors ${
        isDragging ? "border-primary bg-primary/5" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="rounded-full bg-card/90 px-4 py-2 text-sm font-medium text-primary shadow-lg">松开鼠标上传图片</div>
        </div>
      )}

      <div className="mx-auto max-w-5xl p-4 lg:px-8">
        {/* 参考图 - 扇形展开效果 */}
        <div
          className="mb-3"
          onMouseEnter={() => imageCount > 1 && setIsImagesExpanded(true)}
          onMouseLeave={() => imageCount > 1 && setIsImagesExpanded(false)}
        >
          <div className="flex items-center gap-2">
            {/* 参考图扇形区域 */}
            <div
              className="relative flex items-end"
              style={{ height: "56px", minWidth: imageCount > 0 ? `${60 + imageCount * 20}px` : "0px" }}
            >
              {draft.referenceImages.map((img, index) => {
                const style = getFanStyle(index, imageCount, isImagesExpanded);
                return (
                  <div
                    key={img.id}
                    className="absolute cursor-pointer"
                    style={{
                      ...style,
                      zIndex: index,
                      transformOrigin: "bottom center",
                      left: `${index * 20}px`,
                    }}
                    onClick={() => setPreviewImage(img.preview)}
                  >
                    <div className="relative group">
                      <div className="h-12 w-12 overflow-hidden rounded-2xl border-2 border-background bg-muted shadow-lg shadow-black/10 transition-all duration-300 group-hover:border-primary group-hover:scale-105">
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
                        className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-md transition-all duration-200 hover:scale-105 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        aria-label="移除参考图"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 上传按钮和计数 */}
            <div className="flex items-center gap-2">
              {imageCount < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-background/50 text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label="上传参考图"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
              {imageCount > 0 && (
                <span className="rounded-full border border-border/60 bg-background/50 px-2 py-1 text-xs text-muted-foreground">{imageCount}/3</span>
              )}
            </div>
          </div>
        </div>

        {/* 输入框和发送按钮 */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={draft.prompt}
            onChange={(e) => {
              setDraftPrompt(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="描述画面、风格、光线、镜头或修改建议..."
            className="min-h-[64px] max-h-[160px] resize-none rounded-3xl border-border/70 bg-background/70 py-4 pl-4 pr-28 text-[15px] shadow-[0_16px_50px_rgba(8,13,24,0.10)] backdrop-blur-xl transition-colors focus:bg-background"
            maxLength={20000}
            rows={1}
          />

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              aria-label="添加参考图"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {hasRunningTasks ? (
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10 rounded-2xl"
                onClick={cancelGeneration}
                aria-label="停止生成"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                disabled={!draft.prompt.trim() && draft.referenceImages.length === 0 || isSending}
                onClick={handleSend}
                aria-label="发送生成请求"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 参数工具栏 - 带提示 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative group">
            <select
              value={draft.selectedRatio}
              onChange={(e) => setDraftRatio(e.target.value)}
              className="h-9 min-w-[108px] cursor-pointer rounded-full border border-border/70 bg-background/60 pl-9 pr-3 text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 focus:ring-2 focus:ring-ring/50"
              aria-label="选择图片比例"
            >
              {ASPECT_RATIO_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
            <Ratio className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              比例（默认自动）
            </div>
          </div>

          {draft.selectedRatio === "custom" && (
            <Input
              value={draft.customRatio}
              onChange={(e) => setDraftCustomRatio(e.target.value)}
              placeholder="宽:高"
              className="h-9 w-24 rounded-full border-border/70 bg-background/60 text-xs shadow-sm"
            />
          )}

          <div className="relative group">
            <select
              value={draft.quality}
              onChange={(e) => setDraftQuality(e.target.value as "low" | "medium" | "high" | "auto")}
              className="h-9 min-w-[110px] cursor-pointer rounded-full border border-border/70 bg-background/60 pl-9 pr-3 text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 focus:ring-2 focus:ring-ring/50"
              aria-label="选择生成质量"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Gem className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              质量（默认高品质）
            </div>
          </div>

          <div className="relative group">
            <select
              value={draft.concurrency}
              onChange={(e) => setDraftConcurrency(Number(e.target.value))}
              className="h-9 min-w-[92px] cursor-pointer rounded-full border border-border/70 bg-background/60 pl-9 pr-3 text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 focus:ring-2 focus:ring-ring/50"
              aria-label="选择生成张数"
            >
              {Array.from({ length: 3 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}张
                </option>
              ))}
            </select>
            <Layers3 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              并发（默认1）
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

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
