/**
 * Central Configuration Module for klipio.io
 *
 * All environment variables are validated at startup.
 * Feature flags, rate limits, and platform-specific settings
 * are centralized here for easy management.
 */

import { z } from "zod";

// ─── Environment Variable Schema ──────────────────────────────

const envSchema = z.object({
  // ── Supabase ──
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key required"),

  // ── Cloudflare R2 ──
  R2_ACCOUNT_ID: z.string().min(1, "R2 account ID required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2 access key ID required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2 secret access key required"),
  R2_BUCKET_NAME: z.string().min(1, "R2 bucket name required"),
  R2_PUBLIC_URL: z.string().url("R2 public URL required").optional(),

  // ── Cloudways VPS / yt-dlp SSH ──
  VPS_HOST: z.string().min(1, "VPS host required"),
  VPS_PORT: z.string().default("22"),
  VPS_USER: z.string().min(1, "VPS user required"),
  VPS_PRIVATE_KEY: z.string().min(1, "VPS private key required"),
  VPS_SSH_PASSPHRASE: z.string().optional(),
  YTDLP_PATH: z.string().default("/usr/local/bin/yt-dlp"),
  FFPROBE_PATH: z.string().default("/usr/bin/ffprobe"),
  FFMPEG_PATH: z.string().default("/usr/bin/ffmpeg"),

  // ── Proxy Pool ──
  PROXY_PRIMARY_URL: z.string().url().optional(),
  PROXY_BACKUP_URLS: z.string().optional(), // comma-separated
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),

  // ── Rate Limiting ──
  RATE_LIMIT_ANONYMOUS: z.string().default("10"),
  RATE_LIMIT_REGISTERED: z.string().default("100"),
  RATE_LIMIT_WINDOW_MS: z.string().default("3600000"), // 1 hour

  // ── App Settings ──
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://klipio.io"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ── Feature Flags ──
  ENABLE_ANALYSIS: z.enum(["true", "false"]).default("false"),
  ENABLE_TIKTOK: z.enum(["true", "false"]).default("true"),
  ENABLE_INSTAGRAM: z.enum(["true", "false"]).default("true"),
  ENABLE_FACEBOOK: z.enum(["true", "false"]).default("true"),
  ENABLE_YOUTUBE: z.enum(["true", "false"]).default("true"),
  ENABLE_TWITTER: z.enum(["true", "false"]).default("true"),

  // ── AI Pipeline (future) ──
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  WHISPER_API_URL: z.string().url().optional(),

  // ── Observability ──
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  SENTRY_DSN: z.string().url().optional(),
});

// ─── Parse & Export ───────────────────────────────────────────

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Environment validation failed:\n${issues}\n\n` +
        `Please check your .env file or deployment environment variables.`
    );
  }

  return parsed.data;
}

const raw = loadConfig();

// ─── Typed Exports ────────────────────────────────────────────

export const config = {
  // App
  appUrl: raw.NEXT_PUBLIC_APP_URL,
  nodeEnv: raw.NODE_ENV,
  isDev: raw.NODE_ENV === "development",
  isProd: raw.NODE_ENV === "production",

  // Supabase
  supabase: {
    url: raw.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY,
  },

  // R2
  r2: {
    accountId: raw.R2_ACCOUNT_ID,
    accessKeyId: raw.R2_ACCESS_KEY_ID,
    secretAccessKey: raw.R2_SECRET_ACCESS_KEY,
    bucketName: raw.R2_BUCKET_NAME,
    publicUrl: raw.R2_PUBLIC_URL,
    endpoint: `https://${raw.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
    // Files auto-expire after 24 hours
    expirySeconds: 24 * 60 * 60,
  },

  // VPS / yt-dlp
  vps: {
    host: raw.VPS_HOST,
    port: parseInt(raw.VPS_PORT, 10),
    user: raw.VPS_USER,
    privateKey: raw.VPS_PRIVATE_KEY,
    passphrase: raw.VPS_SSH_PASSPHRASE,
  },

  ytdlp: {
    path: raw.YTDLP_PATH,
    ffprobePath: raw.FFPROBE_PATH,
    ffmpegPath: raw.FFMPEG_PATH,
    // Global options passed to every yt-dlp invocation
    globalArgs: [
      "--no-warnings",
      "--no-check-certificates",
      "--socket-timeout", "30",
      "--retries", "3",
      "--fragment-retries", "3",
      "--skip-unavailable-fragments",
      "--no-overwrites",
    ],
  },

  // Proxy
  proxy: {
    primaryUrl: raw.PROXY_PRIMARY_URL,
    backupUrls: raw.PROXY_BACKUP_URLS ? raw.PROXY_BACKUP_URLS.split(",") : [],
    username: raw.PROXY_USERNAME,
    password: raw.PROXY_PASSWORD,
  },

  // Rate Limiting
  rateLimit: {
    anonymousPerHour: parseInt(raw.RATE_LIMIT_ANONYMOUS, 10),
    registeredPerHour: parseInt(raw.RATE_LIMIT_REGISTERED, 10),
    windowMs: parseInt(raw.RATE_LIMIT_WINDOW_MS, 10),
  },

  // Feature Flags
  features: {
    enableAnalysis: raw.ENABLE_ANALYSIS === "true",
    enableTikTok: raw.ENABLE_TIKTOK === "true",
    enableInstagram: raw.ENABLE_INSTAGRAM === "true",
    enableFacebook: raw.ENABLE_FACEBOOK === "true",
    enableYouTube: raw.ENABLE_YOUTUBE === "true",
    enableTwitter: raw.ENABLE_TWITTER === "true",
  },

  // AI Pipeline
  ai: {
    openaiKey: raw.OPENAI_API_KEY,
    geminiKey: raw.GEMINI_API_KEY,
    whisperUrl: raw.WHISPER_API_URL,
  },

  // Observability
  logLevel: raw.LOG_LEVEL,
  sentryDsn: raw.SENTRY_DSN,
} as const;

// ─── Supported Platforms ──────────────────────────────────────

export const SUPPORTED_PLATFORMS = [
  "tiktok",
  "instagram",
  "facebook",
  "youtube",
  "twitter",
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const PLATFORM_PATTERNS: Record<SupportedPlatform, RegExp> = {
  tiktok: /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/.+/i,
  instagram:
    /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv|stories)\/[\w-]+/i,
  facebook:
    /https?:\/\/(?:www\.|web\.|m\.|fb\.watch\/)?(?:facebook\.com|fb\.watch)\/.+/i,
  youtube:
    /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/i,
  twitter:
    /https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/.+\/status\/\d+/i,
};

// ─── Quality Presets ──────────────────────────────────────────

export const QUALITY_PRESETS = {
  hd: { label: "HD (1080p)", height: 1080, format: "bestvideo[height<=1080]+bestaudio/best" },
  sd: { label: "SD (720p)", height: 720, format: "bestvideo[height<=720]+bestaudio/best" },
  low: { label: "Low (480p)", height: 480, format: "bestvideo[height<=480]+bestaudio/best" },
  audio: { label: "Audio Only", height: 0, format: "bestaudio/best" },
} as const;

export type QualityPreset = keyof typeof QUALITY_PRESETS;

// ─── Job Types ────────────────────────────────────────────────

export const JOB_TYPES = ["extract", "download", "analyze"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "queued",
  "extracting",
  "downloading",
  "processing",
  "ready",
  "failed",
  "expired",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

// ─── Error Codes ──────────────────────────────────────────────

export const ERROR_CODES = {
  INVALID_URL: { code: "INVALID_URL", message: "The provided URL is not valid." },
  UNSUPPORTED_PLATFORM: { code: "UNSUPPORTED_PLATFORM", message: "This platform is not supported yet." },
  PRIVATE_VIDEO: { code: "PRIVATE_VIDEO", message: "This video is private or requires authentication." },
  VIDEO_BLOCKED: { code: "VIDEO_BLOCKED", message: "This video is blocked or unavailable in your region." },
  VIDEO_NOT_FOUND: { code: "VIDEO_NOT_FOUND", message: "The video could not be found. It may have been deleted." },
  RATE_LIMITED: { code: "RATE_LIMITED", message: "You have reached the download limit. Please try again later." },
  EXTRACTION_FAILED: { code: "EXTRACTION_FAILED", message: "Failed to extract video. Please try again." },
  STORAGE_ERROR: { code: "STORAGE_ERROR", message: "Failed to store the video. Please try again." },
  JOB_NOT_FOUND: { code: "JOB_NOT_FOUND", message: "The download job was not found." },
  EXPIRED: { code: "EXPIRED", message: "This download link has expired." },
  SERVER_ERROR: { code: "SERVER_ERROR", message: "An unexpected error occurred. Please try again." },
  PROXY_UNREACHABLE: { code: "PROXY_UNREACHABLE", message: "All proxy endpoints failed. Please try again later." },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ─── i18n Ready Error Messages ────────────────────────────────

export function getErrorMessage(code: ErrorCode, locale = "en") {
  // Extensible for future i18n — load from translation files
  const i18nMessages: Record<string, Record<ErrorCode, string>> = {
    en: {
      INVALID_URL: "The provided URL is not valid.",
      UNSUPPORTED_PLATFORM: "This platform is not supported yet.",
      PRIVATE_VIDEO: "This video is private or requires authentication.",
      VIDEO_BLOCKED: "This video is blocked or unavailable in your region.",
      VIDEO_NOT_FOUND: "The video could not be found. It may have been deleted.",
      RATE_LIMITED: "You have reached the download limit. Please try again later.",
      EXTRACTION_FAILED: "Failed to extract video. Please try again.",
      STORAGE_ERROR: "Failed to store the video. Please try again.",
      JOB_NOT_FOUND: "The download job was not found.",
      EXPIRED: "This download link has expired.",
      SERVER_ERROR: "An unexpected error occurred. Please try again.",
      PROXY_UNREACHABLE: "All proxy endpoints failed. Please try again later.",
    },
    es: {
      INVALID_URL: "La URL proporcionada no es válida.",
      UNSUPPORTED_PLATFORM: "Esta plataforma aún no es compatible.",
      PRIVATE_VIDEO: "Este video es privado o requiere autenticación.",
      VIDEO_BLOCKED: "Este video está bloqueado o no está disponible en tu región.",
      VIDEO_NOT_FOUND: "No se pudo encontrar el video. Puede haber sido eliminado.",
      RATE_LIMITED: "Has alcanzado el límite de descargas. Inténtalo de nuevo más tarde.",
      EXTRACTION_FAILED: "Error al extraer el video. Inténtalo de nuevo.",
      STORAGE_ERROR: "Error al almacenar el video. Inténtalo de nuevo.",
      JOB_NOT_FOUND: "No se encontró el trabajo de descarga.",
      EXPIRED: "Este enlace de descarga ha expirado.",
      SERVER_ERROR: "Ocurrió un error inesperado. Inténtalo de nuevo.",
      PROXY_UNREACHABLE: "Todos los puntos de enlace proxy fallaron. Inténtalo de nuevo más tarde.",
    },
    fr: {
      INVALID_URL: "L'URL fournie n'est pas valide.",
      UNSUPPORTED_PLATFORM: "Cette plateforme n'est pas encore prise en charge.",
      PRIVATE_VIDEO: "Cette vidéo est privée ou nécessite une authentification.",
      VIDEO_BLOCKED: "Cette vidéo est bloquée ou indisponible dans votre région.",
      VIDEO_NOT_FOUND: "La vidéo est introuvable. Elle a peut-être été supprimée.",
      RATE_LIMITED: "Vous avez atteint la limite de téléchargement. Réessayez plus tard.",
      EXTRACTION_FAILED: "Échec de l'extraction de la vidéo. Veuillez réessayer.",
      STORAGE_ERROR: "Échec du stockage de la vidéo. Veuillez réessayer.",
      JOB_NOT_FOUND: "Le travail de téléchargement est introuvable.",
      EXPIRED: "Ce lien de téléchargement a expiré.",
      SERVER_ERROR: "Une erreur inattendue s'est produite. Veuillez réessayer.",
      PROXY_UNREACHABLE: "Tous les points de terminaison proxy ont échoué. Réessayez plus tard.",
    },
    de: {
      INVALID_URL: "Die angegebene URL ist ungültig.",
      UNSUPPORTED_PLATFORM: "Diese Plattform wird noch nicht unterstützt.",
      PRIVATE_VIDEO: "Dieses Video ist privat oder erfordert eine Authentifizierung.",
      VIDEO_BLOCKED: "Dieses Video ist in Ihrer Region blockiert oder nicht verfügbar.",
      VIDEO_NOT_FOUND: "Das Video wurde nicht gefunden. Es wurde möglicherweise gelöscht.",
      RATE_LIMITED: "Sie haben das Download-Limit erreicht. Bitte versuchen Sie es später erneut.",
      EXTRACTION_FAILED: "Videoextraktion fehlgeschlagen. Bitte versuchen Sie es erneut.",
      STORAGE_ERROR: "Videospeicherung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      JOB_NOT_FOUND: "Der Download-Auftrag wurde nicht gefunden.",
      EXPIRED: "Dieser Download-Link ist abgelaufen.",
      SERVER_ERROR: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      PROXY_UNREACHABLE: "Alle Proxy-Endpunkte sind fehlgeschlagen. Bitte versuchen Sie es später erneut.",
    },
    zh: {
      INVALID_URL: "提供的网址无效。",
      UNSUPPORTED_PLATFORM: "此平台尚不支持。",
      PRIVATE_VIDEO: "此视频为私密内容或需要验证。",
      VIDEO_BLOCKED: "此视频在您的地区被屏蔽或不可用。",
      VIDEO_NOT_FOUND: "找不到该视频。可能已被删除。",
      RATE_LIMITED: "您已达到下载限制。请稍后再试。",
      EXTRACTION_FAILED: "视频提取失败。请重试。",
      STORAGE_ERROR: "视频存储失败。请重试。",
      JOB_NOT_FOUND: "未找到下载任务。",
      EXPIRED: "此下载链接已过期。",
      SERVER_ERROR: "发生意外错误。请重试。",
      PROXY_UNREACHABLE: "所有代理端点均失败。请稍后再试。",
    },
    ja: {
      INVALID_URL: "提供されたURLは無効です。",
      UNSUPPORTED_PLATFORM: "このプラットフォームはまだサポートされていません。",
      PRIVATE_VIDEO: "この動画は非公開または認証が必要です。",
      VIDEO_BLOCKED: "この動画はお住まいの地域ではブロックされているか、利用できません。",
      VIDEO_NOT_FOUND: "動画が見つかりません。削除された可能性があります。",
      RATE_LIMITED: "ダウンロード制限に達しました。後でもう一度お試しください。",
      EXTRACTION_FAILED: "動画の抽出に失敗しました。もう一度お試しください。",
      STORAGE_ERROR: "動画の保存に失敗しました。もう一度お試しください。",
      JOB_NOT_FOUND: "ダウンロードジョブが見つかりません。",
      EXPIRED: "このダウンロードリンクは期限切れです。",
      SERVER_ERROR: "予期しないエラーが発生しました。もう一度お試しください。",
      PROXY_UNREACHABLE: "すべてのプロキシエンドポイントが失敗しました。後でもう一度お試しください。",
    },
    ko: {
      INVALID_URL: "제공된 URL이 유효하지 않습니다.",
      UNSUPPORTED_PLATFORM: "이 플랫폼은 아직 지원되지 않습니다.",
      PRIVATE_VIDEO: "이 동영상은 비공개이거나 인증이 필요합니다.",
      VIDEO_BLOCKED: "이 동영상은 귀하의 지역에서 차단되었거나 사용할 수 없습니다.",
      VIDEO_NOT_FOUND: "동영상을 찾을 수 없습니다. 삭제되었을 수 있습니다.",
      RATE_LIMITED: "다운로드 한도에 도달했습니다. 나중에 다시 시도하세요.",
      EXTRACTION_FAILED: "동영상 추출에 실패했습니다. 다시 시도하세요.",
      STORAGE_ERROR: "동영상 저장에 실패했습니다. 다시 시도하세요.",
      JOB_NOT_FOUND: "다운로드 작업을 찾을 수 없습니다.",
      EXPIRED: "이 다운로드 링크가 만료되었습니다.",
      SERVER_ERROR: "예기치 않은 오류가 발생했습니다. 다시 시도하세요.",
      PROXY_UNREACHABLE: "모든 프록시 엔드포인트가 실패했습니다. 나중에 다시 시도하세요.",
    },
  };

  const messages = i18nMessages[locale] || i18nMessages.en;
  return messages[code] || i18nMessages.en[code];
}

// ─── Retry Configuration ──────────────────────────────────────

export const RETRY_CONFIG = {
  maxRetries: 3,
  minTimeout: 2000,
  maxTimeout: 30000,
  factor: 2,
  randomize: true,
} as const;

// ─── Video Expiry ─────────────────────────────────────────────

export const DOWNLOAD_EXPIRY_HOURS = 24;

// ─── Logging Utility ──────────────────────────────────────────

export function createLogger(module: string) {
  const levels = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };
  const currentLevel = levels[config.logLevel] ?? 2;

  function shouldLog(level: keyof typeof levels) {
    return levels[level] >= currentLevel;
  }

  return {
    trace: (msg: string, meta?: Record<string, unknown>) =>
      shouldLog("trace") && console.log(`[TRACE][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
    debug: (msg: string, meta?: Record<string, unknown>) =>
      shouldLog("debug") && console.log(`[DEBUG][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
    info: (msg: string, meta?: Record<string, unknown>) =>
      shouldLog("info") && console.log(`[INFO][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      shouldLog("warn") && console.warn(`[WARN][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
    error: (msg: string, meta?: Record<string, unknown>) =>
      shouldLog("error") && console.error(`[ERROR][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
    fatal: (msg: string, meta?: Record<string, unknown>) =>
      console.error(`[FATAL][${module}] ${msg}`, meta ? JSON.stringify(meta) : ""),
  };
}
