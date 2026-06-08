"use client";

import Link from "next/link";
import { LogOut, Shield, UserCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { profile, isAdmin, signOut, isLoading } = useAuth();

  if (isLoading) {
    return collapsed ? (
      <div className="h-10 w-10 rounded-2xl bg-muted/50" />
    ) : (
      <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
        正在读取账号...
      </div>
    );
  }

  if (!profile) return null;

  if (collapsed) {
    return (
      <div className="mt-auto flex flex-col items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            aria-label="管理员面板"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 rounded-2xl")}
            title="管理员面板"
          >
            <Shield className="h-4 w-4" />
          </Link>
        )}
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={signOut} title="退出登录">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-background/55 p-3 shadow-inner shadow-black/[0.02]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{profile.email}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "管理员" : "用户"}</Badge>
            {profile.status === "disabled" && <Badge variant="destructive">已禁用</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 flex-1 rounded-xl")}
          >
            管理后台
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-9 rounded-xl", isAdmin ? "flex-1" : "w-full")}
          onClick={signOut}
        >
          退出登录
        </Button>
      </div>
    </div>
  );
}