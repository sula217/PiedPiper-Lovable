"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { demoPlanning, demoProfiles } from "./fixtures";
import { profileSchema, type Profile, type Dimension } from "./profile";
import {
  answerInvestigation,
  canMessage,
  DEFAULT_WEIGHTS,
  eligibility,
  isMutual,
  isOpenToIntroductions,
  missingInformation,
} from "./matching";
import {
  computeOverlap,
  planningSchema,
  proposalSchema,
  withinWindows,
  venueRefSchema,
  type DateCategory,
  type Planning,
  type Proposal,
  type VenueRef,
} from "./planning";
import { sessionSchema, type AgentSession } from "./agents";
import { cityIdFor } from "./places/types";
import { dateIdeasResultSchema, type DateIdeasResult } from "./dates";
import { suggestionSchema, type Suggestion } from "./enrichment";
import {
  emptySocial,
  instagramSchema,
  socialSchema,
  type Instagram,
} from "./social";

/** Current key. Phase 1 (v1) data is migrated on first load, never discarded. */
export const storageKey = "pied-piper:fictional-demo:v2";
export const legacyStorageKeys = ["pied-piper:fictional-demo:v1"];
export const GUEST_ID = "guest";
const decisionSchema = z.enum(["interested", "pass"]);
const v1Fields = {
  profile: profileSchema.nullable(),
  candidates: z.array(profileSchema),
  decisions: z.record(z.string(), decisionSchema),
  counterparts: z.record(z.string(), decisionSchema),
  questions: z.record(z.string(), z.enum(["declined", "shared"])),
  messages: z.array(
    z.object({
      id: z.string(),
      peerId: z.string(),
      sender: z.enum(["you", "synthetic"]),
      text: z.string().max(2000),
      at: z.string(),
    }),
  ),
  feedback: z.array(
    z.object({ peerId: z.string(), reason: z.string(), at: z.string() }),
  ),
  reports: z.array(
    z.object({ peerId: z.string(), reason: z.string(), at: z.string() }),
  ),
  weights: z.object({
    goals: z.number(),
    lifestyle: z.number(),
    interests: z.number(),
    values: z.number(),
    reciprocal: z.number(),
  }),
};
const legacyV1Schema = z.object({ version: z.literal(1), ...v1Fields });
const stateSchema = z.object({
  version: z.literal(2),
  ...v1Fields,
  /** General availability + date preferences, keyed by profile id. */
  planning: z.record(z.string(), planningSchema),
  /** Latest agent investigation per fictional peer. */
  agentSessions: z.record(z.string(), sessionSchema),
  dateIdeas: z.record(z.string(), dateIdeasResultSchema),
  proposals: z.array(proposalSchema).max(200),
  enrichment: z.array(suggestionSchema).max(60),
  /** Optional Instagram username, kept apart from the profile (Phase 2.2). */
  social: socialSchema.default(emptySocial),
  introducedIds: z.array(z.string()).max(6).default([]),
});
export type DemoState = z.infer<typeof stateSchema>;
export function initialDemo(): DemoState {
  return {
    version: 2,
    profile: null,
    candidates: structuredClone(demoProfiles),
    decisions: {},
    counterparts: {},
    questions: {},
    messages: [],
    feedback: [],
    reports: [],
    weights: { ...DEFAULT_WEIGHTS },
    planning: structuredClone(demoPlanning),
    agentSessions: {},
    dateIdeas: {},
    proposals: [],
    enrichment: [],
    social: emptySocial(),
    introducedIds: [],
  };
}
const isLegacyCity = (city: string) => {
  const id = cityIdFor(city);
  return id === "astana" || id === "almaty";
};
/** Upgrade any supported saved state to the current schema. Throws if invalid. */
export function migrateDemo(raw: unknown): DemoState {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 2) {
    const saved = stateSchema.parse(raw);
    // US relaunch: generated Kazakhstan fixtures were retired, and the
    // hand-written characters moved to US cities. Drop retired fixture IDs,
    // move kept characters (and their fictional time zone) to their current
    // city, and append new stable IDs. Consented answers, blocks, decisions,
    // messages and proposals are never replaced.
    const current = new Map(demoProfiles.map((p) => [p.id, p]));
    const kept = saved.candidates
      .filter((p) => current.has(p.id))
      .map((p) =>
        isLegacyCity(p.city) ? { ...p, city: current.get(p.id)!.city } : p,
      );
    const ids = new Set(kept.map((p) => p.id));
    const planning = { ...structuredClone(demoPlanning) };
    for (const [id, plan] of Object.entries(saved.planning))
      planning[id] =
        id !== GUEST_ID &&
        demoPlanning[id] &&
        plan.availability?.timeZone.startsWith("Asia/")
          ? structuredClone(demoPlanning[id])
          : plan;
    return {
      ...saved,
      candidates: [
        ...kept,
        ...structuredClone(demoProfiles.filter((p) => !ids.has(p.id))),
      ],
      planning,
      agentSessions: Object.fromEntries(
        Object.entries(saved.agentSessions).filter(([id]) => current.has(id)),
      ),
      introducedIds: saved.introducedIds.filter((id) => current.has(id)),
    };
  }
  const v1 = legacyV1Schema.parse(raw);
  const fresh = initialDemo();
  // Then apply the current (v2) upgrade, e.g. the US relaunch.
  return migrateDemo(
    stateSchema.parse({
      ...v1,
      candidates: [
        ...v1.candidates,
        ...fresh.candidates.filter(
          (p) => !v1.candidates.some((old) => old.id === p.id),
        ),
      ],
      version: 2,
      planning: fresh.planning,
      agentSessions: {},
      dateIdeas: {},
      proposals: [],
      enrichment: [],
      social: emptySocial(),
    }),
  );
}
export type DemoAction =
  | { type: "profile"; profile: Profile }
  | { type: "introductions"; ids: string[] }
  | {
      type: "decision";
      id: string;
      decision: "interested" | "pass";
      reason?: string;
      prioritizeInterests?: boolean;
    }
  | { type: "counterpart"; id: string; decision: "interested" | "pass" }
  | {
      type: "answer";
      id: string;
      subjectId: string;
      dimension: Dimension;
      answer: string;
      consent: boolean;
    }
  | { type: "message"; id: string; text: string; synthetic?: boolean }
  | { type: "block"; id: string; report?: string }
  | { type: "reset-decisions" }
  | { type: "ready"; ready: boolean }
  | { type: "planning"; planning: Planning }
  | { type: "agent-session"; id: string; session: AgentSession }
  | { type: "date-ideas"; id: string; result: DateIdeasResult }
  | {
      type: "propose";
      id: string;
      activity: { category: DateCategory; title: string };
      start: string;
      end: string;
      now?: string;
      /** A verified place/event chosen in "Discover Your First Date". */
      venue?: VenueRef;
      /** Days ahead to check availability (events can be weeks away). */
      horizonDays?: number;
    }
  | {
      type: "proposal-response";
      id: string;
      proposalId: string;
      response: "accepted" | "declined";
    }
  | { type: "withdraw-proposal"; id: string; proposalId: string }
  | { type: "enrichment-suggestions"; suggestions: Suggestion[] }
  | { type: "enrichment-decision"; suggestionId: string; approve: boolean }
  /** Delete every pending/rejected suggestion (approved ones are on the profile). */
  | { type: "enrichment-clear" }
  | { type: "social"; instagram: Instagram | null };
export function matched(state: DemoState, id: string) {
  const peer = state.candidates.find((c) => c.id === id);
  return (
    !!state.profile &&
    !!peer &&
    !state.profile.blockedIds.includes(id) &&
    !peer.blockedIds.includes(state.profile.id) &&
    isMutual(state.decisions[id], state.counterparts[id])
  );
}
/** Date planning (availability, ideas, proposals) requires a mutual, unblocked connection. */
export const canPlanDate = (state: DemoState, id: string) => matched(state, id);
export function reduceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "profile")
    return {
      ...state,
      introducedIds: [],
      profile: profileSchema.parse({
        ...action.profile,
        fictional: true,
        id: GUEST_ID,
      }),
    };
  if (action.type === "reset-decisions")
    return { ...state, decisions: {}, counterparts: {}, introducedIds: [] };
  if (!state.profile) throw new Error("Review and approve your profile first.");
  if (action.type === "introductions") {
    const ids = [...new Set([...state.introducedIds, ...action.ids])];
    if (ids.length > 6)
      throw new Error("This collection is limited to six introductions.");
    for (const id of action.ids) {
      const peer = state.candidates.find((p) => p.id === id);
      if (
        !peer ||
        !isOpenToIntroductions(state.profile) ||
        !isOpenToIntroductions(peer) ||
        !eligibility(state.profile, peer).eligible
      )
        throw new Error(
          "Only mutually eligible, Ready-to-Connect profiles can be introduced.",
        );
    }
    return { ...state, introducedIds: ids };
  }
  if (action.type === "social")
    return {
      ...state,
      social: {
        instagram: action.instagram
          ? instagramSchema.parse(action.instagram)
          : null,
      },
    };
  if (action.type === "enrichment-clear")
    return {
      ...state,
      enrichment: state.enrichment.filter((s) => s.status === "approved"),
    };
  if (action.type === "ready")
    return {
      ...state,
      profile: profileSchema.parse({
        ...state.profile,
        readyToConnect: action.ready,
      }),
    };
  if (action.type === "planning") {
    const planning = planningSchema.parse(action.planning);
    const sharing = !!planning.availability?.shareWithMatches;
    return {
      ...state,
      planning: { ...state.planning, [GUEST_ID]: planning },
      // Revoking availability consent withdraws open proposals that relied on
      // it. Already-accepted dates stay until someone withdraws them.
      proposals: sharing
        ? state.proposals
        : state.proposals.map((p) =>
            p.status === "proposed" ? withdraw(p) : p,
          ),
    };
  }
  if (action.type === "enrichment-suggestions") {
    const incoming = action.suggestions.map((x) => suggestionSchema.parse(x));
    const history = state.enrichment.filter((x) => x.status !== "pending");
    return { ...state, enrichment: [...incoming, ...history].slice(0, 60) };
  }
  if (action.type === "enrichment-decision")
    return decideSuggestion(state, state.profile, action);
  const peer = state.candidates.find((c) => c.id === action.id);
  if (!peer) throw new Error("This profile is not available.");
  if (action.type === "block")
    return {
      ...state,
      proposals: state.proposals.map((p) =>
        p.peerId === action.id &&
        (p.status === "proposed" || p.status === "accepted")
          ? withdraw(p)
          : p,
      ),
      profile: {
        ...state.profile,
        blockedIds: [...new Set([...state.profile.blockedIds, action.id])],
      },
      reports: action.report
        ? [
            ...state.reports,
            {
              peerId: action.id,
              reason: action.report,
              at: new Date().toISOString(),
            },
          ]
        : state.reports,
    };
  if (action.type === "decision") {
    if (!eligibility(state.profile, peer).eligible)
      throw new Error(
        "This introduction no longer meets your mutual requirements.",
      );
    if (
      action.decision === "interested" &&
      (!isOpenToIntroductions(state.profile) || !isOpenToIntroductions(peer))
    )
      throw new Error(
        isOpenToIntroductions(state.profile)
          ? `${peer.name} has paused new introductions.`
          : "You’ve paused new introductions. Turn Ready to Connect back on to express new interest.",
      );
    return {
      ...state,
      decisions: { ...state.decisions, [action.id]: action.decision },
      weights: action.prioritizeInterests
        ? { ...state.weights, interests: 30 }
        : state.weights,
      feedback: action.reason
        ? [
            ...state.feedback,
            {
              peerId: action.id,
              reason: action.reason,
              at: new Date().toISOString(),
            },
          ]
        : state.feedback,
    };
  }
  if (action.type === "counterpart") {
    if (
      state.decisions[action.id] !== "interested" ||
      !eligibility(state.profile, peer).eligible
    )
      throw new Error("Express interest in an eligible profile first.");
    return {
      ...state,
      counterparts: { ...state.counterparts, [action.id]: action.decision },
    };
  }
  if (action.type === "answer") {
    const q = missingInformation(state.profile, peer).find(
      (q) =>
        q.subjectId === action.subjectId && q.dimension === action.dimension,
    );
    if (!q || state.questions[q.key])
      throw new Error(
        "This question has already been handled or is no longer relevant.",
      );
    const subject = q.subjectId === state.profile.id ? state.profile : peer;
    const updated = answerInvestigation(
      subject,
      q.dimension,
      action.answer,
      action.consent,
    );
    return {
      ...state,
      profile: subject.id === state.profile.id ? updated : state.profile,
      candidates: state.candidates.map((c) =>
        c.id === subject.id ? updated : c,
      ),
      questions: {
        ...state.questions,
        [q.key]: action.consent ? "shared" : "declined",
      },
    };
  }
  if (action.type === "message") {
    const text = action.text.trim();
    if (!text || text.length > 2000)
      throw new Error("Messages must be between 1 and 2,000 characters.");
    if (
      !canMessage(
        state.profile.id,
        [state.profile.id, peer.id],
        matched(state, peer.id),
        state.profile.blockedIds.includes(peer.id),
      )
    )
      throw new Error("Messaging requires an unblocked mutual connection.");
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          peerId: action.id,
          sender: action.synthetic ? "synthetic" : "you",
          text,
          at: new Date().toISOString(),
        },
      ],
    };
  }
  if (action.type === "agent-session") {
    const session = sessionSchema.parse(action.session);
    if (
      session.peerId !== peer.id ||
      session.agents.b.profileId !== peer.id ||
      session.agents.a.profileId !== state.profile.id
    )
      throw new Error(
        "This investigation does not belong to this introduction.",
      );
    if (!eligibility(state.profile, peer).eligible)
      throw new Error(
        "Matchmakers only investigate introductions that meet both people’s requirements.",
      );
    return {
      ...state,
      agentSessions: { ...state.agentSessions, [peer.id]: session },
    };
  }
  // Everything below is first-date planning: mutual connections only.
  if (!canPlanDate(state, peer.id))
    throw new Error(
      "Date planning opens only after both people express interest.",
    );
  if (action.type === "date-ideas")
    return {
      ...state,
      dateIdeas: {
        ...state.dateIdeas,
        [peer.id]: dateIdeasResultSchema.parse(action.result),
      },
    };
  if (action.type === "propose") {
    const now = action.now ? new Date(action.now) : new Date();
    const horizon = Math.min(Math.max(action.horizonDays ?? 7, 1), 35);
    const overlap = computeOverlap(
      state.planning[GUEST_ID]?.availability,
      state.planning[peer.id]?.availability,
      { from: now, days: horizon },
    );
    if (overlap.status !== "ok")
      throw new Error(
        "Both people need to share overlapping availability before proposing a time.",
      );
    if (
      !withinWindows({ start: action.start, end: action.end }, overlap.windows)
    )
      throw new Error("Choose a time inside your shared availability.");
    const at = now.toISOString();
    const proposal = proposalSchema.parse({
      id: crypto.randomUUID(),
      peerId: peer.id,
      activity: action.activity,
      ...(action.venue ? { venue: venueRefSchema.parse(action.venue) } : {}),
      start: new Date(action.start).toISOString(),
      end: new Date(action.end).toISOString(),
      proposedBy: "you",
      status: "proposed",
      responseSimulated: false,
      createdAt: at,
      updatedAt: at,
    });
    return {
      ...state,
      // A new proposal replaces (withdraws) your previous open one.
      proposals: [
        ...state.proposals.map((p) =>
          p.peerId === peer.id &&
          p.proposedBy === "you" &&
          p.status === "proposed"
            ? withdraw(p)
            : p,
        ),
        proposal,
      ].slice(-200),
    };
  }
  if (
    action.type === "proposal-response" ||
    action.type === "withdraw-proposal"
  ) {
    const target = state.proposals.find(
      (p) => p.id === action.proposalId && p.peerId === peer.id,
    );
    if (!target) throw new Error("This proposal is no longer available.");
    if (action.type === "proposal-response") {
      if (target.status !== "proposed" || target.proposedBy !== "you")
        throw new Error("Only an open proposal can be answered.");
      return replaceProposal(state, {
        ...target,
        status: action.response,
        responseSimulated: true,
        updatedAt: new Date().toISOString(),
      });
    }
    if (target.status !== "proposed" && target.status !== "accepted")
      throw new Error("This proposal is already closed.");
    return replaceProposal(state, withdraw(target));
  }
  return state;
}
function withdraw(p: Proposal): Proposal {
  return { ...p, status: "withdrawn", updatedAt: new Date().toISOString() };
}
function replaceProposal(state: DemoState, next: Proposal): DemoState {
  return {
    ...state,
    proposals: state.proposals.map((p) => (p.id === next.id ? next : p)),
  };
}
/** Applies an enrichment suggestion ONLY when the person explicitly approves it. */
function decideSuggestion(
  state: DemoState,
  profile: Profile,
  action: { suggestionId: string; approve: boolean },
): DemoState {
  const s = state.enrichment.find((x) => x.id === action.suggestionId);
  if (!s || s.status !== "pending")
    throw new Error("This suggestion was already reviewed.");
  const status = action.approve ? ("approved" as const) : ("rejected" as const);
  const enrichment = state.enrichment.map((x) =>
    x.id === s.id ? { ...x, status } : x,
  );
  if (!action.approve) return { ...state, enrichment };
  let nextProfile = profile,
    planning = state.planning;
  if (s.kind === "interest") {
    if (!profile.interests.includes(s.value)) {
      if (profile.interests.length >= 12)
        throw new Error(
          "You already have 12 interests. Remove one in your profile first.",
        );
      nextProfile = profileSchema.parse({
        ...profile,
        interests: [...profile.interests, s.value],
      });
    }
  } else if (s.kind === "summary") {
    nextProfile = profileSchema.parse({ ...profile, bio: s.value });
  } else if (s.kind === "activity") {
    const current: Planning = planning[GUEST_ID] ?? {
      availability: null,
      datePreferences: { budget: null, activityTypes: [] },
    };
    planning = {
      ...planning,
      [GUEST_ID]: planningSchema.parse({
        ...current,
        datePreferences: {
          ...current.datePreferences,
          activityTypes: [
            ...new Set([...current.datePreferences.activityTypes, s.value]),
          ],
        },
      }),
    };
  }
  return { ...state, enrichment, profile: nextProfile, planning };
}
const serverState = initialDemo();
let snapshot = serverState,
  hydrated = false;
let storageError = "";
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}
function getSnapshot() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        snapshot = migrateDemo(JSON.parse(raw));
        const upgraded = JSON.stringify(snapshot);
        if (upgraded !== raw) {
          try {
            localStorage.setItem(storageKey, upgraded);
          } catch {
            storageError =
              "The upgraded demo is available for this visit, but browser storage could not save it.";
          }
        }
      } else {
        // Safe upgrade: keep Phase 1 progress, then retire the legacy key only
        // after the migrated state has been written successfully.
        for (const key of legacyStorageKeys) {
          const legacy = localStorage.getItem(key);
          if (!legacy) continue;
          snapshot = migrateDemo(JSON.parse(legacy));
          localStorage.setItem(storageKey, JSON.stringify(snapshot));
          localStorage.removeItem(key);
          break;
        }
      }
    } catch {
      storageError =
        "Saved demo data could not be read. This session is starting fresh.";
    }
  }
  return snapshot;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useDemo() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}
export function getStorageError() {
  return storageError;
}
export function dispatchDemo(action: DemoAction) {
  snapshot = reduceDemo(getSnapshot(), action);
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    storageError = "";
  } catch {
    storageError =
      "Browser storage is unavailable or full. Changes will last only for this visit.";
  }
  emit();
}
export function deleteDemo() {
  snapshot = initialDemo();
  try {
    localStorage.removeItem(storageKey);
    for (const key of legacyStorageKeys) localStorage.removeItem(key);
  } catch {
    storageError =
      "Browser storage could not be cleared. Clear site data in browser settings.";
  }
  emit();
}
