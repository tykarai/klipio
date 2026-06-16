import { NextRequest, NextResponse } from "next/server";
import { normalizePrivateKey } from "@/lib/config";

export const runtime = "nodejs";

const REQUIRED_RUNTIME_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "VPS_HOST",
  "VPS_USER",
  "VPS_PRIVATE_KEY",
] as const;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  const env = checkRuntimeEnv();

  const response: Record<string, unknown> = {
    status: env.ok ? "healthy" : "degraded",
    service: "klipio",
    timestamp: new Date().toISOString(),
    checks: {
      env,
    },
  };

  if (deep) {
    response.checks = {
      env,
      ...(await runDeepChecks()),
    };
  }

  response.latencyMs = Date.now() - startedAt;

  return NextResponse.json(response, {
    status: env.ok ? 200 : 503,
  });
}

function checkRuntimeEnv() {
  const missing = REQUIRED_RUNTIME_ENV.filter((key) => !process.env[key]);
  const invalid: string[] = [];
  const privateKey = process.env.VPS_PRIVATE_KEY
    ? normalizePrivateKey(process.env.VPS_PRIVATE_KEY)
    : "";

  if (
    privateKey &&
    (!privateKey.includes("BEGIN ") ||
      !privateKey.includes("END ") ||
      privateKey.length < 200)
  ) {
    invalid.push("VPS_PRIVATE_KEY appears incomplete or malformed");
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

async function runDeepChecks() {
  const checks: Record<string, unknown> = {};

  try {
    const { createServiceClient } = await import("@/lib/supabase");
    const service = createServiceClient();
    const { error } = await service
      .from("downloads")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      throw new Error(formatHealthError(error));
    }

    checks.supabase = { ok: true };
  } catch (error) {
    checks.supabase = {
      ok: false,
      error: formatHealthError(error),
    };
  }

  try {
    const { getQueueStats } = await import("@/lib/queue");
    checks.queue = {
      ok: true,
      stats: await getQueueStats(),
    };
  } catch (error) {
    checks.queue = {
      ok: false,
      error: formatHealthError(error),
    };
  }

  try {
    const { checkR2Health } = await import("@/lib/r2");
    checks.r2 = await checkR2Health();
  } catch (error) {
    checks.r2 = {
      ok: false,
      error: formatHealthError(error),
    };
  }

  return checks;
}

function formatHealthError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : String(error);
  } catch {
    return String(error);
  }
}
