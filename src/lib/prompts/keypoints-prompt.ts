/**
 * Klipio - Key Point Extraction Prompt
 * Optimized for extracting main points, summaries, and organizing by category
 */

import { OpenRouterMessage } from "@/types/analysis";

// ─── System Prompt ─────────────────────────────────────────────────────────────

export const KEYPOINTS_SYSTEM_PROMPT = `You are an expert content summarizer. Extract the most important points from video transcripts, organized by category with timestamps. Be concise and actionable.

CRITICAL RULES:
- Extract only genuinely important points, not every detail
- Include timestamps when the point is discussed
- Categorize points logically (Tips, Facts, Steps, Warnings, etc.)
- Rate importance: high (essential), medium (useful), low (contextual)
- Write in clear, scannable bullet points
- Be concise to minimize token usage
- Maximum 20 key points total to avoid overwhelming output`;

// ─── Key Points Extraction Prompt ──────────────────────────────────────────────

export function buildKeyPointsPrompt(transcript: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: KEYPOINTS_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Extract key points from this video transcript. Provide a structured summary.

TRANSCRIPT:
"""${transcript.slice(0, 10000)}"""

Output JSON:
{
  "summary": "1-2 paragraph overview of the video content",
  "categories": [
    {
      "category": "Main Points|Tips|Facts|Steps|Warnings|Benefits|How-To|Definitions|Key Takeaways",
      "icon": "relevant emoji",
      "points": [
        {
          "text": "Clear, concise point statement",
          "timestamp": 45.5,
          "importance": "high|medium|low",
          "context": "brief surrounding context"
        }
      ]
    }
  ],
  "totalPoints": 0,
  "estimatedReadTime": "2 min"
}

Guidelines:
- Create 2-5 categories based on content type
- Include timestamps for all high-importance points
- Limit to most important 15-20 points total
- Use the video's original language/tone
- If the video is a tutorial, use "Steps" category with numbered actions
- If educational, use "Facts" and "Definitions"
- If a review, use "Pros" and "Cons" categories`,
    },
  ];
}

// ─── Quick Summary Prompt (for real-time preview) ──────────────────────────────

export function buildQuickSummaryPrompt(transcript: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: "Generate a 2-3 sentence summary of this video transcript. Be concise.",
    },
    {
      role: "user",
      content: `Summarize in 2-3 sentences:
"""${transcript.slice(0, 5000)}"""`,
    },
  ];
}

// ─── Content Type Detection Prompt ─────────────────────────────────────────────

export function buildContentTypeDetectionPrompt(
  transcript: string,
  visionSummary: string
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: "Classify video content type based on transcript and visual analysis. Output JSON only.",
    },
    {
      role: "user",
      content: `Based on this video analysis, classify the content type:

TRANSCRIPT SAMPLE:
"""${transcript.slice(0, 3000)}"""

VISUAL ANALYSIS:
${visionSummary}

Output JSON:
{
  "primaryType": "recipe|travel|product_review|educational|entertainment|mixed",
  "primaryConfidence": 0.85,
  "secondaryType": "recipe|travel|product_review|educational|entertainment|null",
  "secondaryConfidence": 0.15,
  "reasoning": "brief explanation",
  "detectedSignals": {
    "hasCooking": true|false,
    "hasTravel": true|false,
    "hasProducts": true|false,
    "hasEducation": true|false,
    "hasEntertainment": true|false,
    "hasRecipeSteps": true|false,
    "hasIngredients": true|false,
    "hasLandmarks": true|false,
    "hasBrandMentions": true|false
  }
}`,
    },
  ];
}
