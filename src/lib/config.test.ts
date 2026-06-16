import { describe, expect, it } from "vitest";
import {
  DOWNLOAD_STATUSES,
  detectPlatform,
  normalizePrivateKey,
  PLATFORM_PATTERNS,
  QUALITY_PRESETS,
  QUEUE_JOB_STATUSES,
} from "./config";

describe("download architecture config", () => {
  it("keeps download lifecycle statuses separate from queue statuses", () => {
    expect(DOWNLOAD_STATUSES).toContain("ready");
    expect(DOWNLOAD_STATUSES).toContain("expired");
    expect(DOWNLOAD_STATUSES).not.toContain("dead_letter");

    expect(QUEUE_JOB_STATUSES).toContain("processing");
    expect(QUEUE_JOB_STATUSES).toContain("dead_letter");
    expect(QUEUE_JOB_STATUSES).not.toContain("ready");
  });

  it("recognizes core supported platform URLs", () => {
    expect(PLATFORM_PATTERNS.youtube.test("https://www.youtube.com/watch?v=BaW_jenozKc")).toBe(true);
    expect(PLATFORM_PATTERNS.tiktok.test("https://www.tiktok.com/@demo/video/123456789")).toBe(true);
    expect(PLATFORM_PATTERNS.instagram.test("https://www.instagram.com/reel/ABC123/")).toBe(true);
    expect(detectPlatform("https://www.youtube.com/watch?v=BaW_jenozKc")).toBe("youtube");
  });

  it("defines bounded quality presets for worker downloads", () => {
    expect(QUALITY_PRESETS.hd.height).toBe(1080);
    expect(QUALITY_PRESETS.sd.height).toBe(720);
    expect(QUALITY_PRESETS["audio"].format).toBe("bestaudio/best");
  });

  it("normalizes Vercel-style escaped private keys", () => {
    expect(normalizePrivateKey('"-----BEGIN KEY-----\\nbody\\n-----END KEY-----"')).toBe(
      "-----BEGIN KEY-----\nbody\n-----END KEY-----"
    );
  });
});
