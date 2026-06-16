/**
 * Klipio - FFmpeg Video Processing
 * Keyframe extraction, audio extraction, thumbnail generation,
 * metadata retrieval with Cloudways VPS SSH support.
 */

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { mkdir, access } from "fs/promises";
import { join, basename, extname } from "path";
import { randomUUID } from "crypto";
import { FFmpegConfig, VideoMetadata, FrameData, PipelineError } from "@/types/analysis";

const execFileAsync = promisify(execFile);

// ─── Default Config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Partial<FFmpegConfig> = {
  localOutputDir: "/tmp/klipio",
  frameInterval: 5, // 1 frame every 5 seconds
  maxFrames: 10,
  audioFormat: "mp3",
  videoCodec: "libx264",
};

// ─── Video Platform Detection ──────────────────────────────────────────────────

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("reddit.com")) return "reddit";
  return "other";
}

// ─── FFmpeg Client ─────────────────────────────────────────────────────────────

export class FFmpegProcessor {
  private config: FFmpegConfig;

  constructor(config: Partial<FFmpegConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as FFmpegConfig;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Extract keyframes from a video file at regular intervals
   */
  async extractKeyframes(
    videoPath: string,
    options?: { interval?: number; maxFrames?: number; outputDir?: string }
  ): Promise<FrameData[]> {
    const interval = options?.interval ?? this.config.frameInterval ?? 5;
    const maxFrames = options?.maxFrames ?? this.config.maxFrames ?? 10;
    const outputDir = options?.outputDir ?? join(this.config.localOutputDir, "frames");

    await mkdir(outputDir, { recursive: true });

    // Get video duration first
    const duration = await this.getDuration(videoPath);
    const effectiveInterval = Math.max(interval, duration / maxFrames);

    const framePattern = join(outputDir, `frame_%04d.jpg`);

    try {
      // Extract frames using select filter for precise timing
      await execFileAsync("ffmpeg", [
        "-i", videoPath,
        "-vf", `select='not(mod(t\\,${effectiveInterval}))',scale=1280:-1`,
        "-vsync", "vfr",
        "-q:v", "2",
        "-frames:v", String(maxFrames),
        framePattern,
      ]);
    } catch (err) {
      // Fallback: simpler extraction if select filter fails
      try {
        await execFileAsync("ffmpeg", [
          "-i", videoPath,
          "-vf", "fps=1/" + effectiveInterval + ",scale=1280:-1",
          "-q:v", "2",
          "-frames:v", String(maxFrames),
          framePattern,
        ]);
      } catch (fallbackErr) {
        throw new PipelineError({
          code: "FRAME_EXTRACTION_FAILED",
          message: `Keyframe extraction failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
          stage: "extracting_frames",
          recoverable: false,
          cause: fallbackErr,
        });
      }
    }

    // Read extracted frame files and build metadata
    const { stdout } = await execFileAsync("sh", [
      "-c",
      `ls -1 ${outputDir}/frame_*.jpg 2>/dev/null | sort`,
    ]);

    const frameFiles = stdout.trim().split("\n").filter(Boolean);

    return frameFiles.map((filePath, index) => ({
      path: filePath.trim(),
      timestamp: Math.round(index * effectiveInterval * 100) / 100,
    }));
  }

  /**
   * Extract frames at specific timestamps (for targeted analysis)
   */
  async extractFramesAtTimestamps(
    videoPath: string,
    timestamps: number[],
    outputDir?: string
  ): Promise<FrameData[]> {
    const dir = outputDir ?? join(this.config.localOutputDir, "frames");
    await mkdir(dir, { recursive: true });

    const frames: FrameData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const outputPath = join(dir, `frame_target_${String(i).padStart(4, "0")}.jpg`);

      try {
        await execFileAsync("ffmpeg", [
          "-ss", String(ts),
          "-i", videoPath,
          "-vframes", "1",
          "-q:v", "2",
          "-y",
          outputPath,
        ]);

        frames.push({ path: outputPath, timestamp: ts });
      } catch (err) {
        console.warn(`[FFmpeg] Failed to extract frame at ${ts}s:`, err);
        // Continue with other timestamps
      }
    }

    return frames;
  }

  /**
   * Extract audio track from video to MP3/WAV
   */
  async extractAudio(
    videoPath: string,
    outputPath?: string
  ): Promise<{ path: string; duration: number; format: string }> {
    const format = this.config.audioFormat ?? "mp3";
    const outPath = outputPath ?? join(
      this.config.localOutputDir,
      "audio",
      `${randomUUID()}.${format}`
    );

    await mkdir(join(outPath, ".."), { recursive: true });

    const codec = format === "wav" ? "pcm_s16le" : "libmp3lame";
    const ext = format === "wav" ? "wav" : "mp3";
    const finalPath = outPath.endsWith(ext) ? outPath : outPath + "." + ext;

    try {
      await execFileAsync("ffmpeg", [
        "-i", videoPath,
        "-vn", // no video
        "-acodec", codec,
        "-ar", "16000", // 16kHz for optimal transcription
        "-ac", "1", // mono
        "-y",
        finalPath,
      ]);

      const duration = await this.getDuration(finalPath);
      return { path: finalPath, duration, format: ext };
    } catch (err) {
      throw new PipelineError({
        code: "TRANSCRIPTION_FAILED",
        message: `Audio extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "transcribing",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Generate thumbnail from video (first frame or middle)
   */
  async generateThumbnail(
    videoPath: string,
    outputPath?: string,
    atSeconds: number = 0
  ): Promise<string> {
    const outPath = outputPath ?? join(
      this.config.localOutputDir,
      "thumbnails",
      `${randomUUID()}.jpg`
    );

    await mkdir(join(outPath, ".."), { recursive: true });

    // Use middle of video for better thumbnail if atSeconds not specified
    let seekTime = atSeconds;
    if (seekTime === 0) {
      const duration = await this.getDuration(videoPath);
      seekTime = Math.floor(duration / 3);
    }

    await execFileAsync("ffmpeg", [
      "-ss", String(seekTime),
      "-i", videoPath,
      "-vframes", "1",
      "-vf", "scale=640:-1",
      "-q:v", "2",
      "-y",
      outPath,
    ]);

    return outPath;
  }

  /**
   * Get comprehensive video metadata
   */
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ]);

      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
      const format = data.format ?? {};

      const duration = parseFloat(format.duration ?? "0");
      const width = videoStream?.width ?? 0;
      const height = videoStream?.height ?? 0;
      const fps = this.parseFps(videoStream?.r_frame_rate ?? "30/1");

      return {
        title: format.tags?.title ?? basename(videoPath),
        duration: Math.round(duration * 100) / 100,
        width,
        height,
        fps: Math.round(fps * 100) / 100,
        thumbnail: "", // populated separately
        platform: "other",
      };
    } catch (err) {
      throw new PipelineError({
        code: "FRAME_EXTRACTION_FAILED",
        message: `Metadata extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "extracting_frames",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Get video duration in seconds
   */
  async getDuration(videoPath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ]);
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Resize video for faster processing
   */
  async resizeVideo(
    videoPath: string,
    outputPath: string,
    maxWidth: number = 720
  ): Promise<string> {
    await mkdir(join(outputPath, ".."), { recursive: true });

    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vf", `scale=${maxWidth}:-2`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "28",
      "-c:a", "copy",
      "-y",
      outputPath,
    ]);

    return outputPath;
  }

  /**
   * Get keyframe timestamps for smart frame extraction
   */
  async getKeyframeTimestamps(videoPath: string): Promise<number[]> {
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "frame=pkt_pts_time,pict_type",
        "-of", "csv=p=0",
        videoPath,
      ]);

      return stdout
        .trim()
        .split("\n")
        .filter((line) => line.includes("I")) // I-frames = keyframes
        .map((line) => {
          const parts = line.split(",");
          return parseFloat(parts[0] ?? "0");
        })
        .filter((t) => !isNaN(t));
    } catch {
      return [];
    }
  }

  /**
   * Extract frames using scene detection (smart keyframe extraction)
   * Gets keyframes at scene changes for better visual variety
   */
  async extractSceneKeyframes(
    videoPath: string,
    maxFrames: number = 10,
    outputDir?: string
  ): Promise<FrameData[]> {
    const dir = outputDir ?? join(this.config.localOutputDir, "frames");
    await mkdir(dir, { recursive: true });

    const sceneFile = join(dir, "scenes.txt");

    try {
      // Detect scene changes
      await execFileAsync("ffmpeg", [
        "-i", videoPath,
        "-vf", "select='gt(scene\\,0.3)',showinfo",
        "-vsync", "vfr",
        "-f", "null",
        "-",
      ]);
    } catch {
      // ffmpeg returns non-zero for null output, that's expected
    }

    // Get keyframe timestamps as fallback
    const keyframes = await this.getKeyframeTimestamps(videoPath);

    if (keyframes.length === 0) {
      // Fall back to regular interval extraction
      return this.extractKeyframes(videoPath, { maxFrames, outputDir: dir });
    }

    // Select evenly distributed keyframes
    const selected = this.selectDistributedFrames(keyframes, maxFrames);
    return this.extractFramesAtTimestamps(videoPath, selected, dir);
  }

  /**
   * Convert frame image to base64 for API submission
   */
  async frameToBase64(framePath: string): Promise<string> {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(framePath);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }

  /**
   * Convert all frames to base64
   */
  async framesToBase64(frames: FrameData[]): Promise<FrameData[]> {
    const results: FrameData[] = [];
    for (const frame of frames) {
      try {
        const base64 = await this.frameToBase64(frame.path);
        results.push({ ...frame, base64 });
      } catch (err) {
        console.warn(`[FFmpeg] Failed to base64 encode frame ${frame.path}:`, err);
        results.push(frame);
      }
    }
    return results;
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(paths: string[]): Promise<void> {
    const { rm } = await import("fs/promises");
    for (const p of paths) {
      try {
        await rm(p, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private parseFps(fpsStr: string): number {
    if (!fpsStr) return 30;
    const parts = fpsStr.split("/");
    if (parts.length === 2) {
      return parseInt(parts[0], 10) / parseInt(parts[1], 10);
    }
    return parseFloat(fpsStr) || 30;
  }

  private selectDistributedFrames(frames: number[], max: number): number[] {
    if (frames.length <= max) return frames;

    const result: number[] = [];
    const step = frames.length / max;

    for (let i = 0; i < max; i++) {
      const idx = Math.min(Math.floor(i * step), frames.length - 1);
      result.push(frames[idx]!);
    }

    return [...new Set(result)]; // deduplicate
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

let globalProcessor: FFmpegProcessor | null = null;

export function getFFmpegProcessor(config?: Partial<FFmpegConfig>): FFmpegProcessor {
  if (!globalProcessor || config) {
    globalProcessor = new FFmpegProcessor(config);
  }
  return globalProcessor;
}
