import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
const measurements: Record<string, unknown> = { profiles: 180 };
afterAll(() => {
  mkdirSync(new URL("../artifacts/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("../artifacts/demo-evaluation.json", import.meta.url),
    JSON.stringify(measurements, null, 2),
  );
});
import {
  demoProfiles,
  legacyDemoProfiles,
  demoPlanning,
  sampleProfile,
} from "../src/lib/fixtures";
import generated from "../src/lib/generated/demo-population.json" with { type: "json" };
import { profileSchema, type Profile } from "../src/lib/profile";
import { eligibility, recommend, exclusionSummary } from "../src/lib/matching";
import { initialDemo, migrateDemo, reduceDemo } from "../src/lib/demo-store";
import { planningSchema, computeOverlap } from "../src/lib/planning";
import { runInvestigation, scriptedBrain } from "../src/lib/agents";

describe("Reproducible expanded demo population", () => {
  it("validates 180 unique fictional adults and every planning record", () => {
    expect(demoProfiles).toHaveLength(180);
    expect(new Set(demoProfiles.map((p) => p.id)).size).toBe(180);
    for (const p of demoProfiles) {
      expect(profileSchema.safeParse(p).success).toBe(true);
      expect(p.fictional).toBe(true);
      expect(p.age).toBeGreaterThanOrEqual(21);
      expect(p.age).toBeLessThanOrEqual(45);
      expect(planningSchema.safeParse(demoPlanning[p.id]).success).toBe(true);
    }
    expect(generated.seed).toBe(22022026);
    expect(generated.profiles.length).toBe(162);
  });
  it("preserves every original demo profile and scenario", () => {
    expect(legacyDemoProfiles).toHaveLength(18);
    for (const old of legacyDemoProfiles)
      expect(demoProfiles.find((p) => p.id === old.id)).toEqual(old);
    expect(demoPlanning.lena.availability?.shareWithMatches).toBe(true);
    expect(demoPlanning.sophie.availability?.shareWithMatches).toBe(false);
  });
  it("includes positive, negative, uncertain, and paused examples across four cities", () => {
    for (const city of ["New York City", "San Francisco", "Chicago", "Austin"])
      expect(
        demoProfiles.filter((p) => p.city === city).length,
      ).toBeGreaterThanOrEqual(30);
    expect(
      demoProfiles.filter((p) => !p.readyToConnect).length,
    ).toBeGreaterThan(8);
    expect(demoProfiles.some((p) => p.attributes.children === null)).toBe(true);
    expect(demoProfiles.some((p) => p.attributes.smoking === "yes")).toBe(true);
  });
  it("provides multiple reciprocal candidates for 36 city/gender/goal combinations", () => {
    const coverage = [];
    for (const city of ["New York City", "San Francisco", "Chicago", "Austin"])
      for (const gender of ["woman", "man", "nonbinary"] as const)
        for (const intent of [
          "long-term",
          "life-partner",
          "exploring",
        ] as const) {
          const p: Profile = {
            ...sampleProfile(),
            approved: true,
            city,
            gender,
            intent,
            age: 26,
            preferences: {
              ...sampleProfile().preferences,
              minAge: 21,
              maxAge: 45,
              genders:
                gender === "man"
                  ? ["woman"]
                  : gender === "woman"
                    ? ["man"]
                    : ["nonbinary"],
              hard: ["smoking"],
            },
          };
          const ranked = recommend(p, demoProfiles);
          coverage.push(ranked.length);
          expect(
            ranked.length,
            `${city}/${gender}/${intent}`,
          ).toBeGreaterThanOrEqual(3);
          for (const r of ranked)
            expect(eligibility(p, r.profile).eligible).toBe(true);
        }
    measurements.coverage = {
      cohorts: 36,
      min: Math.min(...coverage),
      max: Math.max(...coverage),
    };
    console.log(
      `Coverage: 36 representative cohorts; eligible candidates min=${Math.min(...coverage)}, max=${Math.max(...coverage)}.`,
    );
  });
  it("supports representative ages 21 through 45 without widening ranges", () => {
    for (const age of [21, 26, 32, 40, 45]) {
      const p = { ...sampleProfile(), approved: true, age };
      expect(recommend(p, demoProfiles).length).toBeGreaterThan(2);
    }
  });
  it("keeps hard conflicts excluded and explains truly empty results", () => {
    const p = { ...sampleProfile(), approved: true };
    for (const r of recommend(p, demoProfiles)) {
      expect(r.profile.attributes.smoking).not.toBe("yes");
      expect(r.profile.attributes.children).not.toBe("no");
    }
    p.preferences.minAge = 99;
    p.preferences.maxAge = 100;
    expect(recommend(p, demoProfiles)).toEqual([]);
    expect(
      exclusionSummary(p, demoProfiles).some((r) =>
        r.reason.includes("age ranges"),
      ),
    ).toBe(true);
  });
  it("normalizes NYC without widening locality or changing city preference", () => {
    const p = { ...sampleProfile(), approved: true, city: "NYC" };
    expect(recommend(p, demoProfiles).length).toBeGreaterThan(2);
    expect(
      recommend(p, demoProfiles).every(
        (r) => r.profile.city === "New York City",
      ),
    ).toBe(true);
  });
  it("ranks deterministically, excludes paused users, and stays fast on the full pool", () => {
    const p = { ...sampleProfile(), approved: true };
    const expected = recommend(p, demoProfiles).map((r) => r.profile.id);
    const start = performance.now();
    for (let i = 0; i < 20; i++)
      expect(recommend(p, demoProfiles).map((r) => r.profile.id)).toEqual(
        expected,
      );
    const elapsed = performance.now() - start;
    measurements.meanRankingMs = elapsed / 20;
    console.log(`180-profile ranking average: ${(elapsed / 20).toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(4000);
    expect(recommend({ ...p, readyToConnect: false }, demoProfiles)).toEqual(
      [],
    );
    expect(
      recommend(p, demoProfiles).every((r) => r.profile.readyToConnect),
    ).toBe(true);
  });
  it("migrates old browser state without losing answers, messages, blocks or sessions", () => {
    const saved = initialDemo();
    saved.candidates = structuredClone(legacyDemoProfiles);
    saved.candidates[0].attributes.children = "yes";
    saved.profile = {
      ...sampleProfile(),
      approved: true,
      blockedIds: ["iris"],
    };
    saved.decisions.lena = "interested";
    saved.counterparts.lena = "interested";
    saved.messages = [
      {
        id: "old",
        peerId: "lena",
        sender: "you",
        text: "Saved message",
        at: new Date().toISOString(),
      },
    ];
    const serialized = JSON.stringify(saved),
      start = performance.now();
    const migrated = migrateDemo(JSON.parse(serialized));
    measurements.migrationMs = performance.now() - start;
    measurements.storageBytes = Buffer.byteLength(JSON.stringify(migrated));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(migrated.candidates).toHaveLength(180);
    expect(migrated.candidates[0].attributes.children).toBe("yes");
    expect(migrated.messages).toEqual(saved.messages);
    expect(migrated.profile?.blockedIds).toEqual(["iris"]);
    expect(migrated.decisions).toEqual(saved.decisions);
    expect(migrateDemo(migrated).candidates).toHaveLength(180);
    expect(JSON.stringify(migrated).length).toBeLessThan(1_000_000);
  });
  it("bounds collections at six and revalidates eligibility before adding a batch", () => {
    let s = reduceDemo(initialDemo(), {
      type: "profile",
      profile: { ...sampleProfile(), approved: true },
    });
    const ids = recommend(s.profile!, s.candidates).map((r) => r.profile.id);
    s = reduceDemo(s, { type: "introductions", ids: ids.slice(0, 3) });
    s = reduceDemo(s, { type: "introductions", ids: ids.slice(3, 6) });
    expect(s.introducedIds).toHaveLength(6);
    expect(() =>
      reduceDemo(s, { type: "introductions", ids: ids.slice(6, 7) }),
    ).toThrow();
    s = reduceDemo(s, { type: "ready", ready: false });
    expect(() =>
      reduceDemo(s, { type: "introductions", ids: [ids[0]] }),
    ).toThrow();
  });
  it("runs grounded scripted investigations and overlap on a generated candidate", async () => {
    const p = { ...sampleProfile(), approved: true };
    const peer = recommend(
      p,
      demoProfiles.filter((p) => p.id.startsWith("fictional-")),
    )[0].profile;
    const session = await runInvestigation({
      a: p,
      b: peer,
      brain: scriptedBrain(),
    });
    expect(session.turns.length).toBeGreaterThan(0);
    expect(session.source).toBe("scripted");
    const planning = demoPlanning[peer.id];
    expect(planning.datePreferences.activityTypes.length).toBeGreaterThan(0);
    const a = { ...planning.availability!, shareWithMatches: true };
    if (
      planning.availability?.shareWithMatches &&
      planning.availability.openToMeetingSoon
    ) {
      const overlap = computeOverlap(a, planning.availability, {
        from: new Date("2026-11-16T00:00:00Z"),
      });
      expect(overlap.status).toBe("ok");
      if (overlap.status === "ok")
        expect(overlap.windows.length).toBeGreaterThan(0);
    }
  });
});
