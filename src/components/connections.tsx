"use client";
import Link from "next/link";
import { useState } from "react";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Flag,
  Heart,
  ArrowRight,
  CalendarHeart,
} from "lucide-react";
import { AppShell, NoProfile } from "./app-shell";
import { Portrait } from "./portrait";
import { Button } from "./ui/button";
import { SafetyModal } from "./discover";
import { DatePlanner } from "./date-planner";
import { Icebreakers } from "./icebreakers";
import { dispatchDemo, matched, useDemo } from "@/lib/demo-store";
import { formatWindow, proposalStatusLabel } from "@/lib/planning";
export function Connections({
  initialId,
  initialKind,
}: {
  initialId?: string;
  /** Activity group chosen from the matchmakers' shared activities. */
  initialKind?: string;
}) {
  const state = useDemo(),
    [selected, setSelected] = useState(initialId || ""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [report, setReport] = useState(false);
  if (!state.profile)
    return (
      <AppShell>
        <NoProfile />
      </AppShell>
    );
  const peers = state.candidates.filter((c) => matched(state, c.id)),
    peer = peers.find((c) => c.id === selected) ?? peers[0];
  function send(synthetic = false) {
    if (!peer) return;
    try {
      dispatchDemo({
        type: "message",
        id: peer.id,
        text: synthetic
          ? "This is a scripted demo reply: a walk and a conversation sounds like a lovely way to begin."
          : text,
        synthetic,
      });
      setText("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not be sent.");
    }
  }
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE REST IS BEAUTIFULLY HUMAN.</span>
          <h1>
            A conversation <em>begins.</em>
          </h1>
          <p>A little mutual curiosity can go a long way.</p>
        </div>
        <span className="badge sage">
          <Heart size={13} />
          {peers.length} mutual connection{peers.length === 1 ? "" : "s"}
        </span>
      </div>
      {!peers.length ? (
        <div className="empty-state">
          <MessageCircle size={38} />
          <h2>Make a little room for hello.</h2>
          <p>
            Connections appear when both people express interest. In the demo,
            you can explicitly simulate the other person’s decision.
          </p>
          <Button asChild>
            <Link href="/discover">
              Explore your introductions <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="messaging-layout">
          <aside className="connection-list">
            <h2>Your connections</h2>
            {peers.map((p) => (
              <button
                key={p.id}
                className={peer.id === p.id ? "active" : ""}
                onClick={() => {
                  setSelected(p.id);
                  setText("");
                  setError("");
                }}
              >
                <div className="avatar-portrait">
                  <Portrait id={p.id} gender={p.gender} age={p.age} />
                </div>
                <span>
                  <strong>{p.name}</strong>
                  <small>Fictional mutual connection</small>
                </span>
                <span className="status-dot" />
              </button>
            ))}
          </aside>
          <section className="message-thread">
            <header>
              <div className="avatar-portrait">
                <Portrait id={peer.id} gender={peer.gender} age={peer.age} />
              </div>
              <div>
                <h2>{peer.name}</h2>
                <span>Fictional person · simulated mutual interest</span>
              </div>
              <a href="#plan" className="plan-link">
                <CalendarHeart size={15} /> Plan a date
              </a>
              <button
                className="icon-button"
                aria-label={`Block or report ${peer.name}`}
                onClick={() => setReport(true)}
              >
                <Flag size={17} />
              </button>
            </header>
            <div className="message-history" aria-live="polite">
              <div className="connection-moment">
                <Heart size={23} />
                <strong>You both said, “I’m curious.”</strong>
                <p>
                  This connection was created through an explicitly simulated
                  decision.
                </p>
              </div>
              {state.proposals
                .filter(
                  (p) =>
                    p.peerId === peer.id &&
                    (p.status === "proposed" || p.status === "accepted"),
                )
                .map((p) => (
                  <div className="proposal-moment" key={p.id}>
                    <CalendarHeart size={16} />
                    <div>
                      <strong>{p.activity.title}</strong>
                      <span>
                        {formatWindow(
                          p,
                          state.planning.guest?.availability?.timeZone ??
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                        )}
                      </span>
                      <small>{proposalStatusLabel(p)}</small>
                    </div>
                  </div>
                ))}
              {state.messages
                .filter((m) => m.peerId === peer.id)
                .map((m) => (
                  <div
                    key={m.id}
                    className={`chat-message ${m.sender === "you" ? "sent" : "received"}`}
                  >
                    <span>
                      {m.sender === "you" ? "YOU" : "SYNTHETIC DEMO REPLY"}
                    </span>
                    <p>{m.text}</p>
                    <time>
                      {new Date(m.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
            </div>
            <Icebreakers
              key={peer.id}
              profile={state.profile}
              peer={peer}
              onUse={(t) => {
                setText(t);
                document.getElementById("composer-input")?.focus();
              }}
            />
            <div className="message-composer">
              <div className="demo-reply-bar">
                <span>
                  <Sparkles size={14} />
                  No real person is receiving these messages.
                </span>
                <button onClick={() => send(true)}>Simulate a reply</button>
              </div>
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  id="composer-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  aria-label={`Message to ${peer.name}`}
                  placeholder="Start with a little hello…"
                />
                <Button
                  size="icon"
                  type="submit"
                  disabled={!text.trim()}
                  aria-label="Send demo message"
                >
                  <Send size={18} />
                </Button>
              </form>
              <p>
                <ShieldCheck size={12} />
                Saved only in this browser. No AI sends messages for you.
              </p>
            </div>
          </section>
        </div>
      )}
      {peer && state.profile && (
        <DatePlanner
          initialKind={initialKind}
          key={peer.id}
          state={state}
          profile={state.profile}
          peer={peer}
        />
      )}
      {report && peer && (
        <SafetyModal
          name={peer.name}
          onClose={() => setReport(false)}
          onSubmit={(reason) => {
            dispatchDemo({ type: "block", id: peer.id, report: reason });
            setReport(false);
          }}
        />
      )}
    </AppShell>
  );
}
