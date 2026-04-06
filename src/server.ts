import { SMTPSession } from '@/smtp/session';
import { logger } from '@/utils/logger';
import { env as config } from '@/config/env.config';

/**
 * Initializes the primary SMTP listening service.
 */
export const startServer = () => {
    logger.info(`Starting Bun SMTP Server on port ${config.SMTP_PORT}...`);
    
    return Bun.listen<any>({
        hostname: '0.0.0.0',
        port: config.SMTP_PORT,
        socket: {
            async open(socket) {
                logger.info(`New connection from ${socket.remoteAddress}`);
                
                const session = new SMTPSession(
                    (data, id) => {
                        logger.debug(`[Session ${id}] >> ${data.trim()}`);
                        socket.write(data);
                    },
                    async () => {
                        // Delivery logic is handled via the internal persistent queue
                    }
                );

                socket.data = { session };
            },
            async data(socket, data) {
                const session = (socket.data as any).session as SMTPSession;
                if (session) {
                    await session.handleData(data);
                }
            },
            async close(socket) {
                logger.info(`Connection from ${socket.remoteAddress} closed`);
            },
            async error(socket, error) {
                logger.error(`Socket Error with ${socket.remoteAddress}:`, error);
            }
        }
    });
};
