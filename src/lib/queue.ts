/**
 * Job Queue Module for klipio.io
 *
 * PostgreSQL-based queue using Supabase with the following features:
 * - Multiple job types: extract, download, analyze
 * - Priority-based ordering
 * - Retry logic with exponential backoff
 * - Dead letter queue for permanently failed jobs
 * - Worker identity tracking
 * - Scheduled execution (future timestamps)
 *
 * Design: Uses SKIP LOCKED-style atomic job claiming via
 *         Supabase RPC to prevent race conditions.
 */

import { createServiceClient, type Database } from "./supabase";
import {
  config,
  createLogger,
  RETRY_CONFIG,
  type JobType,
  type JobStatus,
} from "./config";

const logger = createLogger("queue");

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type JobPayload = Record<string, unknown>;
export type JobResult = Record<string, unknown>;

export interface CreateJobOptions {
  type: JobType;
  payload: JobPayload;
  priority?: number; // Higher = processed first (default: 0)
  maxAttempts?: number;
  scheduledFor?: Date; // Future execution time
  ipAddress?: string | null;
}

export interface JobClaimResult {
  job: Database["public"]["Tables"]["jobs"]["Row"] | null;
  claimed: boolean;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  avgProcessingTimeMs: number | null;
}

export interface DeadLetterEntry {
  jobId: string;
  type: JobType;
  payload: JobPayload;
  error: string;
  attempts: number;
  failedAt: string;
  workerId: string | null;
}

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_MAX_ATTEMPTS = 3;
const DEAD_LETTER_THRESHOLD = 3; // Failed this many times → dead letter
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before a job is considered stalled
const MAX_SCHEDULE_DELAY_MS = 24 * 60 * 60 * 1000; // Max 24h in future

// Exponential backoff: 2s, 4s, 8s, 16s, 32s... capped at 5 minutes
function getBackoffDelayMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 5 * 60 * 1000);
  // Add jitter (±25%)
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(1000, Math.round(base + jitter));
}

// ═══════════════════════════════════════════════════════════════
//  JOB CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new job in the queue.
 *
 * @returns The created job record
 */
export async function createJob(
  options: CreateJobOptions
): Promise<Database["public"]["Tables"]["jobs"]["Row"]> {
  const service = createServiceClient();

  const now = new Date().toISOString();
  const scheduledFor = options.scheduledFor
    ? options.scheduledFor.toISOString()
    : now;

  // Validate scheduled time isn't too far in the future
  if (options.scheduledFor) {
    const delay = options.scheduledFor.getTime() - Date.now();
    if (delay > MAX_SCHEDULE_DELAY_MS) {
      throw new Error(
        `Cannot schedule job more than 24 hours in the future`
      );
    }
  }

  const { data, error } = await service
    .from("jobs")
    .insert({
      type: options.type,
      status: "queued",
      priority: options.priority ?? 0,
      payload: options.payload,
      result: null,
      error: null,
      attempts: 0,
      max_attempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      scheduled_for: scheduledFor,
      processed_at: null,
      completed_at: null,
      failed_at: null,
      worker_id: null,
      ip_address: options.ipAddress || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    logger.error("Failed to create job", { error: error.message, type: options.type });
    throw new Error(`Failed to create job: ${error.message}`);
  }

  logger.info(`Job created`, {
    jobId: data.id,
    type: options.type,
    priority: options.priority ?? 0,
  });

  return data;
}

/**
 * Create a download job from a download record ID.
 * Convenience wrapper for the most common use case.
 */
export async function createDownloadJob(
  downloadId: string,
  payload: {
    url: string;
    platform: string;
    quality: string;
    userId?: string | null;
    ipAddress?: string | null;
  }
): Promise<string> {
  const job = await createJob({
    type: "download",
    priority: payload.userId ? 10 : 0, // Registered users get higher priority
    payload: {
      downloadId,
      url: payload.url,
      platform: payload.platform,
      quality: payload.quality,
      userId: payload.userId || null,
    },
    ipAddress: payload.ipAddress || null,
  });

  return job.id;
}

/**
 * Create an analysis job after download completes.
 */
export async function createAnalysisJob(
  downloadId: string,
  r2Key: string,
  payload: {
    platform: string;
    title?: string;
    duration?: number | null;
  }
): Promise<string> {
  const job = await createJob({
    type: "analyze",
    priority: 5,
    payload: {
      downloadId,
      r2Key,
      ...payload,
    },
  });

  return job.id;
}

// ═══════════════════════════════════════════════════════════════
//  JOB CLAIMING (Worker pulls from queue)
// ═══════════════════════════════════════════════════════════════

/**
 * Claim the next available job of the given type.
 *
 * Uses atomic update to prevent race conditions between workers.
 * Only claims jobs that are:
 *   - Status = 'queued'
 *   - scheduled_for <= now
 *   - Not exceeded max attempts
 *
 * @param jobType  — Type of job to claim (extract, download, analyze)
 * @param workerId — Unique identifier for this worker instance
 */
export async function claimNextJob(
  jobType: JobType,
  workerId: string
): Promise<JobClaimResult> {
  const service = createServiceClient();

  try {
    // Use the RPC function for atomic claim
    const { data, error } = await service.rpc("pop_job", {
      job_type: jobType,
      worker_id: workerId,
    });

    if (error) {
      // Fallback to manual claim if RPC doesn't exist yet
      logger.warn("pop_job RPC not available, falling back to manual claim", {
        error: error.message,
      });
      return manualClaimJob(service, jobType, workerId);
    }

    if (!data) {
      return { job: null, claimed: false };
    }

    logger.debug(`Claimed job ${data.id} (${jobType})`, { workerId });
    return { job: data as Database["public"]["Tables"]["jobs"]["Row"], claimed: true };
  } catch (error) {
    logger.error("Failed to claim job", {
      jobType,
      workerId,
      error: (error as Error).message,
    });
    return { job: null, claimed: false };
  }
}

/**
 * Manual job claim fallback using Supabase's atomic update.
 * Uses ordering by priority DESC, scheduled_for ASC for fair processing.
 */
async function manualClaimJob(
  service: ReturnType<typeof createServiceClient>,
  jobType: JobType,
  workerId: string
): Promise<JobClaimResult> {
  const now = new Date().toISOString();

  // Find the next available job
  const { data: jobs, error: findError } = await service
    .from("jobs")
    .select("*")
    .eq("type", jobType)
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .lt("attempts", 5) // Sanity check
    .order("priority", { ascending: false })
    .order("scheduled_for", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (findError || !jobs || jobs.length === 0) {
    return { job: null, claimed: false };
  }

  const job = jobs[0];

  // Atomically claim it
  const { data: updated, error: updateError } = await service
    .from("jobs")
    .update({
      status: "processing",
      processed_at: now,
      attempts: job.attempts + 1,
      worker_id: workerId,
      updated_at: now,
    })
    .eq("id", job.id)
    .eq("status", "queued") // Only update if still queued (optimistic locking)
    .select()
    .single();

  if (updateError || !updated) {
    // Another worker claimed it
    return { job: null, claimed: false };
  }

  return { job: updated, claimed: true };
}

// ═══════════════════════════════════════════════════════════════
//  JOB COMPLETION / FAILURE
// ═══════════════════════════════════════════════════════════════

/**
 * Mark a job as completed with results.
 */
export async function completeJob(
  jobId: string,
  result: JobResult
): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await service
    .from("jobs")
    .update({
      status: "completed",
      result,
      error: null,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", jobId);

  if (error) {
    logger.error(`Failed to complete job ${jobId}`, { error: error.message });
    throw error;
  }

  logger.info(`Job completed`, { jobId });
}

/**
 * Mark a job as failed.
 * If max attempts reached, moves to dead letter queue.
 */
export async function failJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();

  // First, get current job state
  const { data: job } = await service
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job) {
    logger.warn(`Cannot fail job ${jobId}: not found`);
    return;
  }

  const isPermanentFailure = job.attempts >= (job.max_attempts ?? DEFAULT_MAX_ATTEMPTS);

  if (isPermanentFailure) {
    // Move to dead letter
    const { error: dlError } = await service.from("dead_letter").insert({
      job_id: jobId,
      type: job.type,
      payload: job.payload,
      error: errorMessage,
      attempts: job.attempts,
      failed_at: now,
      worker_id: job.worker_id,
      created_at: now,
    });

    if (dlError) {
      logger.error("Failed to insert dead letter", {
        jobId,
        error: dlError.message,
      });
    }

    // Mark job as dead_letter
    const { error } = await service
      .from("jobs")
      .update({
        status: "dead_letter",
        error: errorMessage,
        failed_at: now,
        updated_at: now,
      })
      .eq("id", jobId);

    if (error) {
      logger.error(`Failed to mark job ${jobId} as dead letter`, {
        error: error.message,
      });
    }

    logger.warn(`Job moved to dead letter`, {
      jobId,
      attempts: job.attempts,
      error: errorMessage.slice(0, 200),
    });
  } else {
    // Schedule retry with exponential backoff
    const backoffMs = getBackoffDelayMs(job.attempts);
    const scheduledFor = new Date(Date.now() + backoffMs).toISOString();

    const { error } = await service
      .from("jobs")
      .update({
        status: "queued",
        error: errorMessage,
        scheduled_for: scheduledFor,
        updated_at: now,
      })
      .eq("id", jobId);

    if (error) {
      logger.error(`Failed to schedule retry for job ${jobId}`, {
        error: error.message,
      });
      throw error;
    }

    logger.info(`Job scheduled for retry`, {
      jobId,
      attempt: job.attempts + 1,
      backoffMs,
      scheduledFor,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  STALLED JOB RECOVERY
// ═══════════════════════════════════════════════════════════════

/**
 * Re-queue jobs that have been "processing" for too long.
 * This handles worker crashes without proper cleanup.
 *
 * Call this from a cron job every few minutes.
 */
export async function recoverStalledJobs(): Promise<number> {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
  const now = new Date().toISOString();

  // Find stalled jobs
  const { data: stalled, error: findError } = await service
    .from("jobs")
    .select("*")
    .eq("status", "processing")
    .lt("processed_at", cutoff)
    .lt("attempts", 5);

  if (findError || !stalled || stalled.length === 0) {
    return 0;
  }

  let recovered = 0;

  for (const job of stalled) {
    const backoffMs = getBackoffDelayMs(job.attempts);
    const scheduledFor = new Date(Date.now() + backoffMs).toISOString();

    const { error } = await service
      .from("jobs")
      .update({
        status: "queued",
        scheduled_for: scheduledFor,
        error: `Worker timeout: job was processing for > ${PROCESSING_TIMEOUT_MS / 1000}s`,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "processing"); // Ensure still processing

    if (!error) {
      recovered++;
      logger.info(`Recovered stalled job`, {
        jobId: job.id,
        type: job.type,
        wasProcessingFor: `${Math.round(
          (Date.now() - new Date(job.processed_at!).getTime()) / 1000
        )}s`,
      });
    }
  }

  return recovered;
}

// ═══════════════════════════════════════════════════════════════
//  DEAD LETTER QUEUE
// ═══════════════════════════════════════════════════════════════

/**
 * Get entries from the dead letter queue.
 */
export async function getDeadLetterEntries(
  limit = 50,
  offset = 0
): Promise<DeadLetterEntry[]> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("dead_letter")
    .select("*")
    .order("failed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("Failed to fetch dead letter entries", { error: error.message });
    throw error;
  }

  return (data || []).map((row) => ({
    jobId: row.job_id,
    type: row.type as JobType,
    payload: row.payload as JobPayload,
    error: row.error,
    attempts: row.attempts,
    failedAt: row.failed_at,
    workerId: row.worker_id,
  }));
}

/**
 * Re-queue a dead letter job for another attempt.
 * Useful for manual retry after fixing an issue.
 */
export async function retryDeadLetter(jobId: string): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();

  const { data: entry, error: findError } = await service
    .from("dead_letter")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (findError || !entry) {
    throw new Error(`Dead letter entry not found: ${jobId}`);
  }

  // Re-create as a new job
  await createJob({
    type: entry.type as JobType,
    payload: entry.payload as JobPayload,
    priority: 5, // Boost priority for retry
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
  });

  // Remove from dead letter
  await service.from("dead_letter").delete().eq("job_id", jobId);

  logger.info(`Dead letter job re-queued`, { jobId });
}

// ═══════════════════════════════════════════════════════════════
//  QUEUE STATISTICS
// ═══════════════════════════════════════════════════════════════

/**
 * Get current queue statistics.
 */
export async function getQueueStats(): Promise<QueueStats> {
  const service = createServiceClient();

  const { data, error } = await service.rpc("get_queue_stats");

  if (error || !data) {
    // Fallback: count manually
    const statuses: JobStatus[] = [
      "queued",
      "processing",
      "completed",
      "failed",
      "dead_letter",
    ];

    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await service
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = count || 0;
    }

    return {
      queued: counts["queued"] || 0,
      processing: counts["processing"] || 0,
      completed: counts["completed"] || 0,
      failed: counts["failed"] || 0,
      deadLetter: counts["dead_letter"] || 0,
      avgProcessingTimeMs: null,
    };
  }

  return {
    queued: data.queued || 0,
    processing: data.processing || 0,
    completed: data.completed || 0,
    failed: data.failed || 0,
    deadLetter: data.dead_letter || 0,
    avgProcessingTimeMs: data.avg_processing_time_ms,
  };
}

// ═══════════════════════════════════════════════════════════════
//  JOB LOOKUP
// ═══════════════════════════════════════════════════════════════

/**
 * Get a job by its ID.
 */
export async function getJob(
  jobId: string
): Promise<Database["public"]["Tables"]["jobs"]["Row"] | null> {
  const service = createServiceClient();

  const { data, error } = await service
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
}

/**
 * Get the status of a job as a user-friendly string.
 */
export function getJobStatusDisplay(status: JobStatus): string {
  const display: Record<JobStatus, string> = {
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    dead_letter: "Failed Permanently",
  };
  return display[status] || status;
}

// ═══════════════════════════════════════════════════════════════
//  CLEANUP
// ═══════════════════════════════════════════════════════════════

/**
 * Purge completed jobs older than the given age.
 * Call from a cron job to prevent table bloat.
 */
export async function purgeOldJobs(maxAgeHours: number): Promise<number> {
  const service = createServiceClient();
  const cutoff = new Date(
    Date.now() - maxAgeHours * 60 * 60 * 1000
  ).toISOString();

  const { error, count } = await service
    .from("jobs")
    .delete()
    .or(`completed_at.lt.${cutoff},failed_at.lt.${cutoff}`)
    .neq("status", "queued")
    .neq("status", "processing");

  if (error) {
    logger.error("Failed to purge old jobs", { error: error.message });
    throw error;
  }

  logger.info(`Purged ${count || 0} old jobs`);
  return count || 0;
}
