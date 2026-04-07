import { buildResponse, buildMultiResponse } from "./protocol";
import { logger } from "@/utils/logger";
import { env as config, getAuthorizedUsers, isTLSEnabled } from "@/config/env.config";
import { mailQueue } from "@/smtp/queue";
import { SMTPCode, SessionState } from "@/types/protocol";
import type { MailData } from "@/types/mail";

/**
 * Manages an individual SMTP session and its associated protocol state.
 */
export class SMTPSession {
  public id: string;
  private state: SessionState = SessionState.CONNECTED;
  private buffer: string = "";
  private mailData: Partial<MailData> = { to: [] };
  private authUser: string | null = null;

  constructor(
    private write: (data: string, id: string) => any,
    private onUpgrade: () => void,
    private onComplete: (data: MailData) => Promise<void>,
  ) {
    this.id = Math.random().toString(36).substring(2, 10);
    this.send(
      SMTPCode.SERVICE_READY,
      `2.0.0 ${config.SMTP_DOMAIN} Bun SMTP Relay Service Ready`,
    );
  }

  public async handleData(data: Buffer | string) {
    this.buffer += data.toString();

    while (this.buffer.includes("\r\n")) {
      const index = this.buffer.indexOf("\r\n");
      const line = this.buffer.substring(0, index).trim();
      this.buffer = this.buffer.substring(index + 2);

      if (this.state === SessionState.DATA_WRITING) {
        await this.handleDataLine(line);
      } else {
        await this.handleCommandLine(line);
      }
    }
  }

  private async handleCommandLine(line: string) {
    const [command, ...args] = line.split(" ");
    if (!command) return;
    const cmd = command.toUpperCase();
    const argStr = args.join(" ");

    logger.session(
      this.id,
      `Command: ${cmd} ${this.state === SessionState.AUTHENTICATING ? "****" : argStr}`,
    );

    switch (cmd) {
      case "EHLO":
      case "HELO":
        this.state = SessionState.CONNECTED;
        const capabilities = [
          config.SMTP_DOMAIN,
          "PIPELINING",
          "SIZE 10485760",
          "AUTH LOGIN PLAIN",
          "ENHANCEDSTATUSCODES",
          "8BITMIME",
          "CHUNKING",
        ];
        if (isTLSEnabled) {
          capabilities.push("STARTTLS");
        }
        this.sendMulti(SMTPCode.ACTION_COMPLETED, capabilities);
        break;

      case "STARTTLS":
        if (isTLSEnabled) {
          this.send(SMTPCode.SERVICE_READY, "2.0.0 Ready to start TLS");
          this.onUpgrade();
        } else {
          this.send(SMTPCode.UNRECOGNIZED_COMMAND, "Command not recognized");
        }
        break;

      case "AUTH":
        await this.handleAuth(argStr);
        break;

      case "MAIL":
        if (this.state !== SessionState.AUTHENTICATED) {
          this.send(
            SMTPCode.AUTHENTICATION_REQUIRED,
            "Authentication required",
          );
          return;
        }
        const fromMatch = argStr.match(/FROM:<(.*)>/i);
        if (fromMatch && fromMatch[1]) {
          this.mailData.from = fromMatch[1];
          this.state = SessionState.MAIL_FROM;
          this.send(SMTPCode.ACTION_COMPLETED, "2.1.0 OK");
        } else {
          this.send(SMTPCode.SYNTAX_ERROR_PARAMETERS, "5.1.7 Invalid sender");
        }
        break;

      case "RCPT":
        if (
          this.state !== SessionState.MAIL_FROM &&
          this.state !== SessionState.RCPT_TO
        ) {
          this.send(SMTPCode.BAD_SEQUENCE, "5.5.1 Bad sequence of commands");
          return;
        }
        const toMatch = argStr.match(/TO:<(.*)>/i);
        if (toMatch && toMatch[1]) {
          this.mailData.to?.push(toMatch[1]);
          this.state = SessionState.RCPT_TO;
          this.send(SMTPCode.ACTION_COMPLETED, "2.1.5 OK");
        } else {
          this.send(
            SMTPCode.SYNTAX_ERROR_PARAMETERS,
            "5.1.1 Invalid recipient",
          );
        }
        break;

      case "DATA":
        if (this.state !== SessionState.RCPT_TO) {
          this.send(SMTPCode.BAD_SEQUENCE, "Bad sequence of commands");
          return;
        }
        this.state = SessionState.DATA_WRITING;
        this.mailData.content = "";
        this.send(SMTPCode.START_INPUT, "End data with <CR><LF>.<CR><LF>");
        break;

      case "QUIT":
        this.send(SMTPCode.SERVICE_CLOSING, "Bye");
        this.state = SessionState.QUIT;
        break;

      case "RSET":
        this.mailData = { to: [] };
        this.state = SessionState.AUTHENTICATED;
        this.send(SMTPCode.ACTION_COMPLETED, "OK");
        break;

      default:
        this.send(SMTPCode.UNRECOGNIZED_COMMAND, "Command not recognized");
    }
  }

  private async handleAuth(argStr: string) {
    const [mechanism, initialResponse] = argStr.split(" ");

    if (mechanism && mechanism.toUpperCase() === "PLAIN") {
      if (!initialResponse) {
        this.send(
          SMTPCode.PARAMETER_NOT_IMPLEMENTED,
          "Initial response required for PLAIN",
        );
        return;
      }
      const decoded = Buffer.from(initialResponse, "base64").toString();
      const parts = decoded.split("\0");
      const user = parts[1] || parts[0];
      const pass = parts[2];

      const authorizedUsers = getAuthorizedUsers();
      const matchedUser = authorizedUsers.find(
        (u) => u.user === user && u.pass === pass,
      );

      if (matchedUser) {
        this.authUser = user || "";
        this.state = SessionState.AUTHENTICATED;
        this.send(SMTPCode.AUTH_SUCCESS, "2.7.0 Authentication successful");
      } else {
        this.send(
          SMTPCode.AUTH_CREDENTIALS_INVALID,
          "5.7.8 Invalid credentials",
        );
      }
    } else if (mechanism && mechanism.toUpperCase() === "LOGIN") {
      this.send(
        SMTPCode.COMMAND_NOT_IMPLEMENTED,
        "LOGIN not fully implemented, use PLAIN",
      );
    } else {
      this.send(
        SMTPCode.PARAMETER_NOT_IMPLEMENTED,
        "Auth mechanism not supported",
      );
    }
  }

  private async handleDataLine(line: string) {
    if (line === ".") {
      this.state = SessionState.AUTHENTICATED;
      logger.session(this.id, "Mail data received completely");

      if (
        this.mailData.from &&
        this.mailData.to?.length &&
        this.mailData.content !== undefined
      ) {
        const queueId = mailQueue.add(this.mailData as MailData);
        this.send(SMTPCode.ACTION_COMPLETED, `2.6.0 Queued as ${queueId}`);
      } else {
        this.send(SMTPCode.TRANSACTION_FAILED, "5.1.0 Incomplete mail data");
      }
      this.mailData = { to: [] };
    } else {
      const contentLine = line.startsWith("..") ? line.substring(1) : line;
      this.mailData.content += contentLine + "\r\n";
    }
  }

  private send(code: SMTPCode, message: string) {
    this.write(buildResponse(code, message), this.id);
  }

  private sendMulti(code: SMTPCode, lines: string[]) {
    this.write(buildMultiResponse(code, lines), this.id);
  }
}
