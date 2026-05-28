"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";

/**
 * 全局键盘快捷键
 * - Cmd/Ctrl + K: 新建会话
 * - Cmd/Ctrl + /: 聚焦输入框
 * - Esc: 关闭弹窗
 */
export function useKeyboardShortcuts() {
  const { newConversation, setSettingsOpen } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K: 新建会话
      if (isMod && e.key === "k") {
        e.preventDefault();
        newConversation();
        return;
      }

      // Cmd/Ctrl + /: 聚焦输入框
      if (isMod && e.key === "/") {
        e.preventDefault();
        const textarea = document.querySelector(
          'textarea[placeholder*="描述"]'
        ) as HTMLTextAreaElement;
        textarea?.focus();
        return;
      }

      // Esc: 关闭弹窗
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [newConversation, setSettingsOpen]);
}
