"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

export function ConversationList() {
  const {
    conversations,
    currentConversationId,
    newConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    setSettingsOpen,
  } = useAppStore();

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

  return (
    <div className="w-[260px] shrink-0 border-r bg-card flex flex-col h-screen">
      {/* 顶部 Logo + 按钮 */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">AI 绘画</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={newConversation}
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
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {!hasConversations ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">暂无会话</p>
            <Button size="sm" onClick={newConversation} className="gap-1.5">
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
                    <h3 className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
                      {group}
                    </h3>
                    <div className="space-y-0.5">
                      {convs.map((conv) => (
                        <div
                          key={conv.id}
                          className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-accent transition-colors",
                            currentConversationId === conv.id && "bg-accent"
                          )}
                          onClick={() => {
                            if (editingId !== conv.id) {
                              switchConversation(conv.id);
                            }
                          }}
                        >
                          {editingId === conv.id ? (
                            <>
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-6 text-sm flex-1"
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
                                className="h-6 w-6 shrink-0"
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
                                className="h-6 w-6 shrink-0"
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
                              <span className="text-sm truncate flex-1">
                                {conv.title}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(conv.id, conv.title);
                                  }}
                                  title="重命名"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                  }}
                                  title="删除"
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
