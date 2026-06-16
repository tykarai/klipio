/**
 * Klipio - Analysis API Route
 * POST: Accept video URL + analysis type, queue analysis job
 * GET: List recent jobs or check by URL
 */

import { NextRequest, NextResponse } from "next/server";
import { AnalysisOrchestrator } from "@/lib/analyzer";
import { getCostTracker } from "@/lib/cost-tracker";
import {
  AnalyzeRequest,
  AnalyzeResponse,
  JobStatusResponse,
  AnalysisType,
  PipelineError,
} from "@/types/analysis";

// ─── Runtime Config ────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for long-running analyses

// ─── Shared Orchestrator Instance ──────────────────────────────────────────────

let orchestrator: AnalysisOrchestrator | null = null;

function getOrchestrator(): AnalysisOrchestrator {
  if (!orchestrator) {
    orchestrator = new AnalysisOrchestrator();
  }
  return orchestrator;
}

// ─── GET: List jobs or check cached result ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const jobId = searchParams.get("jobId");

    // If jobId provided, return specific job
    if (jobId) {
      const job = getOrchestrator().getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: "Job not found", jobId },
          { status: 404 }
        );
      }

      const response: JobStatusResponse = {
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          currentStep: getStepName(job.status),
          estimatedTimeRemaining: job.status === "completed" ? 0 : undefined,
          error: job.error,
        },
        result: job.status === "completed" ? job.result : undefined,
      };

      return NextResponse.json(response);
    }

    // If URL provided, check cache
    if (url) {
      // This would check cache - for now return not found
      return NextResponse.json(
        { cached: false, url },
        { status: 404 }
      );
    }

    // Return basic API info
    return NextResponse.json({
      name: "Klipio Analysis API",
      version: "1.0.0",
      endpoints: {
        post: "Start a new analysis job",
        get: "Check job status with ?jobId= or check cache with ?url=",
      },
    });
  } catch (err) {
    console.error("[API] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST: Start Analysis Job ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestStart = Date.now();

  try {
    // Parse request body
    let body: AnalyzeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate URL
    const { url, analysisType = "auto", priority = "normal" } = body;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Check supported platforms
    const supportedPlatforms = [
      "youtube.com", "youtu.be",
      "tiktok.com",
      "instagram.com",
      "twitter.com", "x.com",
      "facebook.com", "fb.watch",
      "vimeo.com",
      "reddit.com",
    ];
    const isSupported = supportedPlatforms.some((p) =>
      parsedUrl.hostname.includes(p)
    );
    if (!isSupported) {
      return NextResponse.json(
        {
          error: "Unsupported platform",
          supported: supportedPlatforms,
          provided: parsedUrl.hostname,
        },
        { status: 400 }
      );
    }

    // Validate analysis type
    const validTypes: AnalysisType[] = ["auto", "recipe", "travel", "brand", "keypoints", "full"];
    if (!validTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: "Invalid analysis type", valid: validTypes },
        { status: 400 }
      );
    }

    // Check cost budget
    const costTracker = getCostTracker();
    const budget = await costTracker.checkBudget();
    if (!budget.allowed) {
      return NextResponse.json(
        {
          error: "Budget exceeded",
          dailyRemaining: budget.dailyRemaining,
          weeklyRemaining: budget.weeklyRemaining,
          monthlyRemaining: budget.monthlyRemaining,
          alerts: budget.alerts,
        },
        { status: 429 }
      );
    }

    // Start analysis
    const orch = getOrchestrator();
    const jobId = await orch.startAnalysis(url, analysisType, (progress) => {
      // WebSocket or SSE push could happen here
      console.log(`[Job ${jobId}] ${progress.stage}: ${progress.progress}% - ${progress.message}`);
    });

    // Build response
    const job = orch.getJob(jobId);
    const estimatedTime = estimateProcessingTime(analysisType);

    const response: AnalyzeResponse = {
      jobId,
      status: job?.status ?? "queued",
      estimatedTime,
      pollUrl: `/api/analyze/${jobId}`,
    };

    return NextResponse.json(response, { status: 202 });
  } catch (err) {
    console.error("[API] POST error:", err);

    if (err instanceof PipelineError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          stage: err.stage,
          recoverable: err.recoverable,
        },
        { status: err.code === "BUDGET_EXCEEDED" ? 429 : 500 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStepName(status: string): string {
  const names: Record<string, string> = {
    queued: "Waiting to start",
    downloading: "Downloading video",
    extracting_frames: "Extracting keyframes",
    transcribing: "Transcribing audio",
    analyzing: "Analyzing content",
    fusing: "Combining results",
    completed: "Analysis complete",
    failed: "Analysis failed",
    cancelled: "Analysis cancelled",
  };
  return names[status] ?? "Unknown";
}

function estimateProcessingTime(analysisType: AnalysisType): number {
  const times: Record<AnalysisType, number> = {
    auto: 45,
    recipe: 35,
    travel: 40,
    brand: 30,
    keypoints: 20,
    full: 60,
  };
  return times[analysisType] ?? 45;
}
