# Chat Code Agent

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5-18181B?logo=zustand&logoColor=white)](https://zustand-demo.pmnd.rs/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.52-007ACC?logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![xterm.js](https://img.shields.io/badge/xterm.js-5-000000?logo=terminal&logoColor=white)](https://xtermjs.org/)
[![node-cron](https://img.shields.io/badge/node--cron-3-2B5B84?logo=nodedotjs&logoColor=white)](https://github.com/node-cron/node-cron)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

AI 驱动的全能编程助手 —— 融合聊天对话与代码编辑，支持多模型切换、文件管理、终端操作、MCP 扩展、定时任务等。

## ✨ 特性

- **双模式工作流** — 聊天模式（自由对话）+ 编程模式（项目级代码协作），一键切换
- **多模型支持** — DeepSeek / MiMo / OpenAI / Claude / GLM / 月之暗面 / Gemini，按需配置
- **Markdown 渲染** — 代码语法高亮、行号、一键复制
- **文件管理** — 可视化文件树，支持新建/删除/重命名/内容搜索
- **WebSocket 终端** — 多 Tab 终端，CWD 自动追踪
- **代码编辑器** — 基于 Monaco Editor，支持多 Tab、拖拽排序、分屏编辑、右键菜单
- **MCP 协议** — 接入 MCP Server，扩展工具能力（如 GitHub 操作）
- **Skills 技能系统** — 自定义 System Prompt，会话级/项目级注入
- **Cron 定时任务** — 定时执行 AI 任务，支持工具调用
- **RAG 知识库** — 本地文件向量化检索增强
- **安全认证** — Token 登录认证，API Key 加密存储
- **亮暗主题** — 一键切换，终端同步跟随

---

## 🔐 登录认证

每次启动服务端会自动生成一次性 Token，保障本地访问安全。

![登录页面](screenshots/login.png)

---

## 💬 聊天模式

自由对话，支持多轮交互、Markdown 渲染、代码高亮。侧边栏管理历史对话，支持搜索、置顶、删除。

### 主界面

![聊天主界面](screenshots/chat-main.png)

### 对话管理

侧边栏支持对话搜索、置顶分区、hover 操作按钮（编辑/复制/置顶/删除）。

![对话管理](screenshots/chat-sidebar.png)

### 消息编辑与复制

用户消息支持 hover 展示复制和编辑按钮，点击编辑可原地修改后重新发送。

![消息编辑与复制](screenshots/chat-edit-copy.png)

### Skills 技能系统

自定义 System Prompt 作为"技能"，支持对话/编程模式分别启用。

![Skills 面板](screenshots/chat-skills.png)

### 工具面板

双标签页展示内置工具和 MCP 扩展工具，清晰区分来源。

![工具面板](screenshots/chat-tools.png)

### Cron 定时任务

配置定时 AI 任务，支持 Cron 表达式、模型选择、工具授权。

![Cron 定时任务](screenshots/chat-cron.png)

### RAG 知识库

上传本地文件构建向量知识库，AI 回答自动检索相关内容。

![RAG 知识库](screenshots/chat-rag.png)

---

## 💻 编程模式

以项目为中心的代码协作模式，集成文件树、编辑器、终端三栏布局。

### 主界面

![编程模式](screenshots/code-main.png)

### 文件树操作

目录树展开/折叠，hover 显示新建文件/文件夹、删除按钮，支持文件多选模式。

![文件树](screenshots/code-filetree.png)

### Tab 管理与右键菜单

多文件 Tab 拖拽排序，右键菜单支持关闭/关闭其他/关闭右侧/向右拆分。

![Tab 右键菜单](screenshots/code-editor-tabs.png)

### 分屏编辑

左右分屏同时编辑，中间分割线可拖拽调整比例。

![分屏编辑](screenshots/code-split.png)

### 终端面板

基于 WebSocket 的多 Tab 终端，CWD 自动追踪，标签标题跟随工作目录变化。

![终端面板](screenshots/code-terminal.png)

### 文件内容搜索

侧边栏搜索框支持文件名过滤和文件内容搜索双模式，一键切换。

![文件搜索](screenshots/code-search.png)

---

## 🎨 通用特性

### 亮暗主题

一键切换亮色/暗色主题，全局统一（包括 Markdown 渲染区、终端、代码编辑器）。

![亮暗主题](screenshots/theme-light-dark.png)

---

## ⚙️ 设置中心

### API 配置

管理多个 AI Provider 的 API Key，支持密文显示、一键复制、测试连接。

![API 配置](screenshots/settings-api.png)

### 全局参数

Temperature、Top-P、Max Tokens、Max Tool Rounds 全局默认值。

![全局参数](screenshots/settings-params.png)

### MCP Servers

管理 MCP Server 连接，支持 stdio 和 HTTP 两种传输方式。

![MCP Servers](screenshots/settings-mcp.png)

### 搜索 & Embedding

配置 Tavily 网页搜索 API Key 和 Embedding 模型（用于 RAG 向量检索）。

![搜索与Embedding](screenshots/settings-search-embedding.png)

---

## 🚀 安装与运行

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动后端（3210端口）和前端（5173端口）
npm start

# 或分别启动
npm run server   # 后端 → http://localhost:3210
npm run dev      # 前端 → http://localhost:5173
```

### 生产构建

```bash
npm run build    # TypeScript 编译 + Vite 打包
npm run preview  # 预览构建结果
```

### 配置

1. 启动服务端后访问前端页面
2. 复制终端输出的 Token 进行登录
3. 在设置页配置至少一个 AI Provider 的 API Key
4. 开始使用

参考 `config.example.json` 了解配置文件完整结构。

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 代码编辑器 | Monaco Editor |
| 终端 | xterm.js + node-pty + WebSocket |
| 后端 | Express 5 |
| Markdown | react-markdown + Prism |
| 定时任务 | node-cron |
| 图标 | Lucide React |

---

## 📁 项目结构

```
Chat_Code_Agent/
├── src/
│   ├── components/
│   │   ├── chat/          # ChatWindow, ChatSidebar, SkillsPanel, CronPanel, ToolsPanel, RagPanel
│   │   ├── code/          # CodeAIChat, CodeEditor, CodeSidebar, FolderBrowser, TerminalPanel
│   │   └── common/        # Header, SettingsPanel, LoginScreen, MarkdownRenderer, PromptDialog
│   ├── store/             # Zustand 状态管理
│   ├── utils/             # API 请求、认证、文件操作
│   └── types/             # TypeScript 类型定义
├── server/
│   ├── index.js           # Express API 入口
│   ├── tools.js           # 工具定义与执行
│   ├── cronScheduler.js   # 定时任务调度
│   ├── mcpClient.js       # MCP 协议客户端
│   ├── ragEngine.js       # RAG 检索引擎
│   └── terminal.js        # WebSocket 终端服务
├── screenshots/           # 截图
├── config.example.json    # 配置文件模板
└── package.json
```

---

## 📄 License

MIT
