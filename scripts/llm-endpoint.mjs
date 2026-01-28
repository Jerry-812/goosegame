import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isUnifiedDiff = (text) =>
  text.includes('diff --git') && text.includes('+++') && text.includes('---');

const callModel = async (prompt) => {
  // TODO: Replace this placeholder with a real model call.
  // Optionally provide MOCK_PATCH for testing.
  if (process.env.MOCK_PATCH) {
    return process.env.MOCK_PATCH;
  }
  throw new Error('Model integration not configured');
};

const generatePatchWithRetry = async (prompt) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const patch = await callModel(prompt);
      if (!isUnifiedDiff(patch)) {
        throw new Error('Model output is not a unified diff');
      }
      return patch;
    } catch (error) {
      lastError = error;
      const backoffMs = 500 * 2 ** (attempt - 1);
      await sleep(backoffMs);
    }
  }
  throw lastError ?? new Error('Failed to generate patch');
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
  });

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/patch') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }

  try {
    const body = await parseBody(req);
    if (!body.prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing prompt' }));
      return;
    }

    const patch = await generatePatchWithRetry(body.prompt);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ patch }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(PORT, () => {
  process.stdout.write(`LLM endpoint listening on :${PORT}\n`);
});
