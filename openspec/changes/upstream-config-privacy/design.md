# 设计说明

## 配置分层

- 平台默认配置：由服务端读取，来源优先级为 Supabase `app_settings` 表，其次为环境变量 `UPSTREAM_API_*`。
- 用户自定义配置：仅存储在浏览器 localStorage，随 `/api/generate`、`/api/check-task`、`/api/test-connection` 请求提交给服务端使用。
- 普通用户不会调用读取平台默认配置的接口；管理员接口不回传 API Key 明文，只返回 `hasApiKey`。

## 数据库

新增 `public.app_settings`：

| 字段 | 类型 | 说明 |
|------|------|------|
| key | text | 配置项主键 |
| value | jsonb | 配置内容 |
| updated_at | timestamptz | 更新时间 |

当前使用 key：`upstream_image_config`。

安全策略：

- 启用 RLS。
- `anon`、`authenticated` 没有表权限。
- 显式拒绝客户端角色访问。
- 仅 `service_role` 可通过服务端管理 API 读写。

## API

- `GET /api/admin/upstream-config`：管理员读取平台默认配置摘要。
- `PUT /api/admin/upstream-config`：管理员保存平台默认配置。
- `POST /api/test-connection`：有自定义配置时允许登录用户测试自己的配置；无自定义配置时仅管理员可测试平台默认配置。
- `POST /api/generate`：自定义配置优先，否则使用平台默认配置。
- `POST /api/check-task`：自定义配置优先，否则使用平台默认配置。

## 前端

- 工作台 API 配置弹窗增加“平台默认 / 自定义上游”模式。
- 平台默认模式不显示 Base URL/API Key 输入框。
- 自定义模式保存用户自己的 Base URL/API Key/模型/完整 URL 模式。
- Zustand 持久化版本升级到 2；旧版本本地 API 配置一律迁移为平台默认模式，避免旧默认密钥继续留在客户端。
- 管理员页增加“默认上游配置”面板。
