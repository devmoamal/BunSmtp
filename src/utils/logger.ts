import { LogLevel } from "@/types/logger";

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Professional structured logger for MTA operations.
 */
class Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const color = colors[level.toLowerCase() as keyof typeof colors] || colors.reset;
    return `${colors.gray}[${timestamp}]${colors.reset} ${color}[${level}]${colors.reset} ${message}`;
  }

  info(message: string): void {
    console.log(this.formatMessage(LogLevel.INFO, message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage(LogLevel.WARN, message));
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage(LogLevel.ERROR, message), error || '');
  }

  debug(message: string): void {
    if (process.env.DEBUG === 'true') {
      console.log(this.formatMessage(LogLevel.DEBUG, message));
    }
  }

  session(sessionId: string, message: string): void {
    this.info(`${colors.gray}[Session ${sessionId.slice(0, 8)}]${colors.reset} ${message}`);
  }

  relay(host: string, message: string): void {
    this.info(`${colors.gray}[Relay ${host}]${colors.reset} ${message}`);
  }
}

export const logger = new Logger();
