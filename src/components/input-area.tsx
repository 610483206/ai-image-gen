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
      className={`border-t border-border/50 bg-card shrink-0 transition-colors ${
        isDragging ? "bg-primary/5 border-primary" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="text-primary font-medium">松开鼠标上传图片</div>
        </div>
      )}

      <div className="p-4">
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
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md transition-all duration-300 group-hover:border-primary group-hover:scale-110">
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
                  </div>
                );
              })}
            </div>

            {/* 上传按钮和计数 */}
            <div className="flex items-center gap-2">
              {imageCount < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-primary/50 hover:text-primary/50 transition-all duration-300 hover:scale-105"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
              {imageCount > 0 && (
                <span className="text-xs text-muted-foreground">{imageCount}/3</span>
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
            placeholder="描述你想要的图片或修改建议..."
            className="min-h-[52px] max-h-[160px] resize-none rounded-2xl bg-muted/50 border-border/50 focus:bg-muted transition-colors pr-24"
            maxLength={20000}
            rows={1}
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-muted"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {hasRunningTasks ? (
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={cancelGeneration}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
                disabled={!draft.prompt.trim() && draft.referenceImages.length === 0 || isSending}
                onClick={handleSend}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 参数工具栏 - 带提示 */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="relative group">
            <select
              value={draft.selectedRatio}
              onChange={(e) => setDraftRatio(e.target.value)}
              className="h-8 pl-7 pr-3 rounded-full border border-border/50 bg-muted/50 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {ASPECT_RATIO_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">自定义</option>
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">📐</span>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              比例（默认自动）
            </div>
          </div>

          {draft.selectedRatio === "custom" && (
            <Input
              value={draft.customRatio}
              onChange={(e) => setDraftCustomRatio(e.target.value)}
              placeholder="宽:高"
              className="h-8 w-20 text-xs rounded-full bg-muted/50 border-border/50"
            />
          )}

          <div className="relative group">
            <select
              value={draft.quality}
              onChange={(e) => setDraftQuality(e.target.value as "low" | "medium" | "high" | "auto")}
              className="h-8 pl-7 pr-3 rounded-full border border-border/50 bg-muted/50 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">💎</span>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              质量（默认高品质）
            </div>
          </div>

          <div className="relative group">
            <select
              value={draft.concurrency}
              onChange={(e) => setDraftConcurrency(Number(e.target.value))}
              className="h-8 pl-7 pr-3 rounded-full border border-border/50 bg-muted/50 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {Array.from({ length: 3 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}张
                </option>
              ))}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">⚡</span>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
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
