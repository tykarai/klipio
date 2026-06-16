/**
 * yt-dlp Wrapper Module for klipio.io
 *
 * Executes yt-dlp on a remote Cloudways VPS via SSH to extract
 * direct video URLs and metadata from social media platforms.
 *
 * Supports: TikTok, Instagram, Facebook, YouTube, Twitter/X
 * Handles different quality options (HD, SD, audio-only)
 * Implements retry logic with proxy rotation
 * Provides comprehensive error handling for private/blocked videos
 */

import { config, createLogger, QUALITY_PRESETS } from "./config";
import type { QualityPreset, SupportedPlatform } from "./config";
import {
  withProxyFallback,
} from "./proxy";
import { mkdir } from "fs/promises";
import { dirname } from "path";

const logger = createLogger("ytdlp");

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface VideoMetadata {
  id: string;
  title: string;
  description: string | null;
  duration: number | null; // seconds
  thumbnail: string | null;
  uploader: string | null;
  uploaderUrl: string | null;
  uploadDate: string | null; // YYYYMMDD
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  webpageUrl: string;
  originalUrl: string;
  extractor: string; // platform extractor used
  formats: VideoFormat[];
  subtitles: Record<string, Array<{ url: string; name: string }>>;
  chapters: Array<{ startTime: number; title: string }> | null;
  tags: string[] | null;
  categories: string[] | null;
  language: string | null;
  ageLimit: number | null;
  liveStatus: "is_live" | "was_live" | "not_live" | null;
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string; // e.g., "1920x1080"
  width: number | null;
  height: number | null;
  fps: number | null;
  filesize: number | null;
  filesizeApprox: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  quality: number;
  hasVideo: boolean;
  hasAudio: boolean;
  url: string | null; // direct URL (only populated when requested)
  abr: number | null; // audio bitrate
  vbr: number | null; // video bitrate
  asr: number | null; // audio sampling rate
}

export interface ExtractResult {
  metadata: VideoMetadata;
  selectedFormat: VideoFormat | null;
  directUrl: string | null;
  thumbnailUrl: string | null;
  platform: SupportedPlatform;
}

export interface ExtractionOptions {
  quality?: QualityPreset;
  extractAudio?: boolean;
  startTime?: number; // seconds
  endTime?: number; // seconds
  proxyArg?: string | null;
  extractSubtitles?: boolean;
  extractChapters?: boolean;
}

export type ExtractionError =
  | "PRIVATE_VIDEO"
  | "VIDEO_BLOCKED"
  | "VIDEO_NOT_FOUND"
  | "GEO_BLOCKED"
  | "AGE_RESTRICTED"
  | "LIVE_VIDEO"
  | "RATE_LIMITED"
  | "EXTRACTION_FAILED"
  | "PROXY_UNREACHABLE";

export class YtdlpError extends Error {
  public readonly code: ExtractionError;
  public readonly originalError: string;
  public readonly platform: string;

  constructor(opts: {
    code: ExtractionError;
    message: string;
    originalError?: string;
    platform: string;
  }) {
    super(opts.message);
    this.name = "YtdlpError";
    this.code = opts.code;
    this.originalError = opts.originalError || opts.message;
    this.platform = opts.platform;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SSH CONNECTION MANAGEMENT (Dynamic Import)
// ═══════════════════════════════════════════════════════════════

/** Persistent SSH connection pool (lazy-initialized). */
const sshPool = new Map<string, any>();

async function getSSHConnection(poolKey = "default"): Promise<any> {
  const existing = sshPool.get(poolKey);
  if (existing && existing.isConnected()) {
    return existing;
  }

  // Dynamic import to avoid bundling ssh2 in client builds
  const { NodeSSH } = await import("node-ssh");
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: config.vps.host,
      port: config.vps.port,
      username: config.vps.user,
      privateKey: config.vps.privateKey,
      passphrase: config.vps.passphrase,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
    });

    sshPool.set(poolKey, ssh);
    logger.debug(`SSH connection established (${poolKey})`);
    return ssh;
  } catch (error) {
    logger.error("SSH connection failed", {
      host: config.vps.host,
      error: (error as Error).message,
    });
    throw new YtdlpError({
      code: "EXTRACTION_FAILED",
      message: `Failed to connect to extraction server: ${(error as Error).message}`,
      platform: "unknown",
    });
  }
}

/**
 * Close all SSH connections. Call on shutdown.
 */
export async function closeSSHConnections(): Promise<void> {
  for (const [key, ssh] of sshPool.entries()) {
    if (ssh.isConnected()) {
      ssh.dispose();
      logger.debug(`SSH connection closed (${key})`);
    }
  }
  sshPool.clear();
}

// ═══════════════════════════════════════════════════════════════
//  COMMAND EXECUTION
// ═══════════════════════════════════════════════════════════════

interface SSHExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

async function execOnVPS(
  command: string,
  timeoutMs = 120000
): Promise<SSHExecResult> {
  const ssh = await getSSHConnection();
  const start = Date.now();

  try {
    const result = await ssh.execCommand(command, {
      cwd: "/tmp",
      execOptions: {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        } as NodeJS.ProcessEnv,
      },
      // Use a generous timeout for long extractions
      onChannel: (channel: any) => {
        // Force close after timeout
        const timer = setTimeout(() => {
          channel.close();
          logger.warn("SSH command timed out, channel force-closed");
        }, timeoutMs);

        channel.on("close", () => {
          clearTimeout(timer);
        });
      },
    });

    const elapsed = Date.now() - start;
    logger.debug(`VPS command completed in ${elapsed}ms`, {
      exitCode: result.code,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
      signal: null,
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    logger.error(`VPS command failed after ${elapsed}ms`, {
      command: command.slice(0, 200),
      error: (error as Error).message,
    });
    throw error;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildShellCommand(args: string[]): string {
  return args.map(shellQuote).join(" ");
}

function assertSafeRemotePath(remotePath: string): void {
  if (!remotePath.startsWith("/tmp/klipio/")) {
    throw new Error(`Refusing to operate outside /tmp/klipio: ${remotePath}`);
  }
}

export async function ensureRemoteDir(remoteDir: string): Promise<void> {
  assertSafeRemotePath(remoteDir.endsWith("/") ? remoteDir : `${remoteDir}/`);
  const result = await execOnVPS(`mkdir -p ${shellQuote(remoteDir)}`, 30000);
  if (result.code !== 0) {
    throw new YtdlpError({
      code: "EXTRACTION_FAILED",
      message: `Failed to create remote directory: ${result.stderr || result.stdout}`,
      platform: "unknown",
    });
  }
}

export async function fetchRemoteFile(
  remotePath: string,
  localPath: string
): Promise<void> {
  assertSafeRemotePath(remotePath);
  await mkdir(dirname(localPath), { recursive: true });
  const ssh = await getSSHConnection();
  await ssh.getFile(localPath, remotePath);
}

export async function removeRemotePath(remotePath: string): Promise<void> {
  assertSafeRemotePath(remotePath);
  await execOnVPS(`rm -rf ${shellQuote(remotePath)}`, 30000).catch((error) => {
    logger.warn("Remote cleanup failed", {
      remotePath,
      error: (error as Error).message,
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  YT-DLP COMMAND BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildYtDlpArgs(
  url: string,
  options: ExtractionOptions = {}
): string[] {
  const args = [
    config.ytdlp.path,
    ...config.ytdlp.globalArgs,
  ];

  // Proxy
  if (options.proxyArg) {
    args.push("--proxy", options.proxyArg);
  }

  // Quality selection
  const quality = options.quality || "hd";
  const preset = QUALITY_PRESETS[quality];

  if (options.extractAudio) {
    args.push("-f", "bestaudio/best");
    args.push("--extract-audio");
    args.push("--audio-format", "m4a");
    args.push("--audio-quality", "0"); // best
  } else {
    args.push("-f", preset.format);
  }

  // Time range (for trimming)
  if (options.startTime !== undefined) {
    args.push("--download-sections", `*${options.startTime}-${options.endTime || "inf"}`);
  }

  // Subtitles
  if (options.extractSubtitles) {
    args.push("--write-subs");
    args.push("--sub-langs", "en,es,fr,de,zh,ja,ko,auto");
    args.push("--sub-format", "srt");
  }

  // Chapters
  if (options.extractChapters) {
    args.push("--write-info-json");
  }

  // Output: stdout for video, --dump-json for metadata
  args.push("--dump-json");
  args.push("--no-download");

  // Add the URL last
  args.push(url);

  return args;
}

function buildYtDlpDownloadArgs(
  url: string,
  outputPath: string,
  options: ExtractionOptions = {}
): string[] {
  const args = [
    config.ytdlp.path,
    ...config.ytdlp.globalArgs,
  ];

  if (options.proxyArg) {
    args.push("--proxy", options.proxyArg);
  }

  const quality = options.quality || "hd";
  const preset = QUALITY_PRESETS[quality];

  if (options.extractAudio) {
    args.push("-f", "bestaudio/best");
    args.push("--extract-audio");
    args.push("--audio-format", "m4a");
    args.push("--audio-quality", "0");
  } else {
    args.push("-f", preset.format);
  }

  if (options.startTime !== undefined) {
    args.push("--download-sections", `*${options.startTime}-${options.endTime || "inf"}`);
  }

  args.push("-o", outputPath);
  args.push(url);

  return args;
}

// ═══════════════════════════════════════════════════════════════
//  ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: ExtractionError;
  message: string;
}> = [
  {
    pattern: /private|sign in|log in|login required|This video is private|Content Warning|Age-restricted/i,
    code: "PRIVATE_VIDEO",
    message: "This video is private, age-restricted, or requires authentication.",
  },
  {
    pattern: /not available|video unavailable|This content isn't available|has been removed|deleted|Not Found|404/i,
    code: "VIDEO_NOT_FOUND",
    message: "The video could not be found. It may have been deleted.",
  },
  {
    pattern: /blocked|restriction|geo|region|country|unavailable in your|content not available/i,
    code: "GEO_BLOCKED",
    message: "This video is blocked in your region.",
  },
  {
    pattern: /live stream|is live|live video/i,
    code: "LIVE_VIDEO",
    message: "Live videos cannot be downloaded. Please wait until the stream ends.",
  },
  {
    pattern: /rate limit|too many requests|429|slow down|throttle/i,
    code: "RATE_LIMITED",
    message: "Rate limited by the platform. Please try again in a few minutes.",
  },
  {
    pattern: /proxy|tunnel|connection refused|timeout|network|unreachable/i,
    code: "PROXY_UNREACHABLE",
    message: "Connection failed. The extraction server may be temporarily unavailable.",
  },
];

function classifyYtDlpError(
  stderr: string,
  stdout: string,
  platform: string
): YtdlpError {
  const combined = `${stderr}\n${stdout}`;

  for (const { pattern, code, message } of ERROR_PATTERNS) {
    if (pattern.test(combined)) {
      return new YtdlpError({
        code,
        message,
        originalError: stderr.slice(0, 500),
        platform,
      });
    }
  }

  // Default to generic extraction failure
  return new YtdlpError({
    code: "EXTRACTION_FAILED",
    message: `Failed to extract video: ${stderr.slice(0, 200)}`,
    originalError: stderr.slice(0, 500),
    platform,
  });
}

// ═══════════════════════════════════════════════════════════════
//  METADATA PARSING
// ═══════════════════════════════════════════════════════════════

function parseYtDlpJson(jsonStr: string): VideoMetadata {
  try {
    const raw = JSON.parse(jsonStr);

    const formats: VideoFormat[] = (raw.formats || []).map((f: Record<string, unknown>) => ({
      formatId: String(f.format_id || ""),
      ext: String(f.ext || "mp4"),
      resolution: String(f.resolution || ""),
      width: f.width ? Number(f.width) : null,
      height: f.height ? Number(f.height) : null,
      fps: f.fps ? Number(f.fps) : null,
      filesize: f.filesize ? Number(f.filesize) : null,
      filesizeApprox: f.filesize_approx ? Number(f.filesize_approx) : null,
      videoCodec: f.vcodec ? String(f.vcodec) : null,
      audioCodec: f.acodec ? String(f.acodec) : null,
      quality: f.quality ? Number(f.quality) : 0,
      hasVideo: f.vcodec !== "none" && f.video_ext !== "none",
      hasAudio: f.acodec !== "none" && f.audio_ext !== "none",
      url: f.url ? String(f.url) : null,
      abr: f.abr ? Number(f.abr) : null,
      vbr: f.vbr ? Number(f.vbr) : null,
      asr: f.asr ? Number(f.asr) : null,
    }));

    // Parse subtitles
    const subtitles: VideoMetadata["subtitles"] = {};
    if (raw.subtitles && typeof raw.subtitles === "object") {
      for (const [lang, subs] of Object.entries(raw.subtitles)) {
        subtitles[lang] = (subs as Array<{ url: string; name: string }>).map(
          (s) => ({ url: s.url, name: s.name })
        );
      }
    }

    // Parse chapters
    const chapters = raw.chapters
      ? (raw.chapters as Array<{ start_time: number; title: string }>).map(
          (c) => ({ startTime: c.start_time, title: c.title })
        )
      : null;

    return {
      id: String(raw.id || ""),
      title: String(raw.title || raw.fulltitle || "Untitled"),
      description: raw.description ? String(raw.description) : null,
      duration: raw.duration ? Number(raw.duration) : null,
      thumbnail: raw.thumbnail ? String(raw.thumbnail) : null,
      uploader: raw.uploader ? String(raw.uploader) : null,
      uploaderUrl: raw.uploader_url ? String(raw.uploader_url) : null,
      uploadDate: raw.upload_date ? String(raw.upload_date) : null,
      viewCount: raw.view_count ? Number(raw.view_count) : null,
      likeCount: raw.like_count ? Number(raw.like_count) : null,
      commentCount: raw.comment_count ? Number(raw.comment_count) : null,
      webpageUrl: String(raw.webpage_url || raw.original_url || ""),
      originalUrl: String(raw.original_url || raw.webpage_url || ""),
      extractor: String(raw.extractor || "generic"),
      formats,
      subtitles,
      chapters,
      tags: raw.tags || null,
      categories: raw.categories || null,
      language: raw.language ? String(raw.language) : null,
      ageLimit: raw.age_limit ? Number(raw.age_limit) : null,
      liveStatus: raw.is_live
        ? "is_live"
        : raw.was_live
          ? "was_live"
          : "not_live",
    };
  } catch (error) {
    logger.error("Failed to parse yt-dlp JSON output", {
      error: (error as Error).message,
      preview: jsonStr.slice(0, 200),
    });
    throw new YtdlpError({
      code: "EXTRACTION_FAILED",
      message: "Failed to parse extraction result",
      platform: "unknown",
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  FORMAT SELECTION
// ═══════════════════════════════════════════════════════════════

function selectBestFormat(
  formats: VideoFormat[],
  quality: QualityPreset,
  extractAudio: boolean
): VideoFormat | null {
  if (!formats || formats.length === 0) return null;

  // Filter by audio/video requirements
  let candidates = formats;
  if (extractAudio) {
    candidates = formats.filter((f) => f.hasAudio);
  } else {
    candidates = formats.filter((f) => f.hasVideo);
  }

  if (candidates.length === 0) return null;

  // Sort by quality score
  const preset = QUALITY_PRESETS[quality];
  candidates.sort((a, b) => {
    // Prefer formats matching target quality
    const aMatch = a.height && a.height <= preset.height ? 1 : 0;
    const bMatch = b.height && b.height <= preset.height ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;

    // Then by resolution (higher is better)
    const aPixels = (a.width || 0) * (a.height || 0);
    const bPixels = (b.width || 0) * (b.height || 0);
    return bPixels - aPixels;
  });

  return candidates[0];
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Extract metadata from a video URL without downloading
 */
export async function extractMetadata(
  url: string,
  platform: SupportedPlatform,
  options: ExtractionOptions = {}
): Promise<ExtractResult> {
  const startTime = Date.now();
  logger.info(`Extracting metadata`, { url: url.slice(0, 100), platform });

  try {
    const result = await withProxyFallback(async (proxyArg) => {
      const args = buildYtDlpArgs(url, { ...options, proxyArg });
      const execResult = await execOnVPS(buildShellCommand(args), 120000);
      if (execResult.code !== 0) {
        throw classifyYtDlpError(execResult.stderr, execResult.stdout, platform);
      }
      return execResult;
    });

    // Parse metadata
    const metadata = parseYtDlpJson(result.stdout);

    // Select best format
    const selectedFormat = selectBestFormat(
      metadata.formats,
      options.quality || "hd",
      options.extractAudio || false
    );

    // Get direct URL for selected format
    let directUrl: string | null = null;
    if (selectedFormat && selectedFormat.url) {
      directUrl = selectedFormat.url;
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Metadata extraction complete`, {
      elapsedMs: elapsed,
      title: metadata.title.slice(0, 60),
      formats: metadata.formats.length,
    });

    return {
      metadata,
      selectedFormat,
      directUrl,
      thumbnailUrl: metadata.thumbnail,
      platform,
    };
  } catch (error) {
    if (error instanceof YtdlpError) throw error;

    logger.error(`Extraction error`, {
      url: url.slice(0, 100),
      error: (error as Error).message,
    });

    throw new YtdlpError({
      code: "EXTRACTION_FAILED",
      message: `Failed to extract video metadata: ${(error as Error).message}`,
      originalError: (error as Error).message,
      platform,
    });
  }
}

/**
 * Download a video to the VPS and return the local path
 */
export async function downloadVideo(
  url: string,
  outputDir: string,
  options: ExtractionOptions = {}
): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.%(ext)s`;
  const outputPath = `${outputDir}/${fileName}`;

  await ensureRemoteDir(outputDir);

  logger.info(`Starting download`, { url: url.slice(0, 100), outputPath });

  const result = await withProxyFallback(async (proxyArg) => {
    const args = buildYtDlpDownloadArgs(url, outputPath, { ...options, proxyArg });
    const execResult = await execOnVPS(buildShellCommand(args), 300000);
    if (execResult.code !== 0) {
      throw classifyYtDlpError(execResult.stderr, execResult.stdout, "unknown");
    }
    return execResult;
  }); // 5 min timeout

  // Parse output to find actual file path. yt-dlp may download separate
  // streams and then merge into a final path.
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const pathPatterns = [
    /Merging formats into "([^"]+)"/,
    /Destination:\s+(.+)$/m,
    /\[download\]\s+(.+?)\s+has already been downloaded/,
  ];

  for (const pattern of pathPatterns) {
    const match = combinedOutput.match(pattern);
    const actualPath = match?.[1]?.trim();
    if (actualPath) {
      return actualPath;
    }
  }

  return outputPath.replace("%(ext)s", "mp4");
}

/**
 * Get direct download URL without downloading
 */
export async function getDirectUrl(
  url: string,
  quality: QualityPreset = "hd"
): Promise<{ url: string; format: VideoFormat }> {
  const result = await extractMetadata(url, "youtube", { quality });

  if (!result.selectedFormat || !result.selectedFormat.url) {
    throw new YtdlpError({
      code: "EXTRACTION_FAILED",
      message: "Could not get direct URL for this video",
      platform: "unknown",
    });
  }

  return {
    url: result.selectedFormat.url,
    format: result.selectedFormat,
  };
}
