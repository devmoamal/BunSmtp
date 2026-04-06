/**
 * Standard SMTP Mail Transmission Data
 */
export interface MailData {
  from: string;
  to: string[];
  content: string;
}
