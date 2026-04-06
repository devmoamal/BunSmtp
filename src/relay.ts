import { resolveMx } from "dns/promises";
import { logger } from "@/utils/logger";
import { env as config } from "@/config/env.config";
import { tryCatch } from "@/lib/tryCatch";
import type { MailData } from "@/types/mail";

/**
 * Resolves MX records and relays mail to the appropriate target SMTP server.
 */
export async function relayMail(mail: MailData): Promise<void> {
  const domains = new Set<string>();
  for (const to of mail.to) {
    const domain = to.split("@")[1];
    if (domain) domains.add(domain);
  }

  for (const domain of domains) {
    logger.info(`Starting MX resolution for domain: ${domain}`);

    const { data: mxRecords, error: mxError } = await tryCatch(
      resolveMx(domain),
    );

    if (mxError || !mxRecords || mxRecords.length === 0) {
      logger.error(
        `MX resolution failed for domain: ${domain}. Reason: ${mxError?.message || "No MX records found"}`,
      );
      throw new Error(`Domain resolution failure: ${domain}`);
    }

    const bestMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
    if (!bestMx) {
      logger.error(
        `Priority sorting failed for MX records of domain: ${domain}`,
      );
      throw new Error(`Priority resolution failure: ${domain}`);
    }

    const host = bestMx.exchange;
    const port = 25;

    logger.relay(host, `Initiating relay handshake for domain: ${domain}`);

    const { error: relayError } = await tryCatch(
      performManualRelay(host, port, mail, domain),
    );

    if (relayError) {
      logger.error(
        `Protocol synchronization failed during relay to ${host}. Internal error: ${relayError.message}`,
      );
      throw relayError;
    }

    logger.info(
      `Relay transaction successfully committed for domain: ${domain} via ${host}`,
    );
  }
}

/**
 * Manages the manual SMTP handshake over a raw socket.
 */
async function performManualRelay(
  host: string,
  port: number,
  mail: MailData,
  domain: string,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let currentStep = "CONNECT";
    const recipients = mail.to.filter((t) => t.endsWith(`@${domain}`));
    let rcptIndex = 0;

    const timeout = setTimeout(() => {
      reject(new Error(`Operation timed out while at step: ${currentStep}`));
    }, 30000);

    try {
      await Bun.connect({
        hostname: host,
        port: port,
        tls: {},
        socket: {
          data(s, data) {
            const res = data.toString();
            const code = parseInt(res.substring(0, 3));

            logger.debug(`[Protocol Handshake] << ${res.trim()}`);

            const hasStartTLS = res.includes("STARTTLS");

            if (code >= 400 && currentStep !== "QUIT") {
              clearTimeout(timeout);
              s.end();
              reject(
                new Error(
                  `SMTP protocol rejection at step ${currentStep} (Status: ${code}): ${res.trim()}`,
                ),
              );
              return;
            }

            switch (currentStep) {
              case "CONNECT":
                if (code === 220) {
                  s.write(`EHLO ${config.SMTP_DOMAIN}\r\n`);
                  currentStep = "EHLO";
                }
                break;

              case "EHLO":
                if (code === 250) {
                  if (hasStartTLS) {
                    logger.debug(
                      "Encryption requested: Initiating STARTTLS negotiation.",
                    );
                    s.write("STARTTLS\r\n");
                    currentStep = "STARTTLS";
                  } else {
                    s.write(`MAIL FROM:<${mail.from}>\r\n`);
                    currentStep = "MAIL";
                  }
                }
                break;

              case "STARTTLS":
                if (code === 220) {
                  try {
                    const socket = s as any;
                    if (typeof socket.startTLS === "function") {
                      socket.startTLS();
                      logger.debug(
                        "Encryption active: Socket upgraded to TLS.",
                      );
                      s.write(`EHLO ${config.SMTP_DOMAIN}\r\n`);
                      currentStep = "EHLO_POST_TLS";
                    } else {
                      throw new Error(
                        "Socket does not support startTLS() in this environment.",
                      );
                    }
                  } catch (e) {
                    logger.error("TLS negotiation failure:", e);
                    reject(new Error("TLS upgrade failed during relay"));
                  }
                }
                break;

              case "EHLO_POST_TLS":
                if (code === 250) {
                  s.write(`MAIL FROM:<${mail.from}>\r\n`);
                  currentStep = "MAIL";
                }
                break;

              case "MAIL":
                if (code === 250) {
                  s.write(`RCPT TO:<${recipients[rcptIndex]}>\r\n`);
                  currentStep = "RCPT";
                }
                break;

              case "RCPT":
                if (code === 250) {
                  rcptIndex++;
                  if (rcptIndex < recipients.length) {
                    s.write(`RCPT TO:<${recipients[rcptIndex]}>\r\n`);
                  } else {
                    s.write("DATA\r\n");
                    currentStep = "DATA";
                  }
                }
                break;

              case "DATA":
                if (code === 354) {
                  const body = mail.content.endsWith("\r\n")
                    ? mail.content
                    : mail.content + "\r\n";
                  s.write(body + ".\r\n");
                  currentStep = "COMMIT";
                }
                break;

              case "COMMIT":
                if (code === 250) {
                  s.write("QUIT\r\n");
                  currentStep = "QUIT";
                }
                break;

              case "QUIT":
                clearTimeout(timeout);
                s.end();
                resolve();
                break;
            }
          },
          error(s, err) {
            clearTimeout(timeout);
            reject(err);
          },
          end(s) {
            clearTimeout(timeout);
            if (currentStep !== "QUIT" && currentStep !== "COMMIT") {
              reject(
                new Error(
                  `TCP connection terminated prematurely at step: ${currentStep}`,
                ),
              );
            }
          },
        },
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}
