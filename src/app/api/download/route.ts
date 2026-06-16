/**
 * POST /api/download
 *
 * Main download endpoint for klipio.io.
 *
 * Request:  { url: string, platform: string, quality?: "hd" | "sd" | "low" | "audio" }
 * Response: { success: true, jobId: string, status: string, estimatedSeconds: number }
 *
 * Flow:
 *   1. Validate input (URL + platform)
 *   2. Check rate limits
 *   3. Create download record in Supabase
 *   4. Queue extraction job
 *   5. Return job ID for client polling
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  config,
  createLogger,
  PLATFORM_PATTERNS,
  SUPPORTED_PLATFORMS,
  QUALITY_PRESETS,
  ERROR_CODES,
  getErrorMessage,
} from "@/lib/config";
import {
  createServiceClient,
  createServerSupabaseClient,
  createDownload,
} from "@/lib/supabase";
import { createDownloadJob } from "@/lib/queue";
import { checkRateLimit, recordRequest, getClientIP } from "./rate-limit";

const logger = createLogger("api/download");

// ═══════════════════════════════════════════════════════════════
//  VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════

const downloadRequestSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL too long")
    .refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid URL format" }
    ),
  platform: z.enum(SUPPORTED_PLATFORMS, {
    errorMap: () => ({ message: "Unsupported platform" }),
  }),
  quality: z
    .enum(["hd", "sd", "low", "audio"] as const)
    .default("hd"),
  startTime: z.number().min(0).optional(), // Optional trim start (seconds)
  endTime: z.number().min(0).optional(),   // Optional trim end (seconds)
  locale: z.string().default("en"),        // For localized error messages
});

type DownloadRequest = z.infer<typeof downloadRequestSchema>;

// ═══════════════════════════════════════════════════════════════
//  RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

interface DownloadResponse {
  success: boolean;
  jobId?: string;
  downloadId?: string;
  status?: string;
  estimatedSeconds?: number;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    platform: string;
    quality: string;
    expiresAt: string;
  };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // ── Parse & Validate Body ────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_URL.code,
            message: "Invalid JSON body",
          },
        },
        400
      );
    }

    const parseResult = downloadRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join("; ");
      logger.warn(`Validation failed`, { requestId, issues });
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_URL.code,
            message: issues,
          },
        },
        400
      );
    }

    const { url, platform, quality, startTime: start, endTime: end, locale } = parseResult.data;

    // ── Validate URL matches platform ─────────────────────────
    const pattern = PLATFORM_PATTERNS[platform];
    if (!pattern.test(url)) {
      logger.warn(`URL does not match platform pattern`, {
        requestId,
        url: url.slice(0, 100),
        platform,
      });
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_URL.code,
            message: `URL does not appear to be a valid ${platform} video link`,
          },
        },
        400
      );
    }

    // ── Check feature flag ────────────────────────────────────
    const featureKey = `enable${platform.charAt(0).toUpperCase() + platform.slice(1)}` as keyof typeof config.features;
    if (config.features[featureKey] === false) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.UNSUPPORTED_PLATFORM.code,
            message: getErrorMessage("UNSUPPORTED_PLATFORM", locale),
          },
        },
        503
      );
    }

    // ── Auth & Rate Limiting ──────────────────────────────────
    const ipAddress = getClientIP(request);
    let userId: string | null = null;
    let isRegistered = false;

    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        isRegistered = true;
      }
    } catch {
      // Anonymous user — continue without auth
    }

    const rateLimitResult = await checkRateLimit(ipAddress, userId, isRegistered);
    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit exceeded`, {
        requestId,
        ip: ipAddress,
        userId,
        isRegistered,
      });
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.RATE_LIMITED.code,
            message: getErrorMessage("RATE_LIMITED", locale),
            details: rateLimitResult.resetAt
              ? `Reset at ${new Date(rateLimitResult.resetAt).toLocaleTimeString()}`
              : undefined,
          },
        },
        429,
        { "Retry-After": String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) }
      );
    }

    // ── Create Download Record ─────────────────────────────────
    const expiresAt = new Date(Date.now() + config.r2.expirySeconds * 1000);
    const country = request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country") || null;

    const download = await createDownload({
      id: crypto.randomUUID(),
      url,
      platform,
      status: "queued",
      quality,
      r2_key: null,
      r2_bucket: config.r2.bucketName,
      file_size: null,
      file_name: null,
      mime_type: null,
      duration: null,
      width: null,
      height: null,
      title: null,
      thumbnail_url: null,
      author: null,
      error_code: null,
      error_message: null,
      retry_count: 0,
      user_id: userId,
      ip_address: ipAddress,
      country,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      completed_at: null,
    });

    // ── Queue Extraction Job ───────────────────────────────────
    const jobId = await createDownloadJob(download.id, {
      url,
      platform,
      quality,
      userId,
      ipAddress,
    });

    // ── Record Rate Limit Usage ────────────────────────────────
    await recordRequest(ipAddress, userId);

    // ── Return Response ────────────────────────────────────────
    const elapsed = Date.now() - startTime;
    logger.info(`Download queued`, {
      requestId,
      downloadId: download.id,
      jobId,
      platform,
      quality,
      elapsedMs: elapsed,
    });

    return jsonResponse({
      success: true,
      jobId,
      downloadId: download.id,
      status: "queued",
      estimatedSeconds: estimateProcessingTime(platform, quality),
      meta: {
        platform,
        quality,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`Unexpected error`, {
      requestId,
      elapsedMs: elapsed,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    return jsonResponse(
      {
        success: false,
        error: {
          code: ERROR_CODES.SERVER_ERROR.code,
          message: "An unexpected error occurred. Please try again.",
          details: config.isDev ? (error as Error).message : undefined,
        },
      },
      500
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  GET — List recent downloads (for authenticated users)
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const service = createServiceClient();
    const { data, error, count } = await service
      .from("downloads")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error("Failed to list downloads", { error: error.message });
      return jsonResponse(
        {
          success: false,
          error: { code: "DB_ERROR", message: "Failed to fetch downloads" },
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      downloads: (data || []).map(sanitizeDownloadRecord),
      pagination: { limit, offset, total: count || 0 },
    });
  } catch (error) {
    logger.error("GET /api/download failed", { error: (error as Error).message });
    return jsonResponse(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "Internal server error" },
      },
      500
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  return NextResponse.json(body, { status, headers });
}

/**
 * Estimate processing time based on platform and quality.
 * Used to set client-side polling expectations.
 */
function estimateProcessingTime(
  platform: string,
  quality: string
): number {
  const baseTimes: Record<string, number> = {
    tiktok: 8,
    instagram: 12,
    facebook: 15,
    youtube: 10,
    twitter: 8,
  };

  const qualityMultiplier: Record<string, number> = {
    hd: 1.0,
    sd: 0.7,
    low: 0.5,
    audio: 0.4,
  };

  const base = baseTimes[platform] || 10;
  const mult = qualityMultiplier[quality] || 1.0;

  // Add some randomness (±30%)
  const jitter = 1 + (Math.random() * 0.6 - 0.3);

  return Math.round(base * mult * jitter);
}

/**
 * Remove sensitive fields from download records before sending to client.
 */
function sanitizeDownloadRecord(record: Record<string, unknown>) {
  const {
    ip_address: _ip,
    user_id: _uid,
    error_message: _err,
    ...safe
  } = record;
  return safe;
}
