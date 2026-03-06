import pino from "pino";

type LogMeta = Record<string, unknown>;

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const logger = {
  info(message: string, meta?: LogMeta) {
    if (meta) {
      pinoLogger.info(meta, message);
      return;
    }
    pinoLogger.info(message);
  },
  warn(message: string, meta?: LogMeta) {
    if (meta) {
      pinoLogger.warn(meta, message);
      return;
    }
    pinoLogger.warn(message);
  },
  error(message: string, meta?: LogMeta) {
    if (meta) {
      pinoLogger.error(meta, message);
      return;
    }
    pinoLogger.error(message);
  },
};
