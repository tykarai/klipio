/**
 * Klipio - OpenRouter Client
 * Unified API for all AI models with automatic fallback, cost tracking,
 * rate limit handling, and streaming support.
 */

import {
  OpenRouterConfig,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterResponse,
  OpenRouterStreamChunk,
  OpenRouterModel,
  ModelCostEntry,
  PipelineError,
} from "@/types/analysis";

// ─── Model Pricing (per 1M tokens, in cents) ──────────────────────────────────

interface ModelPricing {
  inputCentsPer1M: number;
  outputCentsPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-3.5-sonnet": { inputCentsPer1M: 300, outputCentsPer1M: 1500 },
  "anthropic/claude-3-haiku": { inputCentsPer1M: 25, outputCentsPer1M: 125 },
  "google/gemini-2.5-flash-preview": { inputCentsPer1M: 15, outputCentsPer1M: 60 },
  "openai/gpt-4o": { inputCentsPer1M: 500, outputCentsPer1M: 1500 },
  "openai/gpt-4o-mini": { inputCentsPer1M: 15, outputCentsPer1M: 60 },
};

// Default config merged with user-provided
const DEFAULT_CONFIG: Partial<OpenRouterConfig> = {
  baseUrl: "https://openrouter.ai/api/v1",
  defaultModel: "google/gemini-2.5-flash-preview",
  fallbackModels: [
    "anthropic/claude-3-haiku",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
  ],
  maxRetries: 3,
  timeoutMs: 30000,
  budgetCentsPerRequest: 5, // 5 cents max per request
};

// ─── OpenRouter Client ─────────────────────────────────────────────────────────

export class OpenRouterClient {
  private config: OpenRouterConfig;
  private costHistory: ModelCostEntry[] = [];
  private lastRequestTime: number = 0;
  private readonly minRequestIntervalMs = 100; // rate limit spacing

  constructor(config: Partial<OpenRouterConfig> & { apiKey: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as OpenRouterClient["config"];
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Send a chat completion request with automatic model fallback
   */
  async chat(options: {
    messages: OpenRouterMessage[];
    model?: OpenRouterModel;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" | "json_schema"; schema?: unknown };
    budgetCents?: number;
    timeoutMs?: number;
    label?: string; // for cost tracking (e.g. "recipe-extraction")
  }): Promise<OpenRouterResponse> {
    const models = this.buildFallbackChain(options.model);
    const budget = options.budgetCents ?? this.config.budgetCentsPerRequest;
    const timeout = options.timeoutMs ?? this.config.timeoutMs;
    const label = options.label ?? "unknown";

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < models.length; attempt++) {
      const model = models[attempt];
      const isFallback = attempt > 0;

      if (isFallback) {
        console.warn(`[OpenRouter] Falling back to ${model} (attempt ${attempt + 1})`);
        await this.delay(500 * attempt); // stagger fallback attempts
      }

      try {
        const result = await this.request(model, {
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens,
          response_format: options.responseFormat,
        }, timeout, label);

        // Check budget
        if (result.costCents > budget) {
          console.warn(
            `[OpenRouter] Request cost ${result.costCents}c exceeded budget ${budget}c on ${model}`
          );
          // If not last model, try next
          if (attempt < models.length - 1) continue;
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const code = this.classifyError(lastError);

        // Non-retryable errors: skip to next model immediately
        if (code === "AUTH" || code === "INVALID") {
          throw lastError;
        }

        // Rate limit: wait and retry same model
        if (code === "RATE_LIMIT") {
          const retryAfter = this.extractRetryAfter(lastError.message) ?? 2000 * (attempt + 1);
          await this.delay(retryAfter);
          // Retry same model one more time
          try {
            const result = await this.request(model, {
              messages: options.messages,
              temperature: options.temperature ?? 0.3,
              max_tokens: options.maxTokens,
              response_format: options.responseFormat,
            }, timeout, label);
            return result;
          } catch (retryErr) {
            lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
          }
        }

        // Continue to next model
      }
    }

    throw new PipelineError({
      code: "AI_MODEL_UNAVAILABLE",
      message: `All models failed. Last error: ${lastError?.message}`,
      stage: "analyzing",
      recoverable: false,
      cause: lastError,
    });
  }

  /**
   * Send a streaming chat completion request
   */
  async *stream(options: {
    messages: OpenRouterMessage[];
    model?: OpenRouterModel;
    temperature?: number;
    maxTokens?: number;
    label?: string;
  }): AsyncGenerator<OpenRouterStreamChunk> {
    const model = options.model ?? this.config.defaultModel;
    const label = options.label ?? "stream";

    const body: OpenRouterRequest = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
      stream: true,
    };

    const startedAt = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${text}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content ?? "";
            const usage = json.usage;

            if (usage) {
              inputTokens = usage.prompt_tokens ?? inputTokens;
              outputTokens = usage.completion_tokens ?? outputTokens;
            }

            yield {
              content: delta,
              done: false,
              usage: usage
                ? { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens }
                : undefined,
            };
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Final cost entry
      const durationMs = Date.now() - startedAt;
      const costCents = this.calculateCost(model, inputTokens, outputTokens);
      this.costHistory.push({
        model,
        provider: "openrouter",
        inputTokens,
        outputTokens,
        costCents,
        durationMs,
        stage: label,
      });

      yield { content: "", done: true };
    } catch (err) {
      throw new PipelineError({
        code: "AI_MODEL_UNAVAILABLE",
        message: `Streaming failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "analyzing",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Get cost summary for this client instance
   */
  getCostSummary(): {
    totalCents: number;
    totalRequests: number;
    avgDurationMs: number;
    byModel: Record<string, { requests: number; cents: number }>;
    byStage: Record<string, { requests: number; cents: number }>;
    history: ModelCostEntry[];
  } {
    const totalCents = this.costHistory.reduce((s, e) => s + e.costCents, 0);
    const totalRequests = this.costHistory.length;
    const avgDurationMs =
      totalRequests > 0
        ? this.costHistory.reduce((s, e) => s + e.durationMs, 0) / totalRequests
        : 0;

    const byModel: Record<string, { requests: number; cents: number }> = {};
    const byStage: Record<string, { requests: number; cents: number }> = {};

    for (const entry of this.costHistory) {
      byModel[entry.model] = byModel[entry.model] ?? { requests: 0, cents: 0 };
      byModel[entry.model].requests++;
      byModel[entry.model].cents += entry.costCents;

      byStage[entry.stage] = byStage[entry.stage] ?? { requests: 0, cents: 0 };
      byStage[entry.stage].requests++;
      byStage[entry.stage].cents += entry.costCents;
    }

    return { totalCents, totalRequests, avgDurationMs, byModel, byStage, history: this.costHistory };
  }

  /**
   * Reset cost history
   */
  resetCostHistory(): void {
    this.costHistory = [];
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async request(
    model: string,
    body: Omit<OpenRouterRequest, "model">,
    timeoutMs: number,
    stage: string
  ): Promise<OpenRouterResponse> {
    await this.rateLimitWait();

    const startedAt = Date.now();

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...body, model } satisfies OpenRouterRequest),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter HTTP ${response.status}: ${text}`);
    }

    const json = await response.json();
    const durationMs = Date.now() - startedAt;

    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // OpenRouter provides usage in response, fall back to estimation
    const inputTokens = usage.prompt_tokens ?? this.estimateTokens(body.messages);
    const outputTokens = usage.completion_tokens ?? this.estimateTokensFromText(content);

    const costCents = this.calculateCost(model, inputTokens, outputTokens);

    const result: OpenRouterResponse = {
      id: json.id ?? `gen-${Date.now()}`,
      model: json.model ?? model,
      content,
      usage,
      costCents,
      durationMs,
    };

    this.costHistory.push({
      model,
      provider: "openrouter",
      inputTokens,
      outputTokens,
      costCents,
      durationMs,
      stage,
    });

    this.lastRequestTime = Date.now();
    return result;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "HTTP-Referer": process.env.APP_URL ?? "https://klipio.io",
      "X-Title": "Klipio AI",
    };
  }

  private buildFallbackChain(primary?: string): string[] {
    const models: string[] = [];
    if (primary) models.push(primary);
    if (primary !== this.config.defaultModel) models.push(this.config.defaultModel);
    for (const fb of this.config.fallbackModels) {
      if (!models.includes(fb)) models.push(fb);
    }
    return models;
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      // Default to cheap estimation
      return Math.round((inputTokens * 0.01 + outputTokens * 0.03) * 100) / 100;
    }
    const inputCost = (inputTokens * pricing.inputCentsPer1M) / 1_000_000;
    const outputCost = (outputTokens * pricing.outputCentsPer1M) / 1_000_000;
    return Math.round((inputCost + outputCost) * 100) / 100; // round to 2 decimals (cents)
  }

  private estimateTokens(messages: OpenRouterMessage[]): number {
    // Rough estimation: ~4 chars per token for text, 258 tokens per image
    let total = 0;
    for (const msg of messages) {
      if (typeof msg.content === "string") {
        total += Math.ceil(msg.content.length / 4);
      } else {
        for (const part of msg.content) {
          if (part.type === "text" && part.text) {
            total += Math.ceil(part.text.length / 4);
          } else if (part.type === "image_url") {
            total += 258; // estimated tokens for image
          }
        }
      }
    }
    return total;
  }

  private estimateTokensFromText(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async rateLimitWait(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minRequestIntervalMs) {
      await this.delay(this.minRequestIntervalMs - elapsed);
    }
  }

  private classifyError(err: Error): "AUTH" | "RATE_LIMIT" | "TIMEOUT" | "INVALID" | "UNKNOWN" {
    const msg = err.message.toLowerCase();
    if (msg.includes("401") || msg.includes("auth") || msg.includes("key")) return "AUTH";
    if (msg.includes("429") || msg.includes("rate") || msg.includes("too many")) return "RATE_LIMIT";
    if (msg.includes("timeout") || msg.includes("abort") || msg.includes("signal")) return "TIMEOUT";
    if (msg.includes("400") || msg.includes("invalid")) return "INVALID";
    return "UNKNOWN";
  }

  private extractRetryAfter(message: string): number | null {
    const match = message.match(/retry[_-]?after[:\s]*(\d+)/i);
    if (match) return parseInt(match[1], 10) * 1000;
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

let globalClient: OpenRouterClient | null = null;

export function getOpenRouterClient(config?: Partial<OpenRouterConfig> & { apiKey: string }): OpenRouterClient {
  if (!globalClient || config) {
    globalClient = new OpenRouterClient(config ?? { apiKey: process.env.OPENROUTER_API_KEY! });
  }
  return globalClient;
}

export function createOpenRouterClient(config: { apiKey: string } & Partial<OpenRouterConfig>): OpenRouterClient {
  return new OpenRouterClient(config);
}
