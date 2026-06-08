# 任务清单

## Supabase 基础封装

- [x] 新增 `src/lib/supabase/client.ts`：浏览器端验证码登录和 session 读取
- [x] 新增 `src/lib/supabase/server.ts`：服务端读取 Cookie session
- [x] 新增 `src/lib/supabase/admin.ts`：仅服务端使用 `SUPABASE_SERVICE_ROLE_KEY`
- [x] 新增 `src/lib/supabase/middleware.ts`：middleware session 刷新
- [x] 新增 `src/lib/auth/session.ts`：统一 `requireUser`、`requireAdmin`、账号启停检查
- [x] 新增 `src/lib/auth/types.ts`：类型定义

## 数据库迁移

- [x] 新增 `supabase/migrations/202606040001_auth_admin_quota.sql`
  - [x] `profiles` 表：用户资料、角色、账号状态、每日配额
  - [x] `user_usage_daily` 表：按用户和日期记录 `used_count/reserved_count`
  - [x] `generation_records` 表：记录每次生图任务
  - [x] RPC：`reserve_generation_quota`、`complete_generation_quota`、`release_generation_quota`
  - [x] RLS：普通用户只能读自己的资料/用量；管理员可查看和修改所有用户
  - [x] 管理员视图 `admin_user_overview`

## 登录和应用入口

- [x] 新增 `src/app/auth/page.tsx`：邮箱验证码登录/注册页面
- [x] 新增 `src/components/auth/auth-card.tsx`：登录卡片组件
- [x] 新增 `src/components/auth/auth-provider.tsx`：Auth 提供者
- [x] 新增 `src/components/auth/user-menu.tsx`：用户菜单（邮箱、退出、管理员入口）
- [x] 新增 `middleware.ts`：刷新 Supabase Cookie；未登录访问首页和 `/admin` 时跳转登录页

## 生图链路保护

- [x] 修改 `src/app/api/generate/route.ts`
  - [x] SSE 创建前校验 session、账号状态和每日配额
  - [x] 通过服务器环境变量读取平台上游 API 配置
  - [x] 成功发送 `complete` 前确认用量；上游失败时释放预占
  - [x] 保持现有 `start/progress/heartbeat/complete/error` SSE 结构
- [x] 修改 `src/app/api/check-task/route.ts`：校验用户和任务归属
- [x] 修改 `src/app/api/upload-image/route.ts`：增加登录边界
- [x] 修改 `src/app/api/test-connection/route.ts`：增加管理员边界
- [x] 新增 `src/lib/generation/quota.ts`：配额 RPC 封装
- [x] 新增 `src/lib/generation/upstream-config.ts`：上游 API 配置

## 前端集成

- [x] 新增 `src/components/quota-badge.tsx`：配额展示组件
- [x] 修改 `src/components/input-area.tsx`：展示今日剩余额度，额度不足时禁用发送
- [x] 修改 `src/store/use-app-store.ts`
  - [x] `streamGenerate` 不再发送用户可见 `apiKey`
  - [x] 每个任务附带稳定 `clientTaskId`
  - [x] `sendMessage`、整条重生、单图重试、重新检查统一刷新配额状态

## 管理员面板

- [x] 新增 `src/app/admin/page.tsx`：独立后台页面
- [x] 新增 `src/components/admin/admin-users-table.tsx`：用户列表、今日生图数、总生图数、每日配额、状态
- [x] 新增 `src/app/api/admin/users/route.ts`：管理员读取用户列表
- [x] 新增 `src/app/api/admin/users/[userId]/route.ts`：管理员修改每日配额和启停状态

## 环境与文档

- [x] 修改 `.env.example`：补充 Supabase、管理员邮箱和平台上游 API 配置
- [x] 修改 `README.md`：记录 Supabase 建表、Auth 邮件验证码配置和管理员初始化方式

## 验证

- [x] `pnpm lint` 通过
- [x] `pnpm build` 通过
- [x] `pnpm dev` 正常启动
