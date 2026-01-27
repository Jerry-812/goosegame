# Goose Catch Deluxe（抓大鹅风格）

本项目现在的**推荐运行方式是直接打开打包好的 macOS `.app`**。

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
- 每次你改完样式或逻辑，只要重新执行一次 `npm run electron:dist`，再打开 `.app` 就是最新版本。

## 2. 浏览器本地运行（开发调试）

如果你要快速调试画面和交互：

1. 启动静态服务
- `python3 -m http.server 4173`

2. 浏览器打开
- `http://127.0.0.1:4173/index.html?mode=easy&seed=2026`

可选（开启调试钩子）：

- `http://127.0.0.1:4173/index.html?debug=1&mode=easy&seed=2026`

## 当前对齐参考站点的关键点

为对齐 `goose-catch-main / vercel` 的观感，当前实现采用了这些默认参数（easy 模式）：

- 倒计时：`120s（2:00）`
- 总物品：`105`
- 托盘格数：`6`
- 手机壳式 UI（灰底 + 圆角机身 + 刘海 + 底部蓝色托盘）

这些参数与画面风格已经直接写在：

- 逻辑：`main.js`
- 画面：`styles.css`

## 打包与脚本

项目脚本（根目录 `package.json`）：

- 语法检查：`npm run check`
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
