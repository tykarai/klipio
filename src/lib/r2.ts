/**
 * Cloudflare R2 Storage Module for klipio.io
 *
 * S3-compatible client for uploading extracted video URLs/metadata,
 * generating signed download URLs, and auto-deleting expired content.
 *
 * R2 provides zero egress fees — perfect for video delivery.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { config, createLogger } from "./config";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

const logger = createLogger("r2");

// ═══════════════════════════════════════════════════════════════
//  S3 CLIENT
// ═══════════════════════════════════════════════════════════════

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!config.r2.accessKeyId || !config.r2.secretAccessKey) {
    throw new Error("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for storage operations");
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.r2.region,
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
      // R2 doesn't support all S3 features — disable checksums
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return s3Client;
}

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface R2UploadResult {
  key: string;
  bucket: string;
  etag: string | undefined;
  size: number;
  contentType: string;
  publicUrl: string | null;
  expiresAt: Date;
}

export interface R2SignedUrlResult {
  downloadUrl: string;
  expiresAt: Date;
  contentType: string | null;
  contentLength: number | null;
  fileName: string | null;
}

export interface R2ObjectMetadata {
  key: string;
  size: number;
  contentType: string | null;
  lastModified: Date | null;
  etag: string | null;
  metadata: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════
//  KEY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a structured R2 key for a download.
 *
 * Format: downloads/{YYYY}/{MM}/{DD}/{platform}_{nanoid}.{ext}
 *
 * This keeps the bucket organized and makes lifecycle rules easy.
 */
export function generateDownloadKey(
  platform: string,
  mimeType: string,
  fileName?: string
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const id = nanoid(12);

  // Determine extension from mimeType or filename
  let ext = "mp4";
  if (mimeType.includes("audio")) ext = "m4a";
  else if (mimeType.includes("webm")) ext = "webm";
  else if (mimeType.includes("mp4")) ext = "mp4";
  else if (fileName) {
    const fileExt = fileName.split(".").pop();
    if (fileExt && fileExt.length <= 5) ext = fileExt;
  }

  const safePlatform = platform.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return `downloads/${year}/${month}/${day}/${safePlatform}_${id}.${ext}`;
}

/**
 * Generate a key for metadata JSON files.
 */
export function generateMetadataKey(downloadKey: string): string {
  return downloadKey.replace(/\.[^.]+$/, "_meta.json");
}

/**
 * Generate a key for thumbnail images.
 */
export function generateThumbnailKey(downloadKey: string): string {
  return downloadKey.replace(/\.[^.]+$/, "_thumb.jpg");
}

// ═══════════════════════════════════════════════════════════════
//  UPLOAD
// ═══════════════════════════════════════════════════════════════

/**
 * Upload a file buffer to R2.
 *
 * @param buffer    — File data
 * @param platform  — Source platform (tiktok, youtube, etc.)
 * @param options   — Upload options (mimeType, fileName, metadata)
 */
export async function uploadToR2(
  buffer: Buffer,
  platform: string,
  options: {
    mimeType?: string;
    fileName?: string;
    metadata?: Record<string, string>;
  } = {}
): Promise<R2UploadResult> {
  const mimeType = options.mimeType || "video/mp4";
  const key = generateDownloadKey(platform, mimeType, options.fileName);
  const expiresAt = new Date(Date.now() + config.r2.expirySeconds * 1000);

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      platform,
      uploadedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      ...(options.fileName ? { originalName: options.fileName } : {}),
      ...options.metadata,
    },
    // R2 lifecycle will handle deletion — this is just informational
    // Expires header tells CDNs not to cache beyond this
    Expires: expiresAt,
  });

  try {
    const result = await getS3Client().send(command);

    logger.info("Uploaded to R2", {
      key,
      bucket: config.r2.bucketName,
      size: buffer.length,
      mimeType,
    });

    return {
      key,
      bucket: config.r2.bucketName,
      etag: result.ETag,
      size: buffer.length,
      contentType: mimeType,
      publicUrl: config.r2.publicUrl
        ? `${config.r2.publicUrl}/${key}`
        : null,
      expiresAt,
    };
  } catch (error) {
    logger.error("R2 upload failed", {
      key,
      error: (error as Error).message,
    });
    throw new Error(
      `Failed to upload to R2: ${(error as Error).message}`
    );
  }
}

/**
 * Upload a local file to R2 using a stream. This avoids buffering large videos
 * in memory inside the worker runtime.
 */
export async function uploadFileToR2(
  filePath: string,
  platform: string,
  options: {
    mimeType?: string;
    fileName?: string;
    metadata?: Record<string, string>;
  } = {}
): Promise<R2UploadResult> {
  const fileStats = await stat(filePath);
  const mimeType = options.mimeType || "video/mp4";
  const key = generateDownloadKey(platform, mimeType, options.fileName);
  const expiresAt = new Date(Date.now() + config.r2.expirySeconds * 1000);

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: fileStats.size,
    ContentType: mimeType,
    Metadata: {
      platform,
      uploadedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      ...(options.fileName ? { originalName: options.fileName } : {}),
      ...options.metadata,
    },
    Expires: expiresAt,
  });

  try {
    const result = await getS3Client().send(command);

    logger.info("Uploaded file to R2", {
      key,
      bucket: config.r2.bucketName,
      size: fileStats.size,
      mimeType,
    });

    return {
      key,
      bucket: config.r2.bucketName,
      etag: result.ETag,
      size: fileStats.size,
      contentType: mimeType,
      publicUrl: config.r2.publicUrl
        ? `${config.r2.publicUrl}/${key}`
        : null,
      expiresAt,
    };
  } catch (error) {
    logger.error("R2 file upload failed", {
      key,
      error: (error as Error).message,
    });
    throw new Error(`Failed to upload file to R2: ${(error as Error).message}`);
  }
}

/**
 * Upload a JSON metadata object to R2 alongside the video file.
 */
export async function uploadMetadata(
  downloadKey: string,
  metadata: Record<string, unknown>
): Promise<string> {
  const key = generateMetadataKey(downloadKey);
  const buffer = Buffer.from(JSON.stringify(metadata, null, 2));

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: "application/json",
    Metadata: {
      type: "metadata",
      associatedKey: downloadKey,
    },
  });

  await getS3Client().send(command);
  logger.debug("Metadata uploaded", { key });

  return key;
}

/**
 * Upload a thumbnail image to R2.
 */
export async function uploadThumbnail(
  downloadKey: string,
  imageBuffer: Buffer
): Promise<string> {
  const key = generateThumbnailKey(downloadKey);

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: imageBuffer,
    ContentType: "image/jpeg",
    Metadata: {
      type: "thumbnail",
      associatedKey: downloadKey,
    },
  });

  await getS3Client().send(command);
  logger.debug("Thumbnail uploaded", { key });

  return key;
}

// ═══════════════════════════════════════════════════════════════
//  SIGNED URLS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a time-limited signed URL for downloading a file from R2.
 *
 * The URL expires after the configured TTL (default 24 hours from upload).
 * This is the primary way users download their videos.
 */
export async function getSignedDownloadUrl(
  key: string,
  options: {
    expirySeconds?: number;
    fileName?: string;
    contentDisposition?: "attachment" | "inline";
  } = {}
): Promise<R2SignedUrlResult> {
  const expirySeconds = options.expirySeconds ?? config.r2.expirySeconds;
  const contentDisposition = options.contentDisposition || "attachment";

  // First, get object metadata
  let metadata: R2ObjectMetadata;
  try {
    metadata = await getObjectMetadata(key);
  } catch {
    // Object doesn't exist or is inaccessible
    throw new Error(`File not found: ${key}`);
  }

  // Build the disposition string
  const disposition =
    contentDisposition === "attachment" && (options.fileName || metadata.metadata?.originalname)
      ? `${contentDisposition}; filename="${encodeURIComponent(
          options.fileName || metadata.metadata?.originalname || key.split("/").pop() || "download"
        ).replace(/%20/g, " ")}"`
      : contentDisposition;

  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    ResponseContentDisposition: disposition,
  });

  try {
    const signedUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: expirySeconds,
    });

    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    logger.debug("Generated signed URL", {
      key,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      downloadUrl: signedUrl,
      expiresAt,
      contentType: metadata.contentType,
      contentLength: metadata.size,
      fileName:
        options.fileName || metadata.metadata?.originalname || key.split("/").pop() || null,
    };
  } catch (error) {
    logger.error("Failed to generate signed URL", {
      key,
      error: (error as Error).message,
    });
    throw new Error(
      `Failed to generate download link: ${(error as Error).message}`
    );
  }
}

/**
 * Get a short-lived signed URL for inline viewing (e.g., video player).
 * Expires in 1 hour.
 */
export async function getInlineUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    ResponseContentDisposition: "inline",
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
}

// ═══════════════════════════════════════════════════════════════
//  METADATA & HEAD
// ═══════════════════════════════════════════════════════════════

/**
 * Get metadata for an object without downloading it.
 */
export async function getObjectMetadata(key: string): Promise<R2ObjectMetadata> {
  const command = new HeadObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
  });

  try {
    const result = await getS3Client().send(command);

    return {
      key,
      size: result.ContentLength || 0,
      contentType: result.ContentType || null,
      lastModified: result.LastModified || null,
      etag: result.ETag || null,
      metadata: (result.Metadata as Record<string, string>) || {},
    };
  } catch (error) {
    logger.error("HeadObject failed", { key, error: (error as Error).message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════════════════════════

/**
 * Delete a single object from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
  });

  await getS3Client().send(command);
  logger.info("Deleted from R2", { key });
}

/**
 * Delete a download and all associated files (video, metadata, thumbnail).
 */
export async function deleteDownloadBundle(downloadKey: string): Promise<void> {
  const keysToDelete = [
    downloadKey,
    generateMetadataKey(downloadKey),
    generateThumbnailKey(downloadKey),
  ];

  await Promise.all(keysToDelete.map((key) => deleteFromR2(key).catch(() => {})));

  logger.info("Deleted download bundle", { downloadKey });
}

// ═══════════════════════════════════════════════════════════════
//  BULK CLEANUP
// ═══════════════════════════════════════════════════════════════

/**
 * List all objects in the downloads prefix.
 * Used by cleanup cron job to find expired files.
 */
export async function listExpiredObjects(
  beforeDate: Date,
  prefix = "downloads/"
): Promise<string[]> {
  const expiredKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.r2.bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const result = await getS3Client().send(command);

    for (const obj of result.Contents || []) {
      if (obj.LastModified && obj.LastModified < beforeDate) {
        expiredKeys.push(obj.Key!);
      }
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return expiredKeys;
}

/**
 * Bulk delete expired objects.
 * Called by the cleanup cron job.
 */
export async function cleanupExpiredObjects(): Promise<number> {
  const expiryCutoff = new Date(
    Date.now() - config.r2.expirySeconds * 1000
  );

  logger.info("Starting R2 cleanup", { cutoff: expiryCutoff.toISOString() });

  const expiredKeys = await listExpiredObjects(expiryCutoff);

  if (expiredKeys.length === 0) {
    logger.info("No expired objects found");
    return 0;
  }

  // Delete in batches of 100 (R2 doesn't support multi-delete, so we parallelize)
  const BATCH_SIZE = 100;
  let deleted = 0;

  for (let i = 0; i < expiredKeys.length; i += BATCH_SIZE) {
    const batch = expiredKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((key) =>
        deleteFromR2(key).catch((err) => {
          logger.warn("Failed to delete expired object", {
            key,
            error: err.message,
          });
        })
      )
    );
    deleted += batch.length;
  }

  logger.info("R2 cleanup complete", { deleted, total: expiredKeys.length });
  return deleted;
}

// ═══════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

/**
 * Verify R2 connectivity.
 */
export async function checkR2Health(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.r2.bucketName,
      MaxKeys: 1,
    });

    await getS3Client().send(command);

    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: (error as Error).message,
    };
  }
}
