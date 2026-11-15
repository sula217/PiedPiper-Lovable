import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { profileSchema } from "@/lib/profile";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import {
  STARTERS_INSTRUCTION,
  starterFacts,
  startersResponseSchema,
  verifyStarters,
} from "@/lib/starters";

export const runtime = "nodejs";
export const maxDuration = 45;

const bodySchema = z.object({
  a: profileSchema,
  b: profileSchema,
  /** The guest confirmed both people said yes (simulated in the demo). */
  mutualConfirmed: z.literal(true),
  processingConsent: z.literal(true),
});

/**
 * "Break the ice with Piper": one Gemini call that drafts three opening
 * messages from approved shared facts. Fictional demo profiles only. The
 * response is verified; nothing is sent to anyone.
 */
export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await guardedBody(req));
    if (!body.a.fictional || !body.b.fictional)
      throw new AIError(
        "INVALID_CONTEXT",
        "Conversation starters are limited to fictional demo profiles.",
        400,
      );
    const facts = starterFacts(body.a, body.b);
    const raw = await generateJSON(
      startersResponseSchema,
      STARTERS_INSTRUCTION,
      {
        sender: { name: body.a.name },
        match: { name: body.b.name },
        sharedFacts: facts.map(({ id, side, label, value }) => ({
          id,
          person: side === "a" ? "sender" : "match",
          label,
          value,
        })),
      },
      {
        maxOutputTokens: 900,
        timeoutMs: 25000,
        temperature: 0.7,
        maxRequests: 2,
      },
    );
    const starters = verifyStarters(raw, facts);
    return NextResponse.json(
      {
        starters,
        rejected: 3 - starters.length,
        notice: raw.providerNotice ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
