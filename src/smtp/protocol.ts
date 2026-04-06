import { SMTPCode } from "@/types/protocol";

/**
 * Construct a standard SMTP response string.
 */
export function buildResponse(code: SMTPCode, message: string): string {
  return `${code} ${message}\r\n`;
}

/**
 * Construct a multi-line SMTP response string.
 */
export function buildMultiResponse(code: SMTPCode, lines: string[]): string {
  return lines.map((line, i) => `${code}${i === lines.length - 1 ? ' ' : '-'}${line}`).join('\r\n') + '\r\n';
}
