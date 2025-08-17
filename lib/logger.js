import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import pino from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logsDir = join(__dirname, "..", "logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const logger = pino({
  level: process.env.LOG_LEVEL || "error",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        options: {
          destination: join(logsDir, "smolten.log"),
          mkdir: true,
        },
      },
    ],
  },
});

export default logger;
