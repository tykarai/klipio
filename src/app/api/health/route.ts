import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "klipio",
    timestamp: new Date().toISOString(),
  });
}
