import fs from 'node:fs/promises';
import path from 'node:path';

export const score = (metrics) => {
  const consoleCount = metrics.console_errors?.count ?? 0;
  const loadMs = metrics.load_ms ?? 0;
  const fps = metrics.fps ?? 0;
  const bundleKb = metrics.bundle_kb ?? 0;

  let value = 0;
  if (consoleCount === 0) value += 1;
  if (fps > 0) value += Math.min(fps, 60) / 60;
  if (loadMs > 0) value += 1000 / loadMs;
  if (bundleKb > 0) value += 500 / bundleKb;

  return Number(value.toFixed(4));
};

export const betterThan = (candidate, baseline) => {
  const reasons = [];
  if ((candidate.console_errors?.count ?? 0) !== 0) {
    reasons.push('candidate has console errors');
  }
  if (
    baseline.load_ms != null &&
    candidate.load_ms != null &&
    candidate.load_ms > baseline.load_ms * 1.1
  ) {
    reasons.push('load time regressed > 10%');
  }
  if (
    baseline.bundle_kb != null &&
    candidate.bundle_kb != null &&
    candidate.bundle_kb > baseline.bundle_kb * 1.05
  ) {
    reasons.push('bundle size regressed > 5%');
  }

  const baselineScore = score(baseline);
  const candidateScore = score(candidate);
  if (candidateScore < baselineScore + 1) {
    reasons.push('score improvement < 1.0');
  }

  return {
    improved: reasons.length === 0,
    reasons,
    baselineScore,
    candidateScore,
  };
};

const parseArgs = (argv) => {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      positional.push(key);
    }
  }
  return { args, positional };
};

const loadMetrics = (data) => {
  if (data.median) {
    return data.median;
  }
  return data;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const baselinePath = positional[0];
  const candidatePath = positional[1];

  if (!baselinePath || !candidatePath) {
    process.stderr.write('Usage: node scripts/score.mjs <baseline.json> <candidate.json> [--output <file>]\n');
    process.exit(1);
  }

  const baselineData = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  const candidateData = JSON.parse(await fs.readFile(candidatePath, 'utf8'));

  const baseline = loadMetrics(baselineData);
  const candidate = loadMetrics(candidateData);

  const comparison = betterThan(candidate, baseline);
  const output = {
    ...comparison,
    baseline,
    candidate,
  };

  if (args.output) {
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, JSON.stringify(output, null, 2));
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!comparison.improved) {
    process.exitCode = 1;
  }
export function score(m) {
  return m.fps * 2 - m.load_ms / 200 - m.bundle_kb / 50 - m.console_errors * 1000;
}

export function betterThan(newM, baseM) {
  if (newM.console_errors > 0) return false;
  if (newM.smoke_ok === false) return false;
  if (newM.load_ms > baseM.load_ms * 1.1) return false;
  if (newM.bundle_kb > baseM.bundle_kb * 1.05) return false;
  return score(newM) > score(baseM) + 1.0;
}
