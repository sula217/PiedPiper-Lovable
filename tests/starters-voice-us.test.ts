import { describe, expect, it } from "vitest";
import { demoProfiles, sampleProfile } from "../src/lib/fixtures";
import {
  starterFacts,
  templateStarters,
  verifyStarters,
} from "../src/lib/starters";
import { rankVoices, speakableText } from "../src/lib/speech";
import { cityIdFor, cities, usCityIds } from "../src/lib/places/types";
import { usPlaces } from "../src/lib/places/curated";
import { recommend } from "../src/lib/matching";
import { PIPER_INSTRUCTION, PIPER_OPENING } from "../src/lib/onboarding";

const jamie = () => ({ ...sampleProfile(), approved: true });
const lena = () => demoProfiles.find((p) => p.id === "lena")!;

describe("Break the ice with Piper", () => {
  it("offers casual, playful and thoughtful templates grounded in shared facts", () => {
    const s = templateStarters(jamie(), lena());
    expect(s.map((x) => x.tone)).toEqual(["casual", "playful", "thoughtful"]);
    const facts = new Set(starterFacts(jamie(), lena()).map((f) => f.id));
    for (const x of s) {
      expect(x.source).toBe("template");
      expect(x.text).toContain("Lena");
      for (const id of x.evidence) expect(facts.has(id), id).toBe(true);
    }
  });
  it("keeps only verified, safe AI suggestions", () => {
    const facts = starterFacts(jamie(), lena());
    const hiking = facts.find((f) => f.id === "a.interest.hiking")!.id;
    const out = verifyStarters(
      {
        starters: [
          {
            tone: "casual",
            text: "Hi Lena! Favorite trail lately?",
            evidence: [hiking],
          },
          {
            tone: "playful",
            text: "Add me on instagram @jamie",
            evidence: [hiking],
          },
          {
            tone: "thoughtful",
            text: "What matters most to you?",
            evidence: ["b.bio"],
          },
        ],
      },
      facts,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tone: "casual", source: "gemini" });
  });
  it("never sends bios or ages to the model", () => {
    for (const f of starterFacts(jamie(), lena()))
      expect(f.id).not.toMatch(/\.(bio|age|city)$/);
  });
});

describe("Spoken replies", () => {
  it("prefers natural en-US voices and drops non-English ones", () => {
    const ranked = rankVoices([
      { name: "Microsoft David", lang: "en-US", voiceURI: "d" },
      { name: "Google Deutsch", lang: "de-DE", voiceURI: "g" },
      { name: "Microsoft Aria Online (Natural)", lang: "en-US", voiceURI: "a" },
      { name: "Daniel", lang: "en-GB", voiceURI: "b" },
    ]);
    expect(ranked.map((v) => v.voiceURI)).toEqual(["a", "d", "b"]);
  });
  it("keeps spoken replies short", () => {
    expect(
      speakableText("word ".repeat(100)).split(" ").length,
    ).toBeLessThanOrEqual(61);
  });
});

describe("US-first demo", () => {
  it("supports four US cities with US time zones and USD", () => {
    expect(usCityIds).toEqual([
      "new-york",
      "san-francisco",
      "chicago",
      "austin",
    ]);
    for (const id of usCityIds) {
      expect(cities[id].currency).toBe("USD");
      expect(cities[id].timeZone).toMatch(/^America\//);
      expect(
        usPlaces.filter((p) => p.city === id).length,
      ).toBeGreaterThanOrEqual(12);
    }
    expect(cityIdFor("NYC")).toBe("new-york");
    expect(cityIdFor("Brooklyn, NY")).toBe("new-york");
    expect(cityIdFor("SF")).toBe("san-francisco");
  });
  it("US places come from OpenStreetMap with no prices except public parks", () => {
    for (const p of usPlaces) {
      expect(p.source.url).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
      if (p.price !== null) expect(p.category).toBe("park");
    }
  });
  it("gives a typical guest in every city several eligible introductions", () => {
    for (const city of [
      "New York City",
      "San Francisco",
      "Chicago",
      "Austin",
    ]) {
      const p = {
        ...jamie(),
        city,
        preferences: { ...jamie().preferences, hard: [] as never[] },
      };
      expect(recommend(p, demoProfiles).length, city).toBeGreaterThanOrEqual(3);
    }
  });
  it("Piper opens with one question and is told to ask one at a time", () => {
    expect(PIPER_OPENING.match(/\?/g)).toHaveLength(1);
    expect(PIPER_INSTRUCTION).toMatch(/exactly ONE primary question/);
    expect(PIPER_INSTRUCTION).toMatch(/NEVER ask again/);
  });
});
