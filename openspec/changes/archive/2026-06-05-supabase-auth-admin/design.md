---
archived-with: 2026-06-05-supabase-auth-admin
status: final
status: final
---
# 技术设计文档

## 架构概览

```mermaid
flowchart TD
  A[用户] --> B[邮箱验证码登录/注册]
  B --> C[Supabase Auth Session]
  C --> D[Next.js Middleware 刷新 Cookie]
  D --> E[AI 绘画工作台]
  E --> F[/api/generate]
  F --> G[校验用户与账号状态]
  G --> H[原子预占每日配额]
  H --> I[调用平台上游生图 API]
  I --> J[SSE progress / complete / error]
  J --> K[成功确认计数或失败释放预占]
  K --> L[Supabase 用量与任务记录]
  M[管理员面板] --> N[用户列表/配额/启停]
  N --> L
```

## 数据模型

### profiles 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，关联 auth.users |
| email | text | 用户邮箱 |
| role | app_role | 角色：user/admin |
| status | account_status | 状态：active/disabled |
| daily_quota | integer | 每日生图配额，默认 20 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### user_usage_daily 表

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID |
| usage_date | date | 使用日期 |
| used_count | integer | 已使用次数 |
| reserved_count | integer | 预占次数 |
| updated_at | timestamptz | 更新时间 |

**主键**: (user_id, usage_date)

### generation_records 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| user_id | uuid | 用户 ID |
| client_task_id | text | 前端任务 ID |
| upstream_task_id | text | 上游任务 ID |
| prompt | text | 生图提示词 |
| image_size | text | 图片尺寸 |
| quality | text | 图片质量 |
| status | generation_status | 状态：reserved/pending_upstream/succeeded/failed |
| error_message | text | 错误信息 |
| requested_at | timestamptz | 请求时间 |
| completed_at | timestamptz | 完成时间 |
| updated_at | timestamptz | 更新时间 |

## RPC 函数设计

### reserve_generation_quota

**用途**: 预占生图配额

**参数**:
- p_user_id: uuid
- p_client_task_id: text
- p_prompt: text (可选)
- p_size: text (可选)
- p_quality: text (可选)

**返回**: jsonb
```json
{
  "ok": true,
  "remaining": 15,
  "recordId": "uuid"
}
```

**逻辑**:
1. 检查用户状态
2. 检查是否已有相同 client_task_id 的记录（防重复）
3. 检查配额是否充足
4. 创建 generation_records 记录
5. 增加 user_usage_daily.reserved_count

### complete_generation_quota

**用途**: 确认生图完成，将 reserved 转为 used

**参数**:
- p_user_id: uuid
- p_client_task_id: text
- p_upstream_task_id: text (可选)

**逻辑**:
1. 验证记录存在且状态为 reserved/pending_upstream
2. 更新 generation_records 状态为 succeeded
3. 减少 reserved_count，增加 used_count

### release_generation_quota

**用途**: 释放预占的配额（生图失败时调用）

**参数**:
- p_user_id: uuid
- p_client_task_id: text
- p_error_message: text (可选)

**逻辑**:
1. 验证记录存在
2. 更新 generation_records 状态为 failed
3. 减少 reserved_count

## 安全设计

### RLS 策略

1. **profiles 表**:
   - 普通用户只能读自己的资料
   - 管理员可以读所有用户的资料

2. **user_usage_daily 表**:
   - 普通用户只能读自己的用量
   - 管理员可以读所有用户的用量

3. **generation_records 表**:
   - 普通用户只能读自己的记录
   - 管理员可以读所有用户的记录

### API 安全边界

1. **/api/generate**:
   - 必须登录
   - 账号状态必须为 active
   - 配额充足才能生图
   - 使用服务端环境变量中的 API Key

2. **/api/check-task**:
   - 必须登录
   - 只能查询自己的任务

3. **/api/upload-image**:
   - 必须登录

4. **/api/test-connection**:
   - 必须是管理员

5. **/api/image/[key]**:
   - 保持匿名访问（给上游 API 读取参考图）
   - 10 分钟 TTL

## 配额管理策略

1. **预占机制**: 生图前先预占名额，防止并发超额
2. **成功确认**: 生图成功后，预占转为已用
3. **失败释放**: 生图失败时，释放预占的名额
4. **防重复**: 同一 client_task_id 不会重复计数

## 前端集成

### 配额刷新时机

1. 登录成功后
2. 发送生图请求后
3. 生图完成/失败后
4. 页面刷新时

### 用户体验

1. 配额充足：正常显示剩余次数
2. 配额不足：禁用发送按钮，显示重置时间
3. 账号禁用：提示联系管理员

## 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 项目 URL | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | ✅ |
| ADMIN_EMAILS | 初始管理员邮箱 | ✅ |
| UPSTREAM_API_BASE_URL | 平台生图 API Base URL | ✅ |
| UPSTREAM_API_KEY | 平台生图 API Key | ✅ |
| UPSTREAM_MODEL_ID | 默认生图模型 | 否 |
| UPSTREAM_USE_FULL_URL | 是否使用完整 URL | 否 |
| DEFAULT_DAILY_QUOTA | 新用户默认配额 | 否 |
