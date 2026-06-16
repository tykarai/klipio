/**
 * Klipio - Travel Analyzer
 * Identifies landmarks, locations, destinations from video frames and transcripts.
 * Generates travel guides with attractions, tips, and booking links.
 */

import { OpenRouterClient } from "@/lib/openrouter";
import { getCostTracker } from "@/lib/cost-tracker";
import {
  buildTravelVisionPrompt,
  buildTravelTextPrompt,
  buildTravelFusionPrompt,
} from "@/lib/prompts/travel-prompt";
import {
  TravelResult,
  FrameData,
  TranscriptResult,
  VisionAnalysisResult,
} from "@/types/analysis";

// ─── Travel Analyzer ───────────────────────────────────────────────────────────

export class TravelAnalyzer {
  private client: OpenRouterClient;
  private costTracker = getCostTracker();

  constructor(client?: OpenRouterClient) {
    this.client = client ?? new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY! });
  }

  /**
   * Analyze video for travel content
   */
  async analyze(
    frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): Promise<TravelResult | null> {
    const isTravelContent = this.detectTravelSignals(frames, transcript, visionResults);
    if (!isTravelContent) {
      return null;
    }

    // Stage 1: Extract from transcript (Claude Haiku)
    const textResult = await this.extractFromTranscript(transcript);

    // Stage 2: Extract from vision (Gemini Flash)
    const visionResult = await this.extractFromVision(frames, visionResults);

    if (!textResult.found && !visionResult.found) {
      return null;
    }

    // Stage 3: Fusion (Claude Sonnet)
    const fused = await this.fuseResults(visionResult.raw, textResult.raw, transcript.text);

    if (!fused || !fused.found) {
      return null;
    }

    // Generate booking links
    const bookingLinks = this.generateBookingLinks(fused.destination, fused.country);

    const travel: TravelResult = {
      destination: fused.destination ?? "Unknown Destination",
      confidence: fused.confidence ?? 0.5,
      country: fused.country ?? "",
      region: fused.region,
      coordinates: fused.coordinates,
      landmarks: (fused.landmarks ?? []).map((lm: any) => ({
        name: lm.name ?? "",
        description: lm.description ?? "",
        type: lm.type ?? "cultural",
        confidence: lm.confidence ?? 0.5,
      })),
      bestTimeToVisit: fused.bestTimeToVisit ?? "",
      idealDuration: fused.idealDuration,
      attractions: (fused.attractions ?? []).map((attr: any) => ({
        name: attr.name ?? "",
        description: attr.description ?? "",
        type: attr.type ?? "sightseeing",
        estimatedPrice: attr.estimatedPrice,
        duration: attr.duration,
        mustSee: attr.mustSee ?? false,
      })),
      activities: fused.activities ?? [],
      localCuisine: fused.localCuisine,
      practicalTips: fused.practicalTips ?? [],
      bookingLinks,
      similarDestinations: fused.similarDestinations,
    };

    return travel;
  }

  // ─── Stage 1: Transcript Extraction ──────────────────────────────────────────

  private async extractFromTranscript(
    transcript: TranscriptResult
  ): Promise<{ found: boolean; raw: string }> {
    try {
      const messages = buildTravelTextPrompt(transcript.text);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.2,
        maxTokens: 1500,
        budgetCents: 0.5,
        label: "travel-text-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "travel-text-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[TravelAnalyzer] Transcript extraction failed:", err);
      return { found: false, raw: "" };
    }
  }

  // ─── Stage 2: Vision Extraction ──────────────────────────────────────────────

  private async extractFromVision(
    frames: FrameData[],
    visionResults: VisionAnalysisResult[]
  ): Promise<{ found: boolean; raw: string }> {
    try {
      const messages = buildTravelVisionPrompt(frames.length);
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
        label: "travel-vision-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "travel-vision-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[TravelAnalyzer] Vision extraction failed:", err);
      return { found: false, raw: "" };
    }
  }

  // ─── Stage 3: Fusion ─────────────────────────────────────────────────────────

  private async fuseResults(
    visionRaw: string,
    textRaw: string,
    transcriptText: string
  ): Promise<any> {
    try {
      const messages = buildTravelFusionPrompt(visionRaw, textRaw, transcriptText);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3.5-sonnet",
        temperature: 0.2,
        maxTokens: 2500,
        responseFormat: { type: "json_object" },
        budgetCents: 2.0,
        label: "travel-fusion",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "travel-fusion",
      });

      return this.safeJsonParse(response.content);
    } catch (err) {
      console.warn("[TravelAnalyzer] Fusion failed:", err);
      return this.safeJsonParse(textRaw);
    }
  }

  // ─── Booking Links ───────────────────────────────────────────────────────────

  private generateBookingLinks(destination: string, country?: string): any[] {
    if (!destination) return [];

    const encoded = encodeURIComponent(destination);
    const links: any[] = [
      {
        type: "hotel" as const,
        provider: "booking" as const,
        url: `https://www.booking.com/searchresults.html?ss=${encoded}`,
      },
      {
        type: "experience" as const,
        provider: "viator" as const,
        url: `https://www.viator.com/search/${encoded}`,
      },
    ];

    if (country) {
      links.push({
        type: "flight" as const,
        provider: "expedia" as const,
        url: `https://www.expedia.com/Destinations-In-${encodeURIComponent(country)}.dxx-Destination-Travel-Guide`,
      });
    }

    return links;
  }

  // ─── Signal Detection ────────────────────────────────────────────────────────

  private detectTravelSignals(
    _frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): boolean {
    const travelKeywords = [
      "travel", "traveling", "trip", "vacation", "holiday",
      "destination", "tour", "tourist", "sightseeing", "landmark",
      "hotel", "resort", "airport", "flight", "passport",
      "city", "country", "explore", "visit", "guide",
      "beach", "mountain", "museum", "temple", "cathedral",
      "restaurant", "cuisine", "local food", "street food",
      "hiking", "adventure", "backpacking", "itinerary",
    ];

    const transcriptLower = transcript.text.toLowerCase();
    const transcriptMatches = travelKeywords.filter((kw) =>
      transcriptLower.includes(kw)
    );

    // Check vision for landmark/location signals
    const locationObjects = ["building", "bridge", "mountain", "beach", "landmark", "monument"];
    const visionMatches = visionResults.flatMap((v) =>
      v.objects.filter((obj) =>
        locationObjects.some((lo) => obj.label.toLowerCase().includes(lo))
      )
    );

    return transcriptMatches.length >= 2 || visionMatches.length >= 1;
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

export function createTravelAnalyzer(client?: OpenRouterClient): TravelAnalyzer {
  return new TravelAnalyzer(client);
}
