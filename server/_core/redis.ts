/**
 * Shared Redis client for request-scoped caches (e.g. user identity cache).
 * Jobs use BullMQ's own connection; this client is for app-level caching.
 */
import Redis from "ioredis";
import { ENV } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  if (!ENV.redisUrl) return null;
  try {
    redis = new Redis(ENV.redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });
    redis.on("error", (err) => logger.warn("Redis client error", { message: err.message }));
    return redis;
  } catch (err) {
    logger.warn("Redis client init failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
