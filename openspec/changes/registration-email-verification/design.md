# 设计

## 服务端流程

`src/app/api/auth/password/route.ts` 继续作为邮箱密码登录入口，统一处理“登录优先，必要时注册”的流程：

1. 先调用 Supabase `signInWithPassword`。
2. 成功时直接返回登录成功，不发送邮件。
3. 密码无效或邮箱未确认时，用 service role 分页查询 Auth 用户。
4. 如果邮箱已存在且已确认，返回通用“邮箱或密码不正确”，不发送确认邮件。
5. 如果邮箱不存在，调用 `signUp({ email, password, options: { emailRedirectTo } })` 创建待确认用户并发送 Supabase 默认确认链接。
6. 如果邮箱已存在但未确认，调用 `resend({ type: "signup", email, options: { emailRedirectTo } })` 重发确认链接。
7. `emailRedirectTo` 指向当前站点 `/auth/callback`，避免确认链接携带不必要的查询参数。

`src/app/auth/callback/route.ts` 继续通过 `exchangeCodeForSession(code)` 处理 Supabase PKCE 确认链接和 OAuth 回调。前端在发送确认邮件后短暂写入 `auth_next` cookie；同一浏览器打开确认链接时可回到安全的 `next` 路径，不同浏览器则回到首页。

## 前端流程

`src/components/auth/auth-card.tsx` 保持单卡片登录：

- 默认展示邮箱和密码。
- 服务端返回 `registration_confirmation_required` 时展示“确认邮件已发送”的提示。
- 提供重新发送确认邮件按钮，并在客户端设置 60 秒冷却，减少重复点击导致的邮件 429。
- 用户可直接修改邮箱或密码，修改后清空当前确认提示和冷却状态。
- Google/GitHub OAuth 保持原入口和平台图标。

## Supabase 配置

该方案依赖 Supabase Email/Password 的默认邮箱确认邮件。Supabase 免费版默认邮件服务无需自定义模板，保留 `{{ .ConfirmationURL }}` 即可。普通密码登录不走注册确认流程，因此不会触发邮件发送。

## 兼容说明

- 旧的已确认密码账号继续可用。
- OAuth-only 账号输邮箱密码时不会触发确认邮件，应继续使用 OAuth 登录。
- 已经进入待确认但未完成的注册可以重新发送确认链接。
