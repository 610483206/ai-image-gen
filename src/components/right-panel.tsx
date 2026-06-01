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
  Image as ImageIcon,
  Gem,
  Layers3,
  ShieldCheck,
  FileText,
  PencilLine,
  WandSparkles,
  Sparkles,
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
    recheckTask,
    cancelGeneration,
    removeMessage,
  } = useAppStore();

  const [bannerVisible, setBannerVisible] = useState(true);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const messages = currentConversation?.messages || [];

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* 顶部提示条 - 可关闭 */}
      {bannerVisible && (
        <div className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/75 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur-xl lg:mx-5">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 leading-relaxed">
            生成的图片仅保存在当前浏览器中，保留 3 天后自动清理。请及时下载保存重要图片。
          </span>
          <button
            onClick={() => setBannerVisible(false)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label="关闭提示"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* 对话流 */}
      <div className="premium-scroll flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-5xl space-y-7">
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
                  onRecheckSingle={(taskIndex) =>
                    recheckTask(message.id, taskIndex)
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

/** 空状态组件 - 画廊跑马灯风格 */
function EmptyState() {
  const { setDraftPrompt } = useAppStore();

  const examples = [
    "霓虹赛博朋克都市，雨夜街道倒映全息广告牌",
    "晨雾缭绕的雪山日出，极简构图，柯达胶片质感",
    "漂浮在绚丽星云中的宇航员，超现实主义油画",
    "烟雨江南水乡，水墨晕染，大面积留白意境",
    "森林深处发光的小鹿，电影级光影，浅景深虚化",
  ];

  // 画廊展示图（仅装饰用途），上下两行使用不同图片，跑马灯内各复制一份以实现无缝循环
  const showcaseTop = [
    "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=280&h=360&fit=crop&auto=format", // 颜料飞溅
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=280&h=360&fit=crop&auto=format", // 人物肖像
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=280&h=360&fit=crop&auto=format", // 山间云海
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=280&h=360&fit=crop&auto=format", // 艺术油画
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=280&h=360&fit=crop&auto=format", // 霓虹灯光
  ];
  const showcaseBottom = [
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=280&h=360&fit=crop&auto=format", // 雪山
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=280&h=360&fit=crop&auto=format", // 雾林
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=280&h=360&fit=crop&auto=format", // 猫
    "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=280&h=360&fit=crop&auto=format", // 山谷
    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=280&h=360&fit=crop&auto=format", // 林间阳光
  ];

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* 极光流光背景 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="empty-aurora absolute left-[22%] top-[24%] h-72 w-72 rounded-full bg-primary/30" />
        <div
          className="empty-aurora absolute right-[20%] top-[30%] h-80 w-80 rounded-full bg-accent/25"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="empty-aurora absolute bottom-[16%] left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20"
          style={{ animationDelay: "-13s" }}
        />
      </div>

      {/* 画廊跑马灯 - 双行反向无限滚动 */}
      <div className="marquee-viewport marquee-mask reveal-up relative mb-12 w-full max-w-4xl space-y-4 overflow-hidden">
        <div className="marquee-row is-left">
          {[...showcaseTop, ...showcaseTop].map((src, i) => (
            <div
              key={`row-a-${i}`}
              className="relative mr-4 h-[112px] w-[160px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-muted/30 shadow-xl shadow-black/20 ring-1 ring-white/5 transition-transform duration-500 hover:scale-[1.05]"
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5" />
            </div>
          ))}
        </div>
        <div className="marquee-row is-right">
          {[...showcaseBottom, ...showcaseBottom].map((src, i) => (
            <div
              key={`row-b-${i}`}
              className="relative mr-4 h-[112px] w-[160px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-muted/30 shadow-xl shadow-black/20 ring-1 ring-white/5 transition-transform duration-500 hover:scale-[1.05]"
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5" />
            </div>
          ))}
        </div>
      </div>

      {/* 徽章 */}
      <div
        className="reveal-up mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-xl"
        style={{ animationDelay: "0.08s" }}
      >
        <span className="animate-pulse-ring inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <WandSparkles className="h-3.5 w-3.5 text-primary" />
        AI 图像工作室 · Creative Studio
      </div>

      {/* 主标题 - 渐变流光 */}
      <h3
        className="reveal-up text-gradient-animate text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ animationDelay: "0.16s" }}
      >
        把灵感绘成画面
      </h3>

      {/* 副标题 */}
      <p
        className="reveal-up mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base"
        style={{ animationDelay: "0.24s" }}
      >
        描述脑海中的画面、风格与光影，AI 在数秒内为你生成独一无二的视觉作品
      </p>

      {/* 示例提示词 */}
      <div
        className="reveal-up mt-8 flex max-w-3xl flex-wrap justify-center gap-2.5"
        style={{ animationDelay: "0.32s" }}
      >
        {examples.map((example) => (
          <button
            key={example}
            onClick={() => setDraftPrompt(example)}
            className="group/chip inline-flex min-h-10 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover/chip:rotate-12" />
            <span>{example}</span>
            <span className="-ml-0.5 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover/chip:translate-x-0 group-hover/chip:opacity-100">
              →
            </span>
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
        <div className="max-w-[86%] space-y-2 sm:max-w-[78%]">
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
                      aria-label="以此图为参考"
                    >
                      <PencilLine className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 消息内容 */}
          <div className="rounded-2xl rounded-tr-md border border-primary/20 bg-primary/[0.12] px-4 py-3 text-foreground shadow-sm">
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
  onRecheckSingle,
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
  onRecheckSingle: (taskIndex: number) => void;
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
        <div className="max-w-[94%] space-y-3 sm:max-w-[88%]">
          {/* 图片网格 - 靠左对齐，根据数量自适应 */}
          <div
            className={`grid gap-3 ${
              message.tasks.length === 1
                ? "grid-cols-1 max-w-sm"
                : message.tasks.length === 2
                  ? "grid-cols-2 max-w-lg"
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
                onRecheck={() => onRecheckSingle(index)}
                onView={(src) => setLightboxSrc(src)}
              />
            ))}
          </div>

          {/* 参数信息 */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
              <ImageIcon className="h-3.5 w-3.5" />
              {message.params.size}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
              <Gem className="h-3.5 w-3.5" />
              {message.params.quality}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
              <Layers3 className="h-3.5 w-3.5" />
              ×{message.params.concurrency}
            </span>
            {message.params.riskGuard && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                风控保险
              </span>
            )}
            {message.durationMs && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
                <Clock className="h-3.5 w-3.5" />
                {(message.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* 优化后的提示词 */}
          {message.tasks.some((t) => t.status === "success" && t.revisedPrompt) && (
            <details className="rounded-xl border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none hover:text-foreground transition-colors">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  查看优化后的提示词
                </span>
              </summary>
              <div className="mt-3 space-y-2 rounded-lg bg-muted/60 p-3">
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
              <Button size="sm" variant="destructive" onClick={onCancel} className="h-9 rounded-xl">
                停止生成
              </Button>
            )}
            {allDone && (
              <Button size="sm" variant="ghost" onClick={onRemove} className="h-9 rounded-xl">
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
  onRecheck,
  onView,
}: {
  task: GenerateTask;
  onRegenerate: () => void;
  onRecheck: () => void;
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
    <div className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg shadow-black/5 ring-1 ring-white/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/[0.12]">
      {task.status === "success" && task.imageBase64 ? (
        <>
          <img
            src={`data:image/png;base64,${task.imageBase64}`}
            alt={task.prompt}
            className="h-full w-full cursor-pointer object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onClick={() => onView(task.imageBase64!)}
          />
          {/* 悬浮操作按钮 */}
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-xl"
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
              className="h-9 w-9 rounded-xl"
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
              className="h-9 w-9 rounded-xl"
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
              className="h-9 w-9 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                handleUseAsReference();
              }}
              title="以此图为参考继续编辑"
              aria-label="以此图为参考继续编辑"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-xl"
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
            <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
              {elapsedTime}
            </div>
          )}
        </>
      ) : task.status === "running" ? (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden p-4">
          <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--accent)/0.12),transparent)]" />
          <div className="relative z-10 flex w-full flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{elapsedTime}</span>
            </div>
            <p className="text-xs font-medium text-primary animate-pulse">
              {getProgressText(progress)}
            </p>
            <div className="w-full max-w-[82%]">
              <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
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
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-destructive/5 p-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="text-xs text-destructive text-center line-clamp-2">
            {task.error || "生成失败"}
          </span>
          <div className="flex gap-2">
            {task.taskId && (
              <Button size="sm" variant="outline" onClick={onRecheck} className="rounded-xl">
                <RotateCcw className="h-3 w-3 mr-1" />
                重新检查
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onRegenerate} className="rounded-xl">
              <RotateCcw className="h-3 w-3 mr-1" />
              重试
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/60">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">等待中...</span>
        </div>
      )}
    </div>
  );
}
