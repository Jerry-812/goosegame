# goosegame（3D 物理收纳消除）

在线试玩（GitHub Pages）：

- `https://jerry-812.github.io/goosegame/`

## 运行

最简单（本地）：

- `python3 -m http.server 8080`
- 浏览器打开 `http://localhost:8080/`

部署成可分享链接（推荐 GitHub Pages）：

### GitHub Pages（免费）

本仓库已内置自动部署：每次 push 到 `main` 会自动把静态站点发布到 `gh-pages` 分支。

1. 打开仓库：`Settings → Pages`
2. `Build and deployment` 里选择：
   - `Source`：`Deploy from a branch`
   - `Branch`：`gh-pages` / `(root)`
3. 等待 1～2 分钟（或去 `Actions` 看 `Deploy GitHub Pages (gh-pages branch)` 是否成功）
4. 访问并分享网站链接：
   - 你的仓库是 `Jerry-812/goosegame`，通常地址是：`https://jerry-812.github.io/goosegame/`

如果你看到部署失败（红叉）：

- 先确认 `Actions` 没有被禁用（仓库 `Settings → Actions → General`）
- 再确认 `Settings → Pages` 已选择 `gh-pages` 分支发布
- 等待一次新的 push 触发工作流（或在 `Actions` 里手动 `Run workflow`）

### 方案 B：Netlify（免费/一键）

- 将仓库导入 Netlify 即可（本仓库已提供 `netlify.toml`，无构建步骤）
- 发布目录是项目根目录，入口 `index.html`

### 方案 C：Vercel（免费/一键）

- 将仓库导入 Vercel 即可（本仓库已提供 `vercel.json`）
- 入口 `index.html`

## 玩法

- 点击锅里**可点击（最上层/未被遮挡）**的物品，放入底部“待合成栏”
- 待合成栏中任意类型累计 **3 个**会自动消除并加分，连消会提升倍率与灵感充能
- 按住拖动可搅拌盆中物品，真实物理挤压可制造出更顺手的可点击目标
- 灵感能量满格会触发 **时间奖励 + 随机道具补给**，节奏更爽快
- 倒计时清空全部物品即胜利；若待合成栏无法再放入新物品则失败

小技巧：

- 待合成栏会自动把同类型放到一起（更接近“抓大鹅”手感）
- “分享”会带上本局 `seed`（局号）和 `mode`（难度），朋友打开就是同一局

## 安装到桌面（可选）

- iOS Safari：分享 → “添加到主屏幕”
- Android Chrome：右上角菜单 → “安装应用”

## 素材

`images/` 下已生成可用的占位 PNG（可直接替换为更精美的透明底素材）。

## 备注

仓库里保留了微信小程序原型文件（`pages/`、`components/`、`app.json` 等），网页版本不依赖它们。
