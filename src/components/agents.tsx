"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarHeart,
  Check,
  CircleDashed,
  CircleHelp,
  Heart,
  Layers,
  LoaderCircle,
  MapPin,
  MessageCircleQuestion,
  MessagesSquare,
  Mountain,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell, NoProfile } from "./app-shell";
import { Portrait } from "./portrait";
import { PiperMark } from "./brand";
import { Button } from "./ui/button";
import { InvestigationModal } from "./discover";
import {
  AIModeBadge,
  invalidateGeminiStatus,
  liveUnavailable,
  useGeminiStatus,
} from "./ai-status";
import { dispatchDemo, matched, useDemo } from "@/lib/demo-store";
import { eligibility, recommend } from "@/lib/matching";
import {
  attributeLabel,
  dimensionLabels,
  title,
  type Profile,
} from "@/lib/profile";
import {
  agentEventSchema,
  buildApprovedContext,
  deterministicSummary,
  investigationBasis,
  DEFAULT_ROUNDS,
  MAX_COACH_QUESTIONS,
  MAX_ROUNDS,
  other,
  runInvestigation,
  screenCoachQuestion,
  scriptedBrain,
  type AgentBrain,
  type AgentEvent,
  type AgentSession,
  type AgentSummary,
  type AgentTurn,
  type ApprovedFact,
  type Topic,
} from "@/lib/agents";

type Live = {
  source: "gemini" | "scripted";
  status: "running" | "done" | "error";
  topics: Topic[];
  turns: AgentTurn[];
  summary: AgentSummary | null;
  facts: ApprovedFact[];
  error: string;
  notice: string;
  /** Fingerprint of the approved facts this run used. */
  basis: string;
};
const portraitFor = (p: Profile) =>
  p.id === "guest" ? p.name.toLocaleLowerCase() || "guest" : p.id;

export function AgentConversations({ initialId }: { initialId?: string }) {
  const state = useDemo(),
    [selected, setSelected] = useState(initialId ?? "");
  if (!state.profile?.approved)
    return (
      <AppShell>
        <NoProfile />
      </AppShell>
    );
  const profile = state.profile;
  const ranked = recommend(profile, state.candidates, state.weights).filter(
    (r) => state.decisions[r.profile.id] !== "pass",
  );
  const listed = [
    ...ranked.slice(0, 6).map((r) => r.profile),
    ...state.candidates.filter(
      (c) =>
        state.agentSessions[c.id] &&
        !ranked.slice(0, 6).some((r) => r.profile.id === c.id) &&
        !profile.blockedIds.includes(c.id),
    ),
  ];
  const peer =
    listed.find((p) => p.id === selected) ??
    state.candidates.find(
      (c) => c.id === selected && !profile.blockedIds.includes(c.id),
    ) ??
    listed[0];
  return (
    <AppShell>
      <div className="page-heading ag-heading">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-star" aria-hidden="true">
              ✳
            </span>
            Agent conversations
          </span>
          <h1>
            Let the matchmakers <em>investigate.</em>
          </h1>
          <p>
            Your AI matchmaker and theirs have a short, consent-based
            conversation about approved facts, so you start with what matters.
          </p>
        </div>
        {peer && (
          <div className="ag-bounded">
            <span>
              <ShieldCheck size={15} /> Bounded investigation
            </span>
            <strong>
              {profile.name} <span aria-hidden="true">↔</span>
              <span className="sr-only">and</span> {peer.name}
            </strong>
            <small>Fictional profiles only</small>
          </div>
        )}
      </div>
      {!peer ? (
        <div className="empty-state">
          <MessagesSquare size={34} />
          <h2>No introductions to investigate yet.</h2>
          <p>
            Matchmakers only talk about people who meet both sides’
            requirements. Check your introductions or preferences.
          </p>
          <Button asChild>
            <Link href="/discover">
              See your introductions <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <nav className="ag-picker" aria-label="Introductions">
            {listed.map((p) => {
              const s = state.agentSessions[p.id];
              return (
                <button
                  key={p.id}
                  className={peer.id === p.id ? "active" : ""}
                  aria-current={peer.id === p.id}
                  onClick={() => setSelected(p.id)}
                >
                  <span className="ag-picker-photo">
                    <Portrait id={p.id} gender={p.gender} age={p.age} />
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {matched(state, p.id)
                        ? "Mutual connection"
                        : s?.summary
                          ? s.summary.verdict === "clarify-first"
                            ? "A question is open"
                            : "Common ground found"
                          : "Not investigated yet"}
                    </small>
                  </span>
                </button>
              );
            })}
          </nav>
          <AgentTheater
            key={peer.id}
            profile={profile}
            peer={peer}
            session={state.agentSessions[peer.id]}
            handled={state.questions}
            decision={state.decisions[peer.id]}
            isMatched={matched(state, peer.id)}
          />
        </>
      )}
    </AppShell>
  );
}

function AgentTheater({
  profile,
  peer,
  session,
  handled,
  decision,
  isMatched,
}: {
  profile: Profile;
  peer: Profile;
  session?: AgentSession;
  handled: Record<string, string>;
  decision?: string;
  isMatched: boolean;
}) {
  const [live, setLive] = useState<Live | null>(null),
    [consent, setConsent] = useState(false),
    [asking, setAsking] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [actionError, setActionError] = useState(""),
    // Coach Mode: questions waiting for the next available turn.
    [queue, setQueue] = useState<string[]>([]),
    [coachDraft, setCoachDraft] = useState(""),
    [coachError, setCoachError] = useState("");
  const reduceMotion = useReducedMotion();
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Mirror of the Coach Mode queue, readable from stream callbacks.
  const queueRef = useRef<string[]>([]);
  const enqueue = (text: string) => {
    queueRef.current = [...queueRef.current, text];
    setQueue(queueRef.current);
  };
  const takeQueue = () => {
    const q = queueRef.current;
    queueRef.current = [];
    setQueue([]);
    return q;
  };
  const consentRef = useRef(false);
  const statusRef = useRef<typeof status | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const status = useGeminiStatus();
  useEffect(() => {
    consentRef.current = consent;
    statusRef.current = status;
  }, [consent, status]);
  const eligible = eligibility(profile, peer).eligible;
  const recommendation = eligible ? recommend(profile, [peer])[0] : undefined;
  const view: Live | null =
    live ??
    (session
      ? {
          source: session.source,
          status: session.status === "failed" ? "error" : "done",
          topics: session.topics,
          turns: session.turns,
          summary: session.summary,
          facts: session.facts,
          error: "",
          notice: session.notice ?? "",
          basis: session.basis,
        }
      : null);
  const factMap = useMemo(
    () => new Map((view?.facts ?? []).map((f) => [f.id, f])),
    [view?.facts],
  );
  const stale =
    !!view &&
    view.status === "done" &&
    eligible &&
    view.basis !== investigationBasis(profile, peer);
  const running = view?.status === "running";
  const names = { a: profile.name, b: peer.name };

  /** Coach Mode questions already asked in this conversation. */
  const coachAsked = (view?.topics ?? []).filter((t) => t.coach).length;
  const coachLeft = Math.max(
    0,
    MAX_COACH_QUESTIONS - coachAsked - queue.length,
  );

  function start(
    source: "gemini" | "scripted",
    reuse = true,
    extra: { coach?: string[]; prior?: AgentSession } = {},
  ) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const facts = [
      ...buildApprovedContext(profile, "a").facts,
      ...buildApprovedContext(peer, "b").facts,
    ];
    const prior = extra.prior
      ? {
          turns: extra.prior.turns,
          topics: extra.prior.topics,
          modelCalls: extra.prior.modelCalls,
        }
      : undefined;
    // Questions queued before the first run are asked after its planned rounds.
    const coach = extra.coach ?? (extra.prior ? [] : takeQueue());
    setNotice("");
    setLive({
      source,
      status: "running",
      // A Coach Mode continuation keeps every verified turn on screen.
      topics: prior?.topics ?? [],
      turns: prior?.turns ?? [],
      summary: null,
      facts,
      error: "",
      notice: "",
      basis: investigationBasis(profile, peer),
    });
    const collected: { topics: Topic[]; turns: AgentTurn[] } = {
      topics: prior?.topics ?? [],
      turns: [...(prior?.turns ?? [])],
    };
    let completed = false;
    const handle = (e: AgentEvent) => {
      if (ac.signal.aborted) return;
      if (e.type === "plan") {
        collected.topics = e.topics;
        setLive((l) => l && { ...l, topics: e.topics });
      } else if (e.type === "turn") {
        // Each verified turn is shown the moment it arrives.
        collected.turns.push(e.turn);
        setLive((l) => l && { ...l, turns: [...l.turns, e.turn] });
      } else if (e.type === "summary")
        setLive((l) => l && { ...l, summary: e.summary });
      else if (e.type === "error")
        setLive((l) => l && { ...l, error: e.message });
      else if (e.type === "complete") {
        completed = true;
        finish(e.session);
      }
    };
    const finish = (s: AgentSession) => {
      if (s.source === "gemini") invalidateGeminiStatus();
      // Questions queued while this run was busy are asked next, continuing
      // the same conversation (never interrupting a running model call).
      const live =
        s.source === "scripted" ||
        (consentRef.current &&
          !(statusRef.current && liveUnavailable(statusRef.current)));
      const asked = s.topics.filter((t) => t.coach).length;
      if (s.status !== "failed" && queueRef.current.length && live) {
        const next = takeQueue().slice(
          0,
          Math.max(0, MAX_COACH_QUESTIONS - asked),
        );
        if (next.length)
          setTimeout(
            () => start(s.source, false, { coach: next, prior: s }),
            0,
          );
      }
      if (s.status !== "failed")
        try {
          dispatchDemo({ type: "agent-session", id: peer.id, session: s });
        } catch (err) {
          setActionError(
            err instanceof Error ? err.message : "Could not save this result.",
          );
        }
      setLive(
        (l) =>
          l && {
            ...l,
            status: s.status === "failed" ? "error" : "done",
            summary: s.summary,
            topics: s.topics,
            turns: s.turns,
            facts: s.facts,
            error:
              s.status === "failed"
                ? s.notice || "The matchmakers could not talk right now."
                : "",
            notice: s.notice ?? "",
          },
      );
    };
    const fail = (message: string) => {
      if (ac.signal.aborted) return;
      if (collected.turns.length) {
        // The stream ended early: keep the verified turns and label the result.
        finish({
          id: `${source}-${peer.id}-${Date.now().toString(36)}`.slice(0, 60),
          peerId: peer.id,
          source,
          status: "partial",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          agents: {
            a: { name: profile.name, profileId: profile.id },
            b: { name: peer.name, profileId: peer.id },
          },
          topics: collected.topics,
          turns: collected.turns,
          facts,
          summary: deterministicSummary(profile, peer, handled),
          modelCalls: prior?.modelCalls ?? 0,
          basis: investigationBasis(profile, peer),
          notice:
            `${message} The completed turns are kept, with a summary assembled without AI.`.slice(
              0,
              400,
            ),
          failedSide: null,
        });
      } else setLive((l) => l && { ...l, status: "error", error: message });
    };
    if (source === "scripted") {
      const brain = scriptedBrain();
      const wait = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ac.signal.aborted ? 0 : ms));
      // Scripted turns are paced so they read one by one; they are labeled
      // "Scripted demo" throughout and never claim to be AI-generated.
      const pace = reduceMotion ? 0.35 : 1;
      const paced: AgentBrain = {
        source: "scripted",
        ask: async (i, o) => (await wait(900 * pace), brain.ask(i, o)),
        answer: async (i, o) => (await wait(1100 * pace), brain.answer(i, o)),
      };
      runInvestigation({
        a: profile,
        b: peer,
        handled,
        brain: paced,
        onEvent: handle,
        signal: ac.signal,
        coach,
        prior,
      }).catch((e) =>
        fail(e instanceof Error ? e.message : "The demonstration failed."),
      );
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/ai/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            a: profile,
            b: peer,
            handled,
            processingConsent: true,
            reuse,
            coach,
            prior: prior ?? null,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? "The matchmakers could not start a conversation.",
          );
        }
        const reader = res.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let i;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) continue;
            try {
              const parsed = agentEventSchema.safeParse(JSON.parse(line));
              if (parsed.success) handle(parsed.data);
            } catch {
              /* ignore a malformed line; the result stays partial */
            }
          }
        }
        if (!completed) fail("The connection to the matchmakers ended early.");
      } catch (e) {
        if (ac.signal.aborted) return;
        fail(
          e instanceof Error
            ? e.message
            : "The matchmakers could not start a conversation.",
        );
      }
    })();
  }

  /** The completed conversation a Coach Mode round continues from. */
  const continuable =
    !running && session && session.status !== "failed" && !stale
      ? session
      : undefined;
  function askCoach(text: string) {
    setCoachError("");
    const screen = screenCoachQuestion(text);
    if (!screen.ok) return setCoachError(screen.reason);
    if (coachLeft <= 0)
      return setCoachError(
        `You've used all ${MAX_COACH_QUESTIONS} Coach Mode questions for this introduction on the free plan.`,
      );
    setCoachDraft("");
    if (running || !view) {
      // Never interrupt a running model call: queue it for the next turn.
      enqueue(screen.text);
      return;
    }
    if (!continuable) return enqueue(screen.text);
    const source = view.source;
    if (source === "gemini" && (!consent || liveUnavailable(status)))
      return setCoachError(
        "Live AI isn't available for this question (consent is off or Gemini is unavailable). Tick the consent box below, or replay it as a scripted demo.",
      );
    start(source, false, { coach: [screen.text], prior: continuable });
  }

  const nextTurn = (() => {
    if (!view || !running) return null;
    if (!view.topics.length) return "Planning the most useful questions…";
    const answered = new Set(
      view.turns.filter((t) => t.role === "answer").map((t) => t.topicId),
    );
    const topic = view.topics.find((t) => !answered.has(t.id));
    if (!topic)
      return "Assembling the summary from verified facts (no extra AI call)…";
    const asked = view.turns.some(
      (t) => t.role === "question" && t.topicId === topic.id,
    );
    const side = asked ? other(topic.asker) : topic.asker;
    const agent = `Agent ${side.toUpperCase()} (Piper for ${names[side]})`;
    const verb = view.source === "gemini" ? "is thinking" : "is typing";
    return asked
      ? `${agent} ${verb} — checking ${names[side]}’s approved profile…`
      : topic.coach
        ? `${agent} ${verb} — asking your Coach Mode question…`
        : `${agent} ${verb} — a question about ${topic.label.toLowerCase()}…`;
  })();
  // Keep the newest message (or the thinking indicator) in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [view?.turns.length, nextTurn, reduceMotion]);

  const answeredRounds = view
    ? view.turns.filter((t) => t.role === "answer").length
    : 0;
  const openUnknown =
    view?.summary && !running && recommendation
      ? view.summary.unknowns.find((u) => !handled[u.key])
      : undefined;
  const sourceChip = !view ? (
    <span className="status-chip is-unknown">Not started</span>
  ) : view.status === "error" ? (
    <span className="status-chip is-error">
      <X size={12} /> Interrupted
    </span>
  ) : running ? (
    <span className="status-chip is-live">
      <LoaderCircle size={12} className="spin" /> In conversation
    </span>
  ) : view.source === "gemini" ? (
    <span className="status-chip is-live">
      <Sparkles size={12} /> Live AI · {answeredRounds} round
      {answeredRounds === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="status-chip is-scripted">
      Scripted demo · {answeredRounds} round{answeredRounds === 1 ? "" : "s"}
    </span>
  );

  return (
    <section
      className="agent-theater"
      aria-label={`Matchmakers for you and ${peer.name}`}
    >
      <header className="ag-people">
        <PersonCard person={profile} portrait={portraitFor(profile)} you />
        <div
          className={`ag-link ${running ? "active" : ""}`}
          aria-hidden="true"
        >
          <Sparkles size={20} />
        </div>
        <PersonCard person={peer} portrait={peer.id} />
      </header>

      <div className="ag-grid">
        <div className="ag-convo">
          <div className="ag-panel-head">
            <span className="ag-panel-icon">
              <MessagesSquare size={20} />
            </span>
            <h2>Agent conversation</h2>
            {sourceChip}
          </div>
          {view && <Progress view={view} />}
          {!view && (
            <div className="agent-intro">
              <h3>
                Shall our matchmakers <em>compare notes?</em>
              </h3>
              <ul>
                <li>
                  <Check size={15} /> Each matchmaker only sees its own person’s
                  approved profile. Preferences, dealbreakers and interviews
                  stay private.
                </li>
                <li>
                  <Check size={15} /> {DEFAULT_ROUNDS} question-and-answer
                  rounds, a {MAX_ROUNDS === 3 ? "third" : "further"} only for an
                  important open question. No scores, no predictions.
                </li>
                <li>
                  <Check size={15} /> Every confirmed fact is checked against
                  approved data. Unknowns stay unknown until someone chooses to
                  share.
                </li>
              </ul>
              {!eligible && (
                <p className="error-text" role="alert">
                  This introduction no longer meets both people’s requirements,
                  so the matchmakers won’t investigate it.
                </p>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Send these fictional profiles’ approved facts to Gemini for this
                conversation.
              </label>
              <div className="ai-mode-row">
                <AIModeBadge mode="live" status={status} />
              </div>
              {liveUnavailable(status) && (
                <p className="muted" role="status">
                  Live AI can’t run right now, so nothing will be sent to
                  Gemini. The scripted demonstration shows the same flow,
                  clearly labeled.
                </p>
              )}
              <div className="inline-actions">
                <Button
                  disabled={!consent || !eligible || liveUnavailable(status)}
                  onClick={() => start("gemini")}
                >
                  <Sparkles size={16} /> Let our AIs talk
                </Button>
                <Button
                  variant="outline"
                  disabled={!eligible}
                  onClick={() => start("scripted")}
                >
                  Play the scripted demonstration
                </Button>
              </div>
              <small>
                The scripted demonstration uses templates, never calls AI, and
                is labeled as scripted throughout.
              </small>
            </div>
          )}
          {view && (
            <>
              <div className={`source-banner ${view.source}`}>
                {view.source === "gemini" ? (
                  <>
                    <Sparkles size={14} />
                    LIVE AI · real Gemini calls, one per message · two separate
                    agent contexts · facts verified before display
                  </>
                ) : (
                  <>
                    <PiperMark />
                    SCRIPTED DEMO · predefined template responses · not
                    AI-generated
                  </>
                )}
              </div>
              <div className="agent-transcript" aria-live="polite">
                <AnimatePresence initial={false}>
                  {view.turns.map((t) => (
                    <TurnBubble
                      key={t.id}
                      turn={t}
                      names={names}
                      topic={view.topics.find((x) => x.id === t.topicId)}
                      factMap={factMap}
                      source={view.source}
                    />
                  ))}
                </AnimatePresence>
                {nextTurn && (
                  <div className="agent-typing" role="status">
                    <span className="ag-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    {nextTurn}
                  </div>
                )}
                <div ref={endRef} aria-hidden="true" />
              </div>
              {view.error && (
                <div className="notice error-notice" role="alert">
                  <div>
                    <strong>The matchmakers couldn’t finish.</strong>
                    <p>{view.error}</p>
                    <div className="inline-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => start("scripted")}
                      >
                        Play the scripted demonstration instead
                      </Button>
                      {consent && !liveUnavailable(status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => start("gemini")}
                        >
                          Retry Gemini
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!view.error && view.notice && !running && (
                <div className="provider-notice agent-notice" role="status">
                  {view.notice}
                </div>
              )}
              <CoachPanel
                peerName={peer.name}
                draft={coachDraft}
                onDraft={setCoachDraft}
                onAsk={askCoach}
                error={coachError}
                queue={queue}
                left={coachLeft}
                running={running}
                askedTopics={view.topics.filter((t) => t.coach)}
                turns={view.turns}
              />
              {!running && (
                <div className="agent-rerun">
                  <span>Run it again</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!eligible}
                    onClick={() => start("scripted")}
                  >
                    Scripted demonstration
                  </Button>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Send approved fictional facts to Gemini
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!consent || !eligible || liveUnavailable(status)}
                    onClick={() => start("gemini", false)}
                  >
                    <Sparkles size={14} /> Live with Gemini
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="ag-summary" aria-label="Your matchmaker’s take">
          <div className="ag-panel-head">
            <span className="ag-panel-icon sage">
              <Layers size={20} />
            </span>
            <h2>Your matchmaker’s take</h2>
          </div>
          {view?.summary && !running ? (
            <SummaryPanel
              summary={view.summary}
              factMap={factMap}
              names={names}
              peer={peer}
              profile={profile}
              handled={handled}
              isMatched={isMatched}
              canAsk={!!recommendation}
              onAsk={setAsking}
            />
          ) : running ? (
            <div className="ag-summary-wait" role="status">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton short" />
              <p>
                The summary is assembled from verified facts after the last
                round, with no extra AI call.
              </p>
            </div>
          ) : (
            <div className="ag-summary-empty">
              <CircleDashed size={26} />
              <p>
                When the matchmakers finish, you’ll see confirmed common ground,
                possible differences, what’s still unknown and an
                evidence-backed recommendation.
              </p>
            </div>
          )}
        </aside>
      </div>

      {openUnknown && (
        <div className="ag-followup">
          <span className="ag-followup-icon">
            <MessageCircleQuestion size={28} />
          </span>
          <div>
            <h3>Ask a consent-based follow-up question.</h3>
            <p>
              {openUnknown.subjectSide === "b"
                ? `Check in with ${peer.name} about ${dimensionLabels[openUnknown.dimension].toLowerCase()}, only with their permission, to complete the picture.`
                : `You haven’t shared your ${dimensionLabels[openUnknown.dimension].toLowerCase()} yet. Answer only if you’re comfortable.`}
            </p>
          </div>
          <Button variant="outline" onClick={() => setAsking(openUnknown.key)}>
            <CircleHelp size={17} /> Ask follow-up question
          </Button>
        </div>
      )}
      {stale && (
        <div className="notice sage-notice stale-notice">
          <RefreshCw size={17} />
          <p>
            Something changed since this conversation, such as an answer shared
            with consent. The introduction below is already recalculated; run
            the matchmakers again to investigate with the updated facts.
          </p>
        </div>
      )}
      {notice && (
        <div role="status" className="notice success-notice dismiss-notice">
          <p>{notice}</p>
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="error-text">
          {actionError}
        </p>
      )}
      {view?.summary && !running && (
        <NextSteps
          peer={peer}
          recommendation={recommendation}
          eligible={eligible}
          decision={decision}
          isMatched={isMatched}
          onError={setActionError}
        />
      )}
      {!(view?.summary && !running) && (
        <div className="ag-back">
          <Link href="/discover" className="button button-outline">
            <ArrowLeft size={16} /> Back to Discover
          </Link>
        </div>
      )}
      {asking && recommendation && (
        <InvestigationModal
          recommendation={recommendation}
          viewer={profile}
          handled={handled}
          initialKey={asking}
          onClose={() => setAsking(null)}
          onResult={(message) => {
            setAsking(null);
            setNotice(message);
          }}
        />
      )}
    </section>
  );
}

function PersonCard({
  person,
  portrait,
  you = false,
}: {
  person: Profile;
  portrait: string;
  you?: boolean;
}) {
  return (
    <div className={`ag-person ${you ? "side-a" : "side-b"}`}>
      <div className="ag-person-photo">
        <Portrait id={portrait} gender={person.gender} age={person.age} />
      </div>
      <div className="ag-person-body">
        <strong className="ag-person-name">
          {person.name}
          {person.age ? `, ${person.age}` : ""}
          {you && <span className="ag-you">You</span>}
        </strong>
        <ul>
          {person.interests.length > 0 && (
            <li>
              <Mountain size={15} />
              Enjoys {person.interests.slice(0, 3).join(", ")}
            </li>
          )}
          {person.intent && (
            <li>
              <Heart size={15} />
              Looking for {title(person.intent).toLowerCase()}
            </li>
          )}
          {person.city && (
            <li>
              <MapPin size={15} />
              {person.city}
            </li>
          )}
        </ul>
        <span className="ag-agent-chip">
          <PiperMark />
          <span>Piper for {person.name}</span>
          <small>{you ? "· your matchmaker" : "· their matchmaker"}</small>
        </span>
      </div>
    </div>
  );
}

function Progress({ view }: { view: Live }) {
  const answered = view.turns.filter((t) => t.role === "answer").length;
  const steps = [
    {
      label: "Plan",
      done: view.topics.length > 0 || view.status !== "running",
    },
    ...Array.from({ length: Math.max(view.topics.length, 1) }, (_, i) => ({
      label: view.topics[i]?.label ?? `Round ${i + 1}`,
      done: answered > i,
    })),
    { label: "Summary", done: !!view.summary && view.status !== "running" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="agent-progress" aria-label="Investigation progress">
      {steps.map((s, i) => (
        <li
          key={`${s.label}-${i}`}
          className={
            s.done
              ? "done"
              : i === current && view.status === "running"
                ? "current"
                : ""
          }
        >
          <span>{s.done ? <Check size={11} /> : i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function EvidenceChips({
  ids,
  factMap,
  names,
}: {
  ids: string[];
  factMap: Map<string, ApprovedFact>;
  names: { a: string; b: string };
}) {
  if (!ids.length) return null;
  return (
    <ul className="evidence-chips" aria-label="Approved facts cited">
      {ids.map((id) => {
        const f = factMap.get(id);
        if (!f) return null;
        const value =
          f.value.length > 48 ? `${f.value.slice(0, 46)}…` : f.value;
        return (
          <li key={id} title={`${names[f.side]} · ${f.label}: ${f.value}`}>
            <BadgeCheck size={11} />
            <span>{names[f.side]}</span>{" "}
            {f.label === "Interest" || f.label === "Value"
              ? value
              : `${f.label}: ${value}`}
          </li>
        );
      })}
    </ul>
  );
}

function TurnBubble({
  turn,
  names,
  topic,
  factMap,
  source,
}: {
  turn: AgentTurn;
  names: { a: string; b: string };
  topic?: Topic;
  factMap: Map<string, ApprovedFact>;
  source: "gemini" | "scripted";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`agent-turn side-${turn.side} ${turn.role}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="ag-turn-avatar" aria-hidden="true">
        <PiperMark />
      </span>
      <div className="ag-turn-body">
        <span className="agent-turn-meta">
          <strong>
            Agent {turn.side.toUpperCase()} · {names[turn.side]}’s Piper
          </strong>
          <span>
            {turn.role === "question" ? "asks" : "answers"} · round {turn.round}
            {topic ? ` · ${topic.label.toLowerCase()}` : ""}
          </span>
          {topic?.coach && turn.role === "question" && (
            <span className="coach-tag">Your Coach Mode question</span>
          )}
          <em>
            {source === "scripted"
              ? "SCRIPTED DEMO"
              : turn.answeredBy === "rule"
                ? "RULE · NO AI CALL"
                : "LIVE AI · GEMINI"}
          </em>
        </span>
        <div className="ag-bubble">
          <p>{turn.text}</p>
          {turn.role === "answer" && (
            <span className={`turn-status ${turn.status}`}>
              {turn.status === "confirmed" ? (
                <>
                  <BadgeCheck size={13} /> Confirmed from approved profile
                </>
              ) : (
                <>
                  <CircleDashed size={13} /> Unknown · not shared yet
                </>
              )}
            </span>
          )}
          <EvidenceChips ids={turn.evidence} factMap={factMap} names={names} />
          {turn.answeredBy === "rule" && source === "gemini" && (
            <small className="grounding-note">
              <ShieldCheck size={12} /> Nothing approved answers this, so it was
              answered by rule without asking the AI to guess.
            </small>
          )}
          {turn.grounding === "corrected" && (
            <small className="grounding-note">
              <ShieldCheck size={12} /> The AI draft couldn’t be fully verified,
              so this answer was rewritten from approved facts only.
            </small>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SummaryPanel({
  summary,
  factMap,
  names,
  peer,
  profile,
  handled,
  isMatched,
  canAsk,
  onAsk,
}: {
  summary: AgentSummary;
  factMap: Map<string, ApprovedFact>;
  names: { a: string; b: string };
  peer: Profile;
  profile: Profile;
  handled: Record<string, string>;
  isMatched: boolean;
  canAsk: boolean;
  onAsk: (key: string) => void;
}) {
  return (
    <div className="agent-summary">
      <div className="summary-col confirmed">
        <h4>
          <Check size={16} /> Confirmed common ground
        </h4>
        {summary.commonGround.length ? (
          <ul>
            {summary.commonGround.map((c) => (
              <li key={c.text}>
                {c.text}
                <EvidenceChips
                  ids={c.evidence.slice(0, 4)}
                  factMap={factMap}
                  names={names}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p>No confirmed common ground yet.</p>
        )}
      </div>
      <div className="summary-col differences">
        <h4>
          <Scale size={16} /> Possible differences
        </h4>
        {summary.possibleDifferences.length ? (
          <ul>
            {summary.possibleDifferences.map((c) => (
              <li key={c.text}>
                {c.text}
                <EvidenceChips
                  ids={c.evidence.slice(0, 4)}
                  factMap={factMap}
                  names={names}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p>No stated differences in the approved facts.</p>
        )}
      </div>
      <div className="summary-col unknowns">
        <h4>
          <CircleDashed size={16} /> Still unknown
        </h4>
        {summary.unknowns.length ? (
          <ul>
            {summary.unknowns.map((u) => {
              const status = handled[u.key];
              const subject = u.subjectSide === "a" ? profile : peer;
              return (
                <li key={u.key}>
                  {u.hard && <span className="hard-tag">Firm requirement</span>}
                  {status === "shared" ? (
                    <span className="resolved">
                      <BadgeCheck size={13} /> Resolved with consent:{" "}
                      {subject.name} shared “
                      {attributeLabel(
                        u.dimension,
                        subject.attributes[u.dimension],
                      )}
                      ”.
                    </span>
                  ) : status === "declined" ? (
                    <span>
                      {subject.name} chose not to share{" "}
                      {dimensionLabels[u.dimension].toLowerCase()}. It won’t be
                      asked again.
                    </span>
                  ) : (
                    <>
                      {u.text}
                      {canAsk && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAsk(u.key)}
                        >
                          {u.subjectSide === "b"
                            ? `Ask ${peer.name} with consent`
                            : "Answer for yourself"}
                          <ArrowUpRight size={14} />
                        </Button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Nothing important is unknown for either person’s preferences.</p>
        )}
      </div>
      {!!summary.sharedActivities?.length && (
        <div className="shared-activities">
          <h4>
            <CalendarHeart size={16} /> Things you could enjoy together
          </h4>
          <ul>
            {summary.sharedActivities.map((s) => (
              <li key={s.category}>
                <span>{s.label}</span>
                <EvidenceChips
                  ids={s.evidence.slice(0, 4)}
                  factMap={factMap}
                  names={names}
                />
                {isMatched ? (
                  <Link
                    className="text-link"
                    href={`/connections?with=${peer.id}&kind=${s.category}#discover`}
                  >
                    See real options in {peer.city || "your city"}{" "}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : (
                  <small>
                    Real places and events unlock after you both say yes.
                  </small>
                )}
              </li>
            ))}
          </ul>
          <small>
            Activity types from confirmed shared interests only. Real places and
            events are suggested from verified listings after you both say yes —
            the matchmakers never invent venues.
          </small>
        </div>
      )}
      <div className={`verdict ${summary.verdict}`}>
        <span className="eyebrow">
          {summary.source === "gemini"
            ? "GEMINI SUMMARY · EVERY ITEM CITES VERIFIED FACTS"
            : "SUMMARY ASSEMBLED FROM VERIFIED FACTS · NO AI CALL"}
        </span>
        <h3>
          {summary.verdict === "clarify-first"
            ? "One important question first."
            : "Worth an introduction."}
        </h3>
        <p>{summary.explanation.text}</p>
        <p className="next-step">
          <strong>Suggested next step:</strong>{" "}
          {isMatched
            ? `You're connected. Break the ice with ${peer.name} and compare availability for a first date.`
            : summary.verdict === "clarify-first"
              ? `Ask the open question above with consent before deciding about ${peer.name}.`
              : `If this sounds good, say you're interested. ${peer.name} only sees it if the interest is mutual.`}
        </p>
        <small>
          This is advisory, not a prediction: no chemistry scores or success
          odds. Hard requirements are checked by the matching engine, never by
          AI. You decide.
        </small>
      </div>
      <p className="fine-print private-take">
        <ShieldCheck size={13} /> Private to you. {peer.name} never sees your
        matchmaker’s take.
      </p>
    </div>
  );
}

function NextSteps({
  peer,
  recommendation,
  eligible,
  decision,
  isMatched,
  onError,
}: {
  peer: Profile;
  recommendation?: ReturnType<typeof recommend>[number];
  eligible: boolean;
  decision?: string;
  isMatched: boolean;
  onError: (message: string) => void;
}) {
  const act = (fn: () => void) => {
    try {
      fn();
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Please try again.");
    }
  };
  return (
    <div className="agent-next">
      <div className="agent-next-rec">
        <span className="eyebrow">
          <RefreshCw size={12} /> The introduction, recalculated from approved
          information
        </span>
        {eligible && recommendation ? (
          <>
            <strong>{recommendation.label}</strong>
            <ul>
              {recommendation.evidence.slice(0, 3).map((e) => (
                <li key={e}>
                  <Check size={13} /> {e}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            A confirmed requirement no longer matches, so this introduction has
            been removed. The matchmakers cannot override a dealbreaker.
          </p>
        )}
      </div>
      <div className="agent-next-bar">
        <Link href="/discover" className="button button-outline">
          <ArrowLeft size={16} /> Back to Discover
        </Link>
        {isMatched ? (
          <div className="agent-next-action">
            <span>
              <Heart size={18} /> <strong>You’re connected.</strong> Compare
              availability and find a real first date.
            </span>
            <Button asChild>
              <Link href={`/connections?with=${peer.id}#discover`}>
                <CalendarHeart size={16} /> Plan your first date
              </Link>
            </Button>
          </div>
        ) : decision === "interested" ? (
          <div className="synthetic-choice agent-next-action">
            <p>
              <Check size={14} /> Your interest is saved.
            </p>
            <span>
              SIMULATE {peer.name.toUpperCase()}’S DECISION · FICTIONAL DEMO
            </span>
            <div>
              <Button
                size="sm"
                onClick={() =>
                  act(() =>
                    dispatchDemo({
                      type: "counterpart",
                      id: peer.id,
                      decision: "interested",
                    }),
                  )
                }
              >
                {peer.name} is also interested <Heart size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  act(() =>
                    dispatchDemo({
                      type: "counterpart",
                      id: peer.id,
                      decision: "pass",
                    }),
                  )
                }
              >
                {peer.name} passes
              </Button>
            </div>
          </div>
        ) : eligible ? (
          <div className="agent-next-action">
            <span>
              The matchmakers suggest; only people decide. {peer.name} only sees
              your interest if it’s mutual.
            </span>
            <Button
              onClick={() =>
                act(() =>
                  dispatchDemo({
                    type: "decision",
                    id: peer.id,
                    decision: "interested",
                  }),
                )
              }
            >
              <Heart size={16} /> I’m interested in {peer.name}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const COACH_SUGGESTIONS = [
  "Ask about their ideal weekend.",
  "Find out whether they enjoy traveling.",
  "Explore how they approach money and dates.",
  "Do they prefer quiet evenings or social plans?",
];
/**
 * Coach Mode — "Ask your matchmaker". Suggestions are screened before they
 * reach a model, queued while a call is running (never interrupting it), and
 * asked by your own matchmaker in the next available round.
 */
function CoachPanel({
  peerName,
  draft,
  onDraft,
  onAsk,
  error,
  queue,
  left,
  running,
  askedTopics,
  turns,
}: {
  peerName: string;
  draft: string;
  onDraft: (s: string) => void;
  onAsk: (text: string) => void;
  error: string;
  queue: string[];
  left: number;
  running: boolean;
  askedTopics: Topic[];
  turns: AgentTurn[];
}) {
  const answerFor = (t: Topic) =>
    turns.find((x) => x.role === "answer" && x.topicId === t.id);
  return (
    <section className="coach-panel" aria-labelledby="coach-title">
      <div className="coach-head">
        <span className="ag-panel-icon">
          <MessageCircleQuestion size={18} />
        </span>
        <div>
          <h3 id="coach-title">Ask your matchmaker</h3>
          <p>
            Suggest something for your Piper to ask {peerName}’s matchmaker.
            It’s asked in the next available turn and answered only from what{" "}
            {peerName} approved for sharing.
          </p>
        </div>
        <span className="coach-left" aria-live="polite">
          {left} of {MAX_COACH_QUESTIONS} left
        </span>
      </div>
      <form
        className="coach-form"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(draft);
        }}
      >
        <label className="sr-only" htmlFor="coach-input">
          Your question for the matchmaker
        </label>
        <input
          id="coach-input"
          value={draft}
          maxLength={200}
          placeholder={`e.g. Ask about ${peerName}’s ideal weekend`}
          onChange={(e) => onDraft(e.target.value)}
          disabled={left <= 0}
        />
        <Button type="submit" size="sm" disabled={left <= 0 || !draft.trim()}>
          {running ? "Queue it" : "Ask"}
        </Button>
      </form>
      <div
        className="coach-chips"
        role="group"
        aria-label="Suggested questions"
      >
        {COACH_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={left <= 0}
            onClick={() => onAsk(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {(queue.length > 0 || askedTopics.length > 0) && (
        <ul className="coach-list">
          {askedTopics.map((t) => {
            const a = answerFor(t);
            return (
              <li key={t.id}>
                <span>“{t.coach}”</span>
                <small className={a?.status === "unknown" ? "unknown" : ""}>
                  {!a
                    ? "Asking now…"
                    : a.status === "confirmed"
                      ? "Answered from approved facts"
                      : "Unknown · not shared yet"}
                </small>
              </li>
            );
          })}
          {queue.map((q, i) => (
            <li key={`q-${i}`}>
              <span>“{q}”</span>
              <small>Queued for the next turn</small>
            </li>
          ))}
        </ul>
      )}
      <small className="fine-print">
        Coach Mode can’t reveal private details, change anyone’s profile, or
        make someone answer. Sensitive topics (income, health, beliefs, contact
        details) are never asked. Plus will include more Coach Mode questions
        (coming soon).
      </small>
    </section>
  );
}
