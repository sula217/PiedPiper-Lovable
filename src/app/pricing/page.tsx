import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { MAX_COACH_QUESTIONS } from "@/lib/agents";

export const metadata: Metadata = {
  title: "Pricing · Pied Piper",
  description:
    "Pied Piper Free and the proposed Pied Piper Plus ($19/month, coming soon).",
};

const free = [
  "Conversational onboarding with Piper (voice or text)",
  "Basic reciprocal matchmaking",
  "Three curated introductions per week",
  "Standard, evidence-based compatibility explanations",
  `AI agent conversations with ${MAX_COACH_QUESTIONS} Coach Mode questions per introduction`,
  "Mutual matching and messaging",
  "Basic date suggestions",
];
const plus = [
  "More curated introductions each week",
  "Additional AI agent investigations",
  "More Coach Mode questions per introduction",
  "Deeper compatibility insights, including Money & Lifestyle",
  "Personalized conversation assistance",
  "Enhanced date planning",
];
const everyone = [
  "Blocking, reporting and account deletion",
  "Consent before any detail is shared",
  "Hard requirements enforced by the matching engine, never by AI",
  "No exact salary, bank or credit data — ever",
];
const faqs = [
  {
    q: "Is Plus available now?",
    a: "Not yet. Plus is a proposed plan for after the hackathon, so there is no checkout and nothing can be charged. Everything you can try today is free.",
  },
  {
    q: "Why would anyone pay for a dating app that shows fewer people?",
    a: "Because the scarce thing is not profiles, it's good conversations. Plus spends more AI effort per introduction (more investigations, more Coach Mode questions, deeper explanations) instead of more swipes.",
  },
  {
    q: "Is AI usage unlimited on Plus?",
    a: "No. Every AI conversation is bounded so the service stays sustainable and fast. Plus raises the limits; it does not remove them.",
  },
  {
    q: "Do safety and privacy features cost extra?",
    a: "Never. Blocking, reporting, consent controls and deletion are available to everyone on every plan.",
  },
  {
    q: "Do you use my finances to match me?",
    a: "Only broad Money & Lifestyle preferences you choose to share, such as budget-friendly first dates or saving vs. spending. We never ask for salary, balances, debt or credit, and never infer them.",
  },
];

export default function Page() {
  return (
    <>
      <header className="flow-nav">
        <Brand />
        <Link className="text-link" href="/">
          Back home
        </Link>
      </header>
      <main id="main" className="reading-page pricing-page">
        <span className="eyebrow">PRICING · PROPOSED MODEL</span>
        <h1>
          Fewer, better <em>introductions.</em>
        </h1>
        <p>
          Pied Piper is free to start. The proposed Plus plan adds more AI
          effort per introduction for people who want to move faster. Prices are
          in US dollars.
        </p>
        <div className="pricing-grid">
          <section className="plan-card" aria-labelledby="free-title">
            <h2 id="free-title">Free</h2>
            <p className="plan-price">
              <strong>$0</strong> <span>forever</span>
            </p>
            <ul>
              {free.map((f) => (
                <li key={f}>
                  <Check size={15} /> {f}
                </li>
              ))}
            </ul>
            <Button asChild>
              <Link href="/onboarding">
                Try the live AI demo <ArrowUpRight size={16} />
              </Link>
            </Button>
          </section>
          <section className="plan-card plus" aria-labelledby="plus-title">
            <span className="plan-badge">Coming soon</span>
            <h2 id="plus-title">Pied Piper Plus</h2>
            <p className="plan-price">
              <strong>$19</strong> <span>/ month · proposed</span>
            </p>
            <p className="plan-note">Everything in Free, plus:</p>
            <ul>
              {plus.map((f) => (
                <li key={f}>
                  <Check size={15} /> {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" disabled aria-disabled="true">
              Coming soon · no checkout yet
            </Button>
          </section>
        </div>
        <section className="plan-everyone" aria-labelledby="everyone-title">
          <h2 id="everyone-title">
            <ShieldCheck size={20} /> Included for everyone
          </h2>
          <ul>
            {everyone.map((f) => (
              <li key={f}>
                <Check size={15} /> {f}
              </li>
            ))}
          </ul>
        </section>
        <h2>Questions</h2>
        <dl className="pricing-faq">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="fine-print">
          Proposed pricing for a hackathon project. There are no paying
          customers, revenue or conversion figures yet.
        </p>
      </main>
    </>
  );
}
