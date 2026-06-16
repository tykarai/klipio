/**
 * Klipio - Key Points Analyzer
 * Extracts main points from transcript, organizes by category, generates summary.
 * Fast single-stage analysis using Claude Haiku for cost efficiency.
 */

import { OpenRouterClient } from "@/lib/openrouter";
import { getCostTracker } from "@/lib/cost-tracker";
import {
  buildKeyPointsPrompt,
  buildQuickSummaryPrompt,
} from "@/lib/prompts/keypoints-prompt";
import { KeyPointsResult, TranscriptResult } from "@/types/analysis";

// ─── Key Points Analyzer ───────────────────────────────────────────────────────

export class KeyPointsAnalyzer {
  private client: OpenRouterClient;
  private costTracker = getCostTracker();

  constructor(client?: OpenRouterClient) {
    this.client = client ?? new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY! });
  }

  /**
   * Analyze transcript for key points
   * Single-stage: Claude Haiku (fastest, cheapest option)
   */
  async analyze(transcript: TranscriptResult): Promise<KeyPointsResult> {
    try {
      const messages = buildKeyPointsPrompt(transcript.text);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: { type: "json_object" },
        budgetCents: 0.5,
        label: "keypoints-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "keypoints-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      if (!parsed) {
        return this.createFallbackResult(transcript);
      }

      return {
        summary: parsed.summary ?? "",
        categories: (parsed.categories ?? []).map((cat: any) => ({
          category: cat.category ?? "General",
          icon: cat.icon,
          points: (cat.points ?? []).map((pt: any) => ({
            text: pt.text ?? "",
            timestamp: pt.timestamp,
            importance: pt.importance ?? "medium",
            context: pt.context,
          })),
        })),
        totalPoints: parsed.totalPoints ?? 0,
        estimatedReadTime: parsed.estimatedReadTime,
      };
    } catch (err) {
      console.warn("[KeyPointsAnalyzer] Extraction failed:", err);
      return this.createFallbackResult(transcript);
    }
  }

  /**
   * Generate a quick summary only (for real-time preview)
   */
  async quickSummary(transcript: TranscriptResult): Promise<string> {
    try {
      const messages = buildQuickSummaryPrompt(transcript.text);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.3,
        maxTokens: 150,
        budgetCents: 0.2,
        label: "keypoints-quick-summary",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "keypoints-quick-summary",
      });

      return response.content.trim();
    } catch {
      return "Unable to generate summary.";
    }
  }

  // ─── Fallback Result ─────────────────────────────────────────────────────────

  private createFallbackResult(transcript: TranscriptResult): KeyPointsResult {
    // Create a basic result from transcript segments
    const points = transcript.segments
      .filter((s) => s.text.length > 20) // meaningful segments only
      .slice(0, 10)
      .map((s) => ({
        text: s.text.slice(0, 200),
        timestamp: s.start,
        importance: "medium" as const,
        context: undefined,
      }));

    return {
      summary: transcript.text.slice(0, 300) + "...",
      categories: [
        {
          category: "Key Points",
          points,
        },
      ],
      totalPoints: points.length,
      estimatedReadTime: `${Math.ceil(points.length * 0.3)} min`,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private safeJsonParse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]!);
        } catch {
          // ignore
        }
      }
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          // ignore
        }
      }
      return null;
    }
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createKeyPointsAnalyzer(client?: OpenRouterClient): KeyPointsAnalyzer {
  return new KeyPointsAnalyzer(client);
}
