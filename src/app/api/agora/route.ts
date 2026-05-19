import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { fetchAgoraPage } from "@/lib/papers/fetch-agora";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success, remaining, resetAt } = limiter.check(ip);
  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
    100,
  );

  const result = await fetchAgoraPage(page, limit);

  const response = NextResponse.json(result);
  response.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return response;
}
