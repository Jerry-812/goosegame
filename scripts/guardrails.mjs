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
