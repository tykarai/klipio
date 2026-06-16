import { NextRequest, NextResponse } from "next/server";
import { config, createLogger } from "@/lib/config";
import { recoverStalledJobs } from "@/lib/queue";

export const runtime = "nodejs";

const logger = createLogger("api/cron/recover-jobs");

export async function GET(request: NextRequest) {
  const auth = authorizeCronRequest(request);
  if (auth) return auth;

  try {
    const recovered = await recoverStalledJobs();
    return NextResponse.json({ status: "ok", recovered });
  } catch (error) {
    logger.error("Recover jobs cron failed", {
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        status: "error",
        error: config.isDev ? (error as Error).message : "Recovery failed",
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
