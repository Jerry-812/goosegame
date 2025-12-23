# goosegame（芭比消除）

## 运行

最简单（本地）：

- `python3 -m http.server 8080`
- 浏览器打开 `http://localhost:8080/`

部署成可分享链接（任选其一）：

### 方案 A：GitHub Pages（推荐，免费）

1. 在 GitHub 新建仓库，把本项目 push 到 `main` 分支
2. 打开仓库 `Settings → Pages → Build and deployment`，选择 `GitHub Actions`
3. 等待 Actions 里 `Deploy GitHub Pages` 工作流跑完
4. 访问并分享：`https://<你的用户名>.github.io/<仓库名>/`

本仓库已内置自动部署配置：`.github/workflows/deploy-pages.yml` + `.nojekyll`。

### 方案 B：Netlify（免费/一键）

- 将仓库导入 Netlify 即可（本仓库已提供 `netlify.toml`，无构建步骤）
- 发布目录是项目根目录，入口 `index.html`

### 方案 C：Vercel（免费/一键）

- 将仓库导入 Vercel 即可（本仓库已提供 `vercel.json`）
- 入口 `index.html`

## 玩法

- 点击锅里**可点击（最上层/未被遮挡）**的芭比娃娃，放入底部“待合成栏”
- 待合成栏中任意类型累计 **3 个**会自动消除并加分
- 60 秒倒计时清空全部娃娃即胜利；若待合成栏无法再放入新娃娃则失败

## 素材

`images/` 下已生成可用的占位 PNG（可直接替换为更精美的透明底素材）。

## 备注

仓库里保留了微信小程序原型文件（`pages/`、`components/`、`app.json` 等），网页版本不依赖它们。
