/**
 * Klipio - Cost Tracker
 * Tracks AI API costs per analysis with logging, summaries, and budget alerts.
 * Target: $0.02-0.05 per full analysis.
 */

import { CostBreakdown, ModelCostEntry, CostBudget, PipelineError } from "@/types/analysis";

// ─── Default Pricing (cents per 1M tokens) ────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  "anthropic/claude-3.5-sonnet": { input: 300, output: 1500 },
  "anthropic/claude-3-haiku": { input: 25, output: 125 },
  "google/gemini-2.5-flash-preview": { input: 15, output: 60 },
  "openai/gpt-4o": { input: 500, output: 1500 },
  "openai/gpt-4o-mini": { input: 15, output: 60 },
};

// ─── Deepgram Pricing ──────────────────────────────────────────────────────────

const DEEPGRAM_COST_PER_MINUTE_CENTS = 0.43; // Nova-2

// ─── Default Budgets ────────────────────────────────────────────────────────────

const DEFAULT_BUDGET: CostBudget = {
  dailyLimitCents: 2000, // $20/day
  weeklyLimitCents: 10000, // $100/week
  monthlyLimitCents: 40000, // $400/month
  currentDailyCents: 0,
  currentWeeklyCents: 0,
  currentMonthlyCents: 0,
  alertsEnabled: true,
};

// ─── Storage Backend Interface ─────────────────────────────────────────────────

interface CostStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  incrBy(key: string, amount: number): Promise<number>;
}

// ─── Cost Tracker ──────────────────────────────────────────────────────────────

export class CostTracker {
  private storage: CostStorage;
  private budget: CostBudget;
  private prefix: string;

  constructor(options?: {
    storage?: CostStorage;
    budget?: Partial<CostBudget>;
    keyPrefix?: string;
  }) {
    this.storage = options?.storage ?? new InMemoryStorage();
    this.budget = { ...DEFAULT_BUDGET, ...options?.budget };
    this.prefix = options?.keyPrefix ?? "klipio:cost";
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Record a model API call cost
   */
  async recordModelCost(entry: ModelCostEntry): Promise<void> {
    const key = `${this.prefix}:history`;
    const existing = await this.storage.get(key);
    const history: ModelCostEntry[] = existing ? JSON.parse(existing) : [];
    history.push(entry);
    await this.storage.set(key, JSON.stringify(history), 86400 * 30); // 30 day TTL

    // Update running totals
    await this.storage.incrBy(`${this.prefix}:total`, entry.costCents);
    await this.storage.incrBy(`${this.prefix}:daily:${this.getDateKey()}`, entry.costCents);
    await this.storage.incrBy(`${this.prefix}:weekly:${this.getWeekKey()}`, entry.costCents);
    await this.storage.incrBy(`${this.prefix}:monthly:${this.getMonthKey()}`, entry.costCents);
  }

  /**
   * Record Deepgram transcription cost
   */
  async recordTranscriptionCost(audioDurationSeconds: number): Promise<void> {
    const costCents = (audioDurationSeconds / 60) * DEEPGRAM_COST_PER_MINUTE_CENTS;
    await this.storage.incrBy(`${this.prefix}:transcription:daily:${this.getDateKey()}`, costCents);
    await this.storage.incrBy(`${this.prefix}:daily:${this.getDateKey()}`, costCents);
  }

  /**
   * Get cost breakdown for an analysis job
   */
  async getJobCost(jobId: string): Promise<CostBreakdown | null> {
    const data = await this.storage.get(`${this.prefix}:job:${jobId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Save complete cost breakdown for a job
   */
  async saveJobCost(jobId: string, breakdown: CostBreakdown): Promise<void> {
    await this.storage.set(`${this.prefix}:job:${jobId}`, JSON.stringify(breakdown), 86400 * 7); // 7 day TTL
  }

  /**
   * Build cost breakdown from model entries
   */
  async buildBreakdown(
    jobId: string,
    entries: ModelCostEntry[],
    audioDurationSeconds?: number
  ): Promise<CostBreakdown> {
    const totalAICents = entries.reduce((sum, e) => sum + e.costCents, 0);
    const transcriptionCents = audioDurationSeconds
      ? Math.round((audioDurationSeconds / 60) * DEEPGRAM_COST_PER_MINUTE_CENTS * 100) / 100
      : 0;

    // Split AI costs by stage
    const visionCents = entries
      .filter((e) => e.stage.includes("vision"))
      .reduce((s, e) => s + e.costCents, 0);
    const textCents = entries
      .filter((e) => e.stage.includes("text") || e.stage.includes("transcript"))
      .reduce((s, e) => s + e.costCents, 0);
    const fusionCents = entries
      .filter((e) => e.stage.includes("fusion"))
      .reduce((s, e) => s + e.costCents, 0);

    const totalCents = Math.round((totalAICents + transcriptionCents) * 100) / 100;

    const breakdown: CostBreakdown = {
      totalCents,
      totalDollars: Math.round(totalCents) / 100,
      downloadCents: 0, // yt-dlp is free
      transcriptionCents,
      visionCents: Math.round(visionCents * 100) / 100,
      textAnalysisCents: Math.round(textCents * 100) / 100,
      fusionCents: Math.round(fusionCents * 100) / 100,
      modelBreakdown: entries,
      startedAt: entries[0] ? new Date(Date.now() - entries[0].durationMs).toISOString() : new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await this.saveJobCost(jobId, breakdown);
    return breakdown;
  }

  /**
   * Check if current spending is within budget
   */
  async checkBudget(): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    weeklyRemaining: number;
    monthlyRemaining: number;
    alerts: string[];
  }> {
    const daily = await this.getDailyTotal();
    const weekly = await this.getWeeklyTotal();
    const monthly = await this.getMonthlyTotal();

    const alerts: string[] = [];

    // Daily alert at 80%
    if (this.budget.alertsEnabled && daily > this.budget.dailyLimitCents * 0.8) {
      alerts.push(`Daily budget at ${Math.round((daily / this.budget.dailyLimitCents) * 100)}%`);
    }
    // Weekly alert at 80%
    if (this.budget.alertsEnabled && weekly > this.budget.weeklyLimitCents * 0.8) {
      alerts.push(`Weekly budget at ${Math.round((weekly / this.budget.weeklyLimitCents) * 100)}%`);
    }
    // Monthly alert at 80%
    if (this.budget.alertsEnabled && monthly > this.budget.monthlyLimitCents * 0.8) {
      alerts.push(`Monthly budget at ${Math.round((monthly / this.budget.monthlyLimitCents) * 100)}%`);
    }

    const allowed =
      daily < this.budget.dailyLimitCents &&
      weekly < this.budget.weeklyLimitCents &&
      monthly < this.budget.monthlyLimitCents;

    return {
      allowed,
      dailyRemaining: Math.max(0, this.budget.dailyLimitCents - daily),
      weeklyRemaining: Math.max(0, this.budget.weeklyLimitCents - weekly),
      monthlyRemaining: Math.max(0, this.budget.monthlyLimitCents - monthly),
      alerts,
    };
  }

  /**
   * Get daily cost summary
   */
  async getDailyTotal(date?: string): Promise<number> {
    const key = `${this.prefix}:daily:${date ?? this.getDateKey()}`;
    const val = await this.storage.get(key);
    return val ? parseFloat(val) : 0;
  }

  /**
   * Get weekly cost summary
   */
  async getWeeklyTotal(week?: string): Promise<number> {
    const key = `${this.prefix}:weekly:${week ?? this.getWeekKey()}`;
    const val = await this.storage.get(key);
    return val ? parseFloat(val) : 0;
  }

  /**
   * Get monthly cost summary
   */
  async getMonthlyTotal(month?: string): Promise<number> {
    const key = `${this.prefix}:monthly:${month ?? this.getMonthKey()}`;
    const val = await this.storage.get(key);
    return val ? parseFloat(val) : 0;
  }

  /**
   * Get cost summary for a date range
   */
  async getSummary(): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    totalAllTime: number;
    budget: CostBudget;
    status: "ok" | "warning" | "exceeded";
  }> {
    const [today, thisWeek, thisMonth, totalAllTime] = await Promise.all([
      this.getDailyTotal(),
      this.getWeeklyTotal(),
      this.getMonthlyTotal(),
      this.getTotalAllTime(),
    ]);

    let status: "ok" | "warning" | "exceeded" = "ok";
    if (today > this.budget.dailyLimitCents || thisWeek > this.budget.weeklyLimitCents) {
      status = "exceeded";
    } else if (today > this.budget.dailyLimitCents * 0.8 || thisWeek > this.budget.weeklyLimitCents * 0.8) {
      status = "warning";
    }

    return { today, thisWeek, thisMonth, totalAllTime, budget: this.budget, status };
  }

  /**
   * Reset all cost tracking data
   */
  async reset(): Promise<void> {
    // This is a no-op for most storage backends
    // Implement in subclass if needed
  }

  // ─── Static Cost Estimation ──────────────────────────────────────────────────

  /**
   * Estimate cost for a video analysis before running it
   */
  static estimateAnalysisCost(videoDurationSeconds: number): {
    totalCents: number;
    breakdown: { transcription: number; vision: number; text: number; fusion: number };
  } {
    const durationMin = videoDurationSeconds / 60;

    // Deepgram transcription
    const transcription = Math.round(durationMin * DEEPGRAM_COST_PER_MINUTE_CENTS * 100) / 100;

    // Gemini Flash vision: ~258 tokens per image, 8 images avg, ~15c per 1M input
    const imageTokens = 8 * 258;
    const vision = Math.round((imageTokens * 15) / 1_000_000 * 100) / 100;

    // Claude Haiku text: transcript ~1K tokens/30s, ~125c per 1M output
    const textInputTokens = Math.ceil((videoDurationSeconds / 30) * 1000);
    const text = Math.round((textInputTokens * 25 + 500 * 125) / 1_000_000 * 100) / 100;

    // Fusion: ~2K input, ~1K output
    const fusion = Math.round((2000 * 25 + 1000 * 125) / 1_000_000 * 100) / 100;

    const totalCents = Math.round((transcription + vision + text + fusion) * 100) / 100;

    return {
      totalCents,
      breakdown: { transcription, vision, text, fusion },
    };
  }

  static getPricing(model: string): { input: number; output: number } {
    return PRICING[model] ?? { input: 25, output: 125 }; // default to Haiku pricing
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async getTotalAllTime(): Promise<number> {
    const val = await this.storage.get(`${this.prefix}:total`);
    return val ? parseFloat(val) : 0;
  }

  private getDateKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private getWeekKey(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil(days / 7);
    return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  private getMonthKey(): string {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  }
}

// ─── In-Memory Storage (default, for development/testing) ──────────────────────

class InMemoryStorage implements CostStorage {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async incrBy(key: string, amount: number): Promise<number> {
    const current = parseFloat((await this.get(key)) ?? "0");
    const next = Math.round((current + amount) * 100) / 100;
    await this.set(key, String(next));
    return next;
  }
}

// ─── Redis Storage (for production) ────────────────────────────────────────────

export class RedisStorage implements CostStorage {
  private redis: any; // ioredis or redis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.redis.incrbyfloat(key, amount);
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

let globalTracker: CostTracker | null = null;

export function getCostTracker(options?: ConstructorParameters<typeof CostTracker>[0]): CostTracker {
  if (!globalTracker || options) {
    globalTracker = new CostTracker(options);
  }
  return globalTracker;
}
