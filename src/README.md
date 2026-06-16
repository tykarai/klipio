# Klipio AI Content Understanding Pipeline

Production-grade multimodal AI pipeline that takes a video URL and produces structured intelligence including recipes, travel destinations, brands, and key points.

## Architecture Overview

```
User shares video URL
       |
       v
+-------------+     +----------------+     +------------------+
|  Download   | --> | Frame Extract  | --> |  Transcribe      |
|  (yt-dlp)   |     | (FFmpeg)       |     |  (Deepgram)      |
+-------------+     +----------------+     +------------------+
                                                  |
       +------------------------------------------+
       |
       v
+----------------------------------+
|  Parallel AI Analysis            |
|  (OpenRouter: Gemini + Claude)   |
+----------------------------------+
       |
       v
+----------------------------------+
|  Fusion Engine                   |
|  (Claude 3.5 Sonnet)             |
+----------------------------------+
       |
       v
+----------------------------------+
|  Structured JSON Output          |
|  Recipe | Travel | Brands | Key  |
+----------------------------------+
```

## Files Created

### Core Types
| File | Description |
|------|-------------|
| `types/analysis.ts` | All TypeScript interfaces, enums, and error types |

### AI Clients
| File | Description |
|------|-------------|
| `lib/openrouter.ts` | OpenRouter client with fallback chain, cost tracking, streaming |
| `lib/deepgram.ts` | Deepgram Nova 2 transcription with diarization |
| `lib/ffmpeg.ts` | Video processing: keyframes, audio, thumbnails |

### Analysis Engine
| File | Description |
|------|-------------|
| `lib/analyzer.ts` | Main orchestrator - full pipeline coordination |
| `lib/analyzers/recipe.ts` | Recipe extraction with ingredients & instructions |
| `lib/analyzers/travel.ts` | Destination detection with travel guides |
| `lib/analyzers/brand.ts` | Logo/product detection with affiliate links |
| `lib/analyzers/keypoints.ts` | Key point extraction with categorization |

### AI Prompts
| File | Description |
|------|-------------|
| `lib/prompts/recipe-prompt.ts` | Recipe extraction prompts (vision + text + fusion) |
| `lib/prompts/travel-prompt.ts` | Travel destination prompts |
| `lib/prompts/brand-prompt.ts` | Brand detection prompts |
| `lib/prompts/keypoints-prompt.ts` | Key point extraction prompts |
| `lib/prompts/fusion-prompt.ts` | Fusion engine prompt combining all signals |

### Infrastructure
| File | Description |
|------|-------------|
| `lib/cost-tracker.ts` | Cost tracking, budget alerts, usage summaries |

### API Routes
| File | Description |
|------|-------------|
| `app/api/analyze/route.ts` | POST: Start analysis, GET: API info |
| `app/api/analyze/[id]/route.ts` | GET: Job status & results, DELETE: Cancel |

## Cost Optimization

| Component | Model | Cost/Request |
|-----------|-------|-------------|
| Vision Analysis | Gemini 2.5 Flash | ~$0.003-0.005 |
| Text Analysis | Claude 3 Haiku | ~$0.001-0.002 |
| Fusion | Claude 3.5 Sonnet | ~$0.005-0.01 |
| Transcription | Deepgram Nova 2 | ~$0.004/min |
| **Total (60s video)** | | **~$0.02-0.05** |

## Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...
DEEPGRAM_API_KEY=...

# Optional
APP_URL=https://klipio.io
REDIS_URL=redis://localhost:6379

# Budget limits (in cents)
DAILY_BUDGET_CENTS=2000
WEEKLY_BUDGET_CENTS=10000
MONTHLY_BUDGET_CENTS=40000
```

## API Usage

### Start Analysis
```bash
POST /api/analyze
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=...",
  "analysisType": "auto"
}
```

Response:
```json
{
  "jobId": "uuid",
  "status": "queued",
  "estimatedTime": 45,
  "pollUrl": "/api/analyze/uuid"
}
```

### Check Status
```bash
GET /api/analyze/{jobId}
```

Response (in progress):
```json
{
  "job": {
    "id": "uuid",
    "status": "analyzing",
    "progress": 60,
    "currentStep": "Running AI content analysis",
    "estimatedTimeRemaining": 15
  }
}
```

Response (complete):
```json
{
  "job": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "currentStep": "Analysis complete"
  },
  "result": { /* full AnalysisResult */ }
}
```

## Output Format

```typescript
interface AnalysisResult {
  contentType: "recipe" | "travel" | "product_review" | "educational" | "entertainment";
  confidence: number;
  video: { title, duration, thumbnail, platform };
  recipe?: { dishName, ingredients[], instructions[], totalCalories, ... };
  travel?: { destination, country, landmarks[], attractions[], ... };
  brands?: { name, confidence, category, affiliateLink }[];
  keyPoints?: { summary, categories[], totalPoints };
  transcript: { language, text, segments[] };
  fusion: { overallSummary, keyInsights[], audience, mood, ... };
}
```

## Features

- **Automatic model fallback**: Gemini → Claude → GPT-4o
- **Parallel processing**: Frame extraction + audio extraction simultaneously
- **24h caching**: Same URL not re-analyzed within 24 hours
- **Budget protection**: Hard stops when approaching cost limits
- **Error recovery**: Retry at each pipeline stage
- **Progress tracking**: Real-time 0-100% progress updates
- **Multi-platform**: YouTube, TikTok, Instagram, Twitter, Facebook, Vimeo, Reddit
- **30+ languages**: Deepgram supports 30+ languages with auto-detection
