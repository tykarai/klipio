/**
 * Klipio - Fusion Prompt
 * Combines ALL signals (vision + transcript + individual analyzer results) into
 * the final unified AnalysisResult structure.
 */

import { OpenRouterMessage } from "@/types/analysis";

// ─── System Prompt ─────────────────────────────────────────────────────────────

export const FUSION_SYSTEM_PROMPT = `You are the Klipio AI Fusion Engine. Your job is to combine multiple analysis signals into one coherent, structured JSON output.

You receive:
1. VISION ANALYSIS: What Gemini 2.5 Flash saw in video frames
2. TRANSCRIPT ANALYSIS: Deepgram transcription with speaker segments
3. CONTENT TYPE: Detected category (recipe, travel, product, educational, entertainment)
4. SPECIALIZED RESULTS: Extracted recipe, travel, brands, and key points

Your task:
- Merge all signals intelligently, resolving conflicts
- Ensure the final JSON matches the AnalysisResult schema exactly
- Add fusion-level insights (overallSummary, keyInsights, audience, mood, contentQuality, viralPotential, suggestedTags)
- NEVER hallucinate information not present in the inputs
- Be concise and production-ready`;

// ─── Main Fusion Prompt ────────────────────────────────────────────────────────

export function buildFusionPrompt(options: {
  visionSummary: string;
  transcriptText: string;
  transcriptLanguage: string;
  contentType: string;
  contentConfidence: number;
  recipeResult?: string;
  travelResult?: string;
  brandResult?: string;
  keyPointsResult?: string;
  videoMetadata: {
    title: string;
    duration: number;
    platform: string;
  };
}): OpenRouterMessage[] {
  const parts: string[] = [];

  parts.push(`FUSION ENGINE - Combine all analysis signals into final JSON output.`);

  parts.push(`\n--- VIDEO METADATA ---
Title: ${options.videoMetadata.title}
Duration: ${options.videoMetadata.duration}s
Platform: ${options.videoMetadata.platform}`);

  parts.push(`\n--- CONTENT TYPE DETECTION ---
Type: ${options.contentType}
Confidence: ${options.contentConfidence}`);

  parts.push(`\n--- VISION ANALYSIS (Gemini 2.5 Flash) ---
${options.visionSummary}`);

  parts.push(`\n--- TRANSCRIPT (${options.transcriptLanguage}) ---
${options.transcriptText.slice(0, 4000)}`);

  if (options.recipeResult) {
    parts.push(`\n--- RECIPE EXTRACTION ---
${options.recipeResult}`);
  }

  if (options.travelResult) {
    parts.push(`\n--- TRAVEL EXTRACTION ---
${options.travelResult}`);
  }

  if (options.brandResult) {
    parts.push(`\n--- BRAND DETECTION ---
${options.brandResult}`);
  }

  if (options.keyPointsResult) {
    parts.push(`\n--- KEY POINTS ---
${options.keyPointsResult}`);
  }

  parts.push(`\n--- INSTRUCTIONS ---
Combine ALL the above signals into ONE valid JSON object matching this exact structure:

{
  "contentType": "recipe|travel|product_review|educational|entertainment",
  "confidence": 0.0-1.0,
  "video": {
    "title": "...",
    "duration": ${options.videoMetadata.duration},
    "thumbnail": "",
    "platform": "${options.videoMetadata.platform}"
  },
  "recipe": { ... } or undefined,
  "travel": { ... } or undefined,
  "brands": [ ... ] or undefined,
  "keyPoints": { ... } or undefined,
  "transcript": {
    "language": "${options.transcriptLanguage}",
    "text": "...",
    "segments": [ ... ]
  },
  "fusion": {
    "overallSummary": "2-3 sentence summary",
    "keyInsights": ["insight 1", "insight 2"],
    "audience": "target audience description",
    "mood": "tone/atmosphere",
    "contentQuality": "high|medium|low",
    "viralPotential": "high|medium|low",
    "suggestedTags": ["tag1", "tag2", "tag3"],
    "relatedTopics": ["topic1", "topic2"]
  },
  "processedAt": "${new Date().toISOString()}",
  "processingTime": 0
}

RULES:
- Output ONLY valid JSON, no markdown, no comments
- Omit optional fields (recipe, travel, brands, keyPoints) if not detected
- transcript.segments should contain at least 3 key segments with timestamps
- fusion.overallSummary must be a concise 2-3 sentence overview
- fusion.suggestedTags should have 5-10 relevant tags
- Ensure all JSON is parseable`);

  return [
    {
      role: "system",
      content: FUSION_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: parts.join("\n"),
    },
  ];
}

// ─── Quality Check Prompt ──────────────────────────────────────────────────────

export function buildQualityCheckPrompt(jsonOutput: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: "You are a JSON quality checker. Validate and fix JSON output. Return only valid JSON.",
    },
    {
      role: "user",
      content: `Review this JSON output and fix any issues (invalid syntax, missing fields, wrong types). Return ONLY the corrected valid JSON, no markdown fences, no explanation:

${jsonOutput}`,
    },
  ];
}
