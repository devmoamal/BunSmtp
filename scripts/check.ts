/**
 * Minimalist SMTP Service Check
 */
import { SMTPCode } from "@/types/protocol";

const PORT = parseInt(process.env.SMTP_PORT || "587");
const HOST = "[IP_ADDRESS]";
try {
  await Bun.connect({
    hostname: HOST,
    port: PORT,
    socket: {
      data(s, data) {
        const code = parseInt(data.toString().substring(0, 3));
        if (code === SMTPCode.SERVICE_READY) {
          console.log("SMTP SERVICE: OPERATIONAL (220)");
          process.exit(0);
        }
        process.exit(1);
      },
      error: () => process.exit(1),
      end: () => process.exit(1),
    },
  });

  // Timeout guard
  setTimeout(() => process.exit(1), 3000);
} catch {
  process.exit(1);
}
