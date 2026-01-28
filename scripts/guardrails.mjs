import fs from 'node:fs/promises';

const blockedPaths = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'vercel.json',
];

const blockedPathPrefixes = ['.github/workflows/'];

const blockedRegexes = [/vite\.config\.(js|ts|mjs|cjs)$/i];

const rendererRemovalPatterns = [
  /WebGLRenderer/i,
  /renderer/i,
];

const parsePatch = (text) => {
  const files = [];
  const lines = text.split('\n');
  let currentFile = null;
  let changedLines = 0;
  const removedLines = [];

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' ');
      const filePath = parts[3]?.replace('b/', '');
      if (filePath) {
        currentFile = filePath;
        files.push(filePath);
      }
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('+') || line.startsWith('-')) {
      changedLines += 1;
      if (line.startsWith('-')) {
        removedLines.push({ file: currentFile, line });
      }
    }
  }

  return { files: Array.from(new Set(files)), changedLines, removedLines };
};

const validatePatch = (text) => {
  const errors = [];
  const { files, changedLines, removedLines } = parsePatch(text);

  if (files.length > 5) {
    errors.push(`too many files changed (${files.length}/5)`);
  }

  if (changedLines > 300) {
    errors.push(`too many changed lines (${changedLines}/300)`);
  }

  for (const file of files) {
    if (blockedPaths.includes(file)) {
      errors.push(`blocked file change: ${file}`);
    }
    if (blockedPathPrefixes.some((prefix) => file.startsWith(prefix))) {
      errors.push(`blocked file change: ${file}`);
    }
    if (blockedRegexes.some((regex) => regex.test(file))) {
      errors.push(`blocked file change: ${file}`);
    }
  }

  for (const { file, line } of removedLines) {
    if (
      rendererRemovalPatterns.some((pattern) => pattern.test(line)) &&
      /canvas/i.test(line)
    ) {
      errors.push(`renderer/canvas removal detected in ${file}`);
    }
    if (/WebGLRenderer/i.test(line)) {
      errors.push(`renderer removal detected in ${file}`);
    }
  }

  return { valid: errors.length === 0, errors, files, changedLines };
};

const main = async () => {
  const patchPath = process.argv[2];
  const patchText = patchPath
    ? await fs.readFile(patchPath, 'utf8')
    : await new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
          data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
      });

  const result = validatePatch(patchText);
  if (!result.valid) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

await main();
import fs from "node:fs";

const ALLOWED_PREFIX = "goose-catch-main/src/";
const MAX_CHANGED_FILES = 10;

const CRITICAL_PATTERNS = [
  { name: "CanvasJSX", regex: /<Canvas\b/i },
  { name: "CreateRoot", regex: /createRoot\(/ },
  { name: "FiberImport", regex: /@react-three\/fiber/ },
];

export function assertPatchSafe(patchText) {
  if (!patchText.trim()) {
    throw new Error("Patch is empty.");
  }

  if (patchText.includes("GIT binary patch")) {
    throw new Error("Binary patches are not allowed.");
  }

  if (!/diff --git a\//.test(patchText) || !/^@@/m.test(patchText)) {
    throw new Error("Patch is not a unified diff.");
  }

  const forbidden = [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".github/workflows",
    "vercel.json",
    "vite.config",
    "electron/",
    "dist/",
    "node_modules/",
  ];

  for (const f of forbidden) {
    if (patchText.includes(`+++ b/${f}`) || patchText.includes(`--- a/${f}`)) {
      throw new Error(`Patch touches forbidden file: ${f}`);
    }
  }

  const changedFiles = new Set();
  const lines = patchText.split("\n");
  const removedPatternHits = new Map();
  const addedPatternHits = new Map();

  for (const pattern of CRITICAL_PATTERNS) {
    removedPatternHits.set(pattern.name, false);
    addedPatternHits.set(pattern.name, false);
  }

  for (const line of lines) {
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      changedFiles.add(diffMatch[2]);
      continue;
    }
    const plusMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (plusMatch) {
      changedFiles.add(plusMatch[1]);
    }

    if (line.startsWith("-") && !line.startsWith("--- ")) {
      for (const pattern of CRITICAL_PATTERNS) {
        if (pattern.regex.test(line)) {
          removedPatternHits.set(pattern.name, true);
        }
      }
    }
    if (line.startsWith("+") && !line.startsWith("+++ ")) {
      for (const pattern of CRITICAL_PATTERNS) {
        if (pattern.regex.test(line)) {
          addedPatternHits.set(pattern.name, true);
        }
      }
    }
  }

  for (const file of changedFiles) {
    if (file === "/dev/null") continue;
    if (!file.startsWith(ALLOWED_PREFIX)) {
      throw new Error(`Patch touches non-src file: ${file}`);
    }
  }

  if (changedFiles.size > MAX_CHANGED_FILES) {
    throw new Error(`Patch touches too many files (${changedFiles.size}).`);
  }

  for (const pattern of CRITICAL_PATTERNS) {
    if (removedPatternHits.get(pattern.name) && !addedPatternHits.get(pattern.name)) {
      throw new Error(`Patch removes critical rendering hook: ${pattern.name}`);
    }
  }

  let plus = 0;
  let minus = 0;
  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("diff --git")) {
      continue;
    }
    if (line.startsWith("+")) plus += 1;
    if (line.startsWith("-")) minus += 1;
  }

  if (plus + minus > 300) {
    throw new Error("Patch too large (>300 lines).");
  }
}

export function readPatch(patchPath) {
  if (!fs.existsSync(patchPath)) {
    throw new Error("Patch file missing.");
  }
  return fs.readFileSync(patchPath, "utf8");
}
