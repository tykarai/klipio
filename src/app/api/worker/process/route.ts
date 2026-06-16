import { NextRequest, NextResponse } from "next/server";
import { config, createLogger } from "@/lib/config";
import { processDownloadQueue } from "@/lib/download-worker";
import { getQueueStats } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 300;

const logger = createLogger("api/worker/process");

export async function POST(request: NextRequest) {
  const auth = authorizeWorkerRequest(request);
  if (auth) return auth;

  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const maxJobs = await getMaxJobs(request);

  try {
    const result = await processDownloadQueue({
      workerId: `api_${requestId}`,
      maxJobs,
    });

    return NextResponse.json({
      status: "ok",
      elapsedMs: Date.now() - startedAt,
      ...result,
    });
  } catch (error) {
    logger.error("Worker process failed", {
      requestId,
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        status: "error",
        error: config.isDev ? (error as Error).message : "Worker failed",
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizeWorkerRequest(request);
  if (auth) return auth;

  if (request.nextUrl.searchParams.get("stats") !== "1") {
    return POST(request);
  }

  const stats = await getQueueStats();
  return NextResponse.json({
    status: "ok",
    queue: stats,
  });
}

function authorizeWorkerRequest(request: NextRequest): NextResponse | null {
  const secret = config.worker.secret;
  const isLocal =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1" ||
    request.nextUrl.hostname === "::1";

  if (!secret) {
    if (config.isProd && !isLocal) {
      return NextResponse.json(
        {
          status: "error",
          error: "WORKER_SECRET is required in production",
        },
        { status: 503 }
      );
    }
    return null;
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : header;

  if (token !== secret) {
    return NextResponse.json(
      {
        status: "error",
        error: "Unauthorized worker request",
      },
      { status: 401 }
    );
  }

  return null;
}

async function getMaxJobs(request: NextRequest): Promise<number> {
  const fromQuery = request.nextUrl.searchParams.get("maxJobs");
  if (fromQuery) {
    return Math.max(1, Math.min(10, Number.parseInt(fromQuery, 10) || 1));
  }

  try {
    const body = (await request.json()) as { maxJobs?: unknown };
    if (typeof body.maxJobs === "number") {
      return Math.max(1, Math.min(10, Math.floor(body.maxJobs)));
    }
  } catch {
    // Body is optional.
  }

  return config.worker.maxJobsPerInvocation;
}
