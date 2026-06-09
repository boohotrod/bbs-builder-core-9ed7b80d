import { z } from "zod";

// Server env validation. Used inside handlers — never at module scope on Workers.
// Preview never sets these; production cPanel does.
const Schema = z.object({
  STORE_MODE: z.enum(["mock", "real"]).default("mock"),
  DATABASE_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  INVITE_SIGNING_KEY: z.string().min(32).optional(),
  AUDIT_CHAIN_SECRET: z.string().min(32).optional(),
  FEDERATION_SIGNING_KEY: z.string().min(32).optional(),
  AI_GATEWAY_KEY: z.string().min(8).optional(),
});

export type ServerEnv = z.infer<typeof Schema>;

export function getServerEnv(): ServerEnv {
  return Schema.parse({
    STORE_MODE: process.env.STORE_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    INVITE_SIGNING_KEY: process.env.INVITE_SIGNING_KEY,
    AUDIT_CHAIN_SECRET: process.env.AUDIT_CHAIN_SECRET,
    FEDERATION_SIGNING_KEY: process.env.FEDERATION_SIGNING_KEY,
    AI_GATEWAY_KEY: process.env.AI_GATEWAY_KEY,
  });
}
