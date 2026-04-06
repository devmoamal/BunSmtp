/**
 * A professional SMTP Healthcheck script for Bun.
 * Connects to the local SMTP port and verifies the 220 service ready response.
 */
import { SMTPCode } from "@/types/protocol";

const HOST = 'localhost';
const PORT = parseInt(process.env.SMTP_PORT || '587');

async function checkHealth(): Promise<void> {
  const timeout = 5000;
  
  try {
    const socket = await Bun.connect({
      hostname: HOST,
      port: PORT,
      socket: {
        data(s, data) {
          const res = data.toString();
          const code = parseInt(res.substring(0, 3));
          
          if (code === SMTPCode.SERVICE_READY) {
            process.exit(0);
          } else {
            console.error(`Status code mismatch: Expected 220, received ${code}`);
            process.exit(1);
          }
        },
        error() {
          process.exit(1);
        },
        end() {
          process.exit(1);
        }
      }
    });

    // Set an absolute timeout for the healthcheck process
    setTimeout(() => {
        console.error('Healthcheck timed out after 5s.');
        process.exit(1);
    }, timeout);

  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

checkHealth();
