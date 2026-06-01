"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Download, Copy, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  prompt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, prompt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);

  /** 键盘事件处理 */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 3));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  /** 下载图片 */
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
    link.download = `ai-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("图片已下载");
  };

  /** 复制提示词 */
  const handleCopyPrompt = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      toast.success("提示词已复制");
    }
  };

  const imageSrc = src.startsWith("data:") ? src : `data:image/png;base64,${src}`;

  // 通过 Portal 渲染到 body，避免被带 backdrop-filter/transform 的祖先困住 fixed 定位
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 工具栏 */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
          title="缩小 (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-white text-sm min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
          title="放大 (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-white/20 mx-1" />
        <Button
          variant="secondary"
          size="icon"
          onClick={handleDownload}
          title="下载图片"
        >
          <Download className="h-4 w-4" />
        </Button>
        {prompt && (
          <Button
            variant="secondary"
            size="icon"
            onClick={handleCopyPrompt}
            title="复制提示词"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        <div className="w-px h-6 bg-white/20 mx-1" />
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          title="关闭 (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 图片 */}
      <div
        className="max-w-[95vw] max-h-[95vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageSrc}
          alt={alt || "AI 生成图片"}
          className="max-w-full max-h-[92vh] object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>

      {/* 底部提示词 */}
      {prompt && (
        <div
          className="absolute bottom-4 left-4 right-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white/80 text-sm line-clamp-2 max-w-2xl mx-auto bg-black/50 rounded-lg px-4 py-2">
            {prompt}
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
