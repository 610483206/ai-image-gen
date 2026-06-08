"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AdminUserRow } from "@/lib/auth/types";

export function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "读取用户列表失败");

      const nextUsers = data.users as AdminUserRow[];
      setUsers(nextUsers);
      setQuotaDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, String(user.daily_quota)])));
    } catch (err) {
      const message = err instanceof Error ? err.message : "读取用户列表失败";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const totals = useMemo(
    () => ({
      users: users.length,
      active: users.filter((user) => user.status === "active").length,
      today: users.reduce((sum, user) => sum + user.today_count, 0),
      total: users.reduce((sum, user) => sum + user.total_count, 0),
    }),
    [users]
  );

  const updateUser = async (userId: string, payload: Record<string, unknown>) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "更新用户失败");
      await loadUsers();
      toast.success("用户配置已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新用户失败");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const saveQuota = async (user: AdminUserRow) => {
    const draft = quotaDrafts[user.id];
    if (draft === undefined || draft === String(user.daily_quota)) return;
    if (!/^\d+$/.test(draft)) {
      toast.error("每日配额必须是非负整数");
      setQuotaDrafts((state) => ({ ...state, [user.id]: String(user.daily_quota) }));
      return;
    }
    await updateUser(user.id, { dailyQuota: Number.parseInt(draft, 10) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card/80 p-5 shadow-xl shadow-black/5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> 管理员面板
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">用户与生图配额</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看所有用户的今日用量、总用量、每日额度和账号状态。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={buttonVariants({ variant: "outline", className: "h-9 rounded-xl" })}>
            <ArrowLeft className="h-4 w-4" /> 返回工作台
          </Link>
          <Button variant="default" className="h-9 rounded-xl" onClick={() => void loadUsers()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="注册用户" value={totals.users} />
        <StatCard label="启用账号" value={totals.active} />
        <StatCard label="今日生图" value={totals.today} />
        <StatCard label="累计生图" value={totals.total} />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">正在加载用户数据...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">暂无注册用户</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 font-medium">今日</th>
                  <th className="px-4 py-3 font-medium">总数</th>
                  <th className="px-4 py-3 font-medium">每日配额</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((user) => {
                  const disabled = updatingUserId === user.id;
                  return (
                    <tr key={user.id} className="bg-card/40 transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.email}</div>
                        <div className="mt-1 flex gap-1.5">
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role === "admin" ? "管理员" : "用户"}
                          </Badge>
                          {user.reserved_count > 0 && <Badge variant="outline">预占 {user.reserved_count}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.created_at).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">{user.today_count}</td>
                      <td className="px-4 py-3">{user.total_count}</td>
                      <td className="px-4 py-3">
                        <Input
                          value={quotaDrafts[user.id] ?? String(user.daily_quota)}
                          onChange={(event) => setQuotaDrafts((state) => ({ ...state, [user.id]: event.target.value }))}
                          onBlur={() => void saveQuota(user)}
                          disabled={disabled}
                          className="h-9 w-24 rounded-xl"
                          inputMode="numeric"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.status === "active" ? "secondary" : "destructive"}>
                          {user.status === "active" ? "启用" : "禁用"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant={user.status === "active" ? "destructive" : "outline"}
                          size="sm"
                          className="h-8 rounded-xl"
                          disabled={disabled}
                          onClick={() => void updateUser(user.id, { status: user.status === "active" ? "disabled" : "active" })}
                        >
                          {user.status === "active" ? "禁用" : "启用"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}