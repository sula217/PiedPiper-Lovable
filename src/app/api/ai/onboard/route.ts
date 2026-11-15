import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transcriptSchema, onboardingResponseSchema } from "@/lib/ai-schema";
import { generateJSON, AIError } from "@/lib/gemini";
import { guardedBody, apiError } from "@/lib/api-guard";
import { interviewMissing, PIPER_INSTRUCTION } from "@/lib/onboarding";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({
  messages: transcriptSchema.min(1),
  adultConfirmed: z.literal(true),
  processingConsent: z.literal(true),
  mode: z.enum(["demo", "real"]),
});
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await guardedBody(req));
    if (body.mode === "real" && process.env.ALLOW_REAL_AI_PROCESSING !== "true")
      throw new AIError(
        "REAL_AI_DISABLED",
        "AI interviews for real profiles are not enabled. You can create your profile manually, or use fictional details in the demo.",
        403,
      );
    const result = await generateJSON(
      onboardingResponseSchema,
      PIPER_INSTRUCTION,
      body.messages,
    );
    result.readyForReview =
      result.readyForReview && !interviewMissing(result.draft).length;
    return NextResponse.json(
      { ...result, source: "gemini" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
