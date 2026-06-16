/**
 * GET /api/download/:id
 *
 * Poll download status by ID. Returns the current state of the download
 * and a signed R2 URL when the file is ready.
 *
 * Response states:
 *   queued     → Still waiting to start
 *   extracting → yt-dlp is working on it
 *   downloading→ Video is being transferred to R2
 *   processing → Post-processing (thumbnails, metadata)
 *   ready      → Done! Returns signedDownloadUrl
 *   failed     → Something went wrong (errorCode + errorMessage)
 *   expired    → The 24-hour download window has passed
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger, config, ERROR_CODES, getErrorMessage } from "@/lib/config";
import { getDownloadById, updateDownload } from "@/lib/supabase";
import { getSignedDownloadUrl } from "@/lib/r2";
import { getJob } from "@/lib/queue";

const logger = createLogger("api/download/status");

// ═══════════════════════════════════════════════════════════════
//  RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

interface StatusResponse {
  success: boolean;
  downloadId: string;
  status:
    | "queued"
    | "extracting"
    | "downloading"
    | "processing"
    | "ready"
    | "failed"
    | "expired";
  progress?: {
    percent: number;
    stage: string;
    etaSeconds: number | null;
  };
  result?: {
    signedDownloadUrl: string;
    expiresAt: string;
    fileName: string;
    fileSize: number | null;
    contentType: string;
    duration: number | null;
    resolution: string;
    thumbnailUrl: string | null;
    title: string | null;
    author: string | null;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta?: {
    platform: string;
    quality: string;
    createdAt: string;
    expiresAt: string;
  };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const { id: downloadId } = await params;
  const startTime = Date.now();

  // Parse locale from query
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") || "en";

  try {
    // ── Validate ID ────────────────────────────────────────────
    if (!downloadId || !isValidUUID(downloadId)) {
      return jsonResponse(
        {
          success: false,
          downloadId: downloadId || "unknown",
          status: "failed" as const,
          error: {
            code: ERROR_CODES.INVALID_URL.code,
            message: "Invalid download ID",
            retryable: false,
          },
        },
        400
      );
    }

    // ── Fetch Download Record ──────────────────────────────────
    const download = await getDownloadById(downloadId);

    if (!download) {
      logger.warn(`Download not found`, { requestId, downloadId });
      return jsonResponse(
        {
          success: false,
          downloadId,
          status: "failed" as const,
          error: {
            code: ERROR_CODES.JOB_NOT_FOUND.code,
            message: getErrorMessage("JOB_NOT_FOUND", locale),
            retryable: false,
          },
        },
        404
      );
    }

    // ── Check Expiry ───────────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(download.expires_at);

    if (now > expiresAt && download.status !== "expired") {
      // Auto-expire
      await updateDownload(downloadId, { status: "expired" });
      download.status = "expired";
    }

    // ── Build Response Based on Status ────────────────────────
    const baseResponse: StatusResponse = {
      success: true,
      downloadId,
      status: download.status as StatusResponse["status"],
      meta: {
        platform: download.platform,
        quality: download.quality,
        createdAt: download.created_at,
        expiresAt: download.expires_at,
      },
    };

    switch (download.status) {
      case "queued": {
        // Check if there's a job to report progress
        const job = await findJobForDownload(downloadId);
        return jsonResponse({
          ...baseResponse,
          status: "queued",
          progress: {
            percent: 0,
            stage: "queued",
            etaSeconds: estimateEta(download),
          },
        });
      }

      case "extracting":
        return jsonResponse({
          ...baseResponse,
          status: "extracting",
          progress: {
            percent: 15,
            stage: "extracting_video_info",
            etaSeconds: estimateEta(download),
          },
        });

      case "downloading":
        return jsonResponse({
          ...baseResponse,
          status: "downloading",
          progress: {
            percent: 50,
            stage: "transferring_to_storage",
            etaSeconds: estimateEta(download),
          },
        });

      case "processing":
        return jsonResponse({
          ...baseResponse,
          status: "processing",
          progress: {
            percent: 85,
            stage: "finalizing",
            etaSeconds: estimateEta(download),
          },
        });

      case "ready": {
        // Generate signed download URL
        if (!download.r2_key) {
          logger.error(`Ready download missing R2 key`, { downloadId });
          return jsonResponse(
            {
              ...baseResponse,
              status: "failed" as const,
              error: {
                code: ERROR_CODES.STORAGE_ERROR.code,
                message: "File reference missing",
                retryable: false,
              },
            },
            500
          );
        }

        const signedUrlResult = await getSignedDownloadUrl(download.r2_key, {
          fileName: download.file_name || undefined,
          contentDisposition: "attachment",
        });

        const resolution =
          download.width && download.height
            ? `${download.width}x${download.height}`
            : "unknown";

        logger.info(`Download ready, signed URL generated`, {
          requestId,
          downloadId,
          elapsedMs: Date.now() - startTime,
        });

        return jsonResponse({
          ...baseResponse,
          status: "ready",
          result: {
            signedDownloadUrl: signedUrlResult.downloadUrl,
            expiresAt: signedUrlResult.expiresAt.toISOString(),
            fileName: signedUrlResult.fileName || download.file_name || "download",
            fileSize: download.file_size,
            contentType: signedUrlResult.contentType || download.mime_type || "video/mp4",
            duration: download.duration,
            resolution,
            thumbnailUrl: download.thumbnail_url,
            title: download.title,
            author: download.author,
          },
        });
      }

      case "failed": {
        const errorCode = download.error_code || "EXTRACTION_FAILED";
        const retryable = isRetryableError(errorCode);

        return jsonResponse({
          ...baseResponse,
          status: "failed",
          error: {
            code: errorCode,
            message:
              download.error_message ||
              getErrorMessage(errorCode as keyof typeof ERROR_CODES, locale) ||
              "Download failed",
            retryable,
          },
        });
      }

      case "expired":
        return jsonResponse({
          ...baseResponse,
          status: "expired",
          error: {
            code: ERROR_CODES.EXPIRED.code,
            message: getErrorMessage("EXPIRED", locale),
            retryable: true,
          },
        });

      default:
        return jsonResponse(
          {
            ...baseResponse,
            status: "failed" as const,
            error: {
              code: ERROR_CODES.SERVER_ERROR.code,
              message: "Unknown download status",
              retryable: false,
            },
          },
          500
        );
    }
  } catch (error) {
    logger.error(`Unexpected error checking download status`, {
      requestId,
      downloadId,
      error: (error as Error).message,
    });

    return jsonResponse(
      {
        success: false,
        downloadId,
        status: "failed" as const,
        error: {
          code: ERROR_CODES.SERVER_ERROR.code,
          message: config.isDev
            ? (error as Error).message
            : "Internal server error",
          retryable: true,
        },
      },
      500
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE — Cancel a queued download
// ═══════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: downloadId } = await params;

  try {
    const download = await getDownloadById(downloadId);

    if (!download) {
      return jsonResponse(
        {
          success: false,
          downloadId,
          status: "failed" as const,
          error: {
            code: ERROR_CODES.JOB_NOT_FOUND.code,
            message: "Download not found",
            retryable: false,
          },
        },
        404
      );
    }

    // Can only cancel queued or extracting downloads
    if (download.status !== "queued" && download.status !== "extracting") {
      return jsonResponse(
        {
          success: false,
          downloadId,
          status: download.status as StatusResponse["status"],
          error: {
            code: "CANNOT_CANCEL",
            message: `Cannot cancel a download that is already ${download.status}`,
            retryable: false,
          },
        },
        409
      );
    }

    await updateDownload(downloadId, {
      status: "failed",
      error_code: "CANCELLED",
      error_message: "Cancelled by user",
    });

    logger.info(`Download cancelled`, { downloadId });

    return jsonResponse({
      success: true,
      downloadId,
      status: "failed",
      error: {
        code: "CANCELLED",
        message: "Download was cancelled",
        retryable: true,
      },
    });
  } catch (error) {
    logger.error(`Failed to cancel download`, {
      downloadId,
      error: (error as Error).message,
    });

    return jsonResponse(
      {
        success: false,
        downloadId,
        status: "failed" as const,
        error: {
          code: ERROR_CODES.SERVER_ERROR.code,
          message: "Failed to cancel download",
          retryable: false,
        },
      },
      500
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function jsonResponse(body: StatusResponse, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Find the queue job associated with a download record.
 */
async function findJobForDownload(
  downloadId: string
): Promise<Record<string, unknown> | null> {
  try {
    const { createServiceClient } = await import("@/lib/supabase");
    const service = createServiceClient();

    const { data, error } = await service
      .from("jobs")
      .select("*")
      .eq("payload->>downloadId", downloadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Estimate remaining processing time in seconds.
 */
function estimateEta(download: {
  status: string;
  created_at: string;
  platform: string;
  quality: string;
}): number | null {
  const elapsed = Date.now() - new Date(download.created_at).getTime();

  const platformEstimates: Record<string, number> = {
    tiktok: 8000,
    instagram: 12000,
    facebook: 15000,
    youtube: 10000,
    twitter: 8000,
  };

  const qualityMultipliers: Record<string, number> = {
    hd: 1.0,
    sd: 0.7,
    low: 0.5,
    audio: 0.4,
  };

  const baseEstimate =
    (platformEstimates[download.platform] || 10000) *
    (qualityMultipliers[download.quality] || 1.0);

  const remaining = Math.max(1, Math.ceil((baseEstimate - elapsed) / 1000));
  return remaining;
}

/**
 * Determine if an error is retryable.
 */
function isRetryableError(errorCode: string): boolean {
  const retryableCodes = [
    "EXTRACTION_FAILED",
    "PROXY_UNREACHABLE",
    "RATE_LIMITED",
    "SERVER_ERROR",
    "STORAGE_ERROR",
  ];
  const nonRetryableCodes = [
    "INVALID_URL",
    "UNSUPPORTED_PLATFORM",
    "PRIVATE_VIDEO",
    "VIDEO_NOT_FOUND",
    "VIDEO_BLOCKED",
    "EXPIRED",
    "JOB_NOT_FOUND",
  ];

  if (nonRetryableCodes.includes(errorCode)) return false;
  if (retryableCodes.includes(errorCode)) return true;

  // Default: assume retryable for unknown errors
  return true;
}
