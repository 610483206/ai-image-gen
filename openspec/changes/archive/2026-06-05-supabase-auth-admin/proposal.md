# Supabase 鉴权与管理员面板

## 概述

为 AI Image Gen 增加 Supabase 邮箱验证码鉴权、用户每日生图配额和独立管理员面板。实现会优先保护服务端生图入口，保留现有 SSE 返回形态和前端会话体验。

## 背景

原有系统存在以下问题：
1. API Key 暴露在客户端，存在安全风险
2. 缺少用户身份验证，无法追踪和限制使用
3. 无法对用户进行配额管理
4. 缺少管理员后台进行用户管理

## 目标

1. **安全收口**：生图 API Key 统一使用服务端环境变量，前端不再控制平台 Key
2. **用户鉴权**：实现邮箱验证码登录/注册流程
3. **配额管理**：每日生图配额，防止滥用
4. **管理员面板**：用户管理、配额调整、账号启停

## 已确认口径

- 登录/注册：统一邮箱验证码流程，输入邮箱后收验证码，新邮箱验证后自动注册并登录
- 初始管理员：通过服务端环境变量 `ADMIN_EMAILS` 指定，首次登录/刷新用户资料时自动提升为管理员
- 安全边界：生图配额必须在服务端校验；普通用户不能通过前端绕过 `/api/generate`

## 实现范围

### 1. Supabase 基础封装
- `src/lib/supabase/client.ts` - 浏览器端验证码登录和 session 读取
- `src/lib/supabase/server.ts` - 服务端读取 Cookie session
- `src/lib/supabase/admin.ts` - 仅服务端使用 `SUPABASE_SERVICE_ROLE_KEY`
- `src/lib/auth/session.ts` - 统一 `requireUser`、`requireAdmin`、账号启停检查

### 2. 数据库结构
- `profiles` 表：用户资料、角色、账号状态、每日配额
- `user_usage_daily` 表：按用户和日期记录使用量
- `generation_records` 表：生图任务记录
- RPC 函数：配额预占、确认、释放

### 3. 登录和应用入口
- `src/app/auth/page.tsx` - 邮箱验证码登录/注册页面
- `middleware.ts` - 路由保护，未登录跳转登录页
- `src/components/auth/user-menu.tsx` - 用户菜单（邮箱、退出、管理员入口）

### 4. 生图链路保护
- `src/app/api/generate/route.ts` - SSE 创建前校验 session、账号状态和每日配额
- `src/app/api/check-task/route.ts` - 校验用户和任务归属
- `src/lib/generation/quota.ts` - 配额 RPC 封装

### 5. 管理员面板
- `src/app/admin/page.tsx` - 管理后台页面
- `src/components/admin/admin-users-table.tsx` - 用户列表、配额管理
- `src/app/api/admin/users/route.ts` - 管理员 API
- `src/app/api/admin/users/[userId]/route.ts` - 用户管理 API

### 6. 前端集成
- `src/components/quota-badge.tsx` - 配额展示
- `src/components/input-area.tsx` - 额度不足时禁用发送
- `src/store/use-app-store.ts` - 任务附带 clientTaskId，刷新配额状态

## 验收标准

1. ✅ 邮箱验证码登录/注册流程正常
2. ✅ 未登录用户自动跳转登录页
3. ✅ 生图 API 使用服务端 Key，前端无法覆盖
4. ✅ 每日配额限制生效，超额无法生图
5. ✅ 管理员可查看用户列表、修改配额、启停账号
6. ✅ 禁用账号后用户无法继续生图
7. ✅ SSE 返回形态保持不变（start/progress/complete/error）
