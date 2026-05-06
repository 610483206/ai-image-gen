"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/use-app-store";
import {
  getImageRecords,
  cleanupExpiredRecords,
  type ImageRecord,
} from "@/lib/db";

/**
 * 历史记录 Hook
 * 应用启动时加载历史记录，清理过期数据
 */
export function useHistory() {
  const [history, setHistory] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { addTask } = useAppStore();

  /** 加载历史记录 */
  const loadHistory = async () => {
    try {
      setLoading(true);
      // 先清理过期记录
      await cleanupExpiredRecords();
      // 加载未过期记录
      const records = await getImageRecords();
      setHistory(records);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    } finally {
      setLoading(false);
    }
  };

  /** 将历史记录添加到任务列表 */
  const restoreToTaskList = (record: ImageRecord) => {
    addTask({
      id: record.id,
      prompt: record.prompt,
      status: "success",
      imageBase64: record.imageBase64,
      revisedPrompt: record.revisedPrompt,
      createdAt: record.createdAt,
    });
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return {
    history,
    loading,
    loadHistory,
    restoreToTaskList,
  };
}
