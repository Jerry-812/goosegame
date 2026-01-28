# Goosegame 质量评估系统

本目录提供一个**可独立运行的质量评估与诊断系统**，用于多维度自动分析当前游戏质量。

## 功能覆盖

- **运行时性能**：平均 FPS、P95 帧时间、长任务统计。
- **响应性**：输入延迟 P50/P95 采样。
- **稳定性**：页面错误、Console 异常。
- **资源负载**：资源传输体积、编码体积、JS Heap 使用。
- **玩法/配置面**：物品分值区间、模型覆盖率、平台产物覆盖情况。
- **子项评分 + 诊断建议**：自动细分子项评分、诊断原因与优化建议。

## 快速开始

```bash
node quality-audit/run.js
```

默认会启动临时静态服务器并打开 `index.html?debug=1` 进行采样。

### 指定 URL

```bash
node quality-audit/run.js --url http://localhost:4173/index.html?debug=1
```

### 指定输出目录

```bash
node quality-audit/run.js --out quality-audit/output
```

## 输出

- `quality-audit/output/quality-report.json`
- `quality-audit/output/quality-report.md`

## 子项评分与诊断

报告会在每个维度下输出细分子项（subpoints）的评分与等级，并列出对应的诊断原因与优化建议，便于逐项优化。

## 备注

- 依赖 Playwright（已在项目 devDependencies 中）。
- 若评估目标在生产环境，建议使用完整 URL，并携带 `debug=1` 以便抓取更多行为数据。
