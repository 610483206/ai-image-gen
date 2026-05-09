"use client";

import { useState } from "react";
import { useAppStore, type GenerateTask } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  Download,
  Copy,
  RotateCcw,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  ZoomIn,
  Timer,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  useElapsedTime,
  useSimulatedProgress,
  getProgressText,
} from "@/hooks/use-elapsed-time";

export function RightPanel() {
  const {
    conversations,
    currentConversationId,
    regenerateSingleImage,
    cancelGeneration,
    removeMessage,
  } = useAppStore();

  const [bannerVisible, setBannerVisible] = useState(true);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const messages = currentConversation?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* 顶部提示条 - 可关闭 */}
      {bannerVisible && (
        <div className="bg-muted/60 backdrop-blur-sm border-b border-border/50 px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-3 shrink-0">
          <Info className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="flex-1 leading-relaxed">
            生成的图片仅保存在当前浏览器中，保留 3 天后自动清理。请及时下载保存重要图片。
          </span>
          <button
            onClick={() => setBannerVisible(false)}
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* 对话流 */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => {
              if (message.role === "user") {
                return (
                  <UserMessageBubble key={message.id} message={message} />
                );
              }
              return (
                <AssistantMessageBubble
                  key={message.id}
                  message={message as { role: "assistant"; id: string; tasks: GenerateTask[]; params: { size: string; quality: string; concurrency: number; riskGuard: boolean }; durationMs?: number }}
                  onRegenerateSingle={(taskIndex) =>
                    regenerateSingleImage(message.id, taskIndex)
                  }
                  onCancel={cancelGeneration}
                  onRemove={() => removeMessage(message.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** 空状态组件 - 悬挂照片风格 */
function EmptyState() {
  const { setDraftPrompt } = useAppStore();

  const examples = [
    "一只穿着宇航服的猫咪站在月球表面",
    "赛博朋克风格的东京街头夜景",
    "水彩风格的中国山水画",
  ];

  const photos = [
    {
      src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=280&h=360&fit=crop&auto=format",
      alt: "彩色颜料飞溅",
    },
    {
      src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=280&h=360&fit=crop&auto=format",
      alt: "人物特写肖像",
    },
    {
      src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=280&h=360&fit=crop&auto=format",
      alt: "山间云海风景",
    },
    {
      src: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=280&h=360&fit=crop&auto=format",
      alt: "艺术油画",
    },
    {
      src: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=280&h=360&fit=crop&auto=format",
      alt: "霓虹灯光艺术",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      {/* 悬挂照片区域 */}
      <div className="relative mb-10 w-full max-w-3xl">
        {/* SVG 半圆弧形绳索 + 照片挂绳 */}
        <svg
          className="absolute top-0 left-0 w-full"
          style={{ height: "110px" }}
          viewBox="0 0 800 110"
          preserveAspectRatio="xMidYMin meet"
        >
          {/* 半圆弧形主绳 - 明显下垂的弧线 */}
          <path
            d="M 40 6 Q 400 140 760 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-muted-foreground/20"
          />
          {/* 左固定钉 */}
          <circle cx="40" cy="6" r="3.5" className="fill-muted-foreground/30" />
          {/* 右固定钉 */}
          <circle cx="760" cy="6" r="3.5" className="fill-muted-foreground/30" />
          {/* 5根挂绳 - 从弧线对应位置下垂 */}
          <path d="M 136 28 L 136 62" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/18" />
          <path d="M 268 48 L 268 82" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/18" />
          <path d="M 400 58 L 400 92" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/18" />
          <path d="M 532 48 L 532 82" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/18" />
          <path d="M 664 28 L 664 62" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/18" />
        </svg>

        {/* 照片卡片 - 跟随弧线高低排列 */}
        <div className="flex justify-center items-end gap-5" style={{ paddingTop: "96px" }}>
          {photos.map((photo, i) => {
            // 外低内高，跟随弧线
            const offsets = [0, 20, 30, 20, 0];
            return (
              <div
                key={i}
                className="hanging-photo flex flex-col items-center"
                style={{ marginTop: `${offsets[i]}px` }}
              >
                <div className="relative w-[120px] h-[152px] rounded-lg border border-white/[0.1] shadow-xl shadow-black/30 overflow-hidden bg-muted/20">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 文案 */}
      <div className="space-y-3 mb-8">
        <h3 className="text-2xl font-bold tracking-tight">准备开始创作</h3>
        <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
          输入描述你想要的图片，AI 将根据你的描述生成独特的视觉作品
        </p>
      </div>

      {/* 示例提示词 */}
      <div className="flex flex-wrap gap-2.5 justify-center">
        {examples.map((example) => (
          <button
            key={example}
            onClick={() => setDraftPrompt(example)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/30 hover:bg-accent/60 border border-white/[0.06] transition-all duration-200 text-sm text-muted-foreground hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 用户消息气泡 */
function UserMessageBubble({
  message,
}: {
  message: {
    id: string;
    role: "user";
    prompt: string;
    referenceImages: { id: string; name: string; data: string }[];
    params: { size: string; quality: string; concurrency: number; riskGuard: boolean };
    createdAt: number;
  };
}) {
  const setImageAsReference = useAppStore((s) => s.setImageAsReference);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          {/* 参考图缩略图 */}
          {message.referenceImages.length > 0 && (
            <div className="flex gap-2 justify-end">
              {message.referenceImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.data}
                    alt={img.name}
                    className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                    onClick={() => setLightboxSrc(img.data)}
                  />
                  {/* 悬浮操作按钮 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded-lg">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => setLightboxSrc(img.data)}
                      title="放大预览"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => {
                        setImageAsReference(img.data);
                        toast.success("已添加到参考图");
                      }}
                      title="以此图为参考"
                    >
                      <span className="text-xs">✏️</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 消息内容 */}
          <div className="bg-primary/10 text-foreground rounded-2xl rounded-tr-md px-4 py-3">
            <p className="text-sm whitespace-pre-wrap">{message.prompt}</p>
          </div>
        </div>
      </div>

      {/* 灯箱 */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="参考图预览"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}

/** AI 消息气泡 */
function AssistantMessageBubble({
  message,
  onRegenerateSingle,
  onCancel,
  onRemove,
}: {
  message: {
    id: string;
    role: "assistant";
    tasks: GenerateTask[];
    params: { size: string; quality: string; concurrency: number; riskGuard: boolean };
    durationMs?: number;
  };
  onRegenerateSingle: (taskIndex: number) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const hasRunning = message.tasks.some((t) => t.status === "running");
  const allDone = message.tasks.every(
    (t) => t.status === "success" || t.status === "failed"
  );

  return (
    <>
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-3">
          {/* 图片网格 - 靠左对齐，根据数量自适应 */}
          <div
            className={`grid gap-2 ${
              message.tasks.length === 1
                ? "grid-cols-1 max-w-xs"
                : message.tasks.length === 2
                  ? "grid-cols-2 max-w-md"
                  : message.tasks.length <= 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : message.tasks.length <= 6
                      ? "grid-cols-3"
                      : "grid-cols-3 sm:grid-cols-5"
            }`}
          >
            {message.tasks.map((task, index) => (
              <TaskImage
                key={task.id}
                task={task}
                onRegenerate={() => onRegenerateSingle(index)}
                onView={(src) => setLightboxSrc(src)}
              />
            ))}
          </div>

          {/* 参数信息 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>📐 {message.params.size}</span>
            <span>💎 {message.params.quality}</span>
            <span>⚡ ×{message.params.concurrency}</span>
            {message.params.riskGuard && <span>🛡️ 风控保险</span>}
            {message.durationMs && (
              <span>⏱️ {(message.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>

          {/* 优化后的提示词 */}
          {message.tasks.some((t) => t.status === "success" && t.revisedPrompt) && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground transition-colors">
                📝 查看优化后的提示词
              </summary>
              <div className="mt-1 p-2 bg-muted rounded-md space-y-1">
                {message.tasks
                  .filter((t) => t.status === "success" && t.revisedPrompt)
                  .map((t) => (
                    <p key={t.id} className="whitespace-pre-wrap">{t.revisedPrompt}</p>
                  ))}
              </div>
            </details>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {hasRunning && (
              <Button size="sm" variant="destructive" onClick={onCancel}>
                停止生成
              </Button>
            )}
            {allDone && (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                删除
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 灯箱 */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="AI 生成图片"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}

/** 单张图片组件 */
function TaskImage({
  task,
  onRegenerate,
  onView,
}: {
  task: GenerateTask;
  onRegenerate: () => void;
  onView: (src: string) => void;
}) {
  const setImageAsReference = useAppStore((s) => s.setImageAsReference);

  const { formatted: elapsedTime } = useElapsedTime(
    task.startedAt,
    task.completedAt
  );
  const progress = useSimulatedProgress(
    task.status === "running",
    task.startedAt
  );

  const handleDownload = () => {
    if (!task.imageBase64) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${task.imageBase64}`;
    link.download = `ai-image-${task.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("图片已下载");
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(task.prompt);
    toast.success("提示词已复制");
  };

  const handleUseAsReference = () => {
    if (!task.imageBase64) return;
    setImageAsReference(`data:image/png;base64,${task.imageBase64}`);
    toast.success("已添加到参考图");
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden shadow-sm group aspect-square relative">
      {task.status === "success" && task.imageBase64 ? (
        <>
          <img
            src={`data:image/png;base64,${task.imageBase64}`}
            alt={task.prompt}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => onView(task.imageBase64!)}
          />
          {/* 悬浮操作按钮 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onView(task.imageBase64!);
              }}
              title="放大预览"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              title="下载图片"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyPrompt();
              }}
              title="复制提示词"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleUseAsReference();
              }}
              title="以此图为参考继续编辑"
            >
              <span className="text-sm">✏️</span>
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              title="重新生成"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* 耗时 */}
          {task.completedAt && task.startedAt && (
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {elapsedTime}
            </div>
          )}
        </>
      ) : task.status === "running" ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-shimmer" />
          <div className="relative z-10 flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{elapsedTime}</span>
            </div>
            <p className="text-xs font-medium text-primary animate-pulse">
              {getProgressText(progress)}
            </p>
            <div className="w-full max-w-[80%]">
              <div className="h-1.5 bg-background/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
        </div>
      ) : task.status === "failed" ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/5 gap-2 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="text-xs text-destructive text-center line-clamp-2">
            {task.error || "生成失败"}
          </span>
          <Button size="sm" variant="outline" onClick={onRegenerate}>
            <RotateCcw className="h-3 w-3 mr-1" />
            重试
          </Button>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">等待中...</span>
        </div>
      )}
    </div>
  );
}
