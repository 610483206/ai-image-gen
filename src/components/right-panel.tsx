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
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
  ZoomIn,
  Timer,
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

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const messages = currentConversation?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* 顶部提示条 */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center gap-2 shrink-0">
        <span>⚠️</span>
        <span>生成的图片仅保存在当前浏览器中，保留 3 天后自动清理。切换浏览器或清除浏览器数据会导致历史记录丢失，请及时下载保存重要图片。</span>
      </div>

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

/** 空状态组件 */
function EmptyState() {
  const { setDraftPrompt } = useAppStore();

  const examples = [
    "一只穿着宇航服的猫咪站在月球表面",
    "赛博朋克风格的东京街头夜景",
    "水彩风格的中国山水画",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <Sparkles className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">准备开始创作</h3>
      <p className="text-muted-foreground max-w-md mb-8">
        输入描述你想要的图片，AI 将根据你的描述生成独特的视觉作品
      </p>

      <div className="flex flex-wrap gap-2 justify-center">
        {examples.map((example) => (
          <button
            key={example}
            onClick={() => setDraftPrompt(example)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors text-sm"
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
          <div className="bg-blue-50 text-blue-900 rounded-2xl rounded-tr-md px-4 py-3">
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
