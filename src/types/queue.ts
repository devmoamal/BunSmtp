import type { MailData } from './mail';

/**
 * Metadata for items in the persistent mail queue
 */
export interface QueuedMail {
  id: string;
  data: MailData;
  attempts: number;
  nextRetry: number;
  status: 'PENDING' | 'FAILED' | 'DELIVERED';
  lastError?: string;
}
