import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  GATEWAY_SECRET: z.string().min(1),
  WEB_BASE_URL: z.url().optional(),
});

export const env = EnvSchema.parse(process.env);
