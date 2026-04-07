import { SMTPSession } from "@/smtp/session";
import { logger } from "@/utils/logger";
import { env as config, isTLSEnabled } from "@/config/env.config";

/**
 * Common socket handlers to be shared between plain and upgraded (TLS) states.
 */
const handlers = {
  async data(socket: any, data: Buffer) {
    const session = socket.data?.session as SMTPSession;
    if (session) {
      await session.handleData(data);
    }
  },
  async close(socket: any) {
    logger.info(`Connection from ${socket.remoteAddress} closed`);
  },
  async error(socket: any, error: Error) {
    logger.error(`Socket Error with ${socket.remoteAddress}:`, error);
  },
};

/**
 * Initializes the primary SMTP listening service.
 */
export const startServer = () => {
  logger.info(`Starting Bun SMTP Server on port ${config.SMTP_PORT}...`);

  return Bun.listen<any>({
    hostname: "0.0.0.0",
    port: config.SMTP_PORT,
    socket: {
      ...handlers,
      async open(socket) {
        logger.info(`New connection from ${socket.remoteAddress}`);

        const session = new SMTPSession(
          (data, id) => {
            logger.debug(`[Session ${id}] >> ${data.trim()}`);
            socket.write(data);
          },
          async () => {
            // onUpgrade callback for STARTTLS
            if (isTLSEnabled) {
              try {
                socket.upgradeTLS({
                  tls: {
                    cert: Bun.file(config.TLS_CERT!),
                    key: Bun.file(config.TLS_KEY!),
                  },
                  socket: handlers,
                });
                logger.debug(`[Session ${session.id}] TLS upgrade successful`);
              } catch (err) {
                logger.error(
                  `[Session ${session.id}] TLS upgrade failed:`,
                  err,
                );
                socket.end();
              }
            }
          },
          async () => {
            // Delivery logic is handled via the internal persistent queue
          },
        );

        socket.data = { session };
      },
    },
  });
};
