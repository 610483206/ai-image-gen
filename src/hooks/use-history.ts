"use client";

import { useEffect, useState } from "react";
import {
  getImageRecords,
  cleanupExpiredImages,
  type ImageRecord,
} from "@/lib/db";

/**
 * 历史记录 Hook
 * 应用启动时加载历史记录，清理过期数据
 * v2 中历史记录已集成到会话中，此 hook 保留用于兼容
 */
export function useHistory() {
  const [history, setHistory] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  /** 加载历史记录 */
  const loadHistory = async () => {
    try {
      setLoading(true);
      await cleanupExpiredImages();
      const records = await getImageRecords();
      setHistory(records);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return {
    history,
    loading,
    loadHistory,
  };
}
