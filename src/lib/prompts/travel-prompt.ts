/**
 * Klipio - Travel Destination Extraction Prompt
 * Optimized for landmark detection from video frames + travel guide generation
 */

import { OpenRouterMessage } from "@/types/analysis";

// ─── System Prompt ─────────────────────────────────────────────────────────────

export const TRAVEL_SYSTEM_PROMPT = `You are a world-class travel expert AI. Identify destinations, landmarks, and travel information from video frames and transcripts. Be precise with locations and provide actionable travel advice.

CRITICAL RULES:
- Only identify locations you can confidently recognize
- Use reverse geocoding logic: describe what you see → identify the place
- If uncertain, provide confidence scores
- NEVER invent locations or attractions
- Focus on visually distinctive landmarks
- Be concise to minimize token usage`;

// ─── Vision Prompt (Gemini Flash) ──────────────────────────────────────────────

export function buildTravelVisionPrompt(frameCount: number): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: TRAVEL_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze ${frameCount} video frame(s) from a travel video. For each frame, identify:

1. **Landmarks**: Name any recognizable landmarks, monuments, buildings, natural features
2. **Location Clues**: Architecture style, street signs, flags, license plates, language on signs, landscape type
3. **Atmosphere**: Weather, time of day, crowd level, season
4. **Activities**: What people are doing (touring, hiking, dining, shopping)
5. **Cultural Elements**: Clothing, food visible, festivals, local customs
6. **Transportation**: How people are getting around

Output as JSON array per frame:
[{
  "timestamp": 0,
  "identifiedLandmarks": [{"name": "...", "confidence": 0-1, "type": "natural|historical|cultural|modern"}],
  "locationClues": ["..."],
  "likelyCountry": "...",
  "likelyCity": "...",
  "atmosphere": "...",
  "activities": ["..."],
  "description": "brief scene description"
}]`,
        },
      ],
    },
  ];
}

// ─── Text Analysis Prompt (Claude Haiku) ───────────────────────────────────────

export function buildTravelTextPrompt(transcript: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: TRAVEL_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Extract travel destination information from this video transcript:

TRANSCRIPT:
"""${transcript.slice(0, 8000)}"""

Extract:
1. Destination name(s) mentioned
2. Country and region
3. Specific landmarks, attractions, or points of interest
4. Activities recommended or shown
5. Best time to visit (if mentioned)
6. Travel tips or advice given
7. Local food or culture mentioned
8. Accommodation or transport recommendations
9. Budget information
10. Safety tips

Output as JSON. If no travel content found, return {"found": false, "reason": "..."}. Keep under 2000 tokens.`,
    },
  ];
}

// ─── Fusion Prompt (Claude Sonnet - combines vision + text) ────────────────────

export function buildTravelFusionPrompt(
  visionResults: string,
  textResults: string,
  transcript: string
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: `You are a travel guide fusion expert. Combine visual landmark detection with transcript information to create a comprehensive travel guide. Output valid JSON only.`,
    },
    {
      role: "user",
      content: `VISION ANALYSIS (landmarks and locations identified in frames):
${visionResults}

TEXT ANALYSIS (travel info from transcript):
${textResults}

ADDITIONAL CONTEXT:
${transcript.slice(0, 3000)}

Fuse into this exact JSON structure:
{
  "found": true,
  "destination": "primary destination name",
  "confidence": 0-1,
  "country": "...",
  "region": "...",
  "coordinates": {"lat": 0, "lng": 0},
  "description": "2-3 sentence overview",
  "landmarks": [
    {
      "name": "...",
      "description": "...",
      "type": "natural|historical|cultural|modern|religious",
      "confidence": 0-1
    }
  ],
  "bestTimeToVisit": "season/months",
  "idealDuration": "X days",
  "attractions": [
    {
      "name": "...",
      "description": "...",
      "type": "sightseeing|adventure|food|shopping|nightlife",
      "estimatedPrice": "$$$",
      "duration": "2-3 hours",
      "mustSee": true|false
    }
  ],
  "activities": ["activity 1", "activity 2"],
  "localCuisine": ["dish 1", "dish 2"],
  "practicalTips": ["tip 1", "tip 2"],
  "bookingLinks": [
    {"type": "hotel|flight|tour|restaurant|experience", "provider": "booking|airbnb|expedia", "url": "..."}
  ],
  "similarDestinations": ["destination 1", "destination 2"]
}

For booking links, generate real URLs:
- Hotels: https://www.booking.com/searchresults.html?ss={destination}
- Experiences: https://www.viator.com/search/{destination}
- Restaurants: https://www.tripadvisor.com/Search?q={destination}+restaurants`,
    },
  ];
}
