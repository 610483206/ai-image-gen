# 设计

## 修复方案

1. 修改 `AuthCard`：
   - 移除邮件链接发送流程和 `signInWithOtp` 调用。
   - 改为邮箱 + 密码表单，提交到服务端密码登录接口。
   - 增加 Google/GitHub OAuth 按钮，并展示平台图标。
   - OAuth 使用当前站点 origin 下的 `/auth/callback` 作为 `redirectTo`，并用短期 `oauth_next` cookie 保存登录后的站内跳转路径，避免 Supabase Redirect URL 匹配回退到生产 `site_url`。
   - 按 Supabase 错误码显示更明确的错误提示。

2. 新增 `src/app/api/auth/password/route.ts`：
   - 先使用 SSR Supabase client 调用 `signInWithPassword`。
   - 如果邮箱/密码无效，使用 service role 的 admin client 自动创建新用户，并设置 `email_confirm: true`，避免新用户注册触发确认邮件。
   - 创建成功后再次调用 `signInWithPassword`，把 session 写入 Cookie。
   - 如果邮箱已存在但密码不匹配，返回通用错误，避免暴露账号存在性。

3. 保留并泛化 `src/app/auth/callback/route.ts`：
   - 读取 `code`，并从 query 或短期 `oauth_next` cookie 获取 `next`。
   - 调用 Supabase SSR client 的 `exchangeCodeForSession(code)` 写入 Cookie。
   - 成功后跳转到 `next`，失败后跳回 `/auth` 并带通用授权错误信息。

## 范围说明

该修复属于登录流程行为修复；不改数据库结构，不新增外部依赖。Supabase 控制台仍需启用 Email/Password、Google、GitHub Provider，并配置允许的回调地址：

- Supabase Auth Redirect URLs 包含 `http://localhost:3000/auth/callback`、`http://127.0.0.1:3000/auth/callback` 和 `https://img.appboot.top/auth/callback`。
- Google/GitHub OAuth App 回调地址填写 Supabase 回调：`https://knqbtzlwdaltwcffhdhg.supabase.co/auth/v1/callback`。

## 兼容说明

- 系统不会为旧邮件链接账号生成默认密码；旧账号如果要走邮箱密码登录，需要管理员重置密码。
- `ADMIN_EMAILS` 仍然是管理员自举来源；对应邮箱首次刷新用户资料时会同步为 admin。
- 当用户今日额度不足或已用完时，发送按钮保留可点击反馈并显示明确原因；额度徽标在耗尽时直接展示“今日额度已用完”和重置时间。
