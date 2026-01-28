import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

function readFileSlice(filePath, maxLen = 8000) {
  if (!fs.existsSync(filePath)) return "";
  const content = fs.readFileSync(filePath, "utf8");
  return content.slice(0, maxLen);
}

function collectContext() {
  const files = [
    "goose-catch-main/src/App.tsx",
    "goose-catch-main/src/Experience.tsx",
    "goose-catch-main/src/main.tsx",
    "goose-catch-main/src/style.css",
    "goose-catch-main/src/stores/useGameStore.ts",
    "goose-catch-main/src/components/Items.tsx",
    "goose-catch-main/src/components/Item.tsx",
    "goose-catch-main/src/components/Container.tsx",
    "goose-catch-main/src/components/Bag.tsx",
    "goose-catch-main/src/components/UI.tsx",
    "goose-catch-main/src/components/CountDown.tsx",
    "goose-catch-main/src/components/Background.tsx",
    "goose-catch-main/src/components/SceneEnvironment.tsx",
  ].filter((f) => fs.existsSync(f));

  const ctx = files
    .map((f) => {
      const content = readFileSlice(f);
      return `FILE: ${f}\n---\n${content}\n---\n`;
    })
    .join("\n");

  return { files, ctx };
}

function extractPatch(rawText) {
  if (!rawText) return "";
  const diffBlock = rawText.match(/```diff\s*([\s\S]*?)```/i);
  if (diffBlock?.[1]) return diffBlock[1].trim() + "\n";
  const anyBlock = rawText.match(/```\s*([\s\S]*?)```/);
  if (anyBlock?.[1]) return anyBlock[1].trim() + "\n";
  return rawText.trim() + "\n";
}

function isUnifiedDiff(patchText) {
  return /diff --git a\//.test(patchText) && /^@@/m.test(patchText);
}

function normalizePatchPaths(patchText) {
  return patchText
    .replace(
      /^diff --git a\/src\/(.+?) b\/src\/(.+)$/gm,
      "diff --git a/goose-catch-main/src/$1 b/goose-catch-main/src/$2"
    )
    .replace(/^--- a\/src\//gm, "--- a/goose-catch-main/src/")
    .replace(/^\+\+\+ b\/src\//gm, "+++ b/goose-catch-main/src/");
}

function assertPatchApplies(patchPath) {
  try {
    execSync(`git apply --check ${patchPath}`, { stdio: "ignore" });
  } catch (err) {
    throw new Error("Patch failed to apply cleanly.");
  }
}

function parseEdits(rawText) {
  const cleaned = extractPatch(rawText).trim();
  const jsonMatch = cleaned.startsWith("{") ? cleaned : cleaned.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (typeof jsonMatch === "string" ? jsonMatch : jsonMatch[0]) : null;
  if (!jsonText) {
    throw new Error("No JSON edits found.");
  }
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data.edits)) {
    throw new Error("JSON edits must include an edits array.");
  }
  return data.edits;
}

function buildPatchFromEdits(edits) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "goose-patch-"));
  const grouped = new Map();
  for (const edit of edits) {
    if (!edit || typeof edit !== "object") {
      throw new Error("Edit entry must be an object.");
    }
    const filePath = edit.path;
    if (typeof filePath !== "string" || !filePath.startsWith("goose-catch-main/src/")) {
      throw new Error(`Invalid edit path: ${filePath}`);
    }
    if (typeof edit.find !== "string" || typeof edit.replace !== "string") {
      throw new Error(`Invalid edit for ${filePath}: find/replace must be strings.`);
    }
    if (!grouped.has(filePath)) {
      grouped.set(filePath, []);
    }
    grouped.get(filePath).push({ find: edit.find, replace: edit.replace });
  }

  const diffs = [];
  try {
    for (const [filePath, fileEdits] of grouped.entries()) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const original = fs.readFileSync(filePath, "utf8");
      let updated = original;
      for (const { find, replace } of fileEdits) {
        const index = updated.indexOf(find);
        if (index === -1) {
          throw new Error(`Find string not found in ${filePath}.`);
        }
        updated = updated.replace(find, replace);
      }
      if (updated === original) {
        continue;
      }

      const originalPath = path.join(tempDir, `${path.basename(filePath)}.orig`);
      const updatedPath = path.join(tempDir, `${path.basename(filePath)}.new`);
      fs.writeFileSync(originalPath, original, "utf8");
      fs.writeFileSync(updatedPath, updated, "utf8");

      const diffCmd = `diff -u -L a/${filePath} -L b/${filePath} "${originalPath}" "${updatedPath}"`;
      let diffText = "";
      try {
        diffText = execSync(diffCmd, { encoding: "utf8" });
      } catch (err) {
        if (err?.status === 1 && err.stdout) {
          diffText = err.stdout.toString();
        } else {
          throw err;
        }
      }

      if (diffText.trim()) {
        diffs.push(`diff --git a/${filePath} b/${filePath}\n${diffText}`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (!diffs.length) {
    throw new Error("No changes generated from edits.");
  }

  return diffs.join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPatch(prompt) {
  const endpoint = process.env.LLM_ENDPOINT;
  if (!endpoint) {
    throw new Error("LLM_ENDPOINT not set.");
  }

  const body = { prompt };
  const headers = { "Content-Type": "application/json" };
  if (process.env.LLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LLM_API_KEY}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.patch || typeof data.patch !== "string") {
    throw new Error("LLM response missing patch.");
  }
  return data.patch;
}

async function fetchPatchWithRetry(prompt, retries = 3) {
  let attempt = 0;
  let lastError;
  while (attempt < retries) {
    try {
      return await fetchPatch(prompt);
    } catch (err) {
      lastError = err;
      const backoff = 1000 * Math.pow(2, attempt);
      await sleep(backoff);
    }
    attempt += 1;
  }
  throw lastError ?? new Error("Failed to fetch patch.");
}

const baselinePath = process.argv[2] || "baseline.json";
if (!fs.existsSync(baselinePath)) {
  console.error(`Baseline file not found: ${baselinePath}`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const { ctx } = collectContext();

const prompt = `
你是一个 Three.js 小游戏工程师。目标：提升性能与稳定性（FPS ↑、load_ms ↓、bundle_kb ↓、console_errors 必须为 0）。
当前 baseline 指标：${JSON.stringify(baseline)}

规则：
- 只允许修改 goose-catch-main/src/ 下的 ts/tsx/js/css 文件
- 不允许修改依赖、配置、工作流
- 输出必须是 *unified diff*（git apply 可直接应用）
- 尽量小改动（<300 行）
- 优先：减少每帧 allocations、避免重复创建对象、优化渲染循环、减少不必要的计算、修复潜在报错
- 不要改动资源/模型/贴图的 import 路径或文件名
- 不要改动状态库或 store 的 import 路径
- 不要删除或注释 useGLTF.preload 相关代码

格式要求（非常重要）：
- 只输出 unified diff，不要包含解释文字或代码块标记
- diff 路径必须以 goose-catch-main/src/ 开头
- hunk 头部的行号与行数必须严格正确，确保可用 git apply 直接应用

项目上下文：
${ctx}

请输出 unified diff。
`.trim();

const jsonPrompt = `
如果你无法稳定输出可应用的 unified diff，请改为输出严格 JSON：
{
  "edits": [
    {
      "path": "goose-catch-main/src/....",
      "find": "精确的原始文本片段（必须存在）",
      "replace": "替换后的文本"
    }
  ]
}

要求：
- 只允许修改 goose-catch-main/src/ 下的文件
- 每个 edits 的 find 必须是原文件中可唯一定位的片段
- 只输出 JSON，不要任何额外文字或代码块
`.trim();

async function generateValidPatch(basePrompt, attempts = 3) {
  let lastError = "Unknown error";
  for (let i = 0; i < attempts; i += 1) {
    const suffix =
      i === 0
        ? ""
        : `\n\n上一次输出存在问题：${lastError}\n请严格输出可应用的 unified diff。`;
    const rawPatch = await fetchPatchWithRetry(`${basePrompt}${suffix}`, 1);
    const patch = normalizePatchPaths(extractPatch(rawPatch));

    if (!patch.trim()) {
      lastError = "Empty patch from LLM.";
      continue;
    }
    if (!isUnifiedDiff(patch)) {
      lastError = "Patch is not a unified diff.";
      continue;
    }

    const tempPath = "agent.patch";
    fs.writeFileSync(tempPath, patch, "utf8");
    try {
      assertPatchApplies(tempPath);
      return patch;
    } catch (err) {
      lastError = err?.message ?? "Patch failed apply check.";
      fs.unlinkSync(tempPath);
    }
  }
  throw new Error(lastError);
}

try {
  let patch;
  try {
    patch = await generateValidPatch(prompt, 3);
  } catch (err) {
    const rawJson = await fetchPatchWithRetry(`${prompt}\n\n${jsonPrompt}`, 1);
    const edits = parseEdits(rawJson);
    patch = buildPatchFromEdits(edits);
    const tempPath = "agent.patch";
    fs.writeFileSync(tempPath, patch, "utf8");
    assertPatchApplies(tempPath);
  }

  fs.writeFileSync("agent.patch", patch, "utf8");
  console.log("Wrote agent.patch");
} catch (err) {
  console.error(err?.message ?? "Failed to generate valid patch.");
  process.exit(1);
}
