/**
 * Klipio - Recipe Extraction Prompt
 * Optimized for Gemini 2.5 Flash (vision) + Claude 3.5 Sonnet (text fusion)
 * Cost target: <1 cent per recipe extraction
 */

import { OpenRouterMessage } from "@/types/analysis";

// ─── System Prompt ─────────────────────────────────────────────────────────────

export const RECIPE_SYSTEM_PROMPT = `You are a culinary expert AI. Extract structured recipe information from video frames and transcript text. Be precise with quantities and follow standard recipe format.

CRITICAL RULES:
- ONLY extract recipe information if the video is clearly about cooking/food preparation
- If no recipe is present, return { "found": false, "reason": "..." }
- Convert all measurements to standard US units (cups, tbsp, tsp, oz, lb, g)
- Estimate calories using standard nutritional data if not provided
- NEVER invent ingredients or steps not visible in the video
- Be concise to minimize token usage`;

// ─── Vision Prompt (Gemini Flash) ──────────────────────────────────────────────

export function buildRecipeVisionPrompt(frameCount: number): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: RECIPE_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze ${frameCount} video frame(s) from a cooking video. For each frame, describe:
1. Visible ingredients (name, approximate quantity if visible)
2. Cooking equipment/tools being used
3. Cooking techniques/actions shown
4. Dish appearance (color, texture, presentation)
5. Text visible on screen (recipe titles, ingredients, instructions)

Output as JSON array with one entry per frame: [{"timestamp": 0, "ingredients": [], "actions": [], "equipment": [], "description": "", "onScreenText": ""}]`,
        },
      ],
    },
  ];
}

// ─── Text Analysis Prompt (Claude Haiku) ───────────────────────────────────────

export function buildRecipeTextPrompt(transcript: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: RECIPE_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Extract recipe information from this cooking video transcript:

TRANSCRIPT:
"""${transcript.slice(0, 8000)}"""

If the transcript contains recipe instructions, extract:
1. Dish name
2. Complete ingredient list with quantities
3. Step-by-step cooking instructions
4. Prep time, cook time, total time (if mentioned)
5. Difficulty level
6. Number of servings
7. Any dietary notes (vegetarian, vegan, gluten-free, etc.)
8. Chef tips or special techniques mentioned

Output as JSON. If no recipe found, return {"found": false}. Keep under 2000 tokens.`,
    },
  ];
}

// ─── Fusion Prompt (Claude Sonnet - combines vision + text) ────────────────────

export function buildRecipeFusionPrompt(
  visionResults: string,
  textResults: string,
  transcript: string
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `You are a recipe fusion expert. Combine vision analysis (what was seen) and transcript analysis (what was said) into ONE perfect structured recipe. Resolve conflicts by prioritizing visual evidence for quantities and transcript for instructions. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `VISION ANALYSIS (what was seen in video frames):
${visionResults}

TEXT ANALYSIS (from transcript):
${textResults}

TRANCRIPT SNIPPETS:
${transcript.slice(0, 4000)}

Fuse into this exact JSON structure:
{
  "found": true,
  "dishName": "...",
  "confidence": 0-1,
  "cuisine": "...",
  "description": "...",
  "ingredients": [
    { "name": "...", "quantity": "...", "unit": "...", "optional": false, "notes": "..." }
  ],
  "instructions": [
    { "step": 1, "instruction": "...", "duration": "...", "temperature": "..." }
  ],
  "prepTime": "...",
  "cookTime": "...",
  "totalTime": "...",
  "difficulty": "easy|medium|hard",
  "servings": 4,
  "dietaryTags": [],
  "nutritionPerServing": { "calories": 0, "protein": "0g", "carbs": "0g", "fat": "0g" },
  "totalCalories": 0,
  "tips": [],
  "shoppingLinks": []
}`,
    },
  ];
}

// ─── Shopping Link Generation Prompt ───────────────────────────────────────────

export function buildShoppingLinksPrompt(ingredients: string[]): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: "Generate shopping links for ingredients. Output JSON array only.",
    },
    {
      role: "user",
      content: `Generate affiliate shopping links for these ingredients:
${ingredients.join("\n")}

Output JSON: [{"ingredient": "...", "provider": "amazon|instacart|walmart", "url": "..."}]
For Amazon: https://www.amazon.com/s?k={ingredient}
For Instacart: https://www.instacart.com/store/search_v3/{ingredient}`,
    },
  ];
}
