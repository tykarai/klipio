/**
 * Supabase Client Module for klipio.io
 *
 * Provides both client-side and server-side Supabase clients
 * with full TypeScript types for all database tables.
 */

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { config, createLogger } from "./config";

const logger = createLogger("supabase");

// ═══════════════════════════════════════════════════════════════
//  DATABASE TYPES
// ═══════════════════════════════════════════════════════════════

export interface DownloadRecord {
  id: string;
  url: string;
  platform: string;
  status:
    | "queued"
    | "extracting"
    | "downloading"
    | "processing"
    | "ready"
    | "failed"
    | "expired";
  quality: string;
  r2_key: string | null;
  r2_bucket: string | null;
  file_size: number | null;
  file_name: string | null;
  mime_type: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  thumbnail_url: string | null;
  author: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  user_id: string | null;
  ip_address: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  completed_at: string | null;
}

export interface AnalysisRecord {
  id: string;
  download_id: string;
  content_type: string | null;
  summary: string | null;
  key_moments: Array<{
    timestamp: number;
    label: string;
    confidence: number;
  }> | null;
  entities: Array<{
    name: string;
    type: string;
    confidence: number;
  }> | null;
  sentiment: {
    overall: string;
    score: number;
  } | null;
  transcript: string | null;
  transcript_url: string | null;
  categories: string[] | null;
  tags: string[] | null;
  language: string | null;
  results: Record<string, unknown> | null;
  processing_time_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRecord {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "enterprise";
  downloads_count: number;
  downloads_reset_at: string;
  monthly_quota: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface JobRecord {
  id: string;
  type: "extract" | "download" | "analyze";
  status:
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | "dead_letter";
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  worker_id: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateLimitRecord {
  id: string;
  ip_address: string;
  user_id: string | null;
  requests_count: number;
  window_start: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      downloads: {
        Row: DownloadRecord;
        Insert: Omit<DownloadRecord, "created_at" | "updated_at"> &
          Partial<Pick<DownloadRecord, "created_at" | "updated_at">>;
        Update: Partial<DownloadRecord>;
      };
      analyses: {
        Row: AnalysisRecord;
        Insert: Omit<AnalysisRecord, "created_at" | "updated_at"> &
          Partial<Pick<AnalysisRecord, "created_at" | "updated_at">>;
        Update: Partial<AnalysisRecord>;
      };
      profiles: {
        Row: ProfileRecord;
        Insert: Omit<ProfileRecord, "created_at" | "updated_at"> &
          Partial<Pick<ProfileRecord, "created_at" | "updated_at">>;
        Update: Partial<ProfileRecord>;
      };
      jobs: {
        Row: JobRecord;
        Insert: Omit<JobRecord, "created_at" | "updated_at"> &
          Partial<Pick<JobRecord, "created_at" | "updated_at">>;
        Update: Partial<JobRecord>;
      };
      rate_limits: {
        Row: RateLimitRecord;
        Insert: Omit<RateLimitRecord, "created_at" | "updated_at"> &
          Partial<Pick<RateLimitRecord, "created_at" | "updated_at">>;
        Update: Partial<RateLimitRecord>;
      };
    };
    Functions: {
      // Custom RPC functions for queue management
      pop_job: {
        Args: { job_type: string; worker_id: string };
        Returns: JobRecord | null;
      };
      retry_failed_jobs: {
        Args: { max_age_hours: number };
        Returns: number; // count of jobs re-queued
      };
      cleanup_expired_downloads: {
        Args: Record<string, never>;
        Returns: number; // count of expired rows cleaned
      };
      get_user_download_quota: {
        Args: { p_user_id: string };
        Returns: { used: number; quota: number; reset_at: string };
      };
    };
  };
}

// ═══════════════════════════════════════════════════════════════
//  CLIENT INSTANCES
// ═══════════════════════════════════════════════════════════════

/**
 * Client-side Supabase instance (for use in React components).
 * Uses the anon key — safe to expose to the browser.
 */
export function createBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error(
      "createBrowserClient() must only be called in the browser. " +
        "Use createServerClient() or createServiceClient() in server contexts."
    );
  }

  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Server-side Supabase instance (for use in Server Components,
 * Server Actions, and Route Handlers).
 * Manages cookies via Next.js cookie API for session handling.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // In a Server Component, cookie setting may fail —
            // middleware handles this for us.
            logger.debug("Cookie set deferred to middleware", { name, error: (e as Error).message });
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (e) {
            logger.debug("Cookie remove deferred to middleware", { name, error: (e as Error).message });
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase instance (admin access, bypasses RLS).
 * ⚠️  NEVER expose this client to the browser.
 * Use only in trusted server contexts.
 */
export function createServiceClient() {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Factory for a Route Handler–specific Supabase client.
 * Handles cookie synchronization between the request and response.
 */
export async function createRouteHandlerClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
}

// ═══════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const service = createServiceClient();

/**
 * Fetch a download record by ID with full typing.
 */
export async function getDownloadById(
  id: string
): Promise<DownloadRecord | null> {
  const { data, error } = await service
    .from("downloads")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    logger.error("getDownloadById failed", { id, error: error.message });
    throw error;
  }

  return data;
}

/**
 * Update a download record by ID.
 */
export async function updateDownload(
  id: string,
  updates: Partial<DownloadRecord>
): Promise<DownloadRecord> {
  const { data, error } = await service
    .from("downloads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("updateDownload failed", { id, error: error.message });
    throw error;
  }

  return data;
}

/**
 * Create a new download record.
 */
export async function createDownload(
  insert: Database["public"]["Tables"]["downloads"]["Insert"]
): Promise<DownloadRecord> {
  const { data, error } = await service
    .from("downloads")
    .insert({
      ...insert,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error("createDownload failed", { error: error.message });
    throw error;
  }

  return data;
}

/**
 * Fetch an analysis record by download ID.
 */
export async function getAnalysisByDownloadId(
  downloadId: string
): Promise<AnalysisRecord | null> {
  const { data, error } = await service
    .from("analyses")
    .select("*")
    .eq("download_id", downloadId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("getAnalysisByDownloadId failed", {
      downloadId,
      error: error.message,
    });
    throw error;
  }

  return data;
}

/**
 * Create or update a profile for a Supabase Auth user.
 */
export async function upsertProfile(
  profile: Database["public"]["Tables"]["profiles"]["Insert"]
): Promise<ProfileRecord> {
  const { data, error } = await service
    .from("profiles")
    .upsert({
      ...profile,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error("upsertProfile failed", { error: error.message });
    throw error;
  }

  return data;
}

/**
 * Check if a user has remaining download quota.
 */
export async function checkUserQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  quota: number;
  resetAt: string;
}> {
  const { data, error } = await service.rpc("get_user_download_quota", {
    p_user_id: userId,
  });

  if (error) {
    logger.error("checkUserQuota RPC failed", { userId, error: error.message });
    // Fallback: deny on RPC failure
    return { allowed: false, used: 0, quota: 0, resetAt: new Date().toISOString() };
  }

  return {
    allowed: data.used < data.quota,
    used: data.used,
    quota: data.quota,
    resetAt: data.reset_at,
  };
}

/**
 * Increment download counter for a user.
 */
export async function incrementDownloadCount(userId: string): Promise<void> {
  const { error } = await service.rpc("increment_download_count", {
    p_user_id: userId,
  });

  if (error) {
    logger.error("incrementDownloadCount failed", {
      userId,
      error: error.message,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  REALTIME SUBSCRIPTION HELPERS (for future use)
// ═══════════════════════════════════════════════════════════════

/**
 * Subscribe to download status changes.
 * Use in client components with useEffect.
 */
export function subscribeToDownload(
  downloadId: string,
  onUpdate: (payload: DownloadRecord) => void
) {
  const client = createBrowserClient();

  const channel = client
    .channel(`download_${downloadId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "downloads",
        filter: `id=eq.${downloadId}`,
      },
      (payload) => {
        onUpdate(payload.new as DownloadRecord);
      }
    )
    .subscribe((status) => {
      logger.debug(`Download subscription status: ${status}`, { downloadId });
    });

  // Return cleanup function
  return () => {
    channel.unsubscribe();
  };
}
