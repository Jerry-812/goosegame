import fs from 'node:fs';

const ALLOWED_PREFIX = 'goose-catch-main/src/';
const MAX_CHANGED_FILES = 8;
const MAX_CHANGED_LINES = 300;

const FORBIDDEN_PATHS = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.github/workflows',
  'vercel.json',
  'vite.config',
  'electron/',
  'dist/',
  'node_modules/',
];

const CRITICAL_PATTERNS = [
  { name: 'CanvasJSX', regex: /<Canvas\b/i },
  { name: 'CreateRoot', regex: /createRoot\(/ },
  { name: 'FiberImport', regex: /@react-three\/fiber/ },
];

export function assertPatchSafe(patchText) {
  if (!patchText.trim()) {
    throw new Error('Patch is empty.');
  }

  if (patchText.includes('GIT binary patch')) {
    throw new Error('Binary patches are not allowed.');
  }

  if (!/diff --git a\//.test(patchText) || !/^@@/m.test(patchText)) {
    throw new Error('Patch is not a unified diff.');
  }

  for (const f of FORBIDDEN_PATHS) {
    if (patchText.includes(`+++ b/${f}`) || patchText.includes(`--- a/${f}`)) {
      throw new Error(`Patch touches forbidden file: ${f}`);
    }
  }

  const changedFiles = new Set();
  const removedPatternHits = new Map();
  const addedPatternHits = new Map();

  for (const pattern of CRITICAL_PATTERNS) {
    removedPatternHits.set(pattern.name, false);
    addedPatternHits.set(pattern.name, false);
  }

  const lines = patchText.split('\n');
  let plus = 0;
  let minus = 0;

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

    if (line.startsWith('+++ ') || line.startsWith('--- ') || line.startsWith('diff --git')) {
      continue;
    }

    if (line.startsWith('+')) {
      plus += 1;
      for (const pattern of CRITICAL_PATTERNS) {
        if (pattern.regex.test(line)) {
          addedPatternHits.set(pattern.name, true);
        }
      }
    }
    if (line.startsWith('-')) {
      minus += 1;
      for (const pattern of CRITICAL_PATTERNS) {
        if (pattern.regex.test(line)) {
          removedPatternHits.set(pattern.name, true);
        }
      }
    }
  }

  for (const file of changedFiles) {
    if (file === '/dev/null') continue;
    if (!file.startsWith(ALLOWED_PREFIX)) {
      throw new Error(`Patch touches non-src file: ${file}`);
    }
  }

  if (changedFiles.size > MAX_CHANGED_FILES) {
    throw new Error(`Patch touches too many files (${changedFiles.size}/${MAX_CHANGED_FILES}).`);
  }

  if (plus + minus > MAX_CHANGED_LINES) {
    throw new Error(`Patch too large (> ${MAX_CHANGED_LINES} lines).`);
  }

  for (const pattern of CRITICAL_PATTERNS) {
    if (removedPatternHits.get(pattern.name) && !addedPatternHits.get(pattern.name)) {
      throw new Error(`Patch removes critical rendering hook: ${pattern.name}`);
    }
  }
}

export function readPatch(patchPath) {
  if (!fs.existsSync(patchPath)) {
    throw new Error('Patch file missing.');
  }
  return fs.readFileSync(patchPath, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const patchPath = process.argv[2];
  const patchText = patchPath
    ? readPatch(patchPath)
    : fs.readFileSync(0, 'utf8');

  try {
    assertPatchSafe(patchText);
    process.stdout.write(JSON.stringify({ ok: true }, null, 2));
  } catch (error) {
    process.stderr.write(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }
}
