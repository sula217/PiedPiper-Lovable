import { NextRequest, NextResponse } from "next/server";
import { AIError } from "./gemini";
import { ZodError } from "zod";
const buckets = new Map<string, { count: number; expires: number }>();
const hourly = { count: 0, expires: 0 };
export async function guardedBody(req: NextRequest, maxBytes = 48000) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin)
    throw new AIError(
      "ORIGIN",
      "This request must come from this application.",
      403,
    );
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  if (buckets.size > 10000)
    for (const [key, bucket] of buckets)
      if (bucket.expires < now) buckets.delete(key);
  if (buckets.size > 10000)
    throw new AIError(
      "BUSY",
      "The demo is busy. Please try again shortly.",
      429,
    );
  // Cost safeguard: a process-wide hourly cap on anonymous AI requests, on
  // top of the per-session/IP limit below. Configurable; never unlimited.
  if (hourly.expires < now) {
    hourly.count = 0;
    hourly.expires = now + 60 * 60 * 1000;
  }
  const cap = Number(process.env.GUEST_AI_HOURLY_LIMIT) || 600;
  if (++hourly.count > cap)
    throw new AIError(
      "BUSY",
      "The live AI demo has reached its hourly limit. Please try again later; the scripted demo is still available.",
      429,
    );
  const bucket = buckets.get(ip) ?? { count: 0, expires: now + 15 * 60 * 1000 };
  if (bucket.expires < now) {
    bucket.count = 0;
    bucket.expires = now + 15 * 60 * 1000;
  }
  bucket.count++;
  buckets.set(ip, bucket);
  if (bucket.count > 30)
    throw new AIError(
      "RATE_LIMITED",
      "Please pause before making more AI requests. The predefined demonstration is still available.",
      429,
    );
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new AIError(
      "TOO_LARGE",
      "This conversation is too long. Please start a new interview.",
      413,
    );
  // Bound streamed requests too; Content-Length alone is not trusted.
  const reader = req.body?.getReader();
  if (!reader)
    throw new AIError("INVALID_INPUT", "A request body is required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AIError("TOO_LARGE", "This conversation is too long.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AIError("INVALID_INPUT", "Please send a valid request.", 400);
  }
}
export function apiError(error: unknown) {
  if (error instanceof AIError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error:
          "Some information is missing or invalid. Please review your entries.",
        code: "INVALID_INPUT",
      },
      { status: 400 },
    );
  return NextResponse.json(
    {
      error: "The request could not be completed. Please try again.",
      code: "UNEXPECTED",
    },
    { status: 500 },
  );
}
