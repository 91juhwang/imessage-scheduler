import http from "node:http";
import https from "node:https";

import type { GatewayStatusCallback } from "@imessage-scheduler/shared";

import type { GatewayEnv } from "./env";

type Requester = (input: {
  url: URL;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ status: number }>;

function defaultRequester({ url, headers, body }: Parameters<Requester>[0]) {
  return new Promise<{ status: number }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (response) => {
        response.on("data", () => undefined);
        response.on("end", () => resolve({ status: response.statusCode ?? 500 }));
      },
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function postGatewayStatus(
  payload: GatewayStatusCallback,
  env: GatewayEnv,
  requester: Requester = defaultRequester,
) {
  const url = new URL("/api/gateway/status", env.webBaseUrl);
  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body).toString(),
    "X-Gateway-Secret": env.gatewaySecret,
  };

  const result = await requester({ url, headers, body });
  return result.status >= 200 && result.status < 300;
}

export type { Requester };
export { postGatewayStatus };
