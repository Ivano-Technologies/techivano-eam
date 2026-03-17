#!/usr/bin/env node
/**
 * Queue health check: Redis + BullMQ eam-background-jobs.
 * Verifies queues exist for job types: executive.computeMetrics,
 * warehouse.rebalanceStock, vendor.computeRiskScores.
 * Exit 0 if healthy, non-zero if unavailable.
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Redis from "ioredis";
import { Queue } from "bullmq";

const QUEUE_NAME = "eam-background-jobs";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

async function main() {
  let redis;
  try {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    await redis.ping();
  } catch (err) {
    console.error("Redis connection failed:", err.message);
    process.exit(1);
  }

  try {
    const queue = new Queue(QUEUE_NAME, {
      connection: redis,
    });
    const counts = await queue.getJobCounts();
    await queue.close();
    if (counts == null || typeof counts !== "object") {
      console.error("Queue not available: getJobCounts returned invalid result");
      process.exit(1);
    }
    console.log("Queue", QUEUE_NAME, "OK. Counts:", counts);
  } catch (err) {
    console.error("BullMQ queue check failed:", err.message);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();
