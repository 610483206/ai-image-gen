# AI Image Gen - 项目总结文档

> 供 AI 模型和开发者快速了解项目全貌，避免重复阅读源码。
> 最后更新：2026-05-28

---

## 1. 项目概述

基于 Next.js 14 的 AI 图片生成 Web 应用，支持 OpenAI 兼容 API 的文本生图和图片编辑。部署在 Cloudflare Pages，使用 Cloudflare KV 作为临时图片存储。

**核心功能**：文本生图、参考图编辑（img2img）、多轮对话式迭代、并发生图、图片历史管理。

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router, Edge Runtime) |
| 语言 | TypeScript |
| 状态管理 | Zustand 5 + persist (localStorage) |
| 本地存储 | IndexedDB（会话和图片，3 天过期自动清理） |
| UI 组件 | shadcn/ui + Radix UI + Tailwind CSS |
| 通知 | Sonner (toast) |
| 图标 | Lucide React |
| 主题 | next-themes (dark/light) |
| 部署 | Cloudflare Pages (@cloudflare/next-on-pages) |
| 临时存储 | Cloudflare KV (IMAGES_BUCKET，图片 10 分钟 TTL) |

---

## 3. 目录结构

```
src/
├── app/
│   ├── page.tsx                    # 主页面（布局：左侧会话列表 + 右侧对话流 + 底部输入）
│   ├── layout.tsx                  # 根布局（ThemeProvider + Toaster）
│   ├── globals.css                 # 全局样式 + CSS 变量（亮/暗主题色）
│   └── api/
│       ├── generate/route.ts       # ★ 核心：生图 API（SSE 流式，同步/异步双模式）
│       ├── check-task/route.ts     # 异步任务状态查询（超时后重新检查）
│       ├── test-connection/route.ts # API 连接测试（调用 /v1/models）
│       ├── upload-image/route.ts   # 图片上传到 KV
│       └── image/[key]/route.ts    # 从 KV 读取图片（10 分钟 TTL）
├── store/
│   └── use-app-store.ts            # ★ 核心：全局状态（配置、会话、消息、生图任务调度）
├── components/
│   ├── right-panel.tsx             # 对话流展示（消息列表 + 图片网格 + 操作按钮）
│   ├── input-area.tsx              # 底部输入区（prompt + 参考图 + 参数控制）
│   ├── conversation-list.tsx       # 左侧会话列表（新建/切换/删除/清空）
│   ├── settings-dialog.tsx         # API 配置弹窗（BaseURL/Key/Model/测试连接）
│   ├── image-lightbox.tsx          # 图片灯箱（全屏查看 + 下载）
│   ├── left-panel.tsx              # 左侧面板容器
│   └── ui/                         # shadcn/ui 基础组件
├── hooks/
│   ├── use-balance.ts              # 余额查询 Hook
│   ├── use-elapsed-time.ts         # 计时器 Hook（生图耗时显示）
│   ├── use-history.ts              # 历史图片 Hook（从 IndexedDB 读取）
│   └── use-keyboard-shortcuts.ts   # 快捷键 Hook
├── lib/
│   ├── db.ts                       # IndexedDB 封装（会话 + 图片 CRUD，自动过期清理）
│   ├── migration.ts                # v1 → v2 数据迁移（localStorage → IndexedDB 会话）
│   ├── task-queue.ts               # 任务队列（v2 保留兼容，主逻辑已在 store）
│   └── utils.ts                    # 工具函数（cn）
└── types/
    └── cloudflare-env.d.ts         # Cloudflare 环境类型
```

---

## 4. 核心架构与数据流

### 4.1 生图请求流

```
用户输入 prompt + 可选参考图
        ↓
  use-app-store.ts: sendMessage()
  ├── 确定参考图来源（手动选择 / 自动继承上轮结果）
  ├── 创建 user message + assistant message（含 N 个 pending tasks）
  └── 并发调用 streamGenerate() × N
        ↓
  streamGenerate() → POST /api/generate（JSON body）
        ↓
  route.ts: 判断是否有参考图
  ├── 有参考图 + 标准模式 → POST {baseURL}/images/edits (multipart/form-data)
  ├── 无参考图 → POST {baseURL}/images/generations (JSON)
  └── useFullUrl 模式 → POST {baseURL}（JSON，参考图通过 KV URL 传递）
        ↓
  上游 API 返回
  ├── 同步模式：直接返回 data[0].b64_json 或 data[0].url
  └── 异步模式：返回 task_id → 轮询 /v1/media/status（最多 48 次，5s 间隔）
        ↓
  SSE 事件流 → 前端 streamGenerate() 解析
        ↓
  更新 task 状态 → 保存图片到 IndexedDB
```

### 4.2 两种 API 模式

| 模式 | useFullUrl | 端点选择 | 请求格式 | 典型场景 |
|------|-----------|---------|---------|---------|
| 标准模式 | `false` | 自动: `/images/generations` 或 `/images/edits` | JSON / multipart | OpenAI 官方及兼容中转 |
| 完整 URL 模式 | `true` | 用户填写的完整 URL | JSON (含 images URL 数组) | 鸿蒙大模型中心等非标准 API |

### 4.3 多轮对话策略

1. **以图为锚**（主要）：用户点击生成图的编辑按钮 → 该图自动填入参考图 → 后端走 `/images/edits`
2. **自动继承**（兜底）：用户直接发文本 → 自动取上一轮成功图片（最多 3 张）作为参考图

### 4.4 SSE 心跳机制

后端每 15 秒发 heartbeat 事件，防止 Cloudflare 100 秒超时断连。事件类型：
- `start` → `progress`(多次) → `complete`（成功）或 `error`（失败）

---

## 5. 默认 API 配置

```typescript
// src/store/use-app-store.ts
apiConfig: {
  baseURL: "https://jiuuij.de5.net/v1",     // 默认中转站
  apiKey: "sk-IhOMs9dDvupJKRgB5KCmlsirbf6Yrs59vuH7OsKlHhR8c3ht",
  modelId: "gpt-image-2",
  useFullUrl: false,                          // 标准 OpenAI 模式
}
```

API Key 在 store 中以 base64 编码存储（`encodeApiKey`/`decodeApiKey`，非加密，仅混淆）。用户可在设置弹窗中修改，配置持久化在 localStorage。

---

## 6. 关键文件修改指南

### 需要改生图核心逻辑时
- `src/app/api/generate/route.ts` — 后端 API 路由，负责端点选择、请求构建、SSE 流、异步轮询
- `src/store/use-app-store.ts` — 前端状态，`sendMessage()`（任务调度）和 `streamGenerate()`（SSE 解析）

### 需要改 UI 时
- `src/components/right-panel.tsx` — 对话流和图片展示
- `src/components/input-area.tsx` — 输入区域和参数控制
- `src/components/settings-dialog.tsx` — API 配置弹窗

### 需要改数据存储时
- `src/lib/db.ts` — IndexedDB schema 和 CRUD
- `src/store/use-app-store.ts` — Zustand persist 配置和会话持久化

### 需要改部署配置时
- `wrangler.toml` — Cloudflare Pages + KV 绑定
- `next.config.mjs` — Next.js 配置
- `vercel.json` — Vercel 部署配置

---

## 7. 已知的设计决策和注意事项

1. **Edge Runtime**：所有 API 路由使用 `export const runtime = "edge"`，限制了 Node.js API 的使用（无 fs、无 Buffer 等）。
2. **图片存储分两层**：
   - Cloudflare KV：临时中转（供上游 API 访问参考图 URL），TTL 10 分钟
   - IndexedDB：客户端持久化（生成结果），TTL 3 天
3. **API Key 混淆**：使用 base64 编码存储在 localStorage，不是真正的加密。
4. **异步任务兼容**：部分中转站返回 `task_id` 需轮询，Cloudflare Workers 限制单次最多 50 子请求，轮询上限 48 次 × 5s = 4 分钟。
5. **v1 → v2 迁移**：`src/lib/migration.ts` 处理从旧版单任务列表到新版会话结构的数据迁移，迁移完成后标记不再重复执行。
6. **参考图压缩**：前端在发送前将参考图压缩到 max 1024px、JPEG 0.8 质量，减小请求体。

---

## 8. 开发与部署

```bash
# 本地开发
pnpm install
pnpm dev            # http://localhost:3000

# 构建
pnpm build          # Next.js 标准构建

# Cloudflare Pages 部署
pnpm pages:build    # 使用 @cloudflare/next-on-pages 构建
pnpm pages:dev      # 本地模拟 Cloudflare 环境

# 预览（构建 + 本地 CF 环境）
pnpm preview
```

---

## 9. 修改历史

| 日期 | 变更 | 文件 |
|------|------|------|
| 2026-05-28 | 修复：有参考图时切换到 `/images/edits` + multipart/form-data（OpenAI 标准规范） | `route.ts` |
| 2026-05-28 | 默认站点改为 `https://jiuuij.de5.net/v1`（标准模式） | `use-app-store.ts` |
