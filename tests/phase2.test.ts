import { describe, expect, it } from "vitest";
import {
  demoPlanning,
  demoProfiles,
  samplePlanning,
} from "../src/lib/fixtures";
import {
  availabilitySchema,
  computeOverlap,
  isConfirmedDate,
  proposalSlot,
  slotSchema,
  zonedTimeToUtc,
  type Availability,
} from "../src/lib/planning";
import {
  buildDateContext,
  containsVenueFacts,
  finalizeIdeas,
  templateIdeas,
  verifyIdeas,
} from "../src/lib/dates";
import {
  isSensitive,
  keywordSuggestions,
  verifyEnrichment,
  type EnrichmentInput,
} from "../src/lib/enrichment";
import {
  canPlanDate,
  GUEST_ID,
  initialDemo,
  matched,
  migrateDemo,
  reduceDemo,
  type DemoState,
} from "../src/lib/demo-store";
import { recommend } from "../src/lib/matching";
import { buildApprovedContext } from "../src/lib/agents";
import { sampleProfile } from "../src/lib/fixtures";

// Monday 16 Nov 2026, 00:00 in New York (America/New_York, UTC-5).
const FROM = new Date("2026-11-16T05:00:00.000Z");
const jamie = () => ({ ...sampleProfile(), approved: true });
const sharing = (p = samplePlanning()) => ({
  ...p,
  availability: { ...p.availability!, shareWithMatches: true },
});
const avail = (over: Partial<Availability>): Availability => ({
  timeZone: "America/New_York",
  slots: [],
  openToMeetingSoon: true,
  preference: null,
  shareWithMatches: true,
  ...over,
});

describe("Mutual availability", () => {
  it("computes actual weekly overlapping intervals", () => {
    const r = computeOverlap(
      sharing().availability,
      demoPlanning.lena.availability,
      { from: FROM },
    );
    expect(r.status).toBe("ok");
    expect(r.status === "ok" && r.windows).toEqual([
      { start: "2026-11-18T22:00:00.000Z", end: "2026-11-19T03:00:00.000Z" }, // Wed evening
      { start: "2026-11-21T13:00:00.000Z", end: "2026-11-21T17:00:00.000Z" }, // Sat morning
      { start: "2026-11-22T17:00:00.000Z", end: "2026-11-23T03:00:00.000Z" }, // Sun afternoon + evening (merged)
    ]);
  });
  it("reports no overlap instead of inventing one", () => {
    expect(
      computeOverlap(sharing().availability, demoPlanning.maya.availability, {
        from: FROM,
      }).status,
    ).toBe("no-overlap");
  });
  it("handles different time zones, including across the date line", () => {
    const ny = avail({ slots: [{ day: "sat", start: "08:00", end: "12:00" }] });
    const london = avail({
      timeZone: "Europe/London",
      slots: [{ day: "sat", start: "15:00", end: "20:00" }],
    });
    const r = computeOverlap(ny, london, { from: FROM });
    expect(r.status === "ok" && r.windows).toEqual([
      { start: "2026-11-21T15:00:00.000Z", end: "2026-11-21T17:00:00.000Z" },
    ]);
    const nyAfternoon = avail({
      slots: [{ day: "sat", start: "12:00", end: "17:00" }],
    });
    const almaty = avail({
      timeZone: "Asia/Almaty",
      slots: [{ day: "sun", start: "00:00", end: "03:00" }],
    });
    const r2 = computeOverlap(nyAfternoon, almaty, { from: FROM });
    expect(r2.status === "ok" && r2.windows).toEqual([
      { start: "2026-11-21T19:00:00.000Z", end: "2026-11-21T22:00:00.000Z" },
    ]);
  });
  it("converts wall-clock times correctly across daylight-saving changes", () => {
    expect(
      new Date(
        zonedTimeToUtc("America/New_York", 2026, 3, 7, 720),
      ).toISOString(),
    ).toBe("2026-03-07T17:00:00.000Z");
    expect(
      new Date(
        zonedTimeToUtc("America/New_York", 2026, 3, 8, 720),
      ).toISOString(),
    ).toBe("2026-03-08T16:00:00.000Z");
  });
  it("respects people who are not open to meeting soon", () => {
    expect(
      computeOverlap(sharing().availability, demoPlanning.nora.availability, {
        from: FROM,
      }),
    ).toEqual({ status: "not-open", who: ["b"] });
  });
  it("never assumes availability when none was entered", () => {
    expect(
      computeOverlap(sharing().availability, demoPlanning.jules.availability, {
        from: FROM,
      }),
    ).toEqual({ status: "missing", who: ["b"] });
    expect(
      computeOverlap(avail({ slots: [] }), demoPlanning.lena.availability, {
        from: FROM,
      }),
    ).toEqual({ status: "missing", who: ["a"] });
  });
  it("requires both people's consent before showing overlap", () => {
    expect(
      computeOverlap(
        samplePlanning().availability,
        demoPlanning.lena.availability,
        { from: FROM },
      ),
    ).toEqual({ status: "not-shared", who: ["a"] });
    expect(
      computeOverlap(sharing().availability, demoPlanning.sophie.availability, {
        from: FROM,
      }),
    ).toEqual({ status: "not-shared", who: ["b"] });
  });
  it("validates time windows and time zones", () => {
    expect(
      slotSchema.safeParse({ day: "mon", start: "12:00", end: "09:00" })
        .success,
    ).toBe(false);
    expect(
      availabilitySchema.safeParse(avail({ timeZone: "Mars/Olympus" })).success,
    ).toBe(false);
  });
});

function connected(): DemoState {
  let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
  s = reduceDemo(s, { type: "decision", id: "lena", decision: "interested" });
  s = reduceDemo(s, {
    type: "counterpart",
    id: "lena",
    decision: "interested",
  });
  return reduceDemo(s, { type: "planning", planning: sharing() });
}
const satSlot = () =>
  proposalSlot({
    start: "2026-11-21T13:00:00.000Z",
    end: "2026-11-21T17:00:00.000Z",
  });
const propose = (s: DemoState) =>
  reduceDemo(s, {
    type: "propose",
    id: "lena",
    activity: { category: "museum", title: "An afternoon at an art museum" },
    ...satSlot(),
    now: FROM.toISOString(),
  });

describe("First-date planning", () => {
  it("is only available after mutual approval", () => {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
    s = reduceDemo(s, { type: "planning", planning: sharing() });
    s = reduceDemo(s, { type: "decision", id: "lena", decision: "interested" });
    expect(canPlanDate(s, "lena")).toBe(false);
    expect(() => propose(s)).toThrow(/mutual|both people/i);
    expect(() =>
      reduceDemo(s, {
        type: "date-ideas",
        id: "lena",
        result: { ideas: [], generatedAt: FROM.toISOString(), notice: null },
      }),
    ).toThrow();
    expect(canPlanDate(connected(), "lena")).toBe(true);
  });
  it("grounds ideas in confirmed shared interests only", () => {
    const ctx = buildDateContext(
      jamie(),
      demoProfiles.find((p) => p.id === "maya")!,
      { a: samplePlanning(), b: demoPlanning.maya },
      [],
      "America/New_York",
    );
    const shared = ctx.facts
      .filter((f) => f.id.startsWith("shared.interest."))
      .map((f) => f.value);
    expect(shared.sort()).toEqual(["art", "cooking"]);
    expect(templateIdeas(ctx).every((i) => i.evidence.length > 0)).toBe(true);
  });
  it("rejects fabricated venue facts and ungrounded suggestions", () => {
    for (const t of [
      "Coffee at Blue Bottle Coffee",
      "Tickets cost $25 each",
      "It opens at 9am",
      "I made a reservation for two",
      "Meet at 123 Main Street",
      "Visit www.example.com",
    ])
      expect(containsVenueFacts(t)).toBe(true);
    expect(containsVenueFacts("An afternoon at an art museum or gallery")).toBe(
      false,
    );
    const ctx = buildDateContext(
      jamie(),
      demoProfiles.find((p) => p.id === "lena")!,
      { a: samplePlanning(), b: demoPlanning.lena },
      [],
      "America/New_York",
    );
    const verified = verifyIdeas(
      {
        suggestions: [
          {
            category: "museum",
            title: "An afternoon at an art museum",
            why: "You both listed art as an interest.",
            evidence: ["shared.interest.art"],
            windowIndex: null,
          },
          {
            category: "coffee",
            title: "Coffee at Blue Bottle Coffee",
            why: "A cozy spot you will both like.",
            evidence: ["shared.interest.reading"],
            windowIndex: null,
          },
          {
            category: "sport",
            title: "A pickup basketball game",
            why: "Because it is fun for everyone.",
            evidence: ["shared.interest.basketball"],
            windowIndex: 4,
          },
        ],
      },
      ctx,
    );
    expect(verified.map((v) => v.category)).toEqual(["museum"]);
    const final = finalizeIdeas(verified, ctx);
    expect(final.length).toBeGreaterThanOrEqual(2);
    expect(final.filter((i) => i.source === "template").length).toBe(
      final.length - 1,
    );
  });
  it("distinguishes a proposal from a confirmed date", () => {
    let s = propose(connected());
    const p = s.proposals[0];
    expect(p.status).toBe("proposed");
    expect(isConfirmedDate(p)).toBe(false);
    s = reduceDemo(s, {
      type: "proposal-response",
      id: "lena",
      proposalId: p.id,
      response: "accepted",
    });
    expect(isConfirmedDate(s.proposals[0])).toBe(true);
    expect(s.proposals[0].responseSimulated).toBe(true);
    expect(() =>
      reduceDemo(s, {
        type: "proposal-response",
        id: "lena",
        proposalId: p.id,
        response: "declined",
      }),
    ).toThrow();
  });
  it("rejects proposals outside the shared availability", () => {
    expect(() =>
      reduceDemo(connected(), {
        type: "propose",
        id: "lena",
        activity: { category: "coffee", title: "Coffee" },
        start: "2026-11-17T13:00:00.000Z",
        end: "2026-11-17T14:00:00.000Z",
        now: FROM.toISOString(),
      }),
    ).toThrow(/shared availability/);
  });
  it("supports updates and revocation", () => {
    let s = propose(connected());
    const first = s.proposals[0].id;
    s = propose(s); // a new proposal replaces the open one
    expect(s.proposals.find((p) => p.id === first)!.status).toBe("withdrawn");
    expect(s.proposals.filter((p) => p.status === "proposed")).toHaveLength(1);
    // Revoking availability consent withdraws open proposals and hides overlap.
    s = reduceDemo(s, { type: "planning", planning: samplePlanning() });
    expect(s.proposals.every((p) => p.status === "withdrawn")).toBe(true);
    expect(
      computeOverlap(
        s.planning[GUEST_ID].availability,
        s.planning.lena.availability,
        { from: FROM },
      ).status,
    ).toBe("not-shared");
    // Blocking withdraws even an accepted date and ends planning access.
    let t = propose(connected());
    t = reduceDemo(t, {
      type: "proposal-response",
      id: "lena",
      proposalId: t.proposals[0].id,
      response: "accepted",
    });
    t = reduceDemo(t, { type: "block", id: "lena" });
    expect(t.proposals[0].status).toBe("withdrawn");
    expect(() => propose(t)).toThrow();
  });
});

const input = (over: Partial<EnrichmentInput>): EnrichmentInput => ({
  bio: "",
  interests: "",
  music: "",
  activities: "",
  captions: "",
  ...over,
});
describe("Profile enrichment", () => {
  it("keeps only suggestions quoted from the person's own words and never sensitive inferences", () => {
    const text = input({
      interests: "Weekend bouldering, jazz records, and Sunday church choir.",
    });
    const out = verifyEnrichment(
      {
        interests: [
          {
            value: "climbing",
            reason: "You mentioned bouldering.",
            quote: "weekend bouldering",
          },
          {
            value: "religion",
            reason: "You attend church.",
            quote: "church choir",
          },
          {
            value: "skydiving",
            reason: "Invented.",
            quote: "I love skydiving",
          },
        ],
        activityTags: [
          { value: "cultural-event", reason: "Jazz.", quote: "jazz records" },
        ],
        conversationTopics: [],
        summary: "A Christian jazz lover.",
      },
      text,
      { interests: [], activityTypes: [] },
    );
    expect(out.map((s) => s.value)).toEqual(["climbing", "cultural-event"]);
    expect(out.every((s) => s.status === "pending")).toBe(true);
    expect(isSensitive("introvert")).toBe(true);
  });
  it("stores suggestions as pending without changing the profile", () => {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
    const before = structuredClone(s.profile);
    const suggestions = keywordSuggestions(
      input({ interests: "I love climbing and jazz concerts." }),
      { interests: before!.interests, activityTypes: [] },
    );
    s = reduceDemo(s, { type: "enrichment-suggestions", suggestions });
    expect(s.profile).toEqual(before);
    expect(s.enrichment.every((x) => x.status === "pending")).toBe(true);
    // Pending suggestions are never part of what a matchmaker may share.
    expect(JSON.stringify(buildApprovedContext(s.profile!, "a"))).not.toContain(
      "climbing",
    );
  });
  it("applies an item only on approval, and rejection changes nothing", () => {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
    const suggestions = keywordSuggestions(
      input({ interests: "I love climbing and yoga." }),
      { interests: s.profile!.interests, activityTypes: [] },
    );
    s = reduceDemo(s, { type: "enrichment-suggestions", suggestions });
    const climb = s.enrichment.find((x) => x.value === "climbing")!,
      yoga = s.enrichment.find((x) => x.value === "yoga")!;
    s = reduceDemo(s, {
      type: "enrichment-decision",
      suggestionId: yoga.id,
      approve: false,
    });
    expect(s.profile!.interests).not.toContain("yoga");
    s = reduceDemo(s, {
      type: "enrichment-decision",
      suggestionId: climb.id,
      approve: true,
    });
    expect(s.profile!.interests).toContain("climbing");
    expect(() =>
      reduceDemo(s, {
        type: "enrichment-decision",
        suggestionId: climb.id,
        approve: true,
      }),
    ).toThrow();
  });
});

describe("Ready to Connect", () => {
  it("removes a paused person from new recommendations in both directions", () => {
    const paused = { ...jamie(), readyToConnect: false };
    expect(recommend(paused, demoProfiles)).toEqual([]);
    const lenaPaused = demoProfiles.map((p) =>
      p.id === "lena" ? { ...p, readyToConnect: false } : p,
    );
    expect(
      recommend(jamie(), lenaPaused).some((r) => r.profile.id === "lena"),
    ).toBe(false);
  });
  it("preserves existing matches and messages while paused, and blocks new interest", () => {
    let s = connected();
    s = reduceDemo(s, { type: "ready", ready: false });
    expect(matched(s, "lena")).toBe(true);
    s = reduceDemo(s, { type: "message", id: "lena", text: "Still here." });
    expect(s.messages).toHaveLength(1);
    expect(() =>
      reduceDemo(s, { type: "decision", id: "sam", decision: "interested" }),
    ).toThrow(/paused/);
    s = reduceDemo(s, { type: "ready", ready: true });
    expect(s.profile!.readyToConnect).toBe(true);
  });
});

describe("Demo persistence", () => {
  it("migrates Phase 1 (v1) browser state without losing progress", () => {
    const v1 = {
      ...initialDemo(),
      version: 1,
      profile: { ...jamie(), id: "guest" },
      decisions: { lena: "interested" },
    } as Record<string, unknown>;
    for (const k of [
      "planning",
      "agentSessions",
      "dateIdeas",
      "proposals",
      "enrichment",
    ])
      delete v1[k];
    const migrated = migrateDemo(JSON.parse(JSON.stringify(v1)));
    expect(migrated.version).toBe(2);
    expect(migrated.profile?.name).toBe("Jamie");
    expect(migrated.profile?.readyToConnect).toBe(true);
    expect(migrated.decisions.lena).toBe("interested");
    expect(migrated.planning.lena.availability).not.toBeNull();
    expect(migrateDemo(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });
  it("rejects corrupted saved state", () => {
    expect(() => migrateDemo({ version: 2, profile: "nope" })).toThrow();
  });
});
