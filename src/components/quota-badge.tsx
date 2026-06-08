"use client";

import { Clock3, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

function formatResetTime(resetAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(resetAt));
}

export function QuotaBadge({ className }: { className?: string }) {
  const { quota, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={cn("h-9 rounded-full border border-border/70 bg-background/60 px-3", className)} />
    );
  }

  if (!quota) return null;

  const exhausted = quota.remaining <= 0;

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border px-3 text-xs shadow-sm",
        exhausted
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border/70 bg-background/60 text-muted-foreground",
        className
      )}
      title={`今日已用 ${quota.usedCount}，预占 ${quota.reservedCount}，${formatResetTime(quota.resetAt)} 重置`}
    >
      {exhausted ? <Clock3 className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />}
      {exhausted ? (
        <span>今日额度已用完，{formatResetTime(quota.resetAt)} 重置</span>
      ) : (
        <span>
          剩余 <span className="font-semibold text-foreground">{quota.remaining}</span> / {quota.dailyQuota}
        </span>
      )}
    </div>
  );
}
