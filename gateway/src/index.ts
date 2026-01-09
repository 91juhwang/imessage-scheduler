import http from "node:http";

const port = Number(process.env.GATEWAY_PORT ?? 4001);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/health") {
    const body = JSON.stringify({ ok: true, timestamp: new Date().toISOString() });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[gateway] listening on http://localhost:${port}`);
});
