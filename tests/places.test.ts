import { describe, expect, it, vi } from "vitest";
import {
  demoPlanning,
  demoProfiles,
  sampleProfile,
  samplePlanning,
} from "../src/lib/fixtures";
import {
  computeOverlap,
  formatWindow,
  isConfirmedDate,
  type OverlapResult,
} from "../src/lib/planning";
import { intersection } from "../src/lib/matching";
import {
  defaultFilters,
  DISCOVERY_HORIZON_DAYS,
  eventSlot,
  isPast,
  priceLabel,
  recommendDates,
  runSlot,
  venueCategory,
  venueName,
  type DiscoveryFilters,
  type DiscoveryInput,
} from "../src/lib/date-discovery";
import { curatedEvents, curatedPlaces } from "../src/lib/places/curated";
import {
  curatedProvider,
  discoverVenues,
  osmProvider,
  placeFromOsm,
  type VenueProvider,
} from "../src/lib/places/provider";
import {
  eventSchema,
  isSafeLink,
  placeSchema,
  TICKETON_HOSTS,
} from "../src/lib/places/types";
import { verifyVenueExplanations } from "../src/lib/dates";
import { initialDemo, reduceDemo, type DemoState } from "../src/lib/demo-store";

// Saturday 14 Nov 2026, 20:00 in Astana (UTC+5).
const NOW = new Date("2026-11-14T15:00:00.000Z");
const jamie = () => ({ ...sampleProfile(), approved: true });
const lena = () => demoProfiles.find((p) => p.id === "lena")!;
const shared = () => intersection(jamie().interests, lena().interests);
// These tests exercise the legacy Astana event data, so both fictional
// people keep Astana time here (the US demo uses US time zones).
const kz = <T extends { timeZone: string }>(a: T): T => ({
  ...a,
  timeZone: "Asia/Almaty",
});
const sharing = () => {
  const p = samplePlanning();
  return {
    ...p,
    availability: kz({ ...p.availability!, shareWithMatches: true }),
  };
};
const lenaAvailability = () => kz(demoPlanning.lena.availability!);
const overlapAt = (now: Date): OverlapResult =>
  computeOverlap(sharing().availability, lenaAvailability(), {
    from: now,
    days: DISCOVERY_HORIZON_DAYS,
  });
const input = (
  over: Partial<DiscoveryInput> = {},
  filters: Partial<DiscoveryFilters> = {},
): DiscoveryInput => ({
  mutual: true,
  names: { a: "Jamie", b: "Lena" },
  sharedInterests: shared(),
  activityPrefs: {
    a: sharing().datePreferences.activityTypes,
    b: demoPlanning.lena.datePreferences.activityTypes,
  },
  overlap: overlapAt(NOW),
  now: NOW,
  places: curatedPlaces,
  events: curatedEvents,
  filters: { ...defaultFilters("astana"), ...filters },
  ...over,
});
const ok = (i: DiscoveryInput) => {
  const r = recommendDates(i);
  if (r.status !== "ok") throw new Error("expected ok");
  return r;
};

describe("Curated data integrity", () => {
  it("every record validates and carries a source and verification date", () => {
    for (const p of curatedPlaces) {
      expect(placeSchema.safeParse(p).success).toBe(true);
      expect(p.source.url).toMatch(
        /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/,
      );
      expect(p.source.attribution).toMatch(/OpenStreetMap contributors/);
      expect(p.lastVerified).toBe(
        p.country === "United States" ? "2026-11-15" : "2026-11-14",
      );
    }
    for (const e of curatedEvents) {
      expect(eventSchema.safeParse(e).success).toBe(true);
      expect(e.source.name).toMatch(/Ticketon/);
      expect(e.lastVerified).toBe("2026-11-14");
    }
  });
  it("only links to official Ticketon pages and safe websites", () => {
    for (const e of curatedEvents)
      expect(isSafeLink(e.url, TICKETON_HOSTS)).toBe(true);
    for (const p of curatedPlaces)
      if (p.website) expect(isSafeLink(p.website)).toBe(true);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(
      isSafeLink("https://ticketon.kz.evil.example/event", TICKETON_HOSTS),
    ).toBe(false);
    expect(isSafeLink("https://user:pw@ticketon.kz/x", TICKETON_HOSTS)).toBe(
      false,
    );
    expect(
      isSafeLink("https://www.ticketon.kz/en/event/x", TICKETON_HOSTS),
    ).toBe(true);
  });
  it("never stores ratings, opening hours or invented prices for places", () => {
    for (const p of curatedPlaces) {
      expect(p.price === null || p.price === "free").toBe(true);
      if (p.price === "free") expect(p.category).toBe("park");
      expect(JSON.stringify(p)).not.toMatch(/rating|opening_hours|stars/i);
    }
  });
  it("stores event times with an explicit Kazakhstan offset", () => {
    for (const e of curatedEvents) {
      expect(e.timeZone).toBe("Asia/Almaty");
      if (e.startsAt) expect(e.startsAt).toMatch(/\+05:00$/);
    }
  });
});

describe("Recommendation engine", () => {
  it("requires a mutual match", () => {
    expect(recommendDates(input({ mutual: false })).status).toBe("not-matched");
  });
  it("filters by city", () => {
    const astana = ok(input());
    expect(
      [...astana.recommendations, ...astana.alternatives].every(
        (r) => r.venue.city === "astana",
      ),
    ).toBe(true);
    const almaty = ok(input({}, { city: "almaty" }));
    expect(
      [...almaty.recommendations, ...almaty.alternatives].every(
        (r) => r.venue.city === "almaty",
      ),
    ).toBe(true);
    expect(almaty.recommendations.length).toBeGreaterThan(0);
  });
  it("filters by category and returns at most three", () => {
    const r = ok(input({}, { kinds: ["concerts-events"] }));
    expect(r.recommendations.length).toBeLessThanOrEqual(3);
    expect(
      r.recommendations.every((x) => x.venue.kind === "concerts-events"),
    ).toBe(true);
    const parks = ok(
      input({}, { kinds: ["parks-outdoors"], setting: "outdoor" }),
    );
    expect(
      parks.recommendations.every(
        (x) => x.venue.type === "place" && x.venue.category === "park",
      ),
    ).toBe(true);
  });
  it("offers variety across the four groups when no category is chosen", () => {
    const r = ok(input());
    expect(new Set(r.recommendations.map((x) => x.venue.kind)).size).toBe(3);
  });
  it("excludes past events", () => {
    const later = new Date("2026-12-20T06:00:00.000Z");
    const r = ok(
      input(
        { now: later, overlap: overlapAt(later) },
        { kinds: ["concerts-events", "culture-activities"] },
      ),
    );
    const events = [...r.recommendations, ...r.alternatives].filter(
      (x) => x.venue.type === "event",
    );
    // Only the exhibition still runs (until 31 Jan 2027); dated concerts have passed.
    expect(events.map((x) => x.venue.id)).toEqual([
      "ticketon-bosch-exhibition-astana",
    ]);
    expect(r.excluded.past).toBeGreaterThan(0);
    const bosch = curatedEvents.find(
      (e) => e.id === "ticketon-bosch-exhibition-astana",
    )!;
    expect(isPast(bosch, new Date("2027-02-01T12:00:00Z"))).toBe(true);
    const zimmer = curatedEvents.find((e) =>
      e.id.startsWith("ticketon-hans-zimmer"),
    )!;
    expect(isPast(zimmer, new Date("2026-11-15T14:00:00Z"))).toBe(true); // 19:00 Astana
    expect(isPast(zimmer, new Date("2026-11-15T13:59:00Z"))).toBe(false);
  });
  it("handles time zones: an Astana 19:00 event is 14:00 UTC and is shown in Astana time", () => {
    const zimmer = curatedEvents.find((e) =>
      e.id.startsWith("ticketon-hans-zimmer"),
    )!;
    const slot = eventSlot(zimmer)!;
    expect(slot.start).toBe("2026-11-15T14:00:00.000Z");
    expect(slot.end).toBe("2026-11-15T16:00:00.000Z"); // duration not listed: 2 h assumed for planning
    expect(formatWindow(slot, "Asia/Almaty")).toMatch(/Sun, Nov 15 · 7:00\sPM/);
  });
  it("keeps a scheduled event only when it fits mutual availability", () => {
    const r = ok(input({}, { kinds: ["concerts-events"] }));
    const ids = [...r.recommendations, ...r.alternatives].map(
      (x) => x.venue.id,
    );
    // Sunday 19:00 concerts fit (both free Sunday evening) …
    expect(ids).toContain("ticketon-hans-zimmer-astana-2026-11-15");
    // … a Tuesday open mic does not (Jamie isn't free on Tuesdays).
    expect(ids).not.toContain("ticketon-open-mic-astana-2026-11-17");
    expect(r.excluded.timing).toBeGreaterThan(0);
    const fit = r.recommendations.find((x) =>
      x.venue.id.startsWith("ticketon-hans-zimmer"),
    )!;
    expect(fit.timing).toBe("event-fits");
    expect(fit.slot).toEqual(eventSlot(fit.venue as never));
  });
  it("does not match event times when availability isn't shared, and says so", () => {
    const notShared = computeOverlap(
      samplePlanning().availability,
      demoPlanning.lena.availability,
      { from: NOW },
    );
    const r = ok(input({ overlap: notShared }, { kinds: ["concerts-events"] }));
    expect(
      r.recommendations.every(
        (x) => x.timing === "availability-unknown" && x.slot === null,
      ),
    ).toBe(true);
    expect(r.recommendations[0].timingLabel).toMatch(
      /availability not compared/,
    );
  });
  it("finds a slot for an exhibition inside both its daily hours and a shared window", () => {
    const bosch = curatedEvents.find(
      (e) => e.id === "ticketon-bosch-exhibition-astana",
    )!;
    const o = overlapAt(NOW);
    const slot = runSlot(bosch, o.status === "ok" ? o.windows : [], NOW)!;
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(local.format(new Date(slot.start)) >= "11:00").toBe(true);
    expect(local.format(new Date(slot.end)) <= "21:00").toBe(true);
  });
  it("labels missing prices and never filters on unknown prices", () => {
    const cafe = curatedPlaces.find((p) => p.category === "cafe")!;
    expect(priceLabel(cafe)).toBe("Price not listed");
    const r = ok(input({}, { kinds: ["food-coffee"], budget: "free" }));
    // Cafés have no verified price, so a strict budget does not hide them.
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(
      r.recommendations.every((x) => x.priceLabel === "Price not listed"),
    ).toBe(true);
  });
  it("applies budget only to verified prices", () => {
    const low = ok(input({}, { kinds: ["concerts-events"], budget: "low" }));
    for (const x of [...low.recommendations, ...low.alternatives]) {
      const price = x.venue.price;
      if (price && price !== "free")
        expect(price.from).toBeLessThanOrEqual(5000);
    }
    expect(low.excluded.budget).toBeGreaterThan(0);
    const free = ok(input({}, { kinds: ["parks-outdoors"], budget: "free" }));
    expect(free.recommendations.every((x) => x.venue.price === "free")).toBe(
      true,
    );
  });
  it("ranks by shared interests and explains with grounded facts", () => {
    const r = ok(input({}, { kinds: ["concerts-events"] }));
    const top = r.recommendations[0];
    expect(top.matchedInterests).toContain("music");
    expect(top.reasons[0].evidence).toContain("shared.interest.music");
    const only = ok(input({}, { sharedInterestsOnly: true }));
    expect(
      only.recommendations.every((x) => x.matchedInterests.length > 0),
    ).toBe(true);
  });
  it("shows a useful empty state instead of inventing results", () => {
    const r = ok(input({ places: [], events: [] }));
    expect(r.recommendations).toEqual([]);
    expect(r.candidates).toBe(0);
  });
  it("maps venues to proposal categories", () => {
    expect(
      venueCategory(curatedPlaces.find((p) => p.category === "restaurant")!),
    ).toBe("restaurant");
    expect(
      venueCategory(curatedPlaces.find((p) => p.category === "park")!),
    ).toBe("walk");
    expect(venueCategory(curatedEvents[0])).toBe("cultural-event");
  });
});

describe("Providers", () => {
  it("a failing provider never hides curated results", async () => {
    const broken: VenueProvider = {
      id: "broken",
      label: "Broken",
      kind: "live",
      places: async () => {
        throw new Error("HTTP 504");
      },
      events: async () => [],
    };
    const { places, events, reports } = await discoverVenues("astana", [
      curatedProvider,
      broken,
    ]);
    expect(places.length).toBeGreaterThan(5);
    expect(events.length).toBeGreaterThan(3);
    expect(reports.find((r) => r.id === "broken")).toMatchObject({ ok: false });
    expect(reports.find((r) => r.id === "curated")).toMatchObject({ ok: true });
  });
  it("maps OpenStreetMap elements using only tags that exist", () => {
    const p = placeFromOsm(
      {
        type: "node",
        id: 1,
        lat: 51.1,
        lon: 71.4,
        tags: { amenity: "cafe", name: "Test Café", website: "javascript:x" },
      },
      "astana",
    )!;
    expect(p.address).toBeNull();
    expect(p.website).toBeNull(); // unsafe link dropped
    expect(p.price).toBeNull(); // no fee tag: unknown, not free
    expect(p.source.attribution).toMatch(/OpenStreetMap/);
    expect(
      placeFromOsm(
        { type: "node", id: 2, tags: { amenity: "bench" } },
        "astana",
      ),
    ).toBeNull();
    const park = placeFromOsm(
      {
        type: "way",
        id: 3,
        center: { lat: 51, lon: 71 },
        tags: { leisure: "park", name: "P", fee: "no" },
      },
      "astana",
    )!;
    expect(park.price).toBe("free");
  });
  it("caches live OpenStreetMap results and shares one in-flight request", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            elements: [
              {
                type: "node",
                id: 9,
                lat: 51,
                lon: 71,
                tags: { amenity: "cafe", name: "Live Café" },
              },
            ],
          }),
        ),
    );
    const osm = osmProvider({ fetchImpl: fetchImpl as never, ttlMs: 60000 });
    const [a, b] = await Promise.all([
      osm.places("astana"),
      osm.places("astana"),
    ]);
    await osm.places("astana");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a[0].name).toBe("Live Café");
    expect(b).toEqual(a);
    const failing = osmProvider({
      fetchImpl: (async () => new Response("busy", { status: 504 })) as never,
    });
    await expect(failing.places("astana")).rejects.toThrow(/504/);
  });
});

describe("Gemini explanations of verified recommendations", () => {
  const items = [
    {
      id: "x",
      name: "Coffee Boom",
      venue: null,
      kind: "Food & Coffee",
      category: "cafe",
      setting: "indoor",
      tags: ["coffee"],
    },
  ];
  const facts = new Set(["shared.interest.coffee", "a.kind.food-coffee"]);
  it("keeps grounded explanations that cite shared facts", () => {
    const v = verifyVenueExplanations(
      {
        explanations: [
          {
            id: "x",
            text: "You both love coffee, so Coffee Boom is an easy first meeting.",
            evidence: ["shared.interest.coffee"],
          },
        ],
      },
      items,
      facts,
    );
    expect(v.get("x")?.text).toMatch(/Coffee Boom/);
  });
  it("rejects invented prices, hours, other venues, unknown ids and scores", () => {
    for (const text of [
      "Coffee is ₸1500 there, perfect for you both.",
      "It opens at 9am, great for coffee lovers.",
      "Afterwards walk to Central Park for more coffee.",
      "A 92% match for two coffee lovers.",
      "Tickets are available tonight for you both.",
    ]) {
      const v = verifyVenueExplanations(
        {
          explanations: [
            { id: "x", text, evidence: ["shared.interest.coffee"] },
          ],
        },
        items,
        facts,
      );
      expect(v.size).toBe(0);
    }
    expect(
      verifyVenueExplanations(
        {
          explanations: [
            {
              id: "x",
              text: "You both enjoy coffee a lot.",
              evidence: ["b.secret"],
            },
          ],
        },
        items,
        facts,
      ).size,
    ).toBe(0);
    expect(
      verifyVenueExplanations(
        {
          explanations: [
            {
              id: "other",
              text: "You both enjoy coffee a lot.",
              evidence: ["shared.interest.coffee"],
            },
          ],
        },
        items,
        facts,
      ).size,
    ).toBe(0);
  });
});

describe("Proposals for real places and events", () => {
  function connected(): DemoState {
    let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
    s = reduceDemo(s, { type: "decision", id: "lena", decision: "interested" });
    s = reduceDemo(s, {
      type: "counterpart",
      id: "lena",
      decision: "interested",
    });
    s = {
      ...s,
      planning: {
        ...s.planning,
        lena: { ...s.planning.lena, availability: lenaAvailability() },
      },
    };
    return reduceDemo(s, { type: "planning", planning: sharing() });
  }
  const zimmer = () =>
    curatedEvents.find((e) => e.id.startsWith("ticketon-hans-zimmer"))!;
  const proposeEvent = (s: DemoState, horizonDays = DISCOVERY_HORIZON_DAYS) => {
    const e = zimmer();
    return reduceDemo(s, {
      type: "propose",
      id: "lena",
      activity: { category: venueCategory(e), title: venueName(e) },
      ...eventSlot(e)!,
      now: NOW.toISOString(),
      horizonDays,
      venue: {
        kind: "event",
        id: e.id,
        name: e.title,
        address: e.address,
        url: e.url,
        mapUrl: null,
        source: e.source.name,
        fixedTime: true,
      },
    });
  };
  it("creates a pending proposal that carries the verified venue", () => {
    const s = proposeEvent(connected());
    const p = s.proposals[0];
    expect(p.status).toBe("proposed");
    expect(isConfirmedDate(p)).toBe(false);
    expect(p.venue).toMatchObject({
      kind: "event",
      fixedTime: true,
      url: zimmer().url,
    });
  });
  it("is confirmed only after the (simulated) counterpart accepts, and can be withdrawn", () => {
    let s = proposeEvent(connected());
    const id = s.proposals[0].id;
    s = reduceDemo(s, {
      type: "proposal-response",
      id: "lena",
      proposalId: id,
      response: "accepted",
    });
    expect(isConfirmedDate(s.proposals[0])).toBe(true);
    expect(s.proposals[0].responseSimulated).toBe(true);
    s = reduceDemo(s, {
      type: "withdraw-proposal",
      id: "lena",
      proposalId: id,
    });
    expect(s.proposals[0].status).toBe("withdrawn");
  });
  it("rejects an event time outside shared availability, and before a mutual match", () => {
    const openMic = curatedEvents.find((e) =>
      e.id.startsWith("ticketon-open-mic"),
    )!;
    expect(() =>
      reduceDemo(connected(), {
        type: "propose",
        id: "lena",
        activity: { category: "cultural-event", title: openMic.title },
        ...eventSlot(openMic)!,
        now: NOW.toISOString(),
        horizonDays: 35,
      }),
    ).toThrow(/shared availability/);
    let s = reduceDemo(initialDemo(), { type: "profile", profile: jamie() });
    s = reduceDemo(s, { type: "planning", planning: sharing() });
    expect(() => proposeEvent(s)).toThrow(/both people/);
  });
  it("rejects malformed venue links", () => {
    const e = zimmer();
    expect(() =>
      reduceDemo(connected(), {
        type: "propose",
        id: "lena",
        activity: { category: "cultural-event", title: e.title },
        ...eventSlot(e)!,
        now: NOW.toISOString(),
        horizonDays: 35,
        venue: {
          kind: "event",
          id: e.id,
          name: e.title,
          address: null,
          url: "not a url",
          mapUrl: null,
          source: "x",
          fixedTime: true,
        },
      }),
    ).toThrow();
  });
});
