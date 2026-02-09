# Goose Catch Deluxe（抓大鹅风格）

本项目现在的**核心运行逻辑来自 `goose-catch-main/src`（React + R3F + Rapier）**，外层只是 Electron/部署的包装。

推荐体验方式：直接打开打包好的 macOS `.app`。

参考目标效果（视觉与手感对齐 goose-catch-main / 官方展示）：

- `https://goose-catch.vercel.app/`

## 1. 直接用 `.app` 运行（推荐）

在仓库根目录执行：

1. 安装依赖
- `npm install`

2. 打包 macOS App（会生成最新的 `.app`）
- `npm run electron:dist`

3. 打开 App
- Finder 中打开：`dist/mac-arm64/Goose Catch Deluxe.app`
- 或终端执行：`open \"dist/mac-arm64/Goose Catch Deluxe.app\"`

说明：

- `.app` 的入口就是当前根目录的 `index.html + main.js + styles.css`。
- 目前 `.app` 会优先加载 `goose-catch-main/dist`（即核心 React 版本的构建产物）。
- 每次改完 `goose-catch-main/src`，只要重新执行一次 `npm run electron:dist`，再打开 `.app` 就是最新版本。

## 2. 浏览器本地运行（开发调试）

如果你要快速调试画面和交互：

核心开发建议直接启动 `goose-catch-main`：

1. 启动核心开发服务器
- `npm run dev`

2. 浏览器打开（Vite 会显示本地地址）


## 3. 生成“可在 mac / iOS 直接打开的链接”（强烈推荐 Vercel）

目标：拿到一个 HTTPS 链接，mac 和 iOS 都能直接点开玩（并可“添加到主屏幕”）。

方式 A：Vercel（最省事，推荐）

1. 把仓库推到 GitHub（当前目录就是静态站点根目录）
2. 打开 Vercel 并导入该仓库
3. Framework 选择 `Other` / `Static`
4. Build Command / Output Directory 已配置为 `goose-catch-main/dist`（见 `vercel.json`）
5. 部署完成后，你会得到一个链接（mac / iOS 都可直接打开）

iOS 体验建议：

1. 用 Safari 打开部署链接
2. 点击分享按钮 → “添加到主屏幕”
3. 之后会以 App 形态启动（standalone）

## 当前对齐参考站点的关键点

为对齐 `goose-catch-main / vercel` 的观感，当前实现采用了这些默认参数（easy 模式）：

- 倒计时：`120s（2:00）`
- 总物品：`105`
- 托盘格数：`6`
- 手机壳式 UI（灰底 + 圆角机身 + 刘海 + 底部蓝色托盘）

这些参数与画面风格已经直接写在：

- 核心逻辑：`goose-catch-main/src`
- 画面样式：`goose-catch-main/src/style.css`

## 打包与脚本

项目脚本（根目录 `package.json`）：

- 语法检查（旧版脚本）：`npm run check`
- 核心开发：`npm run dev`（等价于 `goose-catch-main` 的 Vite）
- Electron 打包（目录产物）：`npm run electron:dist`

打包产物位置：

- `dist/mac-arm64/Goose Catch Deluxe.app`

## 部署（可选）

这是一个纯静态站点，也可以继续部署到 GitHub Pages / Netlify / Vercel：

- 入口：`index.html`
- 静态资源：根目录与 `assets/`、`images/`、`vendor/` 等

> 注意：线上部署用于分享，**本地体验建议优先 `.app`**（更接近你最终想要的形态）。

## 备注

- 仓库中保留了微信小程序原型文件（`pages/`、`components/`、`app.json` 等），网页与 `.app` 不依赖它们。
- 参考项目源码在：`goose-catch-main/`

## Auto-evolve CI（可选）

GitHub Actions 工作流 `auto-evolve` 需要一个 LLM HTTP endpoint，返回统一 diff patch：

1. 在服务器上运行 `scripts/llm-endpoint.mjs`（或替换为自定义实现）。
2. 在 GitHub 仓库的 Settings → Secrets and variables → Actions 中新增 `LLM_ENDPOINT`，值为 `https://your-endpoint.example.com/patch`。
3. 触发 `auto-evolve` workflow，CI 会请求 patch、执行 guardrails、评估性能并在改进时创建 PR。
## 自动优化流水线（自动评测 → 生成补丁 → 评估 → PR → 可自动合并）

已新增自动化闭环脚本与 GitHub Actions：

- `scripts/eval.mjs`：Playwright 评测 FPS / load_ms / bundle_kb / console_errors
- `scripts/score.mjs`：评分与对比逻辑
- `scripts/guardrails.mjs`：护栏（仅允许改 `goose-catch-main/src`，限制 diff 大小）
- `scripts/agent_generate_patch.mjs`：调用 LLM 生成 unified diff（写到 `agent.patch`）
- `.github/workflows/auto-evolve.yml`：每天自动跑一次，可手动触发

运行机制：

1. 构建并评估 baseline
2. LLM 生成补丁（只允许改 `goose-catch-main/src`）
3. 重新构建与评估 candidate
4. 指标提升 → 自动 PR → 可自动合并

需要设置的 GitHub Secrets：

- `LLM_ENDPOINT`：你的 LLM 接口地址（POST JSON，返回 patch）
- `LLM_API_KEY`：可选

如果不设置 `LLM_ENDPOINT`，补丁生成会失败并终止流程。

## 本地 Ollama Patch Endpoint（无云 API Key 版本）

你可以在本地用 Ollama + 一个极简 HTTP 服务提供 `LLM_ENDPOINT`。

1. 安装并启动 Ollama（首次运行会拉模型）：

```bash
ollama pull qwen2.5-coder:7b
```

2. 启动补丁服务（默认监听 127.0.0.1:8787）：

```bash
node scripts/ollama_patch_server.mjs
```

3. 本地运行自动化（使用本地 endpoint）：

```bash
LLM_ENDPOINT=http://127.0.0.1:8787/patch npm run build
LLM_ENDPOINT=http://127.0.0.1:8787/patch npm run preview -- --host 0.0.0.0 --port 4173 &
```

4. 若要让 GitHub Actions 也访问本地 endpoint：

- 使用 **self-hosted runner**（运行在你本机）
- 在仓库 **Settings → Variables** 添加：
  - `RUNNER_LABELS`: `["self-hosted","macOS"]`（或你的 runner 标签）
  - `LLM_ENDPOINT`: `http://127.0.0.1:8787/patch`

> Action 里已支持 `vars.LLM_ENDPOINT`，若 Secrets 不设置也可走本地变量。
