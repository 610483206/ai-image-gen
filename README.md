# AI 绘画 - GPT-IMAGE 2.0

基于 GPT-IMAGE 2.0 的 AI 生图 Web 应用，支持文字生成图片、多图编辑、风格迁移。

## ✨ 功能特性

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
│   │   ├── api/generate/route.ts   # 后端代理 API
│   │   ├── globals.css             # 全局样式 + 动画
│   │   ├── layout.tsx              # 根布局
│   │   └── page.tsx                # 主页面
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 组件
│   │   ├── left-panel.tsx          # 左侧控制面板
│   │   ├── right-panel.tsx         # 右侧工作台
│   │   ├── settings-dialog.tsx     # 设置弹窗
│   │   └── image-lightbox.tsx      # 图片灯箱组件
│   ├── hooks/
│   │   ├── use-elapsed-time.ts     # 计时器 + 进度条 Hook
│   │   ├── use-balance.ts          # 余额查询 Hook
│   │   └── use-history.ts          # 历史记录 Hook
│   ├── lib/
│   │   ├── task-queue.ts           # 并发任务队列
│   │   ├── db.ts                   # IndexedDB 工具
│   │   └── utils.ts                # 工具函数
│   └── store/
│       └── use-app-store.ts        # Zustand 全局状态
├── public/                         # 静态资源
├── .env.example                    # 环境变量示例
├── next.config.js                  # Next.js 配置
├── tailwind.config.ts              # Tailwind CSS 配置
├── tsconfig.json                   # TypeScript 配置
└── package.json
```

## 🔧 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_DEFAULT_BASE_URL` | 默认 API 地址 | `https://www.packyapi.com/v1` |
| `NEXT_PUBLIC_DEFAULT_MODEL_ID` | 默认模型 ID | `gpt-image-2` |

## ❓ 常见问题

### Q: 如何更换 API？

点击右上角 ⚙️ 按钮，在弹窗中修改 Base URL、API Key 和 Model ID。

### Q: 支持哪些模型？

支持所有兼容 OpenAI Images API 的模型，如：
- `gpt-image-1` / `gpt-image-2`
- `dall-e-3` / `dall-e-2`

### Q: 图片保存多久？

生成的图片保存在浏览器 IndexedDB 中，保留 3 天后自动清理。请及时下载保存。

### Q: 如何使用参考图？

支持以下方式上传参考图：
- 点击 `+` 按钮选择文件
- 拖拽图片到上传区域
- 使用快捷键 `Ctrl+V` 粘贴图片

### Q: 部署后无法生成图片？

请检查：
1. API Key 是否正确配置
2. Base URL 是否可访问
3. 模型 ID 是否正确

## 📄 License

MIT
