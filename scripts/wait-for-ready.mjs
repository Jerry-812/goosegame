const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INTERVAL_MS = 500;

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

const waitForReady = async (url, timeoutMs, intervalMs) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return true;
    } catch (error) {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? 'http://127.0.0.1:4173';
const timeoutMs = Number(args['timeout-ms'] ?? DEFAULT_TIMEOUT_MS);
const intervalMs = Number(args['interval-ms'] ?? DEFAULT_INTERVAL_MS);

const ready = await waitForReady(url, timeoutMs, intervalMs);
if (!ready) {
  process.stderr.write(`Timed out waiting for ${url}\n`);
  process.exit(1);
}

process.stdout.write(`Ready: ${url}\n`);
