/**
 * Klipio - Main Analysis Orchestrator
 * Orchestrates the full pipeline: download → frames → transcribe → analyze → output
 * with parallel processing, progress tracking, error recovery, and cost optimization.
 */

import { spawn } from "child_process";
import { mkdir, rm, access } from "fs/promises";
import { join, basename } from "path";
import { randomUUID } from "crypto";
import { OpenRouterClient } from "@/lib/openrouter";
import { DeepgramClient } from "@/lib/deepgram";
import { FFmpegProcessor } from "@/lib/ffmpeg";
import { getCostTracker } from "@/lib/cost-tracker";
import { RecipeAnalyzer } from "@/lib/analyzers/recipe";
import { TravelAnalyzer } from "@/lib/analyzers/travel";
import { BrandAnalyzer } from "@/lib/analyzers/brand";
import { KeyPointsAnalyzer } from "@/lib/analyzers/keypoints";
import {
  buildFusionPrompt,
  buildQualityCheckPrompt,
} from "@/lib/prompts/fusion-prompt";
import { buildContentTypeDetectionPrompt } from "@/lib/prompts/keypoints-prompt";
import {
  AnalysisResult,
  AnalysisJob,
  AnalysisStatus,
  JobStatus,
  ContentType,
  AnalysisType,
  FrameData,
  TranscriptResult,
  VisionAnalysisResult,
  PipelineProgress,
  PipelineError,
  OpenRouterMessage,
} from "@/types/analysis";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_VIDEO_DURATION_SECONDS = 600; // 10 min max
const CACHE_TTL_HOURS = 24;
const WORK_DIR = "/tmp/klipio";

// ─── In-Memory Job Store (replace with Redis in production) ────────────────────

const jobStore = new Map<string, AnalysisJob>();
const cacheStore = new Map<string, { result: AnalysisResult; expiresAt: number }>();

// ─── Progress Notifier ─────────────────────────────────────────────────────────

export type ProgressCallback = (progress: PipelineProgress) => void;

// ─── Analysis Orchestrator ─────────────────────────────────────────────────────

export class AnalysisOrchestrator {
  private openRouter: OpenRouterClient;
  private deepgram: DeepgramClient;
  private ffmpeg: FFmpegProcessor;
  private costTracker = getCostTracker();
  private workDir: string;

  // Analyzers
  private recipeAnalyzer: RecipeAnalyzer;
  private travelAnalyzer: TravelAnalyzer;
  private brandAnalyzer: BrandAnalyzer;
  private keyPointsAnalyzer: KeyPointsAnalyzer;

  constructor(options?: {
    openRouter?: OpenRouterClient;
    deepgram?: DeepgramClient;
    ffmpeg?: FFmpegProcessor;
    workDir?: string;
  }) {
    this.openRouter =
      options?.openRouter ??
      new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY! });
    this.deepgram =
      options?.deepgram ??
      new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });
    this.ffmpeg = options?.ffmpeg ?? new FFmpegProcessor();
    this.workDir = options?.workDir ?? WORK_DIR;

    // Initialize analyzers with shared OpenRouter client
    this.recipeAnalyzer = new RecipeAnalyzer(this.openRouter);
    this.travelAnalyzer = new TravelAnalyzer(this.openRouter);
    this.brandAnalyzer = new BrandAnalyzer(this.openRouter);
    this.keyPointsAnalyzer = new KeyPointsAnalyzer(this.openRouter);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start a new analysis job and return job ID
   */
  async startAnalysis(
    url: string,
    analysisType: AnalysisType = "auto",
    onProgress?: ProgressCallback
  ): Promise<string> {
    // Check cache
    const cached = this.getCached(url);
    if (cached) {
      const jobId = randomUUID();
      const job: AnalysisJob = {
        id: jobId,
        url,
        analysisType,
        status: "completed",
        progress: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: { ...cached, cacheHit: true },
      };
      jobStore.set(jobId, job);
      return jobId;
    }

    // Check budget
    const budget = await this.costTracker.checkBudget();
    if (!budget.allowed) {
      throw new PipelineError({
        code: "BUDGET_EXCEEDED",
        message: `Budget exceeded: daily=${budget.dailyRemaining}c, weekly=${budget.weeklyRemaining}c`,
        stage: "queued",
        recoverable: false,
      });
    }

    // Create job
    const jobId = randomUUID();
    const job: AnalysisJob = {
      id: jobId,
      url,
      analysisType,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobStore.set(jobId, job);

    // Run analysis asynchronously
    this.runPipeline(jobId, url, analysisType, onProgress).catch((err) => {
      console.error(`[Orchestrator] Pipeline failed for job ${jobId}:`, err);
      const j = jobStore.get(jobId);
      if (j) {
        j.status = "failed";
        j.error = err instanceof Error ? err.message : String(err);
        j.updatedAt = new Date().toISOString();
        jobStore.set(jobId, j);
      }
    });

    return jobId;
  }

  /**
   * Get analysis status
   */
  getStatus(jobId: string): AnalysisStatus | null {
    const job = jobStore.get(jobId);
    if (!job) return null;

    const stepNames: Record<JobStatus, string> = {
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

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: stepNames[job.status] ?? "Unknown",
      error: job.error,
    };
  }

  /**
   * Get analysis result (when complete)
   */
  getResult(jobId: string): AnalysisResult | null {
    const job = jobStore.get(jobId);
    return job?.result ?? null;
  }

  /**
   * Get full job data
   */
  getJob(jobId: string): AnalysisJob | null {
    return jobStore.get(jobId) ?? null;
  }

  // ─── Main Pipeline ───────────────────────────────────────────────────────────

  private async runPipeline(
    jobId: string,
    url: string,
    analysisType: AnalysisType,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const startedAt = Date.now();
    const tempFiles: string[] = [];

    try {
      await mkdir(this.workDir, { recursive: true });
      const jobDir = join(this.workDir, jobId);
      await mkdir(jobDir, { recursive: true });

      // ─── Step 1: Download Video ──────────────────────────────────────────────
      await this.updateJob(jobId, "downloading", 5, "Downloading video...", onProgress);
      const videoPath = await this.downloadVideo(url, jobDir);
      tempFiles.push(videoPath);

      // ─── Step 2: Extract Frames + Audio (Parallel) ───────────────────────────
      await this.updateJob(jobId, "extracting_frames", 10, "Extracting keyframes...", onProgress);

      const [frames, audioResult] = await Promise.all([
        this.ffmpeg.extractSceneKeyframes(videoPath, 8, join(jobDir, "frames")),
        this.ffmpeg.extractAudio(videoPath, join(jobDir, "audio")),
      ]);

      tempFiles.push(audioResult.path);
      const framesWithBase64 = await this.ffmpeg.framesToBase64(frames);

      await this.updateJob(jobId, "extracting_frames", 25, `Extracted ${frames.length} frames`, onProgress);

      // ─── Step 3: Transcribe Audio ────────────────────────────────────────────
      await this.updateJob(jobId, "transcribing", 30, "Transcribing audio...", onProgress);
      const transcript = await this.deepgram.transcribeFile(audioResult.path);
      await this.costTracker.recordTranscriptionCost(transcript.duration);

      await this.updateJob(
        jobId,
        "transcribing",
        45,
        `Transcribed (${transcript.language}, ${transcript.segments.length} segments)`,
        onProgress
      );

      // ─── Step 4: Vision Analysis (Gemini Flash) ──────────────────────────────
      await this.updateJob(jobId, "analyzing", 50, "Analyzing video frames...", onProgress);
      const visionResults = await this.runVisionAnalysis(framesWithBase64);

      // ─── Step 5: Content Type Detection ──────────────────────────────────────
      await this.updateJob(jobId, "analyzing", 55, "Detecting content type...", onProgress);
      const contentType = await this.detectContentType(transcript, visionResults);

      // ─── Step 6: Run Specialized Analyzers (Parallel where possible) ──────────
      await this.updateJob(jobId, "analyzing", 60, "Running specialized analysis...", onProgress);

      const analysisResults = await this.runSpecializedAnalyzers(
        analysisType,
        contentType.primary,
        framesWithBase64,
        transcript,
        visionResults
      );

      // ─── Step 7: Key Points (always run) ─────────────────────────────────────
      await this.updateJob(jobId, "analyzing", 75, "Extracting key points...", onProgress);
      const keyPoints = await this.keyPointsAnalyzer.analyze(transcript);

      // ─── Step 8: Fusion ──────────────────────────────────────────────────────
      await this.updateJob(jobId, "fusing", 85, "Combining all results...", onProgress);
      const result = await this.fuseResults(
        url,
        contentType,
        transcript,
        visionResults,
        analysisResults,
        keyPoints,
        startedAt
      );

      // ─── Step 9: Save & Cache ────────────────────────────────────────────────
      await this.updateJob(jobId, "completed", 100, "Analysis complete", onProgress);

      const job = jobStore.get(jobId);
      if (job) {
        job.status = "completed";
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        job.result = result;
        job.updatedAt = new Date().toISOString();
        jobStore.set(jobId, job);
      }

      this.setCache(url, result);

      // Cleanup temp files
      await this.cleanup(tempFiles, jobDir);
    } catch (err) {
      await this.cleanup(tempFiles);
      throw err;
    }
  }

  // ─── Step Implementations ────────────────────────────────────────────────────

  private async downloadVideo(url: string, outputDir: string): Promise<string> {
    const outputPath = join(outputDir, "video.%(ext)s");
    const finalPath = join(outputDir, "video.mp4");

    return new Promise((resolve, reject) => {
      const ytDlp = spawn("yt-dlp", [
        "--no-check-certificates",
        "--no-warnings",
        "-f", "best[height<=720]/best",
        "--merge-output-format", "mp4",
        "-o", outputPath,
        "--max-filesize", "500M",
        "--retries", "3",
        "--fragment-retries", "3",
        url,
      ]);

      let stderr = "";
      ytDlp.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ytDlp.on("close", async (code) => {
        if (code !== 0) {
          reject(
            new PipelineError({
              code: "DOWNLOAD_FAILED",
              message: `yt-dlp failed (code ${code}): ${stderr.slice(-500)}`,
              stage: "downloading",
              recoverable: true,
            })
          );
          return;
        }

        // Find the downloaded file
        try {
          await access(finalPath);
          resolve(finalPath);
        } catch {
          // Try to find any video file
          const { readdir } = await import("fs/promises");
          const files = await readdir(outputDir);
          const video = files.find((f) => /\.(mp4|webm|mkv|mov)$/i.test(f));
          if (video) {
            resolve(join(outputDir, video));
          } else {
            reject(
              new PipelineError({
                code: "DOWNLOAD_FAILED",
                message: "Downloaded file not found",
                stage: "downloading",
                recoverable: true,
              })
            );
          }
        }
      });

      ytDlp.on("error", (err) => {
        reject(
          new PipelineError({
            code: "DOWNLOAD_FAILED",
            message: `yt-dlp error: ${err.message}`,
            stage: "downloading",
            recoverable: true,
            cause: err,
          })
        );
      });
    });
  }

  private async runVisionAnalysis(
    frames: FrameData[]
  ): Promise<VisionAnalysisResult[]> {
    // Use Gemini 2.5 Flash for vision analysis
    const results: VisionAnalysisResult[] = [];

    for (const frame of frames) {
      if (!frame.base64) continue;

      try {
        const messages: OpenRouterMessage[] = [
          {
            role: "system" as const,
            content:
              "Describe this video frame concisely. List visible objects, text, and activities. Output JSON only.",
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `Analyze this frame at ${frame.timestamp}s. Output JSON: {"description": "...", "objects": [{"label": "...", "confidence": 0.9}], "textDetected": [{"text": "..."}], "scenes": ["..."], "activities": ["..."]}`
              },
              {
                type: "image_url" as const,
                image_url: { url: frame.base64, detail: "low" },
              },
            ],
          },
        ];

        const response = await this.openRouter.chat({
          messages,
          model: "google/gemini-2.5-flash-preview",
          temperature: 0.2,
          maxTokens: 500,
          budgetCents: 0.5,
          label: "vision-analysis",
        });

        await this.costTracker.recordModelCost({
          model: response.model,
          provider: "openrouter",
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          costCents: response.costCents,
          durationMs: response.durationMs,
          stage: "vision-analysis",
        });

        const parsed = this.safeJsonParse(response.content) ?? {};
        results.push({
          frameTimestamp: frame.timestamp,
          description: parsed.description ?? "",
          objects: parsed.objects ?? [],
          textDetected: parsed.textDetected ?? [],
          scenes: parsed.scenes ?? [],
          activities: parsed.activities ?? [],
        });
      } catch (err) {
        console.warn(`[Vision] Frame ${frame.timestamp}s failed:`, err);
        results.push({
          frameTimestamp: frame.timestamp,
          description: "",
          objects: [],
          textDetected: [],
          scenes: [],
          activities: [],
        });
      }
    }

    return results;
  }

  private async detectContentType(
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): Promise<{ primary: ContentType; confidence: number; secondary?: ContentType; secondaryConfidence?: number }> {
    try {
      const visionSummary = visionResults
        .map((v) => `[${v.frameTimestamp}s] ${v.description}; objects: ${v.objects.map((o) => o.label).join(", ")}; activities: ${v.activities.join(", ")}`)
        .join("\n");

      const messages = buildContentTypeDetectionPrompt(transcript.text, visionSummary);
      const response = await this.openRouter.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.2,
        maxTokens: 500,
        responseFormat: { type: "json_object" },
        budgetCents: 0.3,
        label: "content-type-detection",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "content-type-detection",
      });

      const parsed = this.safeJsonParse(response.content);
      if (!parsed) {
        return { primary: "mixed", confidence: 0.5 };
      }

      return {
        primary: (parsed.primaryType ?? "mixed") as ContentType,
        confidence: parsed.primaryConfidence ?? 0.5,
        secondary: parsed.secondaryType as ContentType | undefined,
        secondaryConfidence: parsed.secondaryConfidence,
      };
    } catch {
      return { primary: "mixed", confidence: 0.5 };
    }
  }

  private async runSpecializedAnalyzers(
    analysisType: AnalysisType,
    detectedType: ContentType,
    frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): Promise<{
    recipe?: any;
    travel?: any;
    brands?: any;
  }> {
    const results: any = {};
    const shouldAnalyze = (type: string) =>
      analysisType === "auto" ||
      analysisType === "full" ||
      analysisType === type ||
      detectedType === type;

    // Run analyzers based on content type and user preference
    const promises: Promise<void>[] = [];

    if (shouldAnalyze("recipe")) {
      promises.push(
        this.recipeAnalyzer.analyze(frames, transcript, visionResults).then((r) => {
          if (r) results.recipe = r;
        })
      );
    }

    if (shouldAnalyze("travel")) {
      promises.push(
        this.travelAnalyzer.analyze(frames, transcript, visionResults).then((r) => {
          if (r) results.travel = r;
        })
      );
    }

    // Brand detection runs unless explicitly excluded
    if (analysisType !== "recipe" && analysisType !== "travel") {
      promises.push(
        this.brandAnalyzer.analyze(frames, transcript, visionResults).then((r) => {
          if (r) results.brands = r;
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  private async fuseResults(
    url: string,
    contentType: { primary: ContentType; confidence: number },
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[],
    analysisResults: { recipe?: any; travel?: any; brands?: any },
    keyPoints: any,
    startedAt: number
  ): Promise<AnalysisResult> {
    const visionSummary = visionResults
      .map((v) => `[${v.frameTimestamp}s] ${v.description}`)
      .join("\n");

    const messages = buildFusionPrompt({
      visionSummary,
      transcriptText: transcript.text,
      transcriptLanguage: transcript.language,
      contentType: contentType.primary,
      contentConfidence: contentType.confidence,
      recipeResult: analysisResults.recipe ? JSON.stringify(analysisResults.recipe) : undefined,
      travelResult: analysisResults.travel ? JSON.stringify(analysisResults.travel) : undefined,
      brandResult: analysisResults.brands ? JSON.stringify(analysisResults.brands) : undefined,
      keyPointsResult: JSON.stringify(keyPoints),
      videoMetadata: {
        title: "", // populated by frontend or yt-dlp metadata
        duration: transcript.duration,
        platform: this.detectPlatform(url),
      },
    });

    const response = await this.openRouter.chat({
      messages,
      model: "anthropic/claude-3.5-sonnet",
      temperature: 0.2,
      maxTokens: 3000,
      responseFormat: { type: "json_object" },
      budgetCents: 3.0,
      label: "fusion",
    });

    await this.costTracker.recordModelCost({
      model: response.model,
      provider: "openrouter",
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      costCents: response.costCents,
      durationMs: response.durationMs,
      stage: "fusion",
    });

    let fused = this.safeJsonParse(response.content);

    // Quality check: if parsing failed, try to fix with another LLM call
    if (!fused) {
      const fixMessages = buildQualityCheckPrompt(response.content);
      const fixResponse = await this.openRouter.chat({
        messages: fixMessages,
        model: "anthropic/claude-3-haiku",
        temperature: 0,
        maxTokens: 3000,
        budgetCents: 1.0,
        label: "fusion-quality-fix",
      });
      fused = this.safeJsonParse(fixResponse.content);
    }

    // Ultimate fallback: construct result manually
    if (!fused) {
      fused = this.buildFallbackResult(
        url,
        contentType,
        transcript,
        visionResults,
        analysisResults,
        keyPoints
      );
    }

    const processingTime = (Date.now() - startedAt) / 1000;

    const result: AnalysisResult = {
      contentType: fused.contentType ?? contentType.primary,
      confidence: fused.confidence ?? contentType.confidence,
      video: fused.video ?? {
        title: "",
        duration: transcript.duration,
        thumbnail: "",
        platform: this.detectPlatform(url),
      },
      recipe: fused.recipe ?? analysisResults.recipe,
      travel: fused.travel ?? analysisResults.travel,
      brands: fused.brands ?? analysisResults.brands,
      keyPoints: fused.keyPoints ?? keyPoints,
      transcript: fused.transcript ?? {
        language: transcript.language,
        text: transcript.text,
        segments: transcript.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      },
      fusion: fused.fusion ?? {
        overallSummary: transcript.text.slice(0, 200),
        keyInsights: [],
        audience: "general",
        mood: "neutral",
        contentQuality: "medium",
        viralPotential: "medium",
        suggestedTags: [],
        relatedTopics: [],
      },
      processedAt: new Date().toISOString(),
      processingTime,
    };

    // Save cost breakdown
    const costBreakdown = await this.costTracker.buildBreakdown(
      "analysis",
      this.openRouter.getCostSummary().history,
      transcript.duration
    );

    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async updateJob(
    jobId: string,
    status: JobStatus,
    progress: number,
    detail: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const job = jobStore.get(jobId);
    if (!job) return;

    job.status = status;
    job.progress = progress;
    job.updatedAt = new Date().toISOString();
    jobStore.set(jobId, job);

    if (onProgress) {
      onProgress({
        stage: status,
        progress,
        message: detail,
        detail,
      });
    }
  }

  private detectPlatform(url: string): string {
    const u = url.toLowerCase();
    if (u.includes("youtube") || u.includes("youtu.be")) return "youtube";
    if (u.includes("tiktok")) return "tiktok";
    if (u.includes("instagram")) return "instagram";
    if (u.includes("twitter") || u.includes("x.com")) return "twitter";
    if (u.includes("facebook")) return "facebook";
    if (u.includes("vimeo")) return "vimeo";
    if (u.includes("reddit")) return "reddit";
    return "other";
  }

  private getCached(url: string): AnalysisResult | null {
    const cached = cacheStore.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      cached.result.cacheHit = true;
      return cached.result;
    }
    if (cached) cacheStore.delete(url);
    return null;
  }

  private setCache(url: string, result: AnalysisResult): void {
    const expiresAt = Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000;
    cacheStore.set(url, { result, expiresAt });
  }

  private async cleanup(paths: string[], directory?: string): Promise<void> {
    for (const p of paths) {
      try {
        await rm(p, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    if (directory) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  private buildFallbackResult(
    url: string,
    contentType: { primary: ContentType; confidence: number },
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[],
    analysisResults: { recipe?: any; travel?: any; brands?: any },
    keyPoints: any
  ): any {
    return {
      contentType: contentType.primary,
      confidence: contentType.confidence,
      video: {
        title: "",
        duration: transcript.duration,
        thumbnail: "",
        platform: this.detectPlatform(url),
      },
      transcript: {
        language: transcript.language,
        text: transcript.text,
        segments: transcript.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      },
      recipe: analysisResults.recipe,
      travel: analysisResults.travel,
      brands: analysisResults.brands,
      keyPoints,
      fusion: {
        overallSummary: `Video about ${contentType.primary}. ${transcript.text.slice(0, 150)}...`,
        keyInsights: [],
        audience: "general",
        mood: "neutral",
        contentQuality: "medium",
        viralPotential: "medium",
        suggestedTags: [contentType.primary],
        relatedTopics: [],
      },
    };
  }

  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]!);
        } catch {
          // ignore
        }
      }
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          // ignore
        }
      }
      return null;
    }
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createAnalyzer(options?: ConstructorParameters<typeof AnalysisOrchestrator>[0]): AnalysisOrchestrator {
  return new AnalysisOrchestrator(options);
}
