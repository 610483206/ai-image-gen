"use client";

import { useState } from "react";
import { useAppStore, type GenerateTask } from "@/store/use-app-store";
import { taskQueue } from "@/lib/task-queue";
import { useHistory } from "@/hooks/use-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History,
  ImageIcon,
  ZoomIn,
  Timer,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useElapsedTime, useSimulatedProgress, getProgressText } from "@/hooks/use-elapsed-time";
import { useBalance } from "@/hooks/use-balance";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Wallet } from "lucide-react";

export function RightPanel() {
  const { tasks, removeTask, clearTasks, setPrompt, clearReferenceImages } = useAppStore();
  const { history, loading: historyLoading, restoreToTaskList } = useHistory();
  const { balance, loading: balanceLoading } = useBalance();

  const runningCount = tasks.filter((t) => t.status === "running").length;
  const successCount = tasks.filter((t) => t.status === "success").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;

  /** 新建会话 */
  const handleNewSession = () => {
    // 取消所有运行中的任务
    if (runningCount > 0) {
      taskQueue.cancelAll();
    }
    // 清空任务列表
    clearTasks();
    // 清空提示词
    setPrompt("");
    // 清空参考图
    clearReferenceImages();
    toast.success("已新建会话");
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* 顶部提示条 */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center gap-2 shrink-0">
        <span>⚠️</span>
        <span>生成的图片仅保留 3 天，请及时下载保存</span>
      </div>

      {/* 紫色 Banner */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                GPT-IMAGE 2.0 — 全球最强的 AI 生图模型
              </h2>
              <p className="text-sm text-muted-foreground">
                支持文字生成图片、多图编辑、风格迁移
              </p>
            </div>
          </div>

          {/* 任务进度、余额和新建会话 */}
          <div className="flex items-center gap-3">
            {/* 余额显示 */}
            {balance && !balanceLoading && (
              <div className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                <Wallet className="h-4 w-4" />
                <span>${balance.remaining.toFixed(2)}</span>
              </div>
            )}
            {tasks.length > 0 && (
              <>
                {runningCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    生成中 {runningCount}
                  </Badge>
                )}
                {successCount > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    成功 {successCount}
                  </Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="destructive">失败 {failedCount}</Badge>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              新建会话
            </Button>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="tasks" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 shrink-0">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              当前任务
              {tasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {tasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              历史记录
              {history.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {history.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 当前任务 */}
        <TabsContent value="tasks" className="flex-1 overflow-y-auto p-6 m-0">
          {tasks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onRemove={() => removeTask(task.id)}
                  onRetry={() => taskQueue.retryTask(task.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* 历史记录 */}
        <TabsContent value="history" className="flex-1 overflow-y-auto p-6 m-0">
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无历史记录</h3>
              <p className="text-muted-foreground">
                生成的图片将在这里显示，保留 3 天
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {history.map((record) => (
                <HistoryCard
                  key={record.id}
                  record={record}
                  onRestore={() => restoreToTaskList(record)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 空状态组件 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <Sparkles className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">准备开始创作</h3>
      <p className="text-muted-foreground max-w-md mb-8">
        请在左侧面板上传参考图并输入提示词，AI 将根据您的设定生成独特的视觉作品
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => {
            const textarea = document.querySelector("textarea");
            textarea?.focus();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors text-sm"
        >
          <span>✏️</span> 输入提示词
        </button>
        <button
          onClick={() => {
            const fileInput = document.querySelector(
              'input[type="file"]'
            ) as HTMLInputElement;
            fileInput?.click();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/80 transition-colors text-sm"
        >
          <span>🖼️</span> 上传参考图
        </button>
      </div>
    </div>
  );
}

/** 任务卡片组件 */
function TaskCard({
  task,
  onRemove,
  onRetry,
}: {
  task: GenerateTask;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // 计时器和进度条 - 使用 startedAt 作为基准时间，避免切换 tab 时重置
  const { formatted: elapsedTime } = useElapsedTime(
    task.startedAt,
    task.completedAt
  );
  const progress = useSimulatedProgress(task.status === "running", task.startedAt);

  /** 下载图片 */
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

  /** 复制提示词 */
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(task.prompt);
    toast.success("提示词已复制");
  };

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden shadow-sm group">
        {/* 图片区域 */}
        <div className="aspect-square relative cursor-pointer">
          {task.status === "success" && task.imageBase64 ? (
            <>
              <img
                src={`data:image/png;base64,${task.imageBase64}`}
                alt={task.prompt}
                className="w-full h-full object-cover"
                onClick={() => setLightboxSrc(task.imageBase64!)}
              />
              {/* 悬浮操作按钮 */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxSrc(task.imageBase64!);
                  }}
                  title="放大预览"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  title="下载图片"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPrompt();
                  }}
                  title="复制提示词"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry();
                  }}
                  title="重新生成"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : task.status === "running" ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 relative overflow-hidden">
              {/* 光影闪烁背景 */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-shimmer" />
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-violet-500/5 animate-shimmer-delay" />

              {/* 内容 */}
              <div className="relative z-10 flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>{elapsedTime}</span>
                </div>
                {/* 动态状态文本 */}
                <p className="text-sm font-medium text-primary animate-pulse">
                  {getProgressText(progress)}
                </p>
                {/* 进度条 */}
                <div className="w-full max-w-[80%]">
                  <div className="h-2 bg-background/80 rounded-full overflow-hidden backdrop-blur-sm">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out shadow-lg shadow-purple-500/30"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1.5">
                    {Math.round(progress)}%
                  </p>
                </div>
              </div>
            </div>
          ) : task.status === "failed" ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/5 gap-2 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <span className="text-xs text-destructive text-center line-clamp-3">
                {task.error || "生成失败"}
              </span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">等待中...</span>
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="p-3">
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {task.prompt}
          </p>

          {/* 耗时显示 */}
          {task.status === "success" && task.completedAt && task.startedAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Timer className="h-3 w-3" />
              <span>耗时 {elapsedTime}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-1.5">
            {task.status === "success" && (
              <>
                <Button
                  size="sm"
                  className="flex-1 h-8"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  下载
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={handleCopyPrompt}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  复制提示词
                </Button>
              </>
            )}
            {task.status === "failed" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={onRetry}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  重试
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={onRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {task.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-8"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                移除
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 灯箱 */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={task.prompt}
          prompt={task.prompt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}

/** 历史记录卡片组件 */
function HistoryCard({
  record,
}: {
  record: {
    id: string;
    prompt: string;
    imageBase64: string;
    size: string;
    quality: string;
    createdAt: number;
    expiresAt: number;
  };
  onRestore: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  /** 下载图片 */
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${record.imageBase64}`;
    link.download = `ai-image-${record.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("图片已下载");
  };

  /** 复制提示词 */
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(record.prompt);
    toast.success("提示词已复制");
  };

  const qualityLabel =
    record.quality === "low"
      ? "1K"
      : record.quality === "medium"
        ? "2K"
        : record.quality === "high"
          ? "4K"
          : "自动";

  const expiresIn = formatDistanceToNow(new Date(record.expiresAt), {
    locale: zhCN,
    addSuffix: false,
  });

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden shadow-sm group cursor-pointer">
        {/* 图片区域 */}
        <div className="aspect-square relative">
          <img
            src={`data:image/png;base64,${record.imageBase64}`}
            alt={record.prompt}
            className="w-full h-full object-cover"
            onClick={() => setLightboxSrc(record.imageBase64)}
          />
          {/* 悬浮操作按钮 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxSrc(record.imageBase64);
              }}
              title="放大预览"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              title="下载图片"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyPrompt();
              }}
              title="复制提示词"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {/* 标签 */}
          <div className="absolute top-2 left-2 flex gap-1">
            <Badge variant="secondary" className="text-xs">
              {record.size}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {qualityLabel}
            </Badge>
          </div>
        </div>

        {/* 信息区域 */}
        <div className="p-3">
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {record.prompt}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(record.createdAt), {
                locale: zhCN,
                addSuffix: true,
              })}
            </span>
            <span>剩余 {expiresIn}</span>
          </div>
        </div>
      </div>

      {/* 灯箱 */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={record.prompt}
          prompt={record.prompt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
