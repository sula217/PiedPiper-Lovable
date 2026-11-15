import { z } from "zod";
import { activityKinds } from "../activities";

/**
 * Real-world places and events for first-date discovery.
 *
 * Every record carries its source and the date it was last verified. Fields
 * that were not verified are null and are shown as "not listed", never
 * guessed: no invented names, addresses, coordinates, prices, ratings or
 * opening hours, and nothing implies a place is open or tickets are available.
 */
/** US demo cities first; the Kazakhstan cities are kept as legacy data only. */
export const usCityIds = [
  "new-york",
  "san-francisco",
  "chicago",
  "austin",
] as const;
export const legacyCityIds = ["astana", "almaty"] as const;
export const cityIds = [...usCityIds, ...legacyCityIds] as const;
export type CityId = (typeof cityIds)[number];
export type UsCityId = (typeof usCityIds)[number];
export type CityConfig = {
  id: CityId;
  name: string;
  /** Short label for compact UI, e.g. "NYC". */
  short: string;
  state: string | null;
  country: string;
  countryCode: string;
  timeZone: string;
  currency: string;
  /** Approximate bounding box (south, west, north, east) for live providers. */
  bbox: [number, number, number, number];
  /** Budget bands in the local currency, used only for verified prices. */
  budgetMax: { free: number; low: number; moderate: number };
};
const usBudget = { free: 0, low: 25, moderate: 75 };
const us = { country: "United States", countryCode: "US", currency: "USD" };
export const cities: Record<CityId, CityConfig> = {
  "new-york": {
    id: "new-york",
    name: "New York City",
    short: "NYC",
    state: "New York",
    ...us,
    timeZone: "America/New_York",
    bbox: [40.7, -74.02, 40.8, -73.94],
    budgetMax: usBudget,
  },
  "san-francisco": {
    id: "san-francisco",
    name: "San Francisco",
    short: "SF",
    state: "California",
    ...us,
    timeZone: "America/Los_Angeles",
    bbox: [37.74, -122.51, 37.81, -122.39],
    budgetMax: usBudget,
  },
  chicago: {
    id: "chicago",
    name: "Chicago",
    short: "Chicago",
    state: "Illinois",
    ...us,
    timeZone: "America/Chicago",
    bbox: [41.85, -87.68, 41.95, -87.6],
    budgetMax: usBudget,
  },
  austin: {
    id: "austin",
    name: "Austin",
    short: "Austin",
    state: "Texas",
    ...us,
    timeZone: "America/Chicago",
    bbox: [30.24, -97.8, 30.31, -97.7],
    budgetMax: usBudget,
  },
  astana: {
    id: "astana",
    name: "Astana",
    short: "Astana",
    state: null,
    country: "Kazakhstan",
    countryCode: "KZ",
    timeZone: "Asia/Almaty",
    currency: "KZT",
    bbox: [51.05, 71.3, 51.22, 71.55],
    budgetMax: { free: 0, low: 5000, moderate: 15000 },
  },
  almaty: {
    id: "almaty",
    name: "Almaty",
    short: "Almaty",
    state: null,
    country: "Kazakhstan",
    countryCode: "KZ",
    timeZone: "Asia/Almaty",
    currency: "KZT",
    bbox: [43.18, 76.8, 43.33, 77.02],
    budgetMax: { free: 0, low: 5000, moderate: 15000 },
  },
};
export const DEFAULT_CITY: UsCityId = "new-york";
/** City names offered in onboarding and the profile editor (US demo). */
export const usCityNames = usCityIds.map((id) => cities[id].name);
const cityAliases: [RegExp, CityId][] = [
  [/\b(new york|nyc|manhattan|brooklyn|queens|bronx)\b/, "new-york"],
  [/\b(san francisco|sf|bay area)\b/, "san-francisco"],
  [/\bchicago\b/, "chicago"],
  [/\baustin\b/, "austin"],
  [/\b(astana|nur-sultan)\b/, "astana"],
  [/\balmaty\b/, "almaty"],
];
/** Maps a free-text profile city to a supported city id, if any. */
export function cityIdFor(city: string | null | undefined): CityId | null {
  const s = (city ?? "").toLocaleLowerCase("en-US");
  return cityAliases.find(([r]) => r.test(s))?.[1] ?? null;
}
/** Formats a whole-number price in a currency. */
export function formatMoney(amount: number, currency: string) {
  const n = amount.toLocaleString("en-US");
  return currency === "USD"
    ? `$${n}`
    : currency === "KZT"
      ? `₸${n}`
      : `${n} ${currency}`;
}

export const placeCategories = [
  "cafe",
  "restaurant",
  "park",
  "museum",
  "gallery",
  "venue",
] as const;
export const eventCategories = [
  "concert",
  "performance",
  "comedy",
  "exhibition",
  "theatre",
] as const;

const sourceSchema = z.object({
  /** e.g. "OpenStreetMap", "Ticketon (manually verified)", "Official website". */
  name: z.string().min(1).max(80),
  /** Where the record can be checked. */
  url: z.url().max(400),
  /** ODbL attribution etc. */
  attribution: z.string().max(160).nullable(),
  kind: z.enum(["curated", "live"]),
});
const priceSchema = z
  .object({
    /** Lowest listed price at verification time, in `currency`. */
    from: z.number().int().min(0),
    currency: z.string().length(3),
    note: z.string().max(160),
  })
  .nullable();

export const placeSchema = z.object({
  id: z.string().min(3).max(80),
  type: z.literal("place"),
  name: z.string().min(1).max(120),
  /** The name as recorded by the source, when it differs from `name`. */
  localName: z.string().max(120).nullable(),
  city: z.enum(cityIds),
  country: z.string().max(60),
  category: z.enum(placeCategories),
  kind: z.enum(activityKinds),
  setting: z.enum(["indoor", "outdoor"]),
  address: z.string().max(160).nullable(),
  localAddress: z.string().max(160).nullable(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    })
    .nullable(),
  website: z.url().max(300).nullable(),
  mapUrl: z.url().max(400),
  /** Only "free" when that is reliable (e.g. a public park); otherwise null. */
  price: z.union([z.literal("free"), priceSchema]),
  tags: z.array(z.string().max(30)).max(12),
  source: sourceSchema,
  lastVerified: z.iso.date(),
});
export type Place = z.infer<typeof placeSchema>;

export const eventSchema = z.object({
  id: z.string().min(3).max(80),
  type: z.literal("event"),
  title: z.string().min(1).max(160),
  city: z.enum(cityIds),
  country: z.string().max(60),
  category: z.enum(eventCategories),
  kind: z.enum(activityKinds),
  setting: z.enum(["indoor", "outdoor"]),
  venue: z.string().max(120).nullable(),
  address: z.string().max(160).nullable(),
  /** Single performance: start with an explicit UTC offset. */
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  /** Duration in minutes when listed; otherwise null (we assume nothing). */
  durationMinutes: z.number().int().min(15).max(600).nullable(),
  /** For exhibitions running over a period with daily hours. */
  run: z
    .object({
      from: z.iso.date(),
      to: z.iso.date(),
      dailyOpen: z.string().regex(/^\d\d:\d\d$/),
      dailyClose: z.string().regex(/^\d\d:\d\d$/),
    })
    .nullable(),
  timeZone: z.string().max(64),
  /** False when the source showed day and month but not the year. */
  yearShownOnSource: z.boolean(),
  price: priceSchema,
  ageRestriction: z.string().max(10).nullable(),
  url: z.url().max(400),
  note: z.string().max(240).nullable(),
  tags: z.array(z.string().max(30)).max(12),
  source: sourceSchema,
  lastVerified: z.iso.date(),
});
export type DateEvent = z.infer<typeof eventSchema>;
export type Venue = Place | DateEvent;

/**
 * Accepts only http(s) links without credentials. For ticketing links the
 * host must be the official site itself (no look-alike or proxy hosts).
 */
export function isSafeLink(url: string, officialHosts?: string[]) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    if (!officialHosts) return true;
    const host = u.hostname.toLowerCase();
    return officialHosts.some((h) => host === h || host === `www.${h}`);
  } catch {
    return false;
  }
}
export const TICKETON_HOSTS = ["ticketon.kz"];
