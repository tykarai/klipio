/**
 * Klipio - Recipe Analyzer
 * Identifies dishes, extracts ingredients with quantities, generates cooking
 * instructions, estimates nutrition, and creates shopping links.
 */

import { OpenRouterClient } from "@/lib/openrouter";
import { getCostTracker } from "@/lib/cost-tracker";
import {
  buildRecipeVisionPrompt,
  buildRecipeTextPrompt,
  buildRecipeFusionPrompt,
  buildShoppingLinksPrompt,
} from "@/lib/prompts/recipe-prompt";
import {
  RecipeResult,
  FrameData,
  TranscriptResult,
  VisionAnalysisResult,
  PipelineError,
} from "@/types/analysis";

// ─── Recipe Analyzer ───────────────────────────────────────────────────────────

export class RecipeAnalyzer {
  private client: OpenRouterClient;
  private costTracker = getCostTracker();

  constructor(client?: OpenRouterClient) {
    this.client = client ?? new OpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY! });
  }

  /**
   * Analyze video for recipe content
   * Two-stage: vision (Gemini Flash) + text (Claude Haiku) → fusion (Claude Sonnet)
   */
  async analyze(
    frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): Promise<RecipeResult | null> {
    // Fast-path: check if content is recipe-related
    const isRecipeContent = this.detectRecipeSignals(frames, transcript, visionResults);
    if (!isRecipeContent) {
      return null;
    }

    // Stage 1: Extract recipe from transcript (Claude Haiku - cheap)
    const textResult = await this.extractFromTranscript(transcript);

    // Stage 2: Extract recipe from vision (Gemini Flash - cheap)
    const visionResult = await this.extractFromVision(frames, visionResults);

    // If neither found a recipe, return null
    if (!textResult.found && !visionResult.found) {
      return null;
    }

    // Stage 3: Fusion (Claude Sonnet - higher quality for merging)
    const fused = await this.fuseResults(visionResult.raw, textResult.raw, transcript.text);

    if (!fused || !fused.found) {
      return null;
    }

    // Generate shopping links
    const shoppingLinks = await this.generateShoppingLinks(fused);

    const recipe: RecipeResult = {
      dishName: fused.dishName ?? "Unknown Dish",
      confidence: fused.confidence ?? 0.5,
      cuisine: fused.cuisine,
      description: fused.description,
      ingredients: (fused.ingredients ?? []).map((ing: any) => ({
        name: ing.name ?? "unknown",
        quantity: ing.quantity ?? "",
        unit: ing.unit,
        optional: ing.optional ?? false,
        notes: ing.notes,
        calories: ing.calories,
      })),
      instructions: (fused.instructions ?? []).map((step: any, i: number) => ({
        step: step.step ?? i + 1,
        instruction: step.instruction ?? "",
        duration: step.duration,
        temperature: step.temperature,
        timestamp: step.timestamp,
      })),
      totalCalories: fused.totalCalories,
      prepTime: fused.prepTime,
      cookTime: fused.cookTime,
      totalTime: fused.totalTime,
      difficulty: fused.difficulty ?? "medium",
      servings: fused.servings,
      dietaryTags: fused.dietaryTags ?? [],
      nutritionPerServing: fused.nutritionPerServing,
      shoppingLinks,
      tips: fused.tips ?? [],
    };

    return recipe;
  }

  // ─── Stage 1: Transcript Extraction ──────────────────────────────────────────

  private async extractFromTranscript(
    transcript: TranscriptResult
  ): Promise<{ found: boolean; raw: string }> {
    try {
      const messages = buildRecipeTextPrompt(transcript.text);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3-haiku",
        temperature: 0.2,
        maxTokens: 1500,
        budgetCents: 0.5,
        label: "recipe-text-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "recipe-text-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[RecipeAnalyzer] Transcript extraction failed:", err);
      return { found: false, raw: "" };
    }
  }

  // ─── Stage 2: Vision Extraction ──────────────────────────────────────────────

  private async extractFromVision(
    frames: FrameData[],
    visionResults: VisionAnalysisResult[]
  ): Promise<{ found: boolean; raw: string }> {
    try {
      // Build vision messages with actual frame images
      const messages = buildRecipeVisionPrompt(frames.length);
      const userContent = messages[1]!.content;

      // Add frame images to the content
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
        label: "recipe-vision-extraction",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "recipe-vision-extraction",
      });

      const parsed = this.safeJsonParse(response.content);
      return { found: parsed?.found !== false, raw: response.content };
    } catch (err) {
      console.warn("[RecipeAnalyzer] Vision extraction failed:", err);
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
      const messages = buildRecipeFusionPrompt(visionRaw, textRaw, transcriptText);
      const response = await this.client.chat({
        messages,
        model: "anthropic/claude-3.5-sonnet",
        temperature: 0.2,
        maxTokens: 2500,
        responseFormat: { type: "json_object" },
        budgetCents: 2.0,
        label: "recipe-fusion",
      });

      await this.costTracker.recordModelCost({
        model: response.model,
        provider: "openrouter",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        costCents: response.costCents,
        durationMs: response.durationMs,
        stage: "recipe-fusion",
      });

      return this.safeJsonParse(response.content);
    } catch (err) {
      console.warn("[RecipeAnalyzer] Fusion failed:", err);
      // Return text result as fallback
      return this.safeJsonParse(textRaw);
    }
  }

  // ─── Shopping Links ──────────────────────────────────────────────────────────

  private async generateShoppingLinks(fusedResult: any): Promise<any[]> {
    try {
      const ingredients: string[] = (fusedResult.ingredients ?? [])
        .map((ing: any) => ing.name)
        .filter(Boolean);

      if (ingredients.length === 0) return [];

      // Use template-based link generation (free, no API call needed)
      return ingredients.map((ingredient: string) => ({
        ingredient,
        provider: "amazon" as const,
        url: `https://www.amazon.com/s?k=${encodeURIComponent(ingredient)}`,
      }));
    } catch {
      return [];
    }
  }

  // ─── Signal Detection ────────────────────────────────────────────────────────

  private detectRecipeSignals(
    frames: FrameData[],
    transcript: TranscriptResult,
    visionResults: VisionAnalysisResult[]
  ): boolean {
    // Check transcript for recipe keywords
    const recipeKeywords = [
      "recipe", "cook", "cooking", "bake", "baking", "fry", "frying",
      "ingredient", "mix", "stir", "chop", "dice", "slice", "heat",
      "oven", "stove", "pan", "pot", "bowl", "whisk", "spoon",
      "cup of", "tablespoon", "teaspoon", "grams", "ounces",
      "dish", "meal", "prep", "preparation", "season", "marinate",
      "boil", "simmer", "roast", "grill", "saute", "blend",
    ];

    const transcriptLower = transcript.text.toLowerCase();
    const transcriptMatches = recipeKeywords.filter((kw) =>
      transcriptLower.includes(kw)
    );

    // Check vision results for food/cooking signals
    const cookingObjects = ["food", "kitchen", "oven", "pan", "pot", "bowl", "plate", "knife"];
    const visionMatches = visionResults.flatMap((v) =>
      v.objects.filter((obj) =>
        cookingObjects.some((co) => obj.label.toLowerCase().includes(co))
      )
    );

    // Threshold: at least 2 transcript keywords OR 1 vision match
    return transcriptMatches.length >= 2 || visionMatches.length >= 1;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private safeJsonParse(text: string): any {
    try {
      // Try direct parse
      return JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code fences
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]!);
        } catch {
          // ignore
        }
      }

      // Try finding JSON object boundaries
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

export function createRecipeAnalyzer(client?: OpenRouterClient): RecipeAnalyzer {
  return new RecipeAnalyzer(client);
}
