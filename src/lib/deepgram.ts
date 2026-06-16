/**
 * Klipio - Deepgram Transcription Client
 * Deepgram Nova 2 model with speaker diarization, word-level timestamps,
 * punctuation, paragraphs, and multi-language support.
 */

import { createClient, ListenLiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import {
  DeepgramConfig,
  TranscriptResult,
  TranscriptSegment,
  WordTimestamp,
  SpeakerSegment,
  PipelineError,
} from "@/types/analysis";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen";
const COST_PER_MINUTE_CENTS = 0.43; // Nova-2: $0.0043/min = 0.43 cents/min

const DEFAULT_CONFIG: Partial<DeepgramConfig> = {
  model: "nova-2",
  detectLanguage: true,
  diarize: true,
  punctuate: true,
  paragraphs: true,
  utterances: true,
  smart_format: true,
  filler_words: false,
  multichannel: false,
};

// ─── Supported Languages (30+) ─────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  "en", "en-US", "en-GB", "en-AU", "en-NZ", "en-IN",
  "es", "es-ES", "es-LATAM", "es-MX",
  "fr", "fr-FR", "fr-CA",
  "de", "de-DE", "it", "pt", "pt-BR", "pt-PT",
  "nl", "da", "no", "sv", "fi",
  "hi", "hi-Latn",
  "ja", "ko", "zh", "zh-CN", "zh-TW",
  "ar", "tr", "pl", "ru", "uk",
  "ro", "cs", "el", "id", "ms", "vi", "th", "ta",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ─── Deepgram Client ───────────────────────────────────────────────────────────

export class DeepgramClient {
  private config: DeepgramConfig;
  private sdk: ReturnType<typeof createClient>;
  private totalDurationMinutes: number = 0;

  constructor(config: Partial<DeepgramConfig> & { apiKey: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as DeepgramConfig;
    this.sdk = createClient(this.config.apiKey);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Transcribe an audio file from disk
   */
  async transcribeFile(audioFilePath: string): Promise<TranscriptResult> {
    const fileStats = await stat(audioFilePath).catch(() => null);
    if (!fileStats) {
      throw new PipelineError({
        code: "TRANSCRIPTION_FAILED",
        message: `Audio file not found: ${audioFilePath}`,
        stage: "transcribing",
        recoverable: false,
      });
    }

    const estimatedDuration = fileStats.size / (16000 * 2); // rough estimate for 16kHz mono WAV
    this.totalDurationMinutes += estimatedDuration / 60;

    const source = { stream: createReadStream(audioFilePath), mimetype: this.detectMimetype(audioFilePath) };

    const options = this.buildOptions();

    try {
      const { result, error } = await this.sdk.listen.prerecorded.transcribeFile(
        source.stream,
        options
      );

      if (error) {
        throw new PipelineError({
          code: "TRANSCRIPTION_FAILED",
          message: `Deepgram error: ${error.message}`,
          stage: "transcribing",
          recoverable: this.isRecoverable(error),
          cause: error,
        });
      }

      return this.parseResult(result);
    } catch (err) {
      if (err instanceof PipelineError) throw err;

      throw new PipelineError({
        code: "TRANSCRIPTION_FAILED",
        message: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "transcribing",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Transcribe from a buffer (for in-memory audio)
   */
  async transcribeBuffer(
    buffer: Buffer,
    mimetype: string = "audio/wav"
  ): Promise<TranscriptResult> {
    const options = this.buildOptions();

    try {
      const { result, error } = await this.sdk.listen.prerecorded.transcribeFile(
        buffer,
        options
      );

      if (error) {
        throw new PipelineError({
          code: "TRANSCRIPTION_FAILED",
          message: `Deepgram error: ${error.message}`,
          stage: "transcribing",
          recoverable: this.isRecoverable(error),
          cause: error,
        });
      }

      return this.parseResult(result);
    } catch (err) {
      if (err instanceof PipelineError) throw err;

      throw new PipelineError({
        code: "TRANSCRIPTION_FAILED",
        message: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "transcribing",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Transcribe from a URL (e.g. direct audio URL)
   */
  async transcribeUrl(audioUrl: string): Promise<TranscriptResult> {
    const options = this.buildOptions();

    try {
      const { result, error } = await this.sdk.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        options
      );

      if (error) {
        throw new PipelineError({
          code: "TRANSCRIPTION_FAILED",
          message: `Deepgram URL transcription error: ${error.message}`,
          stage: "transcribing",
          recoverable: this.isRecoverable(error),
          cause: error,
        });
      }

      return this.parseResult(result);
    } catch (err) {
      if (err instanceof PipelineError) throw err;

      throw new PipelineError({
        code: "TRANSCRIPTION_FAILED",
        message: `URL transcription failed: ${err instanceof Error ? err.message : String(err)}`,
        stage: "transcribing",
        recoverable: true,
        cause: err,
      });
    }
  }

  /**
   * Stream transcription (for real-time use cases)
   */
  async createLiveStream(
    onTranscript: (result: Partial<TranscriptResult>) => void,
    sampleRate = 16000
  ): Promise<ListenLiveClient> {
    const options = this.buildOptions();
    options.sample_rate = sampleRate;
    options.encoding = "linear16";

    const connection = this.sdk.listen.live(options);

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const partial = this.parseLiveResult(data);
      onTranscript(partial);
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("[Deepgram Live] Error:", err);
    });

    return connection;
  }

  /**
   * Get total estimated cost for this session
   */
  getCostCents(): number {
    return Math.round(this.totalDurationMinutes * COST_PER_MINUTE_CENTS * 100) / 100;
  }

  /**
   * Estimate cost before transcription
   */
  estimateCostCents(durationSeconds: number): number {
    return Math.round((durationSeconds / 60) * COST_PER_MINUTE_CENTS * 100) / 100;
  }

  /**
   * Reset session cost tracking
   */
  resetCost(): void {
    this.totalDurationMinutes = 0;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private buildOptions(): Record<string, unknown> {
    const opts: Record<string, unknown> = {
      model: this.config.model ?? "nova-2",
      smart_format: this.config.smart_format ?? true,
      punctuate: this.config.punctuate ?? true,
      paragraphs: this.config.paragraphs ?? true,
      utterances: this.config.utterances ?? true,
      diarize: this.config.diarize ?? true,
      filler_words: this.config.filler_words ?? false,
      multichannel: this.config.multichannel ?? false,
      detect_language: this.config.detectLanguage ?? true,
    };

    if (this.config.language && !this.config.detectLanguage) {
      opts.language = this.config.language;
    }

    return opts;
  }

  private parseResult(result: any): TranscriptResult {
    const channel = result.results?.channels?.[0];
    const alternatives = channel?.alternatives?.[0];
    const utterances = result.results?.utterances ?? [];

    if (!alternatives) {
      return {
        language: result.results?.channels?.[0]?.detected_language ?? "unknown",
        languageConfidence: 0,
        text: "",
        segments: [],
        duration: result.metadata?.duration ?? 0,
      };
    }

    const segments: TranscriptSegment[] = this.extractSegments(utterances, alternatives);
    const words: WordTimestamp[] = alternatives.words?.map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence ?? 0.99,
      speaker: w.speaker,
    })) ?? [];

    const speakers: SpeakerSegment[] = this.extractSpeakers(utterances);

    return {
      language: channel?.detected_language ?? this.config.language ?? "en",
      languageConfidence: channel?.language_confidence ?? 0.95,
      text: alternatives.paragraphs
        ? alternatives.paragraphs.map((p: any) => p.text).join("\n\n")
        : alternatives.transcript ?? "",
      segments,
      words,
      speakers: speakers.length > 0 ? speakers : undefined,
      duration: result.metadata?.duration ?? 0,
    };
  }

  private parseLiveResult(data: any): Partial<TranscriptResult> {
    const channel = data.channel ?? {};
    const alt = channel.alternatives?.[0] ?? {};
    return {
      text: alt.transcript ?? "",
      segments: [
        {
          start: data.start ?? 0,
          end: data.end ?? 0,
          text: alt.transcript ?? "",
          confidence: alt.confidence ?? 0.95,
        },
      ],
    };
  }

  private extractSegments(utterances: any[], alternatives: any): TranscriptSegment[] {
    // Prefer utterances (speaker-aware segments)
    if (utterances && utterances.length > 0) {
      return utterances.map((u: any) => ({
        start: u.start,
        end: u.end,
        text: u.transcript ?? "",
        confidence: u.confidence ?? 0.95,
        speaker: u.speaker,
      }));
    }

    // Fall back to paragraphs
    if (alternatives.paragraphs) {
      return alternatives.paragraphs.map((p: any, i: number) => ({
        start: p.sentences?.[0]?.start ?? i * 10,
        end: p.sentences?.[p.sentences.length - 1]?.end ?? (i + 1) * 10,
        text: p.text ?? "",
        confidence: 0.95,
      }));
    }

    // Last resort: single segment
    return [
      {
        start: 0,
        end: alternatives.words?.[alternatives.words.length - 1]?.end ?? 0,
        text: alternatives.transcript ?? "",
        confidence: 0.95,
      },
    ];
  }

  private extractSpeakers(utterances: any[]): SpeakerSegment[] {
    if (!utterances || utterances.length === 0) return [];

    const speakerMap = new Map<number, { start: number; end: number; texts: string[] }>();

    for (const u of utterances) {
      const speaker = u.speaker;
      if (speaker === undefined) continue;

      const existing = speakerMap.get(speaker);
      if (existing) {
        existing.end = Math.max(existing.end, u.end);
        existing.texts.push(u.transcript);
      } else {
        speakerMap.set(speaker, {
          start: u.start,
          end: u.end,
          texts: [u.transcript],
        });
      }
    }

    return Array.from(speakerMap.entries()).map(([speaker, data]) => ({
      speaker,
      start: data.start,
      end: data.end,
      text: data.texts.join(" "),
    }));
  }

  private detectMimetype(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "mp3": return "audio/mpeg";
      case "wav": return "audio/wav";
      case "m4a": return "audio/m4a";
      case "ogg": return "audio/ogg";
      case "webm": return "audio/webm";
      case "flac": return "audio/flac";
      default: return "audio/wav";
    }
  }

  private isRecoverable(error: any): boolean {
    const msg = String(error?.message ?? "").toLowerCase();
    if (msg.includes("rate limit")) return true;
    if (msg.includes("timeout")) return true;
    if (msg.includes("network")) return true;
    if (msg.includes("temporarily")) return true;
    return false;
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

let globalClient: DeepgramClient | null = null;

export function getDeepgramClient(
  config?: Partial<DeepgramConfig> & { apiKey: string }
): DeepgramClient {
  if (!globalClient || config) {
    globalClient = new DeepgramClient(config ?? { apiKey: process.env.DEEPGRAM_API_KEY! });
  }
  return globalClient;
}

export function createDeepgramClient(
  config: { apiKey: string } & Partial<DeepgramConfig>
): DeepgramClient {
  return new DeepgramClient(config);
}
