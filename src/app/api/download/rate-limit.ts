/**
 * Rate Limiting Module for /api/download
 *
 * Implements per-IP and per-user rate limiting:
 *   - Anonymous: 10 downloads/hour per IP
 *   - Registered: 100 downloads/hour per user
 *
 * Uses Supabase PostgreSQL for persistence across serverless instances.
 * Also supports in-memory fallback for edge cases.
 */

import { createServiceClient } from "@/lib/supabase";
import { config, createLogger } from "@/lib/config";
import { NextRequest } from "next/server";

const logger = createLogger("rate-limit");

// In-memory cache for hot path (avoids DB round-trip when possible)
const memoryCache = new Map<
  string,
  { count: number; windowStart: number }
>();

// ═══════════════════════════════════════════════════════════════
//  CLIENT IP EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract the real client IP from various headers.
 * Works with Vercel, Cloudflare, and standard proxies.
 */
export function getClientIP(request: NextRequest): string {
  // Vercel-specific headers
  const vercelIP =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-vercel-ip");
  if (vercelIP) return vercelIP.split(",")[0].trim();

  // Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // Standard forwarded headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  // Direct connection
  return (request as unknown as { ip?: string }).ip || "unknown";
}

// ═══════════════════════════════════════════════════════════════
//  RATE LIMIT CHECK
// ═══════════════════════════════════════════════════════════════

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  windowStart: string;
  resetAt: string;
  retryAfterMs: number;
  isNewWindow: boolean;
}

/**
 * Check if the request is within rate limits.
 *
 * Priority:
 *   1. If userId provided → check user-based limit
 *   2. Otherwise → check IP-based limit
 */
export async function checkRateLimit(
  ipAddress: string,
  userId: string | null,
  isRegistered: boolean
): Promise<RateLimitResult> {
  const limit = isRegistered
    ? config.rateLimit.registeredPerHour
    : config.rateLimit.anonymousPerHour;

  const windowStart = getWindowStart();
  const key = userId ? `user:${userId}` : `ip:${ipAddress}`;

  // Check memory cache first (fast path)
  const cached = memoryCache.get(key);
  if (cached && cached.windowStart === windowStart.getTime()) {
    const allowed = cached.count < limit;
    const resetAt = new Date(windowStart.getTime() + config.rateLimit.windowMs);

    return {
      allowed,
      remaining: Math.max(0, limit - cached.count),
      limit,
      windowStart: windowStart.toISOString(),
      resetAt: resetAt.toISOString(),
      retryAfterMs: resetAt.getTime() - Date.now(),
      isNewWindow: false,
    };
  }

  // Check database
  const service = createServiceClient();

  const { data, error } = await service
    .from("rate_limits")
    .select("*")
    .eq(userId ? "user_id" : "ip_address", userId || ipAddress)
    .gte("window_start", windowStart.toISOString())
    .order("window_start", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found (expected for new windows)
    logger.error("Rate limit DB check failed", { error: error.message, key });
    // Fail open — allow the request but don't count it
    return {
      allowed: true,
      remaining: limit,
      limit,
      windowStart: windowStart.toISOString(),
      resetAt: new Date(windowStart.getTime() + config.rateLimit.windowMs).toISOString(),
      retryAfterMs: 0,
      isNewWindow: true,
    };
  }

  const count = data?.requests_count || 0;
  const allowed = count < limit;
  const resetAt = new Date(windowStart.getTime() + config.rateLimit.windowMs);

  // Update cache
  memoryCache.set(key, { count, windowStart: windowStart.getTime() });

  return {
    allowed,
    remaining: Math.max(0, limit - count),
    limit,
    windowStart: windowStart.toISOString(),
    resetAt: resetAt.toISOString(),
    retryAfterMs: resetAt.getTime() - Date.now(),
    isNewWindow: !data,
  };
}

/**
 * Record a download request against the rate limit.
 */
export async function recordRequest(
  ipAddress: string,
  userId: string | null
): Promise<void> {
  const windowStart = getWindowStart();
  const key = userId ? `user:${userId}` : `ip:${ipAddress}`;

  // Update memory cache
  const cached = memoryCache.get(key);
  const nextCount =
    cached && cached.windowStart === windowStart.getTime()
      ? cached.count + 1
      : 1;

  if (cached && cached.windowStart === windowStart.getTime()) {
    cached.count = nextCount;
  } else {
    memoryCache.set(key, { count: nextCount, windowStart: windowStart.getTime() });
  }

  // Upsert to database
  const service = createServiceClient();

  const { error } = await service.from("rate_limits").upsert(
    {
      ip_address: userId ? null : ipAddress,
      user_id: userId,
      requests_count: nextCount,
      window_start: windowStart.toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: userId
        ? "user_id,window_start"
        : "ip_address,window_start",
    }
  );

  if (error) {
    // Non-critical — log but don't fail the request
    logger.warn("Failed to record rate limit usage", {
      error: error.message,
      key,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CLEANUP
// ═══════════════════════════════════════════════════════════════

/**
 * Clear expired entries from the in-memory cache.
 * Call periodically to prevent memory leaks.
 */
export function cleanupMemoryCache(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.windowStart > config.rateLimit.windowMs * 2) {
      memoryCache.delete(key);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the start of the current rate limit window.
 * Windows are aligned to hour boundaries for predictability.
 */
function getWindowStart(): Date {
  const now = new Date();
  return new Date(
    Math.floor(now.getTime() / config.rateLimit.windowMs) *
      config.rateLimit.windowMs
  );
}
