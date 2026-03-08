import { and, desc, eq } from "drizzle-orm";
import { backgroundJobRuns } from "../../drizzle/schema";
import { getDb } from "../db";
import { logger } from "../_core/logger";
import { ENV } from "../_core/env";
import type { BackgroundJobName } from "./types";

type Status = "queued" | "running" | "completed" | "failed" | "dead";

type CreateJobRunInput = {
  tenantId: number;
  jobName: BackgroundJobName;
  requestedBy: number | null;
  payload: unknown;
  maxAttempts?: number;
};

export async function createJobRun(input: CreateJobRunInput): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(backgroundJobRuns).values({
    tenantId: input.tenantId,
    jobName: input.jobName,
    requestedBy: input.requestedBy,
    maxAttempts: input.maxAttempts ?? ENV.queueDefaultAttempts,
    payload: JSON.stringify(input.payload ?? {}),
    status: "queued",
  });

  return Number((result as any)[0]?.insertId || (result as any).insertId || 0) || null;
}

export async function markJobQueued(runId: number, queueJobId: string): Promise<void> {
  await updateJobRun(runId, { queueJobId, status: "queued" });
}

export async function markJobRunning(runId: number, attempts: number): Promise<void> {
  await updateJobRun(runId, { status: "running", attempts, startedAt: new Date() });
}

export async function markJobCompleted(runId: number, result: unknown, attempts: number, durationMs?: number): Promise<void> {
  await updateJobRun(runId, {
    status: "completed",
    attempts,
    result: JSON.stringify(result ?? {}),
    completedAt: new Date(),
    durationMs,
  });
}

export async function markJobFailed(runId: number, error: string, attempts: number, durationMs?: number): Promise<void> {
  await updateJobRun(runId, {
    status: "failed",
    attempts,
    error,
    durationMs,
  });
}

export async function markJobDead(runId: number, error: string, attempts: number, durationMs?: number): Promise<void> {
  await updateJobRun(runId, {
    status: "dead",
    attempts,
    error,
    completedAt: new Date(),
    durationMs,
  });
}

async function updateJobRun(
  runId: number,
  patch: Partial<{
    queueJobId: string;
    status: Status;
    attempts: number;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    result: string;
    error: string;
  }>
) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(backgroundJobRuns)
    .set(patch)
    .where(eq(backgroundJobRuns.id, runId));
}

export async function getJobRunById(runId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(backgroundJobRuns)
    .where(and(eq(backgroundJobRuns.id, runId), eq(backgroundJobRuns.tenantId, tenantId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function listRecentJobRuns(tenantId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(backgroundJobRuns)
    .where(eq(backgroundJobRuns.tenantId, tenantId))
    .orderBy(desc(backgroundJobRuns.queuedAt))
    .limit(limit);
}

export function normalizeJobError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    logger.warn("Failed to serialize worker error");
    return "Unknown worker error";
  }
}
