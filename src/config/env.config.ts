import { z } from "zod";
import { tryCatchSync } from "@/lib/tryCatch";
import type { UserCreds } from "@/types/auth";

const envSchema = z.object({
  // Environment specification
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Inbound SMTP service configuration
  SMTP_PORT: z.string().default("25").transform(Number),
  SMTP_RELAY_PORT: z.string().default("25").transform(Number),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),

  // Extended authentication registry (JSON serialization)
  SMTP_USERS_JSON: z.string().optional(),

  // Egress identity (HELO/EHLO)
  SMTP_DOMAIN: z.string().default("localhost"),

  // Debug mode for tactical diagnostics
  DEBUG: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Infrastructure configuration failure:", result.error.format());
  process.exit(1);
}

export const env = result.data;
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Retrieves the compiled list of authorized secondary users.
 */
export const getAuthorizedUsers = (): UserCreds[] => {
  const users: UserCreds[] = [{ user: env.SMTP_USER, pass: env.SMTP_PASS }];

  if (env.SMTP_USERS_JSON) {
    const { data, error } = tryCatchSync(() =>
      JSON.parse(env.SMTP_USERS_JSON!),
    );

    if (!error && Array.isArray(data)) {
      users.push(...data);
    } else if (error) {
      console.error(
        `Registry synchronization failure (SMTP_USERS_JSON): ${error.message}`,
      );
    }
  }

  return users;
};
