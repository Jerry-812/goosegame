import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
};

const run = (command, env = {}) => {
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
};

const startPreview = (port) => {
  const proc = spawn(
    'npm',
    ['--prefix', 'goose-catch-main', 'run', 'preview', '--', '--host', '0.0.0.0', '--port', String(port)],
    { stdio: 'inherit', env: process.env }
  );
  return proc;
};

const stopPreview = async (proc) => {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (!proc.killed) {
    proc.kill('SIGKILL');
  }
};

const args = parseArgs(process.argv.slice(2));
const iterations = Number(args.iters ?? args.iterations ?? 1);
const screenshotEvery = Number(args['screenshot-every'] ?? 5);
const port = Number(args.port ?? 4173);
const url = args.url ?? `http://127.0.0.1:${port}`;
const distDir = args['dist-dir'] ?? 'goose-catch-main/dist';
const screenshotDir = args['screenshot-dir'] ?? 'debug-screenshots';

if (!process.env.LLM_ENDPOINT) {
  process.stderr.write('LLM_ENDPOINT is not set. Example: LLM_ENDPOINT=http://127.0.0.1:8787/patch\n');
  process.exit(1);
}

for (let i = 1; i <= iterations; i += 1) {
  console.log(`\n=== Iteration ${i}/${iterations} ===`);

  // Baseline
  run('npm run build');

  let preview = startPreview(port);
  try {
    run(`node scripts/wait-for-ready.mjs --url ${url}`);
    run(`node scripts/eval_repeat.mjs --url ${url} --runs 3 --dist-dir ${distDir} --screenshot-dir ${screenshotDir} --output baseline.json`);
  } finally {
    await stopPreview(preview);
  }

  let patchApplied = false;
  let improved = false;

  try {
    run('node scripts/agent_generate_patch.mjs baseline.json');
    run("node --input-type=module -e \"import {assertPatchSafe,readPatch} from './scripts/guardrails.mjs'; const p=readPatch('agent.patch'); assertPatchSafe(p);\"");
    run('git apply agent.patch');
    patchApplied = true;

    run('npm run build');

    preview = startPreview(port);
    try {
      run(`node scripts/wait-for-ready.mjs --url ${url}`);
      run(`node scripts/eval_repeat.mjs --url ${url} --runs 3 --dist-dir ${distDir} --screenshot-dir ${screenshotDir} --output candidate.json`);
      if (screenshotEvery > 0 && i % screenshotEvery === 0) {
        const outputPath = `${screenshotDir}/loop-iter-${String(i).padStart(3, '0')}.png`;
        try {
          run(`node scripts/capture_screenshot.mjs --url ${url} --output ${outputPath}`);
        } catch (err) {
          console.warn(`Failed to capture screenshot for iteration ${i}.`);
        }
      }
    } finally {
      await stopPreview(preview);
    }

    run('node scripts/score.mjs baseline.json candidate.json --output decision.json || true');
    if (fs.existsSync('decision.json')) {
      const decision = JSON.parse(fs.readFileSync('decision.json', 'utf8'));
      improved = Boolean(decision.improved);
      console.log('Decision:', decision);
    }
  } catch (err) {
    console.error('Patch iteration failed, reverting this patch.', err?.message ?? err);
    improved = false;
  } finally {
    if (patchApplied && !improved) {
      console.log('Reverting patch (not improved).');
      try {
        run('git apply -R agent.patch');
      } catch (err) {
        console.error('Failed to revert patch automatically. Please inspect working tree.');
      }
    } else if (patchApplied && improved) {
      console.log('Patch improved metrics. Keeping changes.');
    }

    if (!patchApplied && fs.existsSync('agent.patch')) {
      fs.unlinkSync('agent.patch');
    }
  }
}
