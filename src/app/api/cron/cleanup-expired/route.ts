import { NextRequest, NextResponse } from "next/server";
import { config, createLogger } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase";
import { purgeOldJobs } from "@/lib/queue";

export const runtime = "nodejs";

const logger = createLogger("api/cron/cleanup-expired");

export async function GET(request: NextRequest) {
  const auth = authorizeCronRequest(request);
  if (auth) return auth;

  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("cleanup_expired_downloads");

    if (error) {
      throw new Error(error.message);
    }

    const purgedJobs = await purgeOldJobs(24 * 30);

    return NextResponse.json({
      status: "ok",
      cleaned: data ?? 0,
      purgedJobs,
    });
  } catch (error) {
    logger.error("Expired cleanup cron failed", {
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        status: "error",
        error: config.isDev ? (error as Error).message : "Cleanup failed",
      },
      { status: 500 }
    );
  }
}

function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const secret = config.worker.cronSecret || config.worker.secret;
  const isLocal =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1" ||
    request.nextUrl.hostname === "::1";

  if (!secret) {
    if (config.isProd && !isLocal) {
      return NextResponse.json(
        { status: "error", error: "CRON_SECRET or WORKER_SECRET is required" },
        { status: 503 }
      );
    }
    return null;
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;

  if (token !== secret) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized cron request" },
      { status: 401 }
    );
  }

  return null;
}
