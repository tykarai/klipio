/**
 * Klipio - AI Content Understanding Pipeline
 * Core TypeScript type definitions for video analysis
 */

// ─── Content Type Classification ───────────────────────────────────────────────

export type ContentType =
  | "recipe"
  | "travel"
  | "product_review"
  | "educational"
  | "entertainment"
  | "mixed";

export type AnalysisType =
  | "auto"
  | "recipe"
  | "travel"
  | "brand"
  | "keypoints"
  | "full";

// ─── Analysis Job Lifecycle ────────────────────────────────────────────────────

export type JobStatus =
  | "queued"
  | "downloading"
  | "extracting_frames"
  | "transcribing"
  | "analyzing"
  | "fusing"
  | "completed"
  | "failed"
  | "cancelled";

export interface AnalysisJob {
  id: string;
  url: string;
  analysisType: AnalysisType;
  status: JobStatus;
  progress: number; // 0-100
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt?: string;
  error?: string;
  result?: AnalysisResult;
  cost?: CostBreakdown;
}

export interface AnalysisStatus {
  id: string;
  status: JobStatus;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds
  error?: string;
}

// ─── Pipeline Stage Progress ───────────────────────────────────────────────────

export interface PipelineProgress {
  stage: JobStatus;
  progress: number;
  message: string;
  detail?: string;
}

// ─── Cost Tracking ─────────────────────────────────────────────────────────────

export interface CostBreakdown {
  totalCents: number;
  totalDollars: number;
  downloadCents: number;
  transcriptionCents: number;
  visionCents: number;
  textAnalysisCents: number;
  fusionCents: number;
  modelBreakdown: ModelCostEntry[];
  startedAt: string;
  completedAt?: string;
}

export interface ModelCostEntry {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  durationMs: number;
  stage: string;
}

export interface CostBudget {
  dailyLimitCents: number;
  weeklyLimitCents: number;
  monthlyLimitCents: number;
  currentDailyCents: number;
  currentWeeklyCents: number;
  currentMonthlyCents: number;
  alertsEnabled: boolean;
}

// ─── Video Metadata ────────────────────────────────────────────────────────────

export interface VideoMetadata {
  title: string;
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  thumbnail: string; // URL or base64
  platform: VideoPlatform;
  author?: string;
  description?: string;
  uploadDate?: string;
  viewCount?: number;
}

export type VideoPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "facebook"
  | "vimeo"
  | "reddit"
  | "other";

// ─── Transcript ────────────────────────────────────────────────────────────────

export interface TranscriptResult {
  language: string;
  languageConfidence: number;
  text: string;
  segments: TranscriptSegment[];
  words?: WordTimestamp[];
  speakers?: SpeakerSegment[];
  duration: number;
}

export interface TranscriptSegment {
  start: number; // seconds
  end: number; // seconds
  text: string;
  confidence: number;
  speaker?: number;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface SpeakerSegment {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

// ─── Frame Analysis ────────────────────────────────────────────────────────────

export interface FrameData {
  path: string;
  timestamp: number; // seconds into video
  base64?: string; // for API submission
}

export interface VisionAnalysisResult {
  frameTimestamp: number;
  description: string;
  objects: DetectedObject[];
  textDetected: DetectedText[];
  scenes: string[];
  activities: string[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number]; // x1, y1, x2, y2
}

export interface DetectedText {
  text: string;
  confidence: number;
  bbox?: [number, number, number, number];
}

// ─── Recipe ────────────────────────────────────────────────────────────────────

export interface RecipeResult {
  dishName: string;
  confidence: number;
  cuisine?: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: CookingStep[];
  totalCalories?: number;
  prepTime?: string; // e.g. "15 min"
  cookTime?: string; // e.g. "30 min"
  totalTime?: string;
  difficulty: "easy" | "medium" | "hard";
  servings?: number;
  dietaryTags: DietaryTag[];
  nutritionPerServing?: NutritionInfo;
  shoppingLinks: ShoppingLink[];
  tips?: string[];
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit?: string;
  optional: boolean;
  notes?: string;
  calories?: number;
  estimatedPrice?: string;
}

export interface CookingStep {
  step: number;
  instruction: string;
  duration?: string;
  temperature?: string;
  timestamp?: number; // reference to video position
}

export interface NutritionInfo {
  calories: number;
  protein: string; // e.g. "20g"
  carbs: string;
  fat: string;
  fiber?: string;
  sugar?: string;
  sodium?: string;
}

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "keto"
  | "paleo"
  | "halal"
  | "kosher"
  | "low-carb"
  | "high-protein";

export interface ShoppingLink {
  ingredient: string;
  provider: "instacart" | "amazon" | "walmart" | "other";
  url: string;
}

// ─── Travel ────────────────────────────────────────────────────────────────────

export interface TravelResult {
  destination: string;
  confidence: number;
  country: string;
  region?: string;
  coordinates?: { lat: number; lng: number };
  landmarks: Landmark[];
  bestTimeToVisit: string;
  idealDuration?: string;
  attractions: Attraction[];
  activities: string[];
  localCuisine?: string[];
  practicalTips: string[];
  bookingLinks: BookingLink[];
  similarDestinations?: string[];
}

export interface Landmark {
  name: string;
  description: string;
  type: "natural" | "historical" | "cultural" | "modern" | "religious";
  confidence: number;
}

export interface Attraction {
  name: string;
  description: string;
  type: string;
  estimatedPrice?: string;
  duration?: string;
  mustSee: boolean;
}

export interface BookingLink {
  type: "hotel" | "flight" | "tour" | "restaurant" | "experience";
  provider: "booking" | "airbnb" | "expedia" | "tripadvisor" | "viator" | "other";
  url: string;
}

// ─── Brand ─────────────────────────────────────────────────────────────────────

export interface BrandResult {
  name: string;
  confidence: number;
  category: string; // e.g. "electronics", "fashion", "food"
  detectedVia: "logo" | "product" | "text" | "audio" | "combined";
  occurrences: BrandOccurrence[];
  affiliateLink?: AffiliateLink;
  alternatives?: BrandAlternative[];
}

export interface BrandOccurrence {
  timestamp: number;
  frameIndex?: number;
  context: string;
  confidence: number;
}

export interface AffiliateLink {
  provider: "amazon" | "walmart" | "target" | "other";
  url: string;
  estimatedCommission?: string;
}

export interface BrandAlternative {
  name: string;
  priceRange?: string;
  url?: string;
}

// ─── Key Points ────────────────────────────────────────────────────────────────

export interface KeyPointsResult {
  summary: string;
  categories: KeyPointCategory[];
  totalPoints: number;
  estimatedReadTime?: string;
}

export interface KeyPointCategory {
  category: string;
  icon?: string;
  points: KeyPoint[];
}

export interface KeyPoint {
  text: string;
  timestamp?: number;
  importance: "high" | "medium" | "low";
  context?: string;
}

// ─── Final Analysis Result ─────────────────────────────────────────────────────

export interface AnalysisResult {
  contentType: ContentType;
  confidence: number;
  secondaryContentType?: ContentType;
  secondaryConfidence?: number;
  video: VideoMetadata;
  recipe?: RecipeResult;
  travel?: TravelResult;
  brands?: BrandResult[];
  keyPoints?: KeyPointsResult;
  transcript: TranscriptResult;
  fusion: FusionResult;
  processedAt: string; // ISO 8601
  processingTime: number; // seconds
  cacheHit?: boolean;
}

// ─── Fusion Result ─────────────────────────────────────────────────────────────

export interface FusionResult {
  overallSummary: string;
  keyInsights: string[];
  audience: string;
  mood: string;
  contentQuality: "high" | "medium" | "low";
  viralPotential: "high" | "medium" | "low";
  suggestedTags: string[];
  relatedTopics: string[];
}

// ─── API Request/Response ──────────────────────────────────────────────────────

export interface AnalyzeRequest {
  url: string;
  analysisType?: AnalysisType;
  webhookUrl?: string;
  priority?: "low" | "normal" | "high";
}

export interface AnalyzeResponse {
  jobId: string;
  status: JobStatus;
  estimatedTime: number; // seconds
  pollUrl: string;
}

export interface JobStatusResponse {
  job: AnalysisStatus;
  result?: AnalysisResult;
}

// ─── OpenRouter ────────────────────────────────────────────────────────────────

export type OpenRouterModel =
  | "anthropic/claude-3.5-sonnet"
  | "anthropic/claude-3-haiku"
  | "google/gemini-2.5-flash-preview"
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini";

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: OpenRouterModel;
  fallbackModels: OpenRouterModel[];
  maxRetries: number;
  timeoutMs: number;
  budgetCentsPerRequest: number;
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: "low" | "high" | "auto" };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "json_schema"; schema?: unknown };
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  costCents: number;
  durationMs: number;
}

export interface OpenRouterStreamChunk {
  content: string;
  done: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// ─── Deepgram ──────────────────────────────────────────────────────────────────

export interface DeepgramConfig {
  apiKey: string;
  model?: "nova-2" | "nova-1" | "enhanced" | "base";
  language?: string;
  detectLanguage?: boolean;
  diarize?: boolean;
  punctuate?: boolean;
  paragraphs?: boolean;
  utterances?: boolean;
  smart_format?: boolean;
  filler_words?: boolean;
  multichannel?: boolean;
}

// ─── FFmpeg ────────────────────────────────────────────────────────────────────

export interface FFmpegConfig {
  sshHost?: string;
  sshUser?: string;
  sshKeyPath?: string;
  localOutputDir: string;
  frameInterval?: number; // seconds between keyframes
  maxFrames?: number;
  audioFormat?: "mp3" | "wav" | "m4a";
  videoCodec?: string;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  url: string;
  result: AnalysisResult;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
}

// ─── Error Types ───────────────────────────────────────────────────────────────

export type PipelineErrorCode =
  | "DOWNLOAD_FAILED"
  | "INVALID_URL"
  | "VIDEO_TOO_LONG"
  | "FRAME_EXTRACTION_FAILED"
  | "TRANSCRIPTION_FAILED"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_RESPONSE_INVALID"
  | "BUDGET_EXCEEDED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN";

export class PipelineError extends Error {
  public readonly code: PipelineErrorCode;
  public readonly stage: JobStatus;
  public readonly recoverable: boolean;

  constructor(options: {
    code: PipelineErrorCode;
    message: string;
    stage: JobStatus;
    recoverable?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.code = options.code;
    this.stage = options.stage;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
  }
}
