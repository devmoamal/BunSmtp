import { relayMail } from '@/relay';
import { logger } from '@/utils/logger';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tryCatch, tryCatchSync } from '@/lib/tryCatch';
import type { MailData } from '@/types/mail';
import type { QueuedMail } from '@/types/queue';

const QUEUE_FILE = join(process.cwd(), 'data', 'mail_queue.json');

export class MailQueue {
  private queue: QueuedMail[] = [];
  public stats = {
    delivered: 0,
    failed: 0,
    queued: 0,
  };

  constructor() {
    this.load();
    this.process();
    setInterval(() => this.save(), 60000);
  }

  public add(mail: MailData): string {
    const id = Math.random().toString(36).substring(2, 12);
    const item: QueuedMail = {
      id,
      data: mail,
      attempts: 0,
      nextRetry: Date.now(),
      status: 'PENDING',
    };
    
    this.queue.push(item);
    this.stats.queued++;
    this.save();
    
    logger.info(`Mail transaction ${id} accepted into delivery queue.`);
    return id;
  }

  private async process() {
    while (true) {
      const now = Date.now();
      const readyItems = this.queue.filter(m => m.status === 'PENDING' && m.nextRetry <= now);

      for (const item of readyItems) {
        const { error } = await tryCatch(relayMail(item.data));

        if (!error) {
          item.status = 'DELIVERED';
          this.stats.delivered++;
          this.stats.queued--;
          logger.info(`MessageID ${item.id}: Relay transaction completed successfully.`);
        } else {
          item.attempts++;
          item.lastError = error.message;

          if (item.attempts >= 5) {
            item.status = 'FAILED';
            this.stats.failed++;
            this.stats.queued--;
            logger.error(`MessageID ${item.id}: Permanent failure after ${item.attempts} attempts. Last error: ${item.lastError}`);
          } else {
            const delay = Math.pow(2, item.attempts) * 60000;
            item.nextRetry = Date.now() + delay;
            logger.warn(`MessageID ${item.id}: Retrying in ${delay / 60000} minutes. Attempt: ${item.attempts}. Error: ${item.lastError}`);
          }
        }
        this.save();
      }

      await new Promise(r => setTimeout(r, 10000));
    }
  }

  private load() {
    if (existsSync(QUEUE_FILE)) {
      const { data, error } = tryCatchSync(() => JSON.parse(readFileSync(QUEUE_FILE, 'utf-8')));
      if (!error && data) {
        this.queue = data.queue || [];
        this.stats = data.stats || this.stats;
        logger.info(`Persistence layer initialized. Loaded ${this.queue.length} pending items.`);
      } else if (error) {
        logger.error(`Persistence recovery failed for file ${QUEUE_FILE}: ${error.message}`);
      }
    }
  }

  private save() {
    const dirPath = join(process.cwd(), 'data');
    if (!existsSync(dirPath)) {
      tryCatchSync(() => mkdirSync(dirPath, { recursive: true }));
    }
    
    const { error } = tryCatchSync(() => {
      writeFileSync(QUEUE_FILE, JSON.stringify({
        queue: this.queue.filter(m => m.status === 'PENDING'),
        stats: this.stats
      }, null, 2));
    });

    if (error) {
      logger.error(`Persistence commit failed: ${error.message}`);
    }
  }
  
  public getStats() {
    return {
      ...this.stats,
      currentQueue: this.queue.filter(m => m.status === 'PENDING').length
    };
  }
}

export const mailQueue = new MailQueue();
