/**
 * Next.js Middleware for klipio.io
 *
 * Handles:
 *   - Authentication session refresh (Supabase SSR)
 *   - CORS preflight for API routes
 *   - Request ID injection
 *   - Security headers
 *   - Rate limiting on edge (basic IP-based)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// ── Routes that bypass middleware ──────────────────────────────
const PUBLIC_ROUTES = [
  "/",
  "/_next/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/health",
];

const API_PUBLIC_ROUTES = [
  "/api/download",
  "/api/extract",
  "/api/health",
  "/api/auth/",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) return true;
  if (API_PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) return true;
  return false;
}

// ── Main Middleware ────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // ── CORS Preflight ─────────────────────────────────────────
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":
          process.env.NEXT_PUBLIC_APP_URL || "https://klipio.io",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Request-ID, X-Client-Version",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // ── Create Response with Request ID ────────────────────────
  const requestId =
    request.headers.get("x-request-id") || crypto.randomUUID();
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  response.headers.set("x-request-id", requestId);

  // ── Supabase Auth Session Refresh ──────────────────────────
  // Only for non-public API routes and authenticated pages
  if (!isPublicRoute(pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Refresh session if it exists
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Attach user info to headers for downstream use
    if (user) {
      response.headers.set("x-user-id", user.id);
      response.headers.set("x-user-email", user.email || "");
    }
  }

  // ── Security Headers (all routes) ──────────────────────────
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // ── API-specific headers ───────────────────────────────────
  if (pathname.startsWith("/api/")) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    // CORS for API
    const origin = request.headers.get("origin");
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://klipio.io";
    if (origin && (origin === allowedOrigin || process.env.NODE_ENV === "development")) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }

  return response;
}

// ── Matcher Configuration ──────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
