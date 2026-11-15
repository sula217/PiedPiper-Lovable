"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  CircleUserRound,
  MessageCircle,
  MessagesSquare,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Brand, PiperMark } from "./brand";
import { Portrait } from "./portrait";
import { useDemo, getStorageError, matched } from "@/lib/demo-store";
import { Button } from "./ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    state = useDemo();
  const connections = state.candidates.filter(
    (c) => !state.profile?.blockedIds.includes(c.id) && matched(state, c.id),
  ).length;
  // The most recent saved matchmaker conversation (real state, not decoration).
  const latest = Object.values(state.agentSessions)
    .filter((s) => !state.profile?.blockedIds.includes(s.peerId))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  const latestPeer =
    latest && state.candidates.find((c) => c.id === latest.peerId);
  const nav = [
    {
      href: "/matchmaker",
      label: "My AI Matchmaker",
      hint: "Your personal dating AI",
      short: "Matchmaker",
      icon: Bot,
    },
    {
      href: "/discover",
      label: "Discover",
      hint: "Curated people for you",
      short: "Discover",
      icon: Search,
    },
    {
      href: "/agents",
      label: "Agent Conversations",
      hint: "Let our AIs get to know each other",
      short: "Agents",
      icon: MessagesSquare,
    },
    {
      href: "/connections",
      label: "Connections",
      hint: "Matches, messages and date plans",
      short: "Connect",
      icon: MessageCircle,
      count: connections,
    },
    {
      href: "/profile",
      label: "My Profile",
      hint: "Your story, preferences and goals",
      short: "Profile",
      icon: CircleUserRound,
    },
  ];
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Brand />
        <nav aria-label="Your space">
          {nav.map((n) => (
            <Link
              href={n.href}
              key={n.href}
              className={path === n.href ? "active" : ""}
              aria-current={path === n.href ? "page" : undefined}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {!!n.count && (
                <span
                  className="nav-count"
                  aria-label={`${n.count} mutual connection${n.count === 1 ? "" : "s"}`}
                >
                  {n.count}
                </span>
              )}
              <small>{n.hint}</small>
            </Link>
          ))}
        </nav>
        {latest && latestPeer && state.profile && (
          <Link
            href={`/agents?with=${latestPeer.id}`}
            className="sidebar-active"
          >
            <span className="eyebrow">Latest investigation</span>
            <span className="sidebar-active-body">
              <span className="avatar-stack" aria-hidden="true">
                <span>{state.profile.name.slice(0, 1) || "Y"}</span>
                <span>
                  <Portrait
                    id={latestPeer.id}
                    gender={latestPeer.gender}
                    age={latestPeer.age}
                  />
                </span>
              </span>
              <span>
                <strong>
                  {state.profile.name} & {latestPeer.name}
                </strong>
                <small>
                  {latest.source === "gemini" ? "Live Gemini" : "Scripted demo"}{" "}
                  · {latest.status === "partial" ? "partial" : "complete"}
                </small>
              </span>
            </span>
          </Link>
        )}
        <p className="sidebar-tagline">
          <span aria-hidden="true">✳</span>A more human way to date.
        </p>
        <div className="sidebar-bottom">
          <Link href="/privacy">
            <ShieldCheck size={17} />
            Privacy & safety
          </Link>
          <Link href="/pricing">
            <ArrowUpRight size={17} />
            Free & Plus pricing
          </Link>
          <div className="sidebar-user">
            <div className="avatar-initial">
              {state.profile?.name.slice(0, 1) || "J"}
            </div>
            <div>
              <strong>{state.profile?.name || "Your space"}</strong>
              <span>
                {state.profile && state.profile.readyToConnect === false
                  ? "Paused · fictional demo"
                  : "Fictional demo profile"}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <span>
            <span className="status-dot" /> Interactive demo · fictional people
          </span>
          <span className="badge demo-badge">INTERACTIVE DEMO</span>
          <Link href="/account" className="text-link">
            Real accounts <ArrowUpRight size={14} />
          </Link>
        </header>
        <div className="mobile-brand">
          <Brand />
        </div>
        <main id="main" className="app-main">
          {getStorageError() && (
            <div className="notice error-notice">{getStorageError()}</div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <ShieldCheck size={13} />
          Fictional people. Illustrated portraits. Your demo data stays in this
          browser.
        </footer>
      </div>
      <nav className="mobile-app-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <Link
            href={n.href}
            key={n.href}
            className={path === n.href ? "active" : ""}
            aria-current={path === n.href ? "page" : undefined}
          >
            <n.icon size={20} />
            {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function NoProfile() {
  return (
    <div className="empty-state">
      <PiperMark />
      <h2>Let’s start with a hello.</h2>
      <p>
        A short conversation helps us introduce people who make sense for you.
      </p>
      <Button asChild>
        <Link href="/onboarding?demo=1">
          Meet your matchmaker <ArrowUpRight size={17} />
        </Link>
      </Button>
    </div>
  );
}
