import http from "node:http";

import { parseGatewayEnv } from "./env";
import { handleHealth, handleSend } from "./handlers";
import { startWorker } from "./worker";

const env = parseGatewayEnv();

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function respond(res: http.ServerResponse, status: number, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (!req.url || req.method !== "POST") {
    respond(res, 404, { error: "not_found" });
    return;
  }

  if (req.url === "/health") {
    const result = handleHealth(req.headers, env);
    respond(res, result.status, result.json);
    return;
  }

  if (req.url === "/send") {
    try {
      const body = await readJsonBody(req);
      const result = await handleSend(req.headers, body, env);
      respond(res, result.status, result.json);
    } catch (error) {
      respond(res, 400, { error: "invalid_json" });
    }
    return;
  }

  respond(res, 404, { error: "not_found" });
});

server.listen(env.port, () => {
  console.log(`[gateway] listening on http://localhost:${env.port}`);
});

startWorker(env);
