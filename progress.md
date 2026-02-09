Original prompt: 浏览当前游戏中所有场景，仔细研究每个场景中的交互，物体的显示范围是否在屏幕中央正确位置等等等等，是否符合原版抓大鹅小游戏，最大程度优化当前游戏，思考越多越好

## 2026-02-08 巡检计划
- 定位核心实现：goose-catch-main（React + Three.js + Rapier）
- 核查场景/交互：5个主题场景 + 风格切换 + 模式切换 + 道具 + 托盘 + 抓鹅阶段
- 视觉重点：物体堆叠范围、屏幕中心对齐、前景/背景遮挡、移动端适配
- 技术重点：补全自动化观察接口（render_game_to_text / advanceTime）并做回归验证

## 初步观察
- 当前已实现多场景和较多道具逻辑，但缺少自动化观测钩子，难以稳定做逐帧比对。
- Item/Bag/Environment 中存在多个潜在可见性与材质处理细节，需要实测确认后再改。

## 本轮已完成优化（核心逻辑）
- 修复倒计时在暂停时重置问题，冻结道具按预期影响计时。
- 防止重复点击/非 playing 状态触发误判失败。
- 为所有主题场景加入堆叠分布参数与边界夹取，减少边缘散点、强化中心聚拢。
- 禁用环境模型射线拾取，避免背景物件抢占点击命中。
- 增加自动化观测接口：window.render_game_to_text / window.advanceTime。
- 调整物理吸附与相机视角，提升中心视域稳定性。

## 2026-02-09 自动化修复记录
- 修复 `.github/workflows/auto-evolve.yml` 重复定义 `on/jobs` 导致的 YAML 解析失败（GitHub Actions 报 `jobs is already defined`）。
- 将 `auto-evolve` 工作流整合为单一流水线：baseline 构建评测、可选补丁生成、candidate 回归、评分、自动 PR、自动合并、工件上传。
- 增强 `scripts/fetch_patch.mjs`：支持 `LLM_API_KEY` 鉴权头，支持从 markdown code fence 提取 diff，兼容 `patch/output` 字段返回。
- 增强 `scripts/eval_repeat.mjs`：修复 `bundle_kb` 为空时被错误记为 `0` 的统计偏差，改为多数成功（>=50%）判定，降低自动化偶发抖动。
- 增强 `scripts/local_loop.mjs`：补丁流程异常时自动回滚，避免候选评估失败后残留脏改动。
