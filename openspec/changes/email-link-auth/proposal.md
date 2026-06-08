# 邮箱密码与 OAuth 登录 Hotfix

## 问题

当前登录页已切到 Supabase 邮件链接登录，但邮件链接/确认邮件会在登录或注册动作中触发 Supabase 邮件发送。频繁登录、注册或重试时容易触发 Supabase 邮件发送 429，影响正常进入应用。

## 根因

`src/components/auth/auth-card.tsx` 使用 `signInWithOtp` 发送 Magic Link，本质上依赖邮件通道完成登录。该方式不适合高频登录入口，也无法提供第三方授权入口来绕开邮件发送链路。

## 修复目标

- 登录页改为邮箱 + 密码登录，不再使用 `signInWithOtp` 发送邮件链接。
- 首次使用新邮箱登录时自动注册并登录，避免单独注册页。
- 新增 Google/GitHub 授权登录入口，并展示对应平台图标。
- 保留原有 `/auth/callback` 和 `next` 参数，OAuth 登录后回到用户原本想访问的页面。
