"use client";
import { useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  Clock,
  Coffee,
  Database,
  ExternalLink,
  Landmark,
  LoaderCircle,
  MapPin,
  Music,
  SearchX,
  Shuffle,
  Sparkles,
  Ticket,
  Trees,
  Wallet,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  AIModeBadge,
  invalidateGeminiStatus,
  liveUnavailable,
  useGeminiStatus,
} from "./ai-status";
import { dispatchDemo, GUEST_ID, type DemoState } from "@/lib/demo-store";
import { intersection } from "@/lib/matching";
import { sharedMoney, type Profile } from "@/lib/profile";
import { budgetLabels, budgetLevels, computeOverlap } from "@/lib/planning";
import {
  activityKinds,
  activityLabels,
  type ActivityKind,
} from "@/lib/activities";
import {
  defaultFilters,
  DISCOVERY_HORIZON_DAYS,
  explanationFor,
  recommendDates,
  venueCategory,
  venueName,
  type BudgetLevel,
  type DiscoveryFilters,
  type Recommendation,
} from "@/lib/date-discovery";
import {
  curatedEvents,
  curatedPlaces,
  CURATED_VERIFIED_AT,
  US_PLACES_VERIFIED_AT,
} from "@/lib/places/curated";
import {
  cities,
  cityIdFor,
  DEFAULT_CITY,
  formatMoney,
  usCityIds,
  type CityId,
  type Venue,
} from "@/lib/places/types";

/** The supported US city for a profile, defaulting to New York City. */
function homeCity(city: string): CityId {
  const id = cityIdFor(city);
  return id && (usCityIds as readonly string[]).includes(id)
    ? id
    : DEFAULT_CITY;
}
const nextCity = (c: CityId): CityId => {
  const i = (usCityIds as readonly string[]).indexOf(c);
  return usCityIds[(i + 1) % usCityIds.length];
};

const kindIcon: Record<ActivityKind, typeof Coffee> = {
  "food-coffee": Coffee,
  "parks-outdoors": Trees,
  "concerts-events": Music,
  "culture-activities": Landmark,
};
const categoryLabel: Record<string, string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  park: "Park",
  museum: "Museum",
  gallery: "Gallery",
  venue: "Venue",
  concert: "Concert",
  performance: "Performance",
  comedy: "Comedy",
  exhibition: "Exhibition",
  theatre: "Theatre & opera",
};
const order = (b: BudgetLevel | null) => (b ? budgetLevels.indexOf(b) : 99);
function locationOf(v: Venue) {
  if (v.type === "place")
    return (
      v.address ?? (v.coordinates ? "Location on map" : "Location not listed")
    );
  return (
    [v.venue, v.address].filter(Boolean).join(" · ") ||
    "Venue not shown on the listing"
  );
}
function mapLinkOf(v: Venue) {
  if (v.type === "place") return v.mapUrl;
  const q = [v.venue, v.address, cities[v.city].name]
    .filter(Boolean)
    .join(", ");
  return v.venue || v.address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`
    : null;
}
function officialLinkOf(v: Venue) {
  return v.type === "event" ? v.url : v.website;
}
const daysSince = (isoDate: string, now: Date) =>
  Math.floor((now.getTime() - Date.parse(`${isoDate}T00:00:00Z`)) / 86400000);

export function DateDiscovery({
  state,
  profile,
  peer,
  from,
  initialKind,
}: {
  state: DemoState;
  profile: Profile;
  peer: Profile;
  /** Stable reference instant from the planner. */
  from: Date;
  /** Preselected group, e.g. from the matchmakers' shared activities. */
  initialKind?: string;
}) {
  const mine = state.planning[GUEST_ID],
    theirs = state.planning[peer.id];
  const stricter =
    [
      mine?.datePreferences.budget ?? null,
      theirs?.datePreferences.budget ?? null,
    ]
      .filter((b): b is BudgetLevel => !!b)
      .sort((x, y) => order(x) - order(y))[0] ??
    // Fallback: both people shared that they prefer budget-friendly first dates.
    (sharedMoney(profile).some(
      (m) => m.key === "firstDates" && m.value === "budget-friendly",
    ) &&
    sharedMoney(peer).some(
      (m) => m.key === "firstDates" && m.value === "budget-friendly",
    )
      ? "low"
      : null);
  const [filters, setFilters] = useState<DiscoveryFilters>(() => ({
    ...defaultFilters(homeCity(profile.city)),
    budget: stricter,
    kinds: activityKinds.filter((k) => k === initialKind),
  }));
  const [page, setPage] = useState(0),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [ai, setAi] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const status = useGeminiStatus();
  const overlap = computeOverlap(mine?.availability, theirs?.availability, {
    from,
    days: DISCOVERY_HORIZON_DAYS,
  });
  const shared = intersection(profile.interests, peer.interests);
  const result = recommendDates({
    mutual: true,
    names: { a: profile.name, b: peer.name },
    sharedInterests: shared,
    activityPrefs: {
      a: mine?.datePreferences.activityTypes ?? [],
      b: theirs?.datePreferences.activityTypes ?? [],
    },
    overlap,
    now: from,
    places: curatedPlaces,
    events: curatedEvents,
    filters,
  });
  if (result.status !== "ok") return null;
  const pool = [...result.recommendations, ...result.alternatives];
  const pages = Math.max(1, Math.ceil(pool.length / 3));
  const shown =
    page === 0 ? result.recommendations : pool.slice(page * 3, page * 3 + 3);
  const isUs = cities[filters.city].countryCode === "US";
  const verifiedAt = isUs ? US_PLACES_VERIFIED_AT : CURATED_VERIFIED_AT;
  const stale = daysSince(verifiedAt, from) > 30;
  const set = (patch: Partial<DiscoveryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
    setAi({});
  };
  const toggleKind = (k: ActivityKind) =>
    set({
      kinds: filters.kinds.includes(k)
        ? filters.kinds.filter((x) => x !== k)
        : [...filters.kinds, k],
    });

  function suggest(r: Recommendation) {
    setError("");
    setMessage("");
    if (!r.slot) return;
    const v = r.venue;
    try {
      dispatchDemo({
        type: "propose",
        id: peer.id,
        activity: {
          category: venueCategory(v),
          title: venueName(v).slice(0, 160),
        },
        start: r.slot.start,
        end: r.slot.end,
        now: from.toISOString(),
        horizonDays: DISCOVERY_HORIZON_DAYS,
        venue: {
          kind: v.type,
          id: v.id,
          name: venueName(v).slice(0, 160),
          address: v.type === "place" ? v.address : v.address,
          url: officialLinkOf(v),
          mapUrl: mapLinkOf(v),
          source: v.source.name,
          fixedTime: v.type === "event" && !!v.startsAt,
        },
      });
      setMessage(
        `Proposed “${venueName(v)}” to ${peer.name}. It stays pending until ${peer.name} accepts — nothing is booked or purchased.`,
      );
      document
        .getElementById("proposals")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This date could not be proposed.",
      );
    }
  }
  async function explain() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "venues",
          a: profile,
          b: peer,
          planning: { a: mine ?? null, b: theirs ?? null },
          mutualConfirmed: true,
          processingConsent: true,
          city: filters.city,
          ids: shown.map((r) => r.venue.id),
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Gemini could not explain these.");
      const next: Record<string, string> = {};
      for (const [id, e] of Object.entries(
        data.explanations as Record<string, { text: string }>,
      ))
        next[id] = e.text;
      setAi((a) => ({ ...a, ...next }));
      setMessage(
        Object.keys(next).length
          ? `Gemini explained ${Object.keys(next).length} of ${shown.length}; each was checked against your shared facts.${data.rejected ? ` ${data.rejected} unverifiable explanation${data.rejected === 1 ? " was" : "s were"} replaced by the standard one.` : ""}`
          : "Gemini’s explanations couldn’t be verified, so the standard explanations are shown.",
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Gemini is unavailable."} The standard explanations still apply.`,
      );
    } finally {
      invalidateGeminiStatus();
      setBusy(false);
    }
  }

  return (
    <section
      className="discover-date"
      id="discover"
      aria-labelledby="discover-title"
    >
      <div className="discover-date-head">
        <span className="eyebrow">
          <MapPin size={13} /> REAL PLACES & EVENTS ·{" "}
          {cities[filters.city].name.toUpperCase()},{" "}
          {(
            cities[filters.city].state ?? cities[filters.city].country
          ).toUpperCase()}
        </span>
        <h2 id="discover-title">
          Discover your <em>first date.</em>
        </h2>
        <p>
          Verified cafés, parks, concerts and culture, ranked by what you both
          enjoy and when you’re both free. Nothing is booked or purchased.
        </p>
      </div>
      <div className="kind-tiles" role="group" aria-label="Date categories">
        {activityKinds.map((k) => {
          const Icon = kindIcon[k];
          const on = filters.kinds.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              className={`kind-tile ${on ? "on" : ""}`}
              onClick={() => toggleKind(k)}
            >
              <Icon size={22} />
              <span>{activityLabels[k]}</span>
            </button>
          );
        })}
      </div>
      <div className="discover-filters">
        <label>
          City
          <select
            value={filters.city}
            onChange={(e) => set({ city: e.target.value as CityId })}
          >
            {usCityIds.map((c) => (
              <option key={c} value={c}>
                {cities[c].name}, {cities[c].state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Budget
          <select
            value={filters.budget ?? ""}
            onChange={(e) =>
              set({ budget: (e.target.value || null) as BudgetLevel | null })
            }
          >
            <option value="">Any budget</option>
            {budgetLevels.map((b) => (
              <option key={b} value={b}>
                {budgetLabels[b]}
                {b !== "flexible" &&
                  ` (≤ ${formatMoney(cities[filters.city].budgetMax[b], cities[filters.city].currency)} per person)`}
              </option>
            ))}
          </select>
        </label>
        <label>
          When
          <select
            value={filters.when}
            onChange={(e) =>
              set({ when: e.target.value as DiscoveryFilters["when"] })
            }
          >
            <option value="any">Any time</option>
            <option value="fits">Fits our shared availability</option>
          </select>
        </label>
        <label>
          Setting
          <select
            value={filters.setting}
            onChange={(e) =>
              set({ setting: e.target.value as DiscoveryFilters["setting"] })
            }
          >
            <option value="any">Indoor or outdoor</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={filters.sharedInterestsOnly}
            onChange={(e) => set({ sharedInterestsOnly: e.target.checked })}
          />
          Only our confirmed shared interests
        </label>
      </div>
      <p className="fine-print discover-context">
        {shared.length ? (
          <>
            <BadgeCheck size={13} /> Shared interests: {shared.join(", ")}.{" "}
          </>
        ) : (
          "No confirmed shared interests yet. "
        )}
        {overlap.status === "ok"
          ? `Shared availability over the next ${DISCOVERY_HORIZON_DAYS} days is used for timing.`
          : "Availability isn’t compared yet (it needs both people’s consent), so event times aren’t matched."}
        {filters.budget &&
          " Budget applies only where a price is verified; places without a listed price stay visible."}
      </p>
      {message && (
        <p role="status" className="saved-text">
          <BadgeCheck size={14} /> {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!shown.length ? (
        <div className="discover-empty">
          <SearchX size={28} />
          <h3>No verified recommendations match these filters.</h3>
          <p>
            We only show places and events we could verify, so there’s nothing
            invented here.
            {result.excluded.past > 0 &&
              ` ${result.excluded.past} curated event${result.excluded.past === 1 ? " has" : "s have"} already passed.`}
            {result.excluded.timing > 0 &&
              ` ${result.excluded.timing} didn’t fit a shared time.`}
            {result.excluded.budget > 0 &&
              ` ${result.excluded.budget} were over the selected budget.`}
          </p>
          <div className="inline-actions">
            <Button
              size="sm"
              variant="outline"
              onClick={() => set({ ...defaultFilters(filters.city) })}
            >
              Clear filters
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ city: nextCity(filters.city) })}
            >
              Try {cities[nextCity(filters.city)].name}
            </Button>
          </div>
        </div>
      ) : (
        <div className="venue-list">
          {shown.map((r) => (
            <VenueCard
              key={r.venue.id}
              r={r}
              aiText={ai[r.venue.id]}
              peerName={peer.name}
              onSuggest={() => suggest(r)}
            />
          ))}
        </div>
      )}
      <div className="discover-actions">
        <Button
          variant="outline"
          disabled={pool.length <= 3}
          onClick={() => {
            setPage((p) => (p + 1) % pages);
            setMessage("");
          }}
        >
          <Shuffle size={15} /> Explore alternatives
          {pool.length > 3 && ` (${page + 1}/${pages})`}
        </Button>
        <div className="discover-ai">
          <AIModeBadge mode="live" status={status} />
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Send these fictional shared facts to Gemini
          </label>
          <Button
            size="sm"
            variant="ghost"
            disabled={
              !consent || busy || !shown.length || liveUnavailable(status)
            }
            onClick={() => void explain()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            Explain with Gemini
          </Button>
        </div>
      </div>
      <p className="fine-print data-sources">
        <Database size={13} /> Places: © OpenStreetMap contributors (ODbL),
        retrieved {verifiedAt}. Names, addresses and websites are the OSM
        records as published; opening hours, prices and ticket availability are
        not verified, so check the official website before you go.{" "}
        {isUs
          ? "No dated US events are listed: there is no permitted live event source configured, so concert venues are suggested instead of specific shows."
          : `Events: Ticketon.kz pages checked by hand on ${CURATED_VERIFIED_AT}. Past events are hidden automatically.`}
        {stale && (
          <strong className="stale-data">
            {" "}
            This curated list is {daysSince(verifiedAt, from)} days old.
          </strong>
        )}
      </p>
    </section>
  );
}

function VenueCard({
  r,
  aiText,
  peerName,
  onSuggest,
}: {
  r: Recommendation;
  aiText?: string;
  peerName: string;
  onSuggest: () => void;
}) {
  const v = r.venue;
  const Icon = kindIcon[v.kind];
  const official = officialLinkOf(v),
    map = mapLinkOf(v);
  const isEvent = v.type === "event";
  return (
    <article className={`venue-card kind-${v.kind}`} aria-label={venueName(v)}>
      <div className="venue-top">
        <span className="venue-icon">
          <Icon size={18} />
        </span>
        <span className="venue-meta">
          {categoryLabel[v.category] ?? v.category}
          {isEvent && v.ageRestriction ? ` · ${v.ageRestriction}` : ""}
        </span>
        <span className={`venue-badge ${v.source.kind}`}>
          {v.source.kind === "curated" ? "VERIFIED · CURATED" : "LIVE · OSM"}
        </span>
      </div>
      <h3>{venueName(v)}</h3>
      {v.type === "place" && v.localName && (
        <small className="venue-local">{v.localName}</small>
      )}
      <ul className="venue-facts">
        <li>
          <MapPin size={13} /> {locationOf(v)}
        </li>
        <li>
          <Clock size={13} /> {r.timingLabel}
        </li>
        <li>
          <Wallet size={13} /> {r.priceLabel}
        </li>
      </ul>
      <p className="venue-why">
        {aiText ? (
          <>
            <em className="why-source">GEMINI · VERIFIED</em> {aiText}
          </>
        ) : (
          <>
            <em className="why-source">WHY</em> {explanationFor(r)}
          </>
        )}
      </p>
      {isEvent && v.note && <small className="venue-note">{v.note}</small>}
      <small className="venue-source">
        Source:{" "}
        <a href={v.source.url} target="_blank" rel="noopener noreferrer">
          {v.source.name}
        </a>{" "}
        · verified {v.lastVerified}
        {isEvent &&
          !v.yearShownOnSource &&
          " · year inferred from the current listing"}
        {isEvent && " · ticket availability not verified"}
      </small>
      <div className="venue-actions">
        <Button size="sm" disabled={!r.slot} onClick={onSuggest}>
          <CalendarPlus size={14} /> Suggest this date
        </Button>
        {map && (
          <Button size="sm" variant="outline" asChild>
            <a href={map} target="_blank" rel="noopener noreferrer">
              <MapPin size={14} /> Open location
            </a>
          </Button>
        )}
        {official && (
          <Button size="sm" variant="ghost" asChild>
            <a href={official} target="_blank" rel="noopener noreferrer">
              {isEvent ? <Ticket size={14} /> : <ExternalLink size={14} />}
              {isEvent ? "Ticketon page" : "Official website"}
            </a>
          </Button>
        )}
      </div>
      {!r.slot && (
        <small className="venue-note">
          {r.timing === "availability-unknown"
            ? `To suggest a time, you and ${peerName} both need to share availability.`
            : "No shared time fits yet."}
        </small>
      )}
    </article>
  );
}
