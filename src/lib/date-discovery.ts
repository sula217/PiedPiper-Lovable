import {
  activityLabels,
  interestActivity,
  type ActivityKind,
} from "./activities";
import {
  formatWindow,
  withinWindows,
  zonedTimeToUtc,
  type DateCategory,
  type Interval,
  type OverlapResult,
  budgetLevels,
} from "./planning";
import {
  cities,
  formatMoney,
  type CityId,
  type DateEvent,
  type Place,
  type Venue,
} from "./places/types";

/**
 * "Discover Your First Date": a deterministic ranking of REAL places and
 * events for a mutually matched couple.
 *
 * 1. A mutual match is required. 2. Approved shared interests are read.
 * 3. Mutual availability (consented overlap) is used as-is. 4. Candidates come
 * from the verified places/events layer only. 5. City filter. 6. Scheduled
 * events must fit a shared window. 7. Budget applies only to verified prices.
 * 8. Ranking by shared interests, stated preferences and practical fit.
 * 9. Up to three recommendations (plus alternatives).
 *
 * General places (cafés, restaurants, parks, museums) are suggested for a
 * shared window WITHOUT claiming they are open then: opening hours are not
 * verified. Travel times are never estimated.
 */
export const DISCOVERY_HORIZON_DAYS = 35;
export type BudgetLevel = (typeof budgetLevels)[number];
export type DiscoveryFilters = {
  city: CityId;
  /** Empty = all four groups. */
  kinds: ActivityKind[];
  budget: BudgetLevel | null;
  setting: "any" | "indoor" | "outdoor";
  /** "fits" keeps only items that fit a shared time window. */
  when: "any" | "fits";
  sharedInterestsOnly: boolean;
};
export const defaultFilters = (
  city: CityId = "new-york",
): DiscoveryFilters => ({
  city,
  kinds: [],
  budget: null,
  setting: "any",
  when: "any",
  sharedInterestsOnly: false,
});
export type DiscoveryInput = {
  mutual: boolean;
  names: { a: string; b: string };
  sharedInterests: string[];
  activityPrefs: { a: DateCategory[]; b: DateCategory[] };
  overlap: OverlapResult;
  now: Date;
  places: Place[];
  events: DateEvent[];
  filters: DiscoveryFilters;
  limit?: number;
};
export type Reason = { text: string; evidence: string[] };
export type Recommendation = {
  venue: Venue;
  score: number;
  matchedInterests: string[];
  reasons: Reason[];
  /** Suggested time for a proposal, inside a shared window. */
  slot: Interval | null;
  timing:
    | "event-fits"
    | "availability-unknown"
    | "general-place"
    | "no-shared-window";
  timingLabel: string;
  priceLabel: string;
};
export type DiscoveryResult =
  | { status: "not-matched" }
  | {
      status: "ok";
      recommendations: Recommendation[];
      alternatives: Recommendation[];
      excluded: { past: number; budget: number; timing: number };
      candidates: number;
    };

const categoryKind: Partial<Record<DateCategory, ActivityKind>> = {
  coffee: "food-coffee",
  restaurant: "food-coffee",
  walk: "parks-outdoors",
  sport: "parks-outdoors",
  "cultural-event": "concerts-events",
  museum: "culture-activities",
};
/** Did someone list an activity type that belongs to this group? */
export const prefersKind = (prefs: DateCategory[], kind: ActivityKind) =>
  prefs.some((c) => categoryKind[c] === kind);
export const kindCategory: Record<ActivityKind, DateCategory> = {
  "food-coffee": "coffee",
  "parks-outdoors": "walk",
  "concerts-events": "cultural-event",
  "culture-activities": "museum",
};
/** The proposal category for a venue (used by the proposal record). */
export function venueCategory(v: Venue): DateCategory {
  if (v.type === "place" && v.category === "restaurant") return "restaurant";
  return kindCategory[v.kind];
}
export const venueName = (v: Venue) => (v.type === "place" ? v.name : v.title);
export function budgetMax(city: CityId, b: BudgetLevel | null) {
  if (!b || b === "flexible") return Infinity;
  return cities[city].budgetMax[b];
}
export function priceLabel(v: Venue) {
  if (v.price === "free") return "Free to enter (public park)";
  if (!v.price) return "Price not listed";
  return `From ${formatMoney(v.price.from, v.price.currency)} · listed price, may change`;
}
const priceValue = (v: Venue) =>
  v.price === "free" ? 0 : v.price ? v.price.from : null;
const norm = (s: string) => s.trim().toLocaleLowerCase("en-US");

/** The concrete time of a scheduled event, or null for runs/places. */
export function eventSlot(e: DateEvent): Interval | null {
  if (!e.startsAt) return null;
  const start = Date.parse(e.startsAt);
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + (e.durationMinutes ?? 120) * 60000).toISOString(),
  };
}
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
function localDate(tz: string, ms: number) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
  return p; // YYYY-MM-DD
}
/** Is an event in the past (or already over) at `now`? */
export function isPast(e: DateEvent, now: Date) {
  if (e.run) return localDate(e.timeZone, now.getTime()) > e.run.to;
  if (!e.startsAt) return true;
  return Date.parse(e.startsAt) <= now.getTime();
}
/** First ≥90-minute slot where a shared window meets an exhibition's daily hours. */
export function runSlot(e: DateEvent, windows: Interval[], now: Date) {
  if (!e.run) return null;
  for (const w of windows) {
    const ws = Math.max(Date.parse(w.start), now.getTime()),
      we = Date.parse(w.end);
    const day = localDate(e.timeZone, ws);
    if (day < e.run.from || day > e.run.to) continue;
    const [y, m, d] = day.split("-").map(Number);
    const open = zonedTimeToUtc(e.timeZone, y, m, d, hm(e.run.dailyOpen)),
      close = zonedTimeToUtc(e.timeZone, y, m, d, hm(e.run.dailyClose));
    const s = Math.max(ws, open),
      en = Math.min(we, close);
    if (en - s >= 90 * 60000)
      return {
        start: new Date(s).toISOString(),
        end: new Date(Math.min(en, s + 120 * 60000)).toISOString(),
      };
  }
  return null;
}

export function recommendDates(input: DiscoveryInput): DiscoveryResult {
  if (!input.mutual) return { status: "not-matched" };
  const { filters, now } = input;
  const tz = cities[filters.city].timeZone;
  const windows = input.overlap.status === "ok" ? input.overlap.windows : [];
  const known = input.overlap.status === "ok";
  const shared = [...new Set(input.sharedInterests.map(norm))];
  const prefKinds = {
    a: new Set(
      input.activityPrefs.a.map((c) => categoryKind[c]).filter(Boolean),
    ),
    b: new Set(
      input.activityPrefs.b.map((c) => categoryKind[c]).filter(Boolean),
    ),
  };
  const max = budgetMax(filters.city, filters.budget);
  const excluded = { past: 0, budget: 0, timing: 0 };
  const out: Recommendation[] = [];
  const candidates: Venue[] = [
    ...input.places.filter((p) => p.city === filters.city),
    ...input.events.filter((e) => e.city === filters.city),
  ];
  for (const v of candidates) {
    if (filters.kinds.length && !filters.kinds.includes(v.kind)) continue;
    if (filters.setting !== "any" && v.setting !== filters.setting) continue;
    if (v.type === "event" && isPast(v, now)) {
      excluded.past++;
      continue;
    }
    const price = priceValue(v);
    // Budget only applies when a reliable price exists.
    if (price !== null && price > max) {
      excluded.budget++;
      continue;
    }
    const tags = v.tags.map(norm);
    const direct = shared.filter((i) => tags.includes(i));
    const byKind = shared.filter(
      (i) => !direct.includes(i) && interestActivity(i) === v.kind,
    );
    const matched = [...direct, ...byKind];
    if (filters.sharedInterestsOnly && !matched.length) continue;
    // ---- timing ----
    let slot: Interval | null = null;
    let timing: Recommendation["timing"];
    let timingLabel: string;
    if (v.type === "event" && v.startsAt) {
      const s = eventSlot(v)!;
      if (!known) {
        timing = "availability-unknown";
        timingLabel = `${formatWindow(s, tz)} · availability not compared yet`;
        slot = null;
      } else if (withinWindows(s, windows)) {
        timing = "event-fits";
        timingLabel = `${formatWindow(s, tz)} · inside a time you’re both free`;
        slot = s;
      } else {
        excluded.timing++;
        continue; // a fixed-time event outside both people's availability
      }
    } else if (v.type === "event" && v.run) {
      const s = known ? runSlot(v, windows, now) : null;
      if (known && !s) {
        excluded.timing++;
        continue;
      }
      slot = s;
      timing = s ? "event-fits" : "availability-unknown";
      timingLabel = s
        ? `Open daily ${v.run.dailyOpen}–${v.run.dailyClose} until ${v.run.to} · suggested ${formatWindow(s, tz)}`
        : `Open daily ${v.run.dailyOpen}–${v.run.dailyClose} until ${v.run.to}`;
    } else {
      const w = windows[0];
      slot = w
        ? {
            start: w.start,
            end: new Date(
              Math.min(Date.parse(w.end), Date.parse(w.start) + 2 * 3600000),
            ).toISOString(),
          }
        : null;
      timing = w
        ? "general-place"
        : known
          ? "no-shared-window"
          : "availability-unknown";
      timingLabel = w
        ? `Suggested for ${formatWindow(slot!, tz)} · opening hours not verified, check before you go`
        : "Opening hours not verified · compare availability to pick a time";
    }
    if (
      filters.when === "fits" &&
      timing !== "event-fits" &&
      timing !== "general-place"
    ) {
      excluded.timing++;
      continue;
    }
    // ---- score (deterministic) ----
    const inA = prefKinds.a.has(v.kind),
      inB = prefKinds.b.has(v.kind);
    let score =
      Math.min(direct.length, 2) * 3 +
      Math.min(byKind.length, 2) * 1 +
      (inA && inB ? 1.5 : inA || inB ? 0.75 : 0) +
      (timing === "event-fits" ? 2 : timing === "general-place" ? 1 : 0) +
      (price !== null ? 0.5 : 0) +
      ((v.type === "place" ? v.address || v.coordinates : v.venue) ? 0.5 : -1);
    if (v.type === "event" && slot) {
      const days = (Date.parse(slot.start) - now.getTime()) / 86400000;
      if (days <= 10) score += 0.25;
    }
    // ---- reasons (grounded in fact ids) ----
    const reasons: Reason[] = [];
    if (direct.length)
      reasons.push({
        text: `You both enjoy ${direct.slice(0, 2).join(" and ")}.`,
        evidence: direct.slice(0, 2).map((i) => `shared.interest.${i}`),
      });
    else if (byKind.length)
      reasons.push({
        text: `It suits your shared interest in ${byKind.slice(0, 2).join(" and ")}.`,
        evidence: byKind.slice(0, 2).map((i) => `shared.interest.${i}`),
      });
    if (inA && inB)
      reasons.push({
        text: `You both listed ${activityLabels[v.kind].toLowerCase()} as first-date activities.`,
        evidence: [`a.kind.${v.kind}`, `b.kind.${v.kind}`],
      });
    else if (inA || inB)
      reasons.push({
        text: `${inA ? "You" : input.names.b} listed ${activityLabels[v.kind].toLowerCase()} as a first-date activity.`,
        evidence: [`${inA ? "a" : "b"}.kind.${v.kind}`],
      });
    if (timing === "event-fits")
      reasons.push({
        text: "It fits a time you’re both free.",
        evidence: ["availability.overlap"],
      });
    if (v.setting === "outdoor")
      reasons.push({
        text: "A public, outdoor setting keeps a first meeting relaxed.",
        evidence: [`venue.${v.id}`],
      });
    if (!reasons.length)
      reasons.push({
        text: "A public place that is easy for a short first meeting.",
        evidence: [`venue.${v.id}`],
      });
    out.push({
      venue: v,
      score: Math.round(score * 100) / 100,
      matchedInterests: matched,
      reasons,
      slot,
      timing,
      timingLabel,
      priceLabel: priceLabel(v),
    });
  }
  const sorted = out.sort(
    (x, y) =>
      y.score - x.score ||
      (x.slot ? Date.parse(x.slot.start) : Infinity) -
        (y.slot ? Date.parse(y.slot.start) : Infinity) ||
      x.venue.id.localeCompare(y.venue.id),
  );
  const limit = input.limit ?? 3;
  // Without a category filter, prefer variety: one per group first.
  const top: Recommendation[] = [];
  if (!filters.kinds.length || filters.kinds.length > 1) {
    const seen = new Set<string>();
    for (const r of sorted)
      if (top.length < limit && !seen.has(r.venue.kind)) {
        seen.add(r.venue.kind);
        top.push(r);
      }
  }
  for (const r of sorted)
    if (top.length < limit && !top.includes(r)) top.push(r);
  return {
    status: "ok",
    recommendations: top,
    alternatives: sorted.filter((r) => !top.includes(r)).slice(0, 9),
    excluded,
    candidates: candidates.length,
  };
}
export const explanationFor = (r: Recommendation) =>
  r.reasons
    .slice(0, 2)
    .map((x) => x.text)
    .join(" ");
