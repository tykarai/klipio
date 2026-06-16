/**
 * Proxy Rotation Module for klipio.io
 *
 * Manages a pool of residential proxies for extracting video URLs
 * from social media platforms. Implements a fallback chain:
 *   primary proxy → backup proxies → direct connection
 *
 * Tracks proxy health and automatically blacklists failing endpoints.
 */

import { config, createLogger, RETRY_CONFIG } from "./config";

const logger = createLogger("proxy");

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface ProxyEndpoint {
  id: string;
  url: string;
  protocol: "http" | "https" | "socks5";
  host: string;
  port: number;
  auth?: { username: string; password: string };
  region: string;
  provider: string;
  weight: number; // 0-100, higher = preferred
  isHealthy: boolean;
  failCount: number;
  lastUsed: number; // timestamp
  lastFailed: number; // timestamp
  totalRequests: number;
  avgLatencyMs: number;
}

export interface ProxyResult {
  endpoint: ProxyEndpoint;
  ytDlpProxyArg: string;
  responseTimeMs: number;
  success: boolean;
}

export interface ProxyHealthReport {
  total: number;
  healthy: number;
  unhealthy: number;
  byProvider: Record<string, { healthy: number; total: number }>;
  averageLatencyMs: number;
}

// ═══════════════════════════════════════════════════════════════
//  PROXY POOL STATE
// ═══════════════════════════════════════════════════════════════

/** In-memory proxy pool — rebuilt on cold start or config change. */
let proxyPool: ProxyEndpoint[] = [];
let directEnabled = true; // Allow direct connection as last resort

// Health check thresholds
const MAX_FAIL_COUNT = 5;
const FAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const HEALTHY_LATENCY_THRESHOLD_MS = 10000; // 10 seconds

// ═══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function buildProxyPool(): ProxyEndpoint[] {
  const pool: ProxyEndpoint[] = [];
  let idx = 0;

  // Primary proxy
  if (config.proxy.primaryUrl) {
    pool.push(parseProxyUrl(config.proxy.primaryUrl, "primary", idx++));
  }

  // Backup proxies
  for (const url of config.proxy.backupUrls) {
    pool.push(parseProxyUrl(url, "backup", idx++));
  }

  logger.info(`Initialized proxy pool with ${pool.length} endpoint(s)`);
  return pool;
}

function parseProxyUrl(
  url: string,
  provider: string,
  index: number
): ProxyEndpoint {
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "") as "http" | "https" | "socks5";

  return {
    id: `proxy_${index}_${parsed.hostname.replace(/\./g, "_")}`,
    url,
    protocol,
    host: parsed.hostname,
    port: parseInt(parsed.port || (protocol === "https" ? "443" : "8080"), 10),
    auth:
      config.proxy.username && config.proxy.password
        ? {
            username: config.proxy.username,
            password: config.proxy.password,
          }
        : parsed.username && parsed.password
          ? { username: parsed.username, password: parsed.password }
          : undefined,
    region: parsed.searchParams.get("region") || "unknown",
    provider,
    weight: provider === "primary" ? 100 : 50,
    isHealthy: true,
    failCount: 0,
    lastUsed: 0,
    lastFailed: 0,
    totalRequests: 0,
    avgLatencyMs: 0,
  };
}

// Initialize on first import
proxyPool = buildProxyPool();

// ═══════════════════════════════════════════════════════════════
//  PROXY SELECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Get the best available proxy using weighted random selection.
 * Prefers healthy proxies with lower latency.
 */
export function getNextProxy(): ProxyEndpoint | null {
  // Filter healthy proxies
  const healthy = proxyPool.filter((p) => isProxyHealthy(p));

  if (healthy.length === 0) {
    logger.warn("No healthy proxies available");
    return null;
  }

  // Weighted random selection (lower latency = higher weight)
  const totalWeight = healthy.reduce(
    (sum, p) => sum + (p.weight / Math.max(p.avgLatencyMs, 100)) * 100,
    0
  );

  let random = Math.random() * totalWeight;

  for (const proxy of healthy) {
    const weight = (proxy.weight / Math.max(proxy.avgLatencyMs, 100)) * 100;
    random -= weight;
    if (random <= 0) {
      proxy.lastUsed = Date.now();
      return proxy;
    }
  }

  // Fallback to first healthy proxy
  return healthy[0];
}

/**
 * Get the --proxy argument for yt-dlp.
 * Returns the proxy URL in the format yt-dlp expects.
 */
export function getYtDlpProxyArg(proxy: ProxyEndpoint): string {
  const auth = proxy.auth
    ? `${proxy.auth.username}:${proxy.auth.password}@`
    : "";

  if (proxy.protocol === "socks5") {
    return `socks5://${auth}${proxy.host}:${proxy.port}`;
  }

  return `http://${auth}${proxy.host}:${proxy.port}`;
}

/**
 * Build a proxy result with the yt-dlp argument pre-formatted.
 */
export function buildProxyResult(proxy: ProxyEndpoint): ProxyResult {
  return {
    endpoint: proxy,
    ytDlpProxyArg: getYtDlpProxyArg(proxy),
    responseTimeMs: proxy.avgLatencyMs,
    success: true,
  };
}

// ═══════════════════════════════════════════════════════════════
//  HEALTH MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function isProxyHealthy(proxy: ProxyEndpoint): boolean {
  // If proxy has been in cooldown for FAIL_COOLDOWN_MS, reset it
  if (proxy.failCount >= MAX_FAIL_COUNT) {
    const cooldownElapsed = Date.now() - proxy.lastFailed;
    if (cooldownElapsed > FAIL_COOLDOWN_MS) {
      logger.info(`Proxy ${proxy.id} cooldown expired, resetting health`, {
        proxyId: proxy.id,
      });
      proxy.failCount = 0;
      proxy.isHealthy = true;
      return true;
    }
    return false;
  }

  return proxy.isHealthy;
}

/**
 * Mark a proxy as failed after an unsuccessful request.
 * Increments fail count and may blacklist the proxy.
 */
export function markProxyFailed(proxyId: string, error?: string): void {
  const proxy = proxyPool.find((p) => p.id === proxyId);
  if (!proxy) return;

  proxy.failCount++;
  proxy.lastFailed = Date.now();

  if (proxy.failCount >= MAX_FAIL_COUNT) {
    proxy.isHealthy = false;
    logger.warn(`Proxy ${proxy.id} blacklisted after ${proxy.failCount} failures`, {
      proxyId: proxy.id,
      error,
    });
  } else {
    logger.debug(`Proxy ${proxy.id} marked failed (${proxy.failCount}/${MAX_FAIL_COUNT})`, {
      proxyId: proxy.id,
      error,
    });
  }
}

/**
 * Mark a proxy as succeeded after a successful request.
 * Updates latency tracking.
 */
export function markProxySucceeded(
  proxyId: string,
  latencyMs: number
): void {
  const proxy = proxyPool.find((p) => p.id === proxyId);
  if (!proxy) return;

  proxy.totalRequests++;
  // Exponential moving average for latency
  const alpha = 0.3;
  proxy.avgLatencyMs =
    proxy.avgLatencyMs === 0
      ? latencyMs
      : Math.round(alpha * latencyMs + (1 - alpha) * proxy.avgLatencyMs);

  // Reset fail count on success
  if (proxy.failCount > 0) {
    proxy.failCount = Math.max(0, proxy.failCount - 1);
    proxy.isHealthy = true;
  }
}

/**
 * Get a health report for all proxies.
 */
export function getProxyHealthReport(): ProxyHealthReport {
  const healthy = proxyPool.filter((p) => p.isHealthy);
  const unhealthy = proxyPool.filter((p) => !p.isHealthy);

  const byProvider: Record<string, { healthy: number; total: number }> = {};
  for (const p of proxyPool) {
    if (!byProvider[p.provider]) {
      byProvider[p.provider] = { healthy: 0, total: 0 };
    }
    byProvider[p.provider].total++;
    if (p.isHealthy) byProvider[p.provider].healthy++;
  }

  const avgLatency =
    proxyPool.length > 0
      ? Math.round(
          proxyPool.reduce((s, p) => s + p.avgLatencyMs, 0) / proxyPool.length
        )
      : 0;

  return {
    total: proxyPool.length,
    healthy: healthy.length,
    unhealthy: unhealthy.length,
    byProvider,
    averageLatencyMs: avgLatency,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FALLBACK CHAIN
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a function with proxy fallback chain:
 *   primary → backup → direct (no proxy)
 *
 * @param fn       — Function that receives a proxy argument
 * @param lastResortDirect — Whether to try without proxy as final fallback
 */
export async function withProxyFallback<T>(
  fn: (proxyArg: string | null) => Promise<T>,
  lastResortDirect = true
): Promise<T> {
  const errors: Array<{ proxy: string | null; error: string }> = [];

  // Try each healthy proxy in order
  const triedProxies = new Set<string>();

  // First pass: weighted selection
  for (let attempt = 0; attempt < proxyPool.length + (lastResortDirect ? 1 : 0); attempt++) {
    const proxy = getNextProxy();

    if (!proxy) {
      // No more proxies
      if (lastResortDirect && !triedProxies.has("direct")) {
        triedProxies.add("direct");
        logger.warn("Attempting direct connection (no proxy)");
        try {
          const result = await fn(null);
          return result;
        } catch (error) {
          const msg = (error as Error).message;
          errors.push({ proxy: "direct", error: msg });
          throw new AggregateProxyError(
            "All proxy attempts failed",
            errors
          );
        }
      }
      break;
    }

    if (triedProxies.has(proxy.id)) continue;
    triedProxies.add(proxy.id);

    const proxyArg = getYtDlpProxyArg(proxy);
    const start = Date.now();

    try {
      logger.debug(`Trying proxy ${proxy.id}`, {
        proxyId: proxy.id,
        host: proxy.host,
        region: proxy.region,
      });

      const result = await fn(proxyArg);

      // Success — mark proxy healthy
      const latency = Date.now() - start;
      markProxySucceeded(proxy.id, latency);

      logger.debug(`Proxy ${proxy.id} succeeded in ${latency}ms`);
      return result;
    } catch (error) {
      const latency = Date.now() - start;
      const msg = (error as Error).message;

      markProxyFailed(proxy.id, msg);
      errors.push({ proxy: proxy.id, error: msg });

      logger.warn(`Proxy ${proxy.id} failed (${latency}ms): ${msg}`);

      // Continue to next proxy
    }
  }

  // All attempts exhausted
  throw new AggregateProxyError(
    "All proxy attempts failed — video may be region-blocked or private",
    errors
  );
}

/**
 * Error that aggregates all proxy failures for comprehensive reporting.
 */
export class AggregateProxyError extends Error {
  public readonly proxyErrors: Array<{ proxy: string | null; error: string }>;
  public readonly isProxyError = true;

  constructor(message: string, proxyErrors: Array<{ proxy: string | null; error: string }>) {
    super(message);
    this.name = "AggregateProxyError";
    this.proxyErrors = proxyErrors;

    // Aggregate error message for logging
    const details = proxyErrors
      .map((e) => `  [${e.proxy ?? "direct"}] ${e.error}`)
      .join("\n");
    this.message = `${message}\n${details}`;
  }

  /**
   * Determine if all failures were due to the same cause.
   * Useful for categorizing errors (e.g., "all proxies timed out").
   */
  get commonCause(): string | null {
    if (this.proxyErrors.length === 0) return null;
    const first = this.proxyErrors[0].error;
    return this.proxyErrors.every((e) => e.error === first) ? first : null;
  }

  /**
   * Check if this looks like a private/restricted video
   * (not a proxy connectivity issue).
   */
  get isPrivateVideo(): boolean {
    const privateIndicators = [
      "private",
      "login",
      "auth",
      "unauthorized",
      "403",
      "This video is private",
      "This content isn't available",
      "Sign in",
    ];
    return this.proxyErrors.some((e) =>
      privateIndicators.some((ind) => e.error.toLowerCase().includes(ind.toLowerCase()))
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  DIRECT CONNECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Enable or disable direct (no-proxy) connections as last resort.
 */
export function setDirectEnabled(enabled: boolean): void {
  directEnabled = enabled;
  logger.info(`Direct connections ${enabled ? "enabled" : "disabled"}`);
}

/**
 * Refresh the proxy pool (e.g., after config change).
 */
export function refreshProxyPool(): void {
  proxyPool = buildProxyPool();
  logger.info("Proxy pool refreshed");
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS FOR YT-DLP
// ═══════════════════════════════════════════════════════════════

/**
 * Get the yt-dlp --proxy argument from the best available proxy,
 * or null if no proxies are healthy.
 */
export function getBestProxyArg(): string | null {
  const proxy = getNextProxy();
  if (!proxy) return null;
  return getYtDlpProxyArg(proxy);
}

/**
 * Get a list of all proxy URLs formatted for yt-dlp.
 * Useful for passing multiple proxies to tools that support it.
 */
export function getAllProxyArgs(): string[] {
  return proxyPool
    .filter((p) => isProxyHealthy(p))
    .map((p) => getYtDlpProxyArg(p));
}
