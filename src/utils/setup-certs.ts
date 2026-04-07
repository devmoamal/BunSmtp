import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { env as config } from "@/config/env.config";
import { logger } from "@/utils/logger";

/**
 * Ensures that TLS certificates exist. If missing, generates self-signed certificates.
 */
export const ensureCerts = () => {
  const certPath = config.TLS_CERT;
  const keyPath = config.TLS_KEY;

  if (!certPath || !keyPath) {
    logger.warn("TLS_CERT or TLS_KEY not configured. STARTTLS will be disabled.");
    return;
  }

  if (existsSync(certPath) && existsSync(keyPath)) {
    logger.info("Found existing TLS certificates. Using configured paths.");
    return;
  }

  logger.info("Generating self-signed SSL certificates for STARTTLS...");

  // Ensure directory exists
  const certDir = dirname(certPath);
  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }

  // Generate self-signed certs using openssl
  const result = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:4096",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "365",
    "-nodes",
    "-subj",
    `/CN=${config.SMTP_DOMAIN}`,
  ]);

  if (result.success) {
    logger.info(`Successfully generated self-signed certificates at ${certDir}`);
  } else {
    logger.error("Failed to generate self-signed certificates via openssl:");
    logger.error(result.stderr.toString());
  }
};
