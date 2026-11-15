import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarHeart,
  Check,
  Heart,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Brand, PiperMark } from "@/components/brand";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: MessageCircle,
    title: "Talk to Piper",
    text: "Speak or type a natural conversation about your life, values and what you’re looking for. You review every detail before it’s used.",
  },
  {
    icon: MessagesSquare,
    title: "Let the AIs compare notes",
    text: "Your matchmaker and theirs ask a few focused questions using only approved facts, then show what’s shared, different and still unknown.",
  },
  {
    icon: CalendarHeart,
    title: "Make it real",
    text: "When you both say yes, Piper suggests openers, compares general availability and finds real cafés, parks, venues and museums in your city.",
  },
];

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#the-difference">The Piper difference</a>
          <a href="#safety">Safety & privacy</a>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <Button asChild size="sm">
          <Link href="/onboarding">
            Try the live AI demo <ArrowUpRight size={15} />
          </Link>
        </Button>
      </header>
      <main id="main">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-star" aria-hidden="true">
                ✳
              </span>
              Intentional dating for US singles
            </span>
            <h1>
              Stop swiping.
              <br />
              <span>
                Start <em>something real.</em>
              </span>
            </h1>
            <p className="lp-lede">
              Pied Piper uses AI to get to know you, understand what you’re
              looking for, and introduce you to people you’re genuinely
              compatible with.
            </p>
            <p className="lp-promise">
              <strong>Your AI finds the people.</strong> You build the
              relationship.
            </p>
            <p className="lp-hook">
              Your AI meets their AI. You decide if there’s a spark.
            </p>
            <div className="lp-actions">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Try the live AI demo <ArrowUpRight size={18} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/onboarding?demo=1">
                  Watch the scripted demo <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
            <div className="lp-proof">
              <span className="avatar-stack" aria-hidden="true">
                {[
                  "fictional-new-york-city-003",
                  "fictional-chicago-010",
                  "maya",
                ].map(
                  (id) => (
                    <span key={id}>
                      <Portrait id={id} />
                    </span>
                  ),
                )}
              </span>
              <span>
                No sign-up. Live AI with 180 fictional adults in New York City,
                San Francisco, Chicago and Austin. 18+.
              </span>
            </div>
          </div>
          <div
            className="lp-art"
            role="img"
            aria-label="Illustration: two fictional demo profiles, Jamie and Lena, introduced by Piper"
          >
            <div className="lp-orbit" aria-hidden="true" />
            <span className="lp-spark lp-spark-a" aria-hidden="true">
              ✦
            </span>
            <span className="lp-spark lp-spark-b" aria-hidden="true">
              ✳
            </span>
            <figure className="lp-profile lp-profile-a">
              <Portrait id="jamie" gender="man" age={32} />
              <figcaption>
                <strong>Jamie, 32</strong>
                <span>Hiking, good coffee, long conversations.</span>
              </figcaption>
            </figure>
            <figure className="lp-profile lp-profile-b">
              <Portrait id="lena" gender="woman" age={30} />
              <figcaption>
                <strong>
                  Lena, 30{" "}
                  <span className="lp-check">
                    <Check size={11} />
                  </span>
                </strong>
                <span>Curious, kind, and up for adventure.</span>
              </figcaption>
            </figure>
            <div className="lp-pill">
              <span className="status-dot" /> Introduced by Piper
            </div>
            <div className="lp-insight">
              <PiperMark />
              <div>
                <span>YOUR AI MATCHMAKER</span>
                <p>
                  Both love hiking and live music, and both want something
                  long-term. Worth an introduction.
                </p>
              </div>
              <Heart size={18} />
            </div>
            <span className="lp-art-label">
              Fictional demo profiles · illustrated
            </span>
          </div>
        </section>

        <section id="how-it-works" className="lp-how">
          <div className="lp-rule">
            <span>How it works</span>
          </div>
          <ol className="lp-steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="lp-step-icon">
                  <s.icon size={26} />
                </span>
                <div>
                  <h3>
                    {i + 1}. {s.title}
                  </h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="the-difference" className="lp-difference">
          <div className="lp-difference-intro">
            <span className="eyebrow">The Pied Piper difference</span>
            <h2>
              Thoughtful dating,
              <br />
              with a little <em>AI magic.</em>
            </h2>
          </div>
          <div className="lp-features">
            <article>
              <UsersRound size={28} />
              <h3>AI matchmakers</h3>
              <p>
                A personal matchmaker that learns what matters to you and
                introduces a small, considered set of people, never an endless
                feed.
              </p>
            </article>
            <article>
              <Sparkles size={28} />
              <h3>Evidence, not guesses</h3>
              <p>
                Every recommendation shows confirmed common ground, possible
                differences and what’s still unknown. No compatibility scores.
              </p>
            </article>
            <article>
              <CalendarHeart size={28} />
              <h3>Real date ideas</h3>
              <p>
                Real cafés, parks, music venues and museums from OpenStreetMap
                in NYC, San Francisco, Chicago and Austin, matched to when you’re
                both free. Nothing invented, nothing booked for you.
              </p>
            </article>
          </div>
        </section>

        <section className="lp-showcase" aria-labelledby="showcase-title">
          <div className="lp-showcase-copy">
            <span className="eyebrow">Curiosity, with consent</span>
            <h2 id="showcase-title">
              Good introductions ask better <em>questions.</em>
            </h2>
            <p>
              Shared interests are a beginning. Piper notices the gaps that
              matter, asks permission to explore them, and explains what
              changes. Firm requirements are always checked by the matching
              engine, never by AI.
            </p>
            <Button asChild variant="secondary">
              <Link href="/onboarding?demo=1">
                See an introduction unfold <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
          <div
            className="lp-chat"
            aria-label="Illustrative matchmaker exchange with fictional people"
          >
            <div className="lp-chat-msg side-a">
              <span>Jamie’s AI</span>
              <p>
                Both enjoy hiking and live music, and both want a long-term
                relationship. Has Lena shared her family plans?
              </p>
            </div>
            <div className="lp-chat-msg side-b">
              <span>Lena’s AI</span>
              <p>Not yet. That stays unknown until Lena chooses to share it.</p>
            </div>
            <div className="lp-chat-note">
              <ShieldCheck size={16} /> Asked with permission. Shared only with
              consent. Illustrative scenario.
            </div>
          </div>
        </section>

        <section id="safety" className="lp-safety">
          <ShieldCheck size={30} />
          <h2>
            More connection. <em>On your terms.</em>
          </h2>
          <ul>
            <li>
              <Check size={16} /> Review every detail before it’s shared
            </li>
            <li>
              <Check size={16} /> Your interview stays private
            </li>
            <li>
              <Check size={16} /> Skip any optional question
            </li>
            <li>
              <Check size={16} /> Edit, pause, block or delete at any time
            </li>
          </ul>
          <Link className="text-link" href="/privacy">
            Our approach to privacy <ArrowUpRight size={15} />
          </Link>
        </section>

        <section className="lp-cta">
          <h2>
            Ready to meet someone who gets <em>you?</em>
          </h2>
          <p>Let Piper introduce you to people who truly fit.</p>
          <div className="lp-actions">
            <Button asChild size="lg">
              <Link href="/onboarding">
                Try the live AI demo <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See Free & Plus</Link>
            </Button>
          </div>
          <small>
            Use fictional details. No email, password or card required. Adults
            18+ in the US.
          </small>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Thoughtful technology. Human connection.</span>
        <div>
          <Link href="/privacy">Privacy & safety</Link>
          <Link href="/about-matching">How matching works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/account">Your account</Link>
          <a
            href="https://github.com/sula217/PiedPiper-Lovable"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={12} />
          </a>
        </div>
        <small>
          © {new Date().getFullYear()} Pied Piper. Hackathon edition.
        </small>
      </footer>
    </div>
  );
}
