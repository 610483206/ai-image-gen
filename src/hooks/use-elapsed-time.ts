"use client";

import { useState, useEffect, useRef } from "react";

/**
 * 计时器 Hook - 每秒更新经过的时间
 * @param startTime 开始时间戳（毫秒）
 * @param endTime 结束时间戳（毫秒），可选
 * @returns 格式化的时间字符串 (mm:ss)
 */
export function useElapsedTime(startTime?: number, endTime?: number) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    // 如果已有结束时间，计算最终耗时
    if (endTime) {
      setElapsed(Math.floor((endTime - startTime) / 1000));
      return;
    }

    // 否则每秒更新
    const update = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTime, endTime]);

  // 格式化为 mm:ss
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return { elapsed, formatted };
}

/**
 * 模拟进度条 Hook - 使用全局计时器避免组件重置
 * 根据开始时间计算进度，不会因为组件重渲染而重置
 * @param isRunning 是否正在运行
 * @param startTime 开始时间戳
 * @returns 进度百分比 0-95
 */
export function useSimulatedProgress(isRunning: boolean, startTime?: number) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRunning || !startTime) {
      setProgress(0);
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      // 使用对数函数模拟进度：开始快，后面越来越慢
      // 最大到 95%，留 5% 给实际完成
      const newProgress = Math.min(95, Math.log(elapsed + 1) * 20);
      setProgress(newProgress);
    };

    update();
    intervalRef.current = setInterval(update, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startTime]);

  return progress;
}

/**
 * 根据进度获取状态文本
 */
export function getProgressText(progress: number): string {
  if (progress < 10) return "正在创建图片...";
  if (progress < 25) return "构思画面中...";
  if (progress < 40) return "绘制草图中...";
  if (progress < 55) return "添加细节中...";
  if (progress < 70) return "加速打磨中...";
  if (progress < 80) return "润色优化中...";
  if (progress < 90) return "精修画面中...";
  return "即将完成...";
}
