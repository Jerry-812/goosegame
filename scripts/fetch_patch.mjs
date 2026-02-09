import fs from 'node:fs/promises';
import path from 'node:path';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1];
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
};

const isUnifiedDiff = (text) =>
  text.includes('diff --git') && text.includes('+++') && text.includes('---');

const extractPatch = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';
  const diffBlock = rawText.match(/```diff\s*([\s\S]*?)```/i);
  if (diffBlock?.[1]) return `${diffBlock[1].trim()}\n`;
  const anyBlock = rawText.match(/```\s*([\s\S]*?)```/);
  if (anyBlock?.[1]) return `${anyBlock[1].trim()}\n`;
  return `${rawText.trim()}\n`;
};

const fetchPatch = async (endpoint, prompt, apiKey) => {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`LLM endpoint error: ${response.status}`);
  }

  const data = await response.json();
  const rawPatch = data.patch ?? data.output ?? '';
  const patch = extractPatch(rawPatch);

  if (!patch || !isUnifiedDiff(patch)) {
    throw new Error('Invalid patch response from LLM endpoint');
  }

  return patch;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = args.endpoint;
  const promptFile = args['prompt-file'];
  const output = args.output ?? 'artifacts/patch.diff';
  const apiKey = process.env.LLM_API_KEY ?? '';

  if (!endpoint) {
    process.stderr.write('Missing --endpoint\n');
    process.exit(1);
  }

  if (!promptFile) {
    process.stderr.write('Missing --prompt-file\n');
    process.exit(1);
  }

  const prompt = await fs.readFile(promptFile, 'utf8');

  const patch = await fetchPatch(endpoint, prompt, apiKey);

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, patch);

  process.stdout.write(`Patch saved to ${output}\n`);
};

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
