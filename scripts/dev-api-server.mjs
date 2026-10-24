/**
 * Local stand-in for the Vercel/Netlify pedagogy routes.
 * Eleventy does not execute /api during `npm start`, so the browser
 * falls back to http://127.0.0.1:8788 when the same-origin call misses.
 */
import http from "node:http";
import { GET as getQuestions, OPTIONS as optionsQuestions } from "../api/pedagogy/questions.js";
import { POST as postScore, OPTIONS as optionsScore } from "../api/pedagogy/score.js";

const port = Number(process.env.PEDAGOGY_API_PORT || 8788);

const routes = new Map([
  ["GET /api/pedagogy/questions", getQuestions],
  ["POST /api/pedagogy/score", postScore],
  ["POST /api/pedagogy/analyze", postScore],
  ["OPTIONS /api/pedagogy/questions", optionsQuestions],
  ["OPTIONS /api/pedagogy/score", optionsScore],
  ["OPTIONS /api/pedagogy/analyze", optionsScore],
]);

function toHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const method = (req.method || "GET").toUpperCase();
    const request = new Request(url, {
      method,
      headers: toHeaders(req.headers),
      body: method === "GET" || method === "HEAD" ? undefined : body,
    });
    const handler = routes.get(`${method} ${url.pathname}`);
    const response = handler
      ? await handler(request)
      : new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Pedagogy API failed" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`pedagogy API http://127.0.0.1:${port}`);
});
