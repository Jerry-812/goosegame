import http from "node:http";

const HOST = process.env.PATCH_SERVER_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.PATCH_SERVER_PORT || "8787", 10);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const TEMPERATURE = Number.parseFloat(process.env.OLLAMA_TEMPERATURE || "0.2");

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

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(body || "{}");
}

async function callOllama(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: TEMPERATURE },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }
  const data = await res.json();
  return data.response ?? "";
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/patch") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const payload = await readJson(req);
    const prompt = payload?.prompt;
    if (!prompt || typeof prompt !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing prompt" }));
      return;
    }

    const raw = await callOllama(prompt);
    const patch = extractPatch(raw);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ patch, is_diff: isUnifiedDiff(patch) }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err?.message ?? "Server error" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Patch server listening at http://${HOST}:${PORT}`);
  console.log(`Using Ollama at ${OLLAMA_URL} (model: ${MODEL})`);
});
