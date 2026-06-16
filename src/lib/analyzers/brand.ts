/**
 * Klipio - Brand Analyzer
 * Detects logos, products, and brand mentions in video frames and transcripts.
 * Generates affiliate links and brand intelligence reports.
 */

import { OpenRouterClient } from "@/lib/openrouter";
import { getCostTracker } from "@/lib/cost-tracker";
import {
  buildBrandVisionPrompt,
  buildBrandTextPrompt,
  buildBrandFusionPrompt,
} from "@/lib/prompts/brand-prompt";
import { BrandResult, FrameData, TranscriptResult, VisionAnalysisResult } from "@/types/analysis";

// ─── Known Brands Database (partial - can be expanded) ─────────────────────────

const KNOWN_BRANDS: Record<string, { category: string; aliases: string[] }> = {
  apple: { category: "electronics", aliases: ["iphone", "ipad", "macbook", "airpods", "apple watch"] },
  samsung: { category: "electronics", aliases: ["galaxy", "samsung tv"] },
  nike: { category: "fashion", aliases: ["nike air", "jordan"] },
  adidas: { category: "fashion", aliases: ["ultraboost", "yeezy"] },
  amazon: { category: "retail", aliases: ["prime", "alexa", "echo"] },
  google: { category: "tech", aliases: ["pixel", "android", "chromebook", "nest"] },
  microsoft: { category: "tech", aliases: ["surface", "xbox", "windows"] },
  sony: { category: "electronics", aliases: ["playstation", "ps5", "wh-1000xm"] },
  lululemon: { category: "fashion", aliases: ["lulu"] },
  tesla: { category: "automotive", aliases: ["model s", "model 3", "model x", "model y", "cybertruck"] },
  "mercedes-benz": { category: "automotive", aliases: ["mercedes", "amg"] },
  bmw: { category: "automotive", aliases: ["m3", "m5"] },
  mac: { category: "beauty", aliases: ["mac cosmetics", "m.a.c"] },
  sephora: { category: "beauty", aliases: [] },
  ulta: { category: "beauty", aliases: [] },
  starbucks: { category: "beverage", aliases: [] },
  mcdonalds: { category: "food", aliases: ["mcdonald's", "big mac"] },
  nike: { category: "fashion", aliases: [] },
  gucci: { category: "fashion", aliases: [] },
  louisvuitton: { category: "fashion", aliases: ["louis vuitton", "lv"] },
  chanel: { category: "fashion", aliases: [] },
  prada: { category: "fashion", aliases: [] },
  zara: { category: "fashion", aliases: [] },
  hnm: { category: "fashion", aliases: ["h&m"] },
  ikea: { category: "home", aliases: [] },
  costco: { category: "retail", aliases: [] },
  walmart: { category: "retail", aliases: [] },
  target: { category: "retail", aliases: [] },
  nintendo: { category: "electronics", aliases: ["switch", "mario"] },
  logitech: { category: "electronics", aliases: [] },
  razer: { category: "electronics", aliases: [] },
  canon: { category: "electronics", aliases: [] },
  gopro: { category: "electronics", aliases: ["hero "] },
  lego: { category: "toys", aliases: [] },
  hasbro: { category: "toys", aliases: [] },
  dewalt: { category: "home", aliases: [] },
  kitchenaid: { category: "home", aliases: [] },
};

// ─── Brand Analyzer ────────────────────────────────────────────────────────────

export class BrandAnalyzer {
  private client: OpenRouterClient;
  private costTracker = getCostTracker();

  constructor(client?: OpenRouterClient) {
    this.client = client ?? new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY! });
  }

  /**
   * Analyze video for brand mentions and product placements
   */
  async analyze(
    frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): Promise<BrandResult[] | null> {
    // Stage 1: Extract brands from transcript (Claude Haiku)
    const textResult = await this.extractFromTranscript(transcript);

    // Stage 2: Extract brands from vision (Gemini Flash)
    const visionResult = await this.extractFromVision(frames, visionResults);

    // Stage 3: Fusion + known brand matching
    const fused = await this.fuseResults(visionResult.raw, textResult.raw);

    if (!fused || !fused.found || !fused.brands || fused.brands.length === 0) {
      return null;
    }

    // Enhance with known brand database
    const enhanced = fused.brands.map((brand: any) =>
      this.enhanceWithKnownBrand(brand)
    );

    // Generate affiliate links
    const withLinks = enhanced.map((brand: any) => ({
      ...brand,
      affiliateLink: brand.affiliateLink ?? this.generateAffiliateLink(brand.name),
    }));

    return withLinks as BrandResult[];
  }

  // ─── Stage 1: Transcript Extraction ──────────────────────────────────────────

  private async extractFromTranscript(
    transcript: TranscriptResult
  ): Promise<{ found: boolean; raw: string }> {
    try {
      const messages = buildBrandTextPrompt(transcript.text);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.2,
        maxTokens: 1500,
        budgetCents: 0.5,
        label: "brand-text-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "brand-text-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[BrandAnalyzer] Transcript extraction failed:", err);
      return { found: false, raw: "" };
    }
  }

  // ─── Stage 2: Vision Extraction ──────────────────────────────────────────────

  private async extractFromVision(
    frames: FrameData[],
    visionResults: VisionAnalysisResult[]
  ): Promise<{ found: boolean; raw: string }> {
    try {
      const messages = buildBrandVisionPrompt(frames.length);
      const userContent = messages[1]!.content;

      if (typeof userContent !== "string" && Array.isArray(userContent)) {
        for (const frame of frames) {
          if (frame.base64) {
            userContent.push({
              type: "image_url",
              image_url: { url: frame.base64, detail: "low" },
            });
          }
        }
      }

      const response = await this.client.chat({
        messages,
        model: "google/gemini-2.5-flash-preview",
        temperature: 0.2,
        maxTokens: 1500,
        budgetCents: 1.0,
        label: "brand-vision-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "brand-vision-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[BrandAnalyzer] Vision extraction failed:", err);
      return { found: false, raw: "" };
    }
  }

  // ─── Stage 3: Fusion ─────────────────────────────────────────────────────────

  private async fuseResults(visionRaw: string, textRaw: string): Promise<any> {
    try {
      const messages = buildBrandFusionPrompt(visionRaw, textRaw);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku", // Haiku is sufficient for brand fusion
        temperature: 0.2,
        maxTokens: 1500,
        responseFormat: { type: "json_object" },
        budgetCents: 0.5,
        label: "brand-fusion",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "brand-fusion",
      });

      return this.safeJsonParse(response.content);
    } catch (err) {
      console.warn("[BrandAnalyzer] Fusion failed:", err);
      return this.safeJsonParse(textRaw) ?? this.safeJsonParse(visionRaw);
    }
  }

  // ─── Known Brand Matching ────────────────────────────────────────────────────

  private enhanceWithKnownBrand(brand: any): any {
    const nameLower = (brand.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const [knownName, data] of Object.entries(KNOWN_BRANDS)) {
      const normalizedKnown = knownName.replace(/[^a-z0-9]/g, "");
      if (
        nameLower === normalizedKnown ||
        nameLower.includes(normalizedKnown) ||
        normalizedKnown.includes(nameLower) ||
        data.aliases.some((alias) => nameLower.includes(alias.replace(/[^a-z0-9]/g, "")))
      ) {
        return {
          ...brand,
          name: knownName.charAt(0).toUpperCase() + knownName.slice(1),
          category: data.category,
          confidence: Math.max(brand.confidence ?? 0.5, 0.7),
          matchedInDb: true,
        };
      }
    }

    return { ...brand, matchedInDb: false };
  }

  // ─── Affiliate Link Generation ───────────────────────────────────────────────

  private generateAffiliateLink(brandName: string): any | undefined {
    if (!brandName) return undefined;
    const encoded = encodeURIComponent(brandName);
    return {
      provider: "amazon" as const,
      url: `https://www.amazon.com/s?k=${encoded}`,
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

export function createBrandAnalyzer(client?: OpenRouterClient): BrandAnalyzer {
  return new BrandAnalyzer(client);
}
