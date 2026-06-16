import { mkdir, rm, stat } from "fs/promises";
import { basename, extname, join } from "path";
import sanitize from "sanitize-filename";
import {
  config,
  createLogger,
  ERROR_CODES,
  type QualityPreset,
  type SupportedPlatform,
} from "@/lib/config";
import {
  claimNextJob,
  completeJob,
  failJob,
  type JobPayload,
} from "@/lib/queue";
import {
  getDownloadById,
  incrementDownloadCount,
  updateDownload,
  type JobRecord,
} from "@/lib/supabase";
import {
  downloadVideo,
  extractMetadata,
  fetchRemoteFile,
  removeRemotePath,
  type ExtractResult,
  YtdlpError,
} from "@/lib/ytdlp";
import { uploadFileToR2, uploadMetadata } from "@/lib/r2";
import { FFmpegProcessor } from "@/lib/ffmpeg";

const logger = createLogger("download-worker");

export interface WorkerProcessOptions {
  workerId?: string;
  maxJobs?: number;
}

export interface WorkerJobSummary {
  jobId: string;
  downloadId: string | null;
  status: "completed" | "failed" | "retrying" | "skipped";
  elapsedMs: number;
  error?: string;
}

export interface WorkerProcessResult {
  workerId: string;
  processed: number;
  completed: number;
  failed: number;
  retrying: number;
  skipped: number;
  idle: boolean;
  jobs: WorkerJobSummary[];
}

interface DownloadJobPayload extends JobPayload {
  downloadId: string;
  url: string;
  platform: SupportedPlatform;
  quality: QualityPreset;
  userId?: string | null;
  startTime?: number;
  endTime?: number;
}

const ffmpeg = new FFmpegProcessor({
  localOutputDir: "/tmp/klipio-worker",
});

export async function processDownloadQueue(
  options: WorkerProcessOptions = {}
): Promise<WorkerProcessResult> {
  const workerId = options.workerId || `worker_${crypto.randomUUID()}`;
  const maxJobs = Math.max(1, options.maxJobs ?? config.worker.maxJobsPerInvocation);
  const jobs: WorkerJobSummary[] = [];

  for (let i = 0; i < maxJobs; i++) {
    const claim = await claimNextJob("download", workerId);
    if (!claim.claimed || !claim.job) {
      break;
    }

    jobs.push(await processClaimedDownloadJob(claim.job));
  }

  return {
    workerId,
    processed: jobs.length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    retrying: jobs.filter((job) => job.status === "retrying").length,
    skipped: jobs.filter((job) => job.status === "skipped").length,
    idle: jobs.length === 0,
    jobs,
  };
}

async function processClaimedDownloadJob(job: JobRecord): Promise<WorkerJobSummary> {
  const startedAt = Date.now();
  const payload = parsePayload(job.payload);
  const downloadId = payload?.downloadId ?? null;

  try {
    if (!payload) {
      await failJob(job.id, "Invalid download job payload");
      return {
        jobId: job.id,
        downloadId,
        status: "failed",
        elapsedMs: Date.now() - startedAt,
        error: "Invalid download job payload",
      };
    }

    await processDownloadJob(job, payload);

    return {
      jobId: job.id,
      downloadId: payload.downloadId,
      status: "completed",
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retrying = job.attempts < job.max_attempts;

    logger.error("Download job failed", {
      jobId: job.id,
      downloadId,
      retrying,
      error: message,
    });

    await failJob(job.id, message);

    if (downloadId) {
      await updateDownload(downloadId, {
        status: retrying ? "queued" : "failed",
        error_code: getDownloadErrorCode(error),
        error_message: message,
        retry_count: job.attempts,
      }).catch((updateError) => {
        logger.warn("Failed to update download after job failure", {
          downloadId,
          error: (updateError as Error).message,
        });
      });
    }

    return {
      jobId: job.id,
      downloadId,
      status: retrying ? "retrying" : "failed",
      elapsedMs: Date.now() - startedAt,
      error: message,
    };
  }
}

async function processDownloadJob(
  job: JobRecord,
  payload: DownloadJobPayload
): Promise<void> {
  const download = await getDownloadById(payload.downloadId);
  if (!download) {
    throw new Error(`Download record not found: ${payload.downloadId}`);
  }

  if (download.status === "expired" || download.status === "failed") {
    await completeJob(job.id, {
      skipped: true,
      reason: `Download already ${download.status}`,
      downloadId: payload.downloadId,
    });
    return;
  }

  await updateDownload(payload.downloadId, {
    status: "extracting",
    error_code: null,
    error_message: null,
  });

  const extraction = await extractMetadata(payload.url, payload.platform, {
    quality: payload.quality,
    extractAudio: payload.quality === "audio",
    startTime: payload.startTime,
    endTime: payload.endTime,
  });

  await updateDownload(payload.downloadId, {
    status: "downloading",
    title: extraction.metadata.title,
    thumbnail_url: extraction.metadata.thumbnail,
    author: extraction.metadata.uploader,
    description: extraction.metadata.description,
    duration: extraction.metadata.duration,
  });

  const remoteDir = `/tmp/klipio/${payload.downloadId}`;
  let remotePath: string | null = null;
  const localDir = join("/tmp/klipio-worker", payload.downloadId);
  let localPath: string | null = null;

  try {
    remotePath = await downloadVideo(payload.url, remoteDir, {
      quality: payload.quality,
      extractAudio: payload.quality === "audio",
      startTime: payload.startTime,
      endTime: payload.endTime,
    });

    await mkdir(localDir, { recursive: true });
    localPath = join(localDir, basename(remotePath));
    await fetchRemoteFile(remotePath, localPath);

    await updateDownload(payload.downloadId, { status: "processing" });

    const fileStats = await stat(localPath);
    const localMetadata = await getLocalMetadata(localPath, extraction);
    const fileName = buildFileName(payload, extraction, localPath);
    const mimeType = inferMimeType(localPath, payload.quality);

    const upload = await uploadFileToR2(localPath, payload.platform, {
      fileName,
      mimeType,
      metadata: {
        downloadId: payload.downloadId,
        jobId: job.id,
        platform: payload.platform,
        quality: payload.quality,
        sourceUrl: payload.url.slice(0, 500),
      },
    });

    await uploadMetadata(upload.key, {
      downloadId: payload.downloadId,
      jobId: job.id,
      sourceUrl: payload.url,
      platform: payload.platform,
      quality: payload.quality,
      ytDlp: {
        id: extraction.metadata.id,
        extractor: extraction.metadata.extractor,
        webpageUrl: extraction.metadata.webpageUrl,
        selectedFormat: extraction.selectedFormat,
      },
      video: {
        title: extraction.metadata.title,
        uploader: extraction.metadata.uploader,
        duration: localMetadata.duration || extraction.metadata.duration,
        width: localMetadata.width,
        height: localMetadata.height,
        fps: localMetadata.fps,
        thumbnail: extraction.metadata.thumbnail,
      },
      storage: {
        key: upload.key,
        bucket: upload.bucket,
        size: upload.size,
        contentType: upload.contentType,
        expiresAt: upload.expiresAt.toISOString(),
      },
    });

    await updateDownload(payload.downloadId, {
      status: "ready",
      r2_key: upload.key,
      r2_bucket: upload.bucket,
      file_size: fileStats.size,
      file_name: fileName,
      mime_type: mimeType,
      duration: Math.round(localMetadata.duration || extraction.metadata.duration || 0),
      width: localMetadata.width || extraction.selectedFormat?.width || null,
      height: localMetadata.height || extraction.selectedFormat?.height || null,
      title: extraction.metadata.title,
      thumbnail_url: extraction.metadata.thumbnail,
      author: extraction.metadata.uploader,
      completed_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    });

    if (download.user_id) {
      await incrementDownloadCount(download.user_id);
    }

    await completeJob(job.id, {
      downloadId: payload.downloadId,
      r2Key: upload.key,
      fileSize: upload.size,
      fileName,
      contentType: mimeType,
    });
  } finally {
    if (remotePath) {
      await removeRemotePath(remoteDir);
    }

    await rm(localDir, { recursive: true, force: true }).catch(() => {});
  }
}

function parsePayload(payload: JobPayload): DownloadJobPayload | null {
  const platform = payload.platform;
  const quality = payload.quality ?? "hd";

  if (
    typeof payload.downloadId !== "string" ||
    typeof payload.url !== "string" ||
    !isSupportedPlatform(platform) ||
    !isQualityPreset(quality)
  ) {
    return null;
  }

  return {
    ...payload,
    downloadId: payload.downloadId,
    url: payload.url,
    platform,
    quality,
    userId: typeof payload.userId === "string" ? payload.userId : null,
    startTime: typeof payload.startTime === "number" ? payload.startTime : undefined,
    endTime: typeof payload.endTime === "number" ? payload.endTime : undefined,
  };
}

function isSupportedPlatform(value: unknown): value is SupportedPlatform {
  return (
    value === "tiktok" ||
    value === "instagram" ||
    value === "facebook" ||
    value === "youtube" ||
    value === "twitter"
  );
}

function isQualityPreset(value: unknown): value is QualityPreset {
  return value === "hd" || value === "sd" || value === "low" || value === "audio";
}

async function getLocalMetadata(
  localPath: string,
  extraction: ExtractResult
): Promise<{
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}> {
  try {
    const metadata = await ffmpeg.getMetadata(localPath);
    return {
      duration: metadata.duration || extraction.metadata.duration || null,
      width: metadata.width || null,
      height: metadata.height || null,
      fps: metadata.fps || null,
    };
  } catch (error) {
    logger.warn("Local metadata probe failed", {
      localPath,
      error: (error as Error).message,
    });
    return {
      duration: extraction.metadata.duration,
      width: extraction.selectedFormat?.width ?? null,
      height: extraction.selectedFormat?.height ?? null,
      fps: extraction.selectedFormat?.fps ?? null,
    };
  }
}

function buildFileName(
  payload: DownloadJobPayload,
  extraction: ExtractResult,
  localPath: string
): string {
  const ext = extname(localPath) || (payload.quality === "audio" ? ".m4a" : ".mp4");
  const title = sanitize(extraction.metadata.title || `${payload.platform}-video`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const base = title || `${payload.platform}-video`;
  return `${base}${ext}`;
}

function inferMimeType(localPath: string, quality: QualityPreset): string {
  const ext = extname(localPath).toLowerCase();

  if (quality === "audio" || ext === ".m4a") return "audio/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mkv") return "video/x-matroska";
  return "video/mp4";
}

function getDownloadErrorCode(error: unknown): string {
  if (error instanceof YtdlpError) {
    if (error.code === "GEO_BLOCKED") return ERROR_CODES.VIDEO_BLOCKED.code;
    if (error.code === "AGE_RESTRICTED") return ERROR_CODES.PRIVATE_VIDEO.code;
    if (error.code in ERROR_CODES) return error.code;
  }

  return ERROR_CODES.EXTRACTION_FAILED.code;
}
