"use client";
import { useState } from "react";
import { Copy, LoaderCircle, PenLine, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import {
  AIModeBadge,
  invalidateGeminiStatus,
  liveUnavailable,
  useGeminiStatus,
} from "./ai-status";
import { templateStarters, type Starter } from "@/lib/starters";
import type { Profile } from "@/lib/profile";

const toneLabel = {
  casual: "Casual",
  playful: "Playful",
  thoughtful: "Thoughtful",
};

/**
 * "Break the ice with Piper": three optional openers. Choosing one only puts
 * it in the composer for editing; the person sends it themselves.
 */
export function Icebreakers({
  profile,
  peer,
  onUse,
}: {
  profile: Profile;
  peer: Profile;
  onUse: (text: string) => void;
}) {
  const [live, setLive] = useState<Starter[] | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const status = useGeminiStatus();
  const templates = templateStarters(profile, peer);
  // Live suggestions replace templates tone by tone; missing tones keep the template.
  const shown = templates.map((t) => live?.find((l) => l.tone === t.tone) ?? t);
  async function personalize() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ai/starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          a: profile,
          b: peer,
          mutualConfirmed: true,
          processingConsent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gemini is unavailable.");
      setLive(data.starters);
      setMessage(
        data.starters.length
          ? `Live AI wrote ${data.starters.length} of 3, each checked against your shared facts.${data.rejected ? " Any that couldn't be verified keep the template." : ""}`
          : "Gemini's drafts couldn't be verified, so the templates are shown.",
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Gemini is unavailable."} The template suggestions still work.`,
      );
    } finally {
      invalidateGeminiStatus();
      setBusy(false);
    }
  }
  return (
    <section className="icebreakers" aria-labelledby="ice-title">
      <div className="ice-head">
        <h3 id="ice-title">
          <Sparkles size={15} /> Break the ice with Piper
        </h3>
        <small>
          Pick one, edit it, and send it yourself. Piper never sends for you.
        </small>
      </div>
      <ul>
        {shown.map((s) => (
          <li key={s.tone}>
            <span className="ice-tone">
              {toneLabel[s.tone]} ·{" "}
              <em>
                {s.source === "gemini" ? "LIVE AI · VERIFIED" : "TEMPLATE"}
              </em>
            </span>
            <p>{s.text}</p>
            <div className="ice-actions">
              <Button size="sm" variant="outline" onClick={() => onUse(s.text)}>
                <PenLine size={13} /> Use & edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(s.text)
                    .then(() => setMessage("Copied to your clipboard."))
                    .catch(() =>
                      setError("Copy isn't available in this browser."),
                    )
                }
              >
                <Copy size={13} /> Copy
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="ice-live">
        <AIModeBadge mode="live" status={status} />
        <label className="check-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Send our shared fictional facts to Gemini
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={!consent || busy || liveUnavailable(status)}
          onClick={() => void personalize()}
        >
          {busy ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Personalize with live AI
        </Button>
      </div>
      {message && (
        <p className="saved-text" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
