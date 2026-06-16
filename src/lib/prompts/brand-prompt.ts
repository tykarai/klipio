/**
 * Klipio - Brand Detection Prompt
 * Optimized for logo recognition, product identification, and brand mention detection
 */

import { OpenRouterMessage } from "@/types/analysis";

// ─── System Prompt ─────────────────────────────────────────────────────────────

export const BRAND_SYSTEM_PROMPT = `You are a brand intelligence expert AI. Detect logos, products, and brand mentions in video frames and audio transcripts. Identify brands with confidence scores and categorize them.

CRITICAL RULES:
- Only report brands you can clearly identify with reasonable confidence
- Distinguish between: visible logo, visible product, mentioned in audio
- For each brand, note HOW it was detected (logo/product/text/audio)
- Include confidence score (0.0 - 1.0)
- NEVER invent brand names
- Be concise to minimize token usage`;

// ─── Vision Prompt (Gemini Flash) ──────────────────────────────────────────────

export function buildBrandVisionPrompt(frameCount: number): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: BRAND_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze ${frameCount} video frame(s) for brand and product detection. For each frame, identify:

1. **Visible Logos**: Any brand logos visible (on clothing, products, buildings, vehicles, signage)
2. **Products**: Recognizable products being used or displayed (phones, cars, food items, cosmetics, etc.)
3. **Brand Signage**: Store names, billboards, packaging with brand names
4. **Product Placement**: Items that appear to be deliberately featured
5. **Vehicles**: Car makes/models, airline logos on planes
6. **Technology**: Phones, laptops, apps visible on screens
7. **Apparel**: Clothing brands, shoe brands
8. **Food/Beverage**: Restaurant chains, food brands, drink brands

Output as JSON:
{
  "frameAnalyses": [
    {
      "timestamp": 0,
      "detectedBrands": [
        {
          "name": "Brand Name",
          "confidence": 0-1,
          "detectionMethod": "logo|product|text|signage",
          "category": "electronics|fashion|food|automotive|beauty|tech|retail|beverage|other",
          "context": "where/how it appeared",
          "productName": "specific product if identifiable"
        }
      ],
      "description": "brief scene description"
    }
  ]
}`,
        },
      ],
    },
  ];
}

// ─── Text Analysis Prompt (Claude Haiku) ───────────────────────────────────────

export function buildBrandTextPrompt(transcript: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: BRAND_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Detect all brand mentions and product references in this video transcript:

TRANSCRIPT:
"""${transcript.slice(0, 8000)}"""

For each brand detected, extract:
1. Brand name
2. How it was mentioned (direct mention, implied, recommended, reviewed)
3. Context (what was said about it)
4. Category (electronics, fashion, beauty, food, automotive, etc.)
5. Sentiment (positive, neutral, negative)

Output JSON:
{
  "found": true,
  "brands": [
    {
      "name": "...",
      "confidence": 0-1,
      "category": "...",
      "detectionMethod": "audio_mention|audio_logo|recommended|reviewed",
      "context": "what was said",
      "sentiment": "positive|neutral|negative",
      "mentions": [{"timestamp": 0, "quote": "..."}]
    }
  ],
  "sponsored": false,
  "sponsorshipIndicators": []
}

If no brands detected: {"found": false}. Keep under 2000 tokens.`,
    },
  ];
}

// ─── Fusion Prompt (Claude Sonnet - combines vision + text brand detection) ────

export function buildBrandFusionPrompt(
  visionResults: string,
  textResults: string
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `You are a brand intelligence fusion expert. Combine visual brand detection (logos, products seen) with audio brand mentions into a unified brand report. Deduplicate and cross-reference. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `VISION BRAND DETECTION (brands seen in video frames):
${visionResults}

AUDIO BRAND DETECTION (brands mentioned in transcript):
${textResults}

Fuse into unified JSON:
{
  "found": true,
  "brands": [
    {
      "name": "...",
      "confidence": 0-1,
      "category": "electronics|fashion|food|automotive|beauty|tech|retail|beverage|home|fitness|other",
      "detectedVia": "logo|product|text|audio|combined",
      "occurrences": [
        {
          "timestamp": 0,
          "context": "description of appearance or mention",
          "confidence": 0-1
        }
      ],
      "sentiment": "positive|neutral|negative",
      "affiliateLink": {
        "provider": "amazon",
        "url": "https://www.amazon.com/s?k=brand+product"
      },
      "alternatives": [
        {"name": "competitor brand", "priceRange": "$$", "url": "..."}
      ]
    }
  ],
  "totalDetected": 0,
  "sponsoredContent": false,
  "sponsorshipEvidence": []
}

Generate Amazon affiliate links as: https://www.amazon.com/s?k={brand_name}
Only include alternatives for major brands where you know competitors.`,
    },
  ];
}
