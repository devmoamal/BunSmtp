import { startServer } from '@/server';
import { logger } from '@/utils/logger';
import { env as config } from '@/config/env.config';
import { tryCatchSync } from '@/lib/tryCatch';

/**
 * Service initialization logic.
 */
const { data: smtpServer, error: initError } = tryCatchSync(() => startServer());

if (initError || !smtpServer) {
  logger.error(`Service initialization failed: ${initError?.message || 'Unknown protocol error'}`);
  process.exit(1);
}

logger.info(`SMTP Service active on ${smtpServer.hostname}:${smtpServer.port}`);
logger.info(`Relay Identity: ${config.SMTP_DOMAIN}`);

/**
 * Handle termination signals gracefully.
 */
process.on('SIGTERM', () => {
  logger.info('Termination signal received. Closing active listeners.');
  smtpServer.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Interrupt signal received. Closing active listeners.');
  smtpServer.stop();
  process.exit(0);
});
