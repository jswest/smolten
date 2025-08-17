import { join } from "path";
import pino from "pino";
import { PATHS, DEFAULTS } from "./constants.js";
import { ensureDirectory } from "./utils.js";

// Ensure logs directory exists
ensureDirectory(PATHS.LOGS_DIR);

class Logger {
  constructor() {
    this.pino = pino({
      level: process.env.LOG_LEVEL || DEFAULTS.LOG_LEVEL,
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
              destination: join(PATHS.LOGS_DIR, "smolten.log"),
              mkdir: true,
            },
          },
        ],
      },
    });
  }

  get level() {
    return this.pino.level;
  }

  set level(level) {
    this.pino.level = level;
  }

  debug(message, data = {}) {
    this.pino.debug(data, message);
  }

  info(message, data = {}) {
    this.pino.info(data, message);
  }

  warn(message, data = {}) {
    this.pino.warn(data, message);
  }

  error(message, data = {}) {
    this.pino.error(data, message);
  }
}

const logger = new Logger();

export default logger;
export { Logger };
