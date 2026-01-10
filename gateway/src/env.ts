import { z } from "zod";

const EnvSchema = z.object({
  GATEWAY_SECRET: z.string().min(1),
  GATEWAY_PORT: z.string().optional(),
  WORKER_ENABLED: z.string().optional(),
  WEB_BASE_URL: z.string().optional(),
});

type GatewayEnv = {
  gatewaySecret: string;
  port: number;
  workerEnabled: boolean;
  version: string;
  webBaseUrl: string;
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

  return {
    gatewaySecret: parsed.data.GATEWAY_SECRET,
    port,
    workerEnabled,
    version: process.env.npm_package_version ?? "0.1.0",
    webBaseUrl: parsed.data.WEB_BASE_URL ?? "http://localhost:3000",
  };
}

export type { GatewayEnv };
export { parseGatewayEnv };
