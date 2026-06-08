"use client";

import { useState, useMemo, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/user-menu";
import {
  Plus,
  Search,
  Settings,
  Sparkles,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { isToday, isYesterday } from "date-fns";

/** 时间分组 */
type TimeGroup = "今天" | "昨天" | "更早";

function getTimeGroup(timestamp: number): TimeGroup {
  const date = new Date(timestamp);
  if (isToday(date)) return "今天";
  if (isYesterday(date)) return "昨天";
  return "更早";
}

export function ConversationList({ collapsed = false }: { collapsed?: boolean }) {
  const {
    conversations,
    currentConversationId,
    newConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    setSettingsOpen,
  } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  /** 过滤和分组会话 */
  const groupedConversations = useMemo(() => {
    const filtered = searchQuery
      ? conversations.filter((c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : conversations;

    const groups: Record<TimeGroup, typeof conversations> = {
      "今天": [],
      "昨天": [],
      "更早": [],
    };

    for (const conv of filtered) {
      const group = getTimeGroup(conv.updatedAt);
      groups[group].push(conv);
    }

    return groups;
  }, [conversations, searchQuery]);

  /** 开始编辑标题 */
  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  /** 保存编辑 */
  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  /** 取消编辑 */
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const hasConversations = conversations.length > 0;

  // 收起模式 - 只显示图标
  if (collapsed) {
    return (
      <div className="studio-panel flex h-dvh w-[64px] shrink-0 flex-col items-center gap-3 border-y-0 border-l-0 px-2 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-foreground"
          onClick={newConversation}
          title="新建会话"
          aria-label="新建会话"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="切换主题"
          aria-label="切换主题"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          title="设置"
          aria-label="设置"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <UserMenu collapsed />
      </div>
    );
  }

  return (
    <div className="studio-panel flex h-dvh w-[292px] shrink-0 flex-col border-y-0 border-l-0">
      {/* 顶部 Logo + 按钮 */}
      <div className="space-y-4 border-b soft-divider p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-semibold leading-tight">AI 绘画工作台</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">Creative Studio</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="切换主题"
              aria-label="切换主题"
            >
              {mounted && (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsOpen(true)}
              aria-label="设置"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9 rounded-xl shadow-lg shadow-primary/20"
              onClick={newConversation}
              aria-label="新建会话"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 搜索框 */}
        {hasConversations && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="h-10 rounded-xl border-border/70 bg-background/60 pl-9 text-sm shadow-inner shadow-black/[0.02] focus:bg-background"
            />
          </div>
        )}

        <UserMenu />
      </div>

      {/* 会话列表 */}
      <div className="premium-scroll flex-1 overflow-y-auto p-3">
        {!hasConversations ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-muted/30 text-muted-foreground">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="mb-1 text-sm font-medium">暂无会话</p>
            <p className="mb-4 text-xs text-muted-foreground">从一个提示词开始创作</p>
            <Button size="sm" onClick={newConversation} className="h-9 gap-1.5 rounded-xl">
              <Plus className="h-3.5 w-3.5" />
              新建会话
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.entries(groupedConversations) as [TimeGroup, typeof conversations][]).map(
              ([group, convs]) => {
                if (convs.length === 0) return null;
                return (
                  <div key={group}>
                    <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {group}
                    </h3>
                    <div className="space-y-1">
                      {convs.map((conv) => (
                        <div
                          key={conv.id}
                          className={cn(
                            "group flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-muted-foreground transition-all duration-200 hover:border-border/70 hover:bg-muted/50 hover:text-foreground",
                            currentConversationId === conv.id &&
                              "border-primary/30 bg-primary/10 text-foreground shadow-sm shadow-primary/10"
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (editingId !== conv.id) {
                              switchConversation(conv.id);
                            }
                          }}
                          onKeyDown={(e) => {
                            // 仅响应 div 自身的按键，避免重命名输入框/内部按钮的按键冒泡
                            // 触发切换（否则编辑标题时空格会被 preventDefault 吞掉）
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (editingId !== conv.id) switchConversation(conv.id);
                            }
                          }}
                        >
                          {editingId === conv.id ? (
                            <>
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-8 flex-1 rounded-lg text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEdit();
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                              <span className="flex-1 truncate text-sm">
                                {conv.title}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(conv.id, conv.title);
                                  }}
                                  title="重命名"
                                  aria-label="重命名会话"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                  }}
                                  title="删除"
                                  aria-label="删除会话"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
