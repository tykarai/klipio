/**
 * POST /api/extract
 *
 * Direct extraction endpoint — returns video metadata, thumbnails,
 * and transcript URLs without downloading the full video.
 *
 * Used by:
 *   - The AI analysis module (next pipeline stage)
 *   - Frontend preview before download
 *   - Third-party integrations
 *
 * Request:  { url: string, platform: string, includeSubtitles?: boolean }
 * Response: { success: true, metadata: {...}, formats: [...], directUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  config,
  createLogger,
  SUPPORTED_PLATFORMS,
  PLATFORM_PATTERNS,
  ERROR_CODES,
  getErrorMessage,
} from "@/lib/config";
import type { SupportedPlatform } from "@/lib/config";
import { getBestProxyArg } from "@/lib/proxy";
import { checkRateLimit, recordRequest, getClientIP } from "../download/rate-limit";

// Dynamic import for ytdlp to avoid bundling ssh2 native binary
let ytdlpModule: any = null;
async function getYtdlpModule() {
  if (!ytdlpModule) {
    ytdlpModule = await import("@/lib/ytdlp");
  }
  return ytdlpModule;
}

const logger = createLogger("api/extract");

// ═══════════════════════════════════════════════════════════════
//  VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════

const extractRequestSchema = z.object({
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
  quality: z.enum(["hd", "sd", "low", "audio"] as const).default("hd"),
  includeSubtitles: z.boolean().default(false),
  includeChapters: z.boolean().default(false),
  extractAudio: z.boolean().default(false),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  locale: z.string().default("en"),
});

type ExtractRequest = z.infer<typeof extractRequestSchema>;

// ═══════════════════════════════════════════════════════════════
//  RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

interface ExtractResponse {
  success: boolean;
  metadata?: {
    id: string;
    title: string;
    description: string | null;
    duration: number | null;
    thumbnail: string | null;
    uploader: string | null;
    uploaderUrl: string | null;
    uploadDate: string | null;
    viewCount: number | null;
    likeCount: number | null;
    webpageUrl: string;
    platform: string;
    extractor: string;
    liveStatus: string | null;
    language: string | null;
    ageLimit: number | null;
    tags: string[] | null;
    categories: string[] | null;
  };
  formats?: Array<{
    formatId: string;
    ext: string;
    resolution: string;
    width: number | null;
    height: number | null;
    fps: number | null;
    filesize: number | null;
    hasVideo: boolean;
    hasAudio: boolean;
    qualityScore: number;
  }>;
  selectedFormat?: {
    formatId: string;
    resolution: string;
    width: number | null;
    height: number | null;
    filesize: number | null;
    ext: string;
  } | null;
  directUrl?: string | null;
  subtitles?: Record<string, Array<{ url: string; name: string }>>;
  chapters?: Array<{ startTime: number; title: string }>;
  transcriptUrl?: string | null;
  headers?: Record<string, string>;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  timing?: {
    totalMs: number;
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

    const parseResult = extractRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join("; ");
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

    const {
      url,
      platform,
      quality,
      includeSubtitles,
      includeChapters,
      extractAudio,
      startTime,
      endTime,
      locale,
    } = parseResult.data;

    // ── Validate URL matches platform ─────────────────────────
    const pattern = PLATFORM_PATTERNS[platform];
    if (!pattern.test(url)) {
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

    // ── Rate Limiting (lighter check for extraction) ──────────
    const ipAddress = getClientIP(request);
    let userId: string | null = null;
    let isRegistered = false;

    try {
      const { createServerSupabaseClient } = await import("@/lib/supabase");
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        isRegistered = true;
      }
    } catch {
      // Anonymous
    }

    const rateLimitResult = await checkRateLimit(ipAddress, userId, isRegistered);
    if (!rateLimitResult.allowed) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: ERROR_CODES.RATE_LIMITED.code,
            message: getErrorMessage("RATE_LIMITED", locale),
          },
        },
        429
      );
    }

    // ── Extract Metadata ──────────────────────────────────────
    logger.info(`Starting extraction`, {
      requestId,
      url: url.slice(0, 100),
      platform,
      quality,
    });

    const extractResult = await extractMetadata(url, platform as SupportedPlatform, {
      quality,
      extractAudio,
      startTime,
      endTime,
      extractSubtitles: includeSubtitles,
      extractChapters: includeChapters,
    });

    await recordRequest(ipAddress, userId);

    const elapsed = Date.now() - startTime;

    // ── Build Headers for Direct URL ──────────────────────────
    const headers: Record<string, string> = {};
    if (platform === "tiktok") {
      headers["Referer"] = "https://www.tiktok.com/";
    } else if (platform === "instagram") {
      headers["Referer"] = "https://www.instagram.com/";
    } else if (platform === "youtube") {
      headers["User-Agent"] =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    }

    // ── Build Transcript URL ──────────────────────────────────
    let transcriptUrl: string | null = null;
    const autoSubs = extractResult.metadata.subtitles?.["auto"] ||
      extractResult.metadata.subtitles?.["en"] ||
      Object.values(extractResult.metadata.subtitles)[0];

    if (autoSubs && autoSubs.length > 0) {
      transcriptUrl = autoSubs[0].url;
    }

    logger.info(`Extraction complete`, {
      requestId,
      elapsedMs: elapsed,
      title: extractResult.metadata.title.slice(0, 60),
      formats: extractResult.metadata.formats.length,
    });

    return jsonResponse({
      success: true,
      metadata: {
        id: extractResult.metadata.id,
        title: extractResult.metadata.title,
        description: extractResult.metadata.description,
        duration: extractResult.metadata.duration,
        thumbnail: extractResult.metadata.thumbnail,
        uploader: extractResult.metadata.uploader,
        uploaderUrl: extractResult.metadata.uploaderUrl,
        uploadDate: extractResult.metadata.uploadDate,
        viewCount: extractResult.metadata.viewCount,
        likeCount: extractResult.metadata.likeCount,
        webpageUrl: extractResult.metadata.webpageUrl,
        platform,
        extractor: extractResult.metadata.extractor,
        liveStatus: extractResult.metadata.liveStatus,
        language: extractResult.metadata.language,
        ageLimit: extractResult.metadata.ageLimit,
        tags: extractResult.metadata.tags,
        categories: extractResult.metadata.categories,
      },
      formats: extractResult.metadata.formats.map((f) => ({
        formatId: f.formatId,
        ext: f.ext,
        resolution: f.resolution,
        width: f.width,
        height: f.height,
        fps: f.fps,
        filesize: f.filesize,
        hasVideo: f.hasVideo,
        hasAudio: f.hasAudio,
        qualityScore: f.quality,
      })),
      selectedFormat: extractResult.selectedFormat
        ? {
            formatId: extractResult.selectedFormat.formatId,
            resolution: extractResult.selectedFormat.resolution,
            width: extractResult.selectedFormat.width,
            height: extractResult.selectedFormat.height,
            filesize: extractResult.selectedFormat.filesize,
            ext: extractResult.selectedFormat.ext,
          }
        : null,
      directUrl: extractResult.directUrl,
      subtitles: includeSubtitles ? extractResult.metadata.subtitles : undefined,
      chapters: includeChapters && extractResult.metadata.chapters
        ? extractResult.metadata.chapters
        : undefined,
      transcriptUrl,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      timing: {
        totalMs: elapsed,
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof YtdlpError) {
      logger.warn(`Extraction failed`, {
        requestId,
        code: error.code,
        platform: error.platform,
        elapsedMs: elapsed,
      });

      const errorMap: Record<string, keyof typeof ERROR_CODES> = {
        PRIVATE_VIDEO: "PRIVATE_VIDEO",
        VIDEO_NOT_FOUND: "VIDEO_NOT_FOUND",
        GEO_BLOCKED: "VIDEO_BLOCKED",
        AGE_RESTRICTED: "PRIVATE_VIDEO",
        LIVE_VIDEO: "EXTRACTION_FAILED",
        RATE_LIMITED: "RATE_LIMITED",
        PROXY_UNREACHABLE: "PROXY_UNREACHABLE",
        EXTRACTION_FAILED: "EXTRACTION_FAILED",
      };

      const errorCode = errorMap[error.code] || "EXTRACTION_FAILED";

      return jsonResponse(
        {
          success: false,
          error: {
            code: errorCode,
            message: getErrorMessage(errorCode, locale),
            details: config.isDev ? error.originalError : undefined,
          },
        },
        422
      );
    }

    logger.error(`Unexpected extraction error`, {
      requestId,
      elapsedMs: elapsed,
      error: (error as Error).message,
    });

    return jsonResponse(
      {
        success: false,
        error: {
          code: ERROR_CODES.SERVER_ERROR.code,
          message: config.isDev
            ? (error as Error).message
            : "An unexpected error occurred",
        },
      },
      500
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  GET — Quick metadata (public, no auth required)
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const platform = searchParams.get("platform") as SupportedPlatform | null;
  const locale = searchParams.get("locale") || "en";

  if (!url || !platform) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_URL.code,
          message: "Missing 'url' or 'platform' query parameter",
        },
      },
      400
    );
  }

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: ERROR_CODES.UNSUPPORTED_PLATFORM.code,
          message: getErrorMessage("UNSUPPORTED_PLATFORM", locale),
        },
      },
      400
    );
  }

  // Forward to POST handler
  const fakeRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({ url, platform, locale }),
    headers: request.headers,
  });

  return POST(fakeRequest);
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function jsonResponse(body: ExtractResponse, status: number): NextResponse {
  return NextResponse.json(body, { status });
}
