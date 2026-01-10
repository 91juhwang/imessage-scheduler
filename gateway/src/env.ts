import { z } from "zod";

const EnvSchema = z.object({
  GATEWAY_SECRET: z.string().min(1),
  GATEWAY_PORT: z.string().optional(),
  WORKER_ENABLED: z.string().optional(),
  WEB_BASE_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: z.string().optional(),
  MAX_ATTEMPTS: z.string().optional(),
  BASE_BACKOFF_SECONDS: z.string().optional(),
  MAX_BACKOFF_SECONDS: z.string().optional(),
});

type GatewayEnv = {
  gatewaySecret: string;
  port: number;
  workerEnabled: boolean;
  version: string;
  webBaseUrl: string;
  databaseUrl?: string;
  workerPollIntervalMs: number;
  maxAttempts: number;
  baseBackoffSeconds: number;
  maxBackoffSeconds: number;
};

function parseGatewayEnv(): GatewayEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Missing gateway env vars.");
  }

  const port = Number(parsed.data.GATEWAY_PORT ?? 4001);
  if (Number.isNaN(port)) {
    throw new Error("GATEWAY_PORT must be a number.");
  }

  const workerEnabled = parsed.data.WORKER_ENABLED
    ? parsed.data.WORKER_ENABLED === "true"
    : true;

  const workerPollIntervalMs = Number(parsed.data.WORKER_POLL_INTERVAL_MS ?? 2000);
  const maxAttempts = Number(parsed.data.MAX_ATTEMPTS ?? 5);
  const baseBackoffSeconds = Number(parsed.data.BASE_BACKOFF_SECONDS ?? 30);
  const maxBackoffSeconds = Number(parsed.data.MAX_BACKOFF_SECONDS ?? 1800);

  if (Number.isNaN(workerPollIntervalMs)) {
    throw new Error("WORKER_POLL_INTERVAL_MS must be a number.");
  }
  if (Number.isNaN(maxAttempts)) {
    throw new Error("MAX_ATTEMPTS must be a number.");
  }
  if (Number.isNaN(baseBackoffSeconds)) {
    throw new Error("BASE_BACKOFF_SECONDS must be a number.");
  }
  if (Number.isNaN(maxBackoffSeconds)) {
    throw new Error("MAX_BACKOFF_SECONDS must be a number.");
  }

  return {
    gatewaySecret: parsed.data.GATEWAY_SECRET,
    port,
    workerEnabled,
    version: process.env.npm_package_version ?? "0.1.0",
    webBaseUrl: parsed.data.WEB_BASE_URL ?? "http://localhost:3000",
    databaseUrl: parsed.data.DATABASE_URL,
    workerPollIntervalMs,
    maxAttempts,
    baseBackoffSeconds,
    maxBackoffSeconds,
  };
}

export type { GatewayEnv };
export { parseGatewayEnv };
