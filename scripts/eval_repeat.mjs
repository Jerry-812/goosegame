import fs from 'node:fs/promises';
import path from 'node:path';
import { runEval } from './eval.mjs';

const DEFAULT_RUNS = 3;

const ensureDir = async (dir) => {
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }
  return Number(sorted[mid].toFixed(2));
};

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

const summarizeMedian = (runs) => {
  const successful = runs.filter((run) => run.success);
  if (!successful.length) return null;

  const loadMedian = median(successful.map((run) => run.load_ms));
  const fpsMedian = median(successful.map((run) => run.fps));
  const bundleMedian = median(successful.map((run) => run.bundle_kb ?? 0));
  const consoleCounts = median(
    successful.map((run) => run.console_errors?.count ?? 0),
  );

  return {
    success: true,
    load_ms: loadMedian,
    fps: fpsMedian,
    bundle_kb: bundleMedian,
    console_errors: {
      count: consoleCounts,
      samples: successful[0].console_errors?.samples ?? [],
    },
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? 'http://127.0.0.1:4173';
  const runs = Number(args.runs ?? DEFAULT_RUNS);
  const outputPath = args.output;
  const logPath = args.log;
  const screenshotDir = args['screenshot-dir'];
  const distDir = args['dist-dir'];
  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : undefined;
  const fpsDurationMs = args['fps-duration-ms']
    ? Number(args['fps-duration-ms'])
    : undefined;

  const results = [];
  for (let i = 0; i < runs; i += 1) {
    const result = await runEval({
      url,
      screenshotDir,
      distDir,
      timeoutMs,
      fpsDurationMs,
    });
    results.push(result);
  }

  const medianSummary = summarizeMedian(results);
  const output = {
    url,
    runs: results,
    median: medianSummary,
    success: results.every((run) => run.success),
  };

  if (outputPath) {
    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  }

  if (logPath) {
    await ensureDir(path.dirname(logPath));
    await fs.writeFile(logPath, JSON.stringify(output, null, 2));
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.success) {
    process.exitCode = 1;
  }
}
