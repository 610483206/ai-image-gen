# AI 绘画 - GPT-IMAGE 2.0

基于 GPT-IMAGE 2.0 的 AI 生图 Web 应用，支持**多轮对话式生图**，像 ChatGPT 一样通过对话逐步优化图片。

## ✨ 功能特性

### v2 多轮对话（新）

- 💬 **ChatGPT 式对话** - 通过多轮对话逐步优化图片
- ✏️ **以此为参考** - 点击生成图的 ✏️ 按钮，自动作为下一轮参考图
- 🔄 **自动上下文** - 纯文本追问时自动带上一轮结果作为参考图
- 📋 **会话管理** - 左侧会话列表，支持搜索、重命名、删除
- ⌨️ **键盘快捷键** - `Cmd/Ctrl+K` 新建会话，`Cmd/Ctrl+/` 聚焦输入框

### 核心功能

- 🎨 **文字生成图片** - 输入描述即可生成高质量图片
- 🖼️ **参考图编辑** - 支持上传最多 5 张参考图进行编辑
- 📐 **多尺寸支持** - 支持 1:1、16:9、9:16、4K 等多种尺寸
- 💎 **多画质选择** - 低质量/中等/高质量/自动
- ⚡ **并发生成** - 支持 1-10 并发同时生成
- 🛡️ **风控保险** - 内容审核失败自动处理
- 📊 **实时进度** - 生成时显示进度条和预估时间
- 🔍 **图片预览** - 支持放大预览、下载、复制提示词
- 📜 **历史记录** - 自动保存生成历史（保留 3 天）
- 💰 **余额查询** - 自动查询 API 余额

## 🛠️ 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **本地存储**: localStorage + IndexedDB
- **图标**: Lucide Icons

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm（推荐）或 npm/yarn

### 本地运行

```bash
# 1. 克隆项目
git clone https://github.com/your-username/ai-image-gen.git
cd ai-image-gen

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```

打开浏览器访问 http://localhost:3000

### 默认配置

项目内置了默认 API 配置，可直接使用：

| 配置项 | 默认值 |
|--------|--------|
| Base URL | `https://www.packyapi.com/v1` |
| Model ID | `gpt-image-2` |

> API Key 已内置，如需更换请点击右上角 ⚙️ 按钮修改。

## 📦 部署到 Vercel

### 方式一：通过 Vercel 网站部署

1. **上传代码到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/ai-image-gen.git
   git push -u origin main
   ```

2. **登录 [Vercel](https://vercel.com)**

3. **点击 "Add New" → "Project"**

4. **选择你的 GitHub 仓库，点击 "Import"**

5. **配置项目设置**
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `next build`
   - Output Directory: `.next`

6. **（可选）配置环境变量**
   ```
   NEXT_PUBLIC_DEFAULT_BASE_URL=https://www.packyapi.com/v1
   NEXT_PUBLIC_DEFAULT_MODEL_ID=gpt-image-2
   ```

7. **点击 "Deploy" 开始部署**

8. **等待部署完成，访问分配的域名（如 `xxx.vercel.app`）**

### 方式二：通过 Vercel CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

## 📁 项目结构

```
ai-image-gen/
├── src/
│   ├── app/
│   │   ├── api/generate/route.ts   # 后端代理 API（自动选择 /images/generations 或 /images/edits）
│   │   ├── globals.css             # 全局样式 + 动画
│   │   ├── layout.tsx              # 根布局
│   │   └── page.tsx                # 主页面（三栏布局）
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 组件
│   │   ├── conversation-list.tsx   # 左侧会话列表（v2 新增）
│   │   ├── right-panel.tsx         # 中间对话流
│   │   ├── input-area.tsx          # 底部输入区（v2 新增）
│   │   ├── settings-dialog.tsx     # 设置弹窗
│   │   └── image-lightbox.tsx      # 图片灯箱组件
│   ├── hooks/
│   │   ├── use-elapsed-time.ts     # 计时器 + 进度条 Hook
│   │   ├── use-balance.ts          # 余额查询 Hook
│   │   ├── use-history.ts          # 历史记录 Hook
│   │   └── use-keyboard-shortcuts.ts # 键盘快捷键 Hook（v2 新增）
│   ├── lib/
│   │   ├── db.ts                   # IndexedDB 工具（v2: 会话 + 图片存储）
│   │   ├── migration.ts            # v1→v2 数据迁移脚本（v2 新增）
│   │   └── utils.ts                # 工具函数
│   └── store/
│       └── use-app-store.ts        # Zustand 全局状态（v2: 多轮会话模型）
├── public/                         # 静态资源
├── .env.example                    # 环境变量示例
├── next.config.mjs                 # Next.js 配置
├── tailwind.config.ts              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
└── package.json
```

## 🔧 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_DEFAULT_BASE_URL` | 默认 API 地址 | `https://www.packyapi.com/v1` |
| `NEXT_PUBLIC_DEFAULT_MODEL_ID` | 默认模型 ID | `gpt-image-2` |

## 💬 多轮对话使用指南

### 基本用法

1. **首次生成**：在底部输入框输入描述，点击发送或按 Enter
2. **继续修改**：直接输入修改建议，AI 会自动带上一轮结果作为参考图
3. **以此为参考**：点击生成图上的 ✏️ 按钮，该图会自动添加到参考图槽位
4. **单图重试**：点击生成图上的 ↻ 按钮重新生成该图

### 多轮策略

- **以图为锚**：点击 ✏️ 按钮选择参考图 → 输入修改指令 → 使用 `/images/edits` 接口
- **自动上下文**：不选择参考图直接输入 → 自动带上一轮结果 → 使用 `/images/edits` 接口

### 会话管理

- 左侧会话列表按时间分组（今天/昨天/更早）
- 支持搜索、重命名、删除会话
- 会话和图片均保留 3 天，过期自动清理

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `Cmd/Ctrl + K` | 新建会话 |
| `Cmd/Ctrl + /` | 聚焦输入框 |
| `Esc` | 关闭弹窗 |
| `Ctrl + V` | 粘贴图片 |

## ❓ 常见问题

### Q: 如何更换 API？

点击左上角 ⚙️ 按钮，在弹窗中修改 Base URL、API Key 和 Model ID。

### Q: 支持哪些模型？

支持所有兼容 OpenAI Images API 的模型，如：
- `gpt-image-1` / `gpt-image-2`
- `dall-e-3` / `dall-e-2`

### Q: 图片保存多久？

生成的图片保存在浏览器 IndexedDB 中，保留 3 天后自动清理。请及时下载保存。

### Q: 如何使用参考图？

支持以下方式上传参考图：
- 点击输入框左侧 📎 按钮选择文件
- 拖拽图片到输入区域
- 使用快捷键 `Ctrl+V` 粘贴图片
- 点击生成图的 ✏️ 按钮以此图为参考

### Q: 部署后无法生成图片？

请检查：
1. API Key 是否正确配置
2. Base URL 是否可访问
3. 模型 ID 是否正确

### Q: 如何实现多轮对话？

1. 生成图片后，直接在输入框输入修改建议
2. 或者点击生成图的 ✏️ 按钮选择参考图，再输入修改建议
3. AI 会根据上下文自动优化图片

## 📄 License

MIT
