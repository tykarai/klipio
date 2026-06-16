/**
 * Klipio - Analysis Status API Route
 * GET: Return current analysis progress (0-100%) or full results when complete
 */

import { NextRequest, NextResponse } from "next/server";
import { AnalysisOrchestrator } from "@/lib/analyzer";
import { JobStatusResponse, AnalysisResult } from "@/types/analysis";

// ─── Runtime Config ────────────────────────────────────────────────────────────

export const runtime = "nodejs";

// ─── Shared Orchestrator Instance ──────────────────────────────────────────────

let orchestrator: AnalysisOrchestrator | null = null;

function getOrchestrator(): AnalysisOrchestrator {
  if (!orchestrator) {
    orchestrator = new AnalysisOrchestrator();
  }
  return orchestrator;
}

// ─── Route Parameters Type ─────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET: Check Analysis Status ────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Get job from orchestrator
    const orch = getOrchestrator();
    const job = orch.getJob(id);

    if (!job) {
      // Check if we have a completed result cached
      return NextResponse.json(
        {
          error: "Job not found",
          jobId: id,
          hint: "The job may have expired or the ID is incorrect. Start a new analysis with POST /api/analyze",
        },
        { status: 404 }
      );
    }

    // Build step name
    const stepNames: Record<string, string> = {
      queued: "Waiting to start",
      downloading: "Downloading video from source",
      extracting_frames: "Extracting keyframes from video",
      transcribing: "Transcribing audio with AI",
      analyzing: "Running AI content analysis",
      fusing: "Combining all analysis signals",
      completed: "Analysis complete",
      failed: "Analysis failed",
      cancelled: "Analysis was cancelled",
    };

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    if (job.status !== "completed" && job.status !== "failed" && job.status !== "cancelled") {
      estimatedTimeRemaining = estimateRemainingTime(job.progress, job.status);
    }

    // Build response
    const response: JobStatusResponse = {
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: stepNames[job.status] ?? `Processing (${job.status})`,
        estimatedTimeRemaining,
        error: job.error,
      },
      result: job.status === "completed" ? job.result : undefined,
    };

    // Return appropriate status code
    const statusCode = job.status === "failed" ? 500 : 200;
    return NextResponse.json(response, { status: statusCode });
  } catch (err) {
    console.error(`[API] Status check error for job:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Cancel Running Job ────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const orch = getOrchestrator();
    const job = orch.getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Can only cancel non-terminal jobs
    const terminalStatuses = ["completed", "failed", "cancelled"];
    if (terminalStatuses.includes(job.status)) {
      return NextResponse.json(
        {
          error: "Cannot cancel a finished job",
          jobId: id,
          status: job.status,
        },
        { status: 409 }
      );
    }

    // Mark as cancelled
    job.status = "cancelled";
    job.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: "Job cancelled",
      jobId: id,
    });
  } catch (err) {
    console.error(`[API] Cancel error:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Estimate remaining processing time based on current progress and stage
 */
function estimateRemainingTime(progress: number, stage: string): number {
  // Total estimated time for full pipeline: ~45 seconds
  const totalSeconds = 45;
  const remaining = Math.ceil((totalSeconds * (100 - progress)) / 100);

  // Add stage-specific buffer
  const stageBuffer: Record<string, number> = {
    queued: 2,
    downloading: 10,
    extracting_frames: 5,
    transcribing: 8,
    analyzing: 15,
    fusing: 5,
  };

  return remaining + (stageBuffer[stage] ?? 5);
}

/**
 * Sanitize result for public API (remove internal fields)
 */
function sanitizeResult(result: AnalysisResult): Partial<AnalysisResult> {
  // Return full result - all fields are safe for public consumption
  return result;
}
