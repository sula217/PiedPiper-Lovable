# Pied Piper

**Your AI finds the people. You build the relationship.**

A conversation-first dating application for intentional adults, designed around a complete, account-free hackathon demonstration. Piper asks what matters, drafts a profile for human approval, and introduces a small set of fictional people through reciprocal filtering and explainable ranking. When important information is missing, a consent-based question can change the introduction.

**Phase 2** turns recommendations into a complete AI matchmaking journey:

> AI onboarding → reciprocal matching → **agent-to-agent investigation** → human approval → **shared availability** → **first-date planning**

Each person has a personal AI matchmaker. For a promising, already-eligible introduction, the two matchmakers hold a short, bounded, sequential Gemini conversation using only approved profile facts, verify every factual claim against those facts, and surface what is confirmed, what differs, and what is still unknown. After a mutual yes, the matchmakers compare consented general availability and suggest first-date activity types. People make every decision.

**Phase 2.2** makes it reliable and real-world:

> AI finds compatible people, investigates shared interests, and helps them choose **real places and events** for meaningful dates.

- **Gemini reliability:** `gemini-3.5-flash-lite` (verified for this project) is the preferred model; every failure is classified (auth, 404, short rate limit, daily quota, 5xx, 504, network), retried with bounded backoff only when that can help, cooled down server-side, and shown honestly as _Live Gemini_, _Scripted demonstration_ or _Temporarily unavailable_. A live investigation now costs about **3 requests** instead of up to 9.
- **Discover Your First Date:** verified cafés, restaurants, parks, museums (OpenStreetMap) and upcoming concerts/events (manually verified Ticketon listings) in **Astana** (default) and **Almaty**, ranked deterministically by shared interests, preferences, budget and mutual availability, with "Suggest this date" proposals that stay pending until both accept.
- **Let Piper Understand Your Interests:** paste your own bio, captions, music and hobbies (and, where the operator enables it, your own photos) for pending, approve-each suggestions; an optional, unverified, private-by-default Instagram username with no scraping.
- **Shared activities from the agents** lead straight to verified options, only after both people say yes.

This is a working hackathon application, not a scientifically validated compatibility predictor or a launch-ready public dating service.

## US hackathon edition (current)

**Tell Piper about yourself. Your AI meets their AI. Watch them discover the connection. You decide whether to meet.**

The public experience now targets adults (18+) in the **United States**. Proposed initial segment: urban singles about 24–39 who want intentional relationships (a hypothesis, not validated traction).

- **Cities:** New York City (default), San Francisco, Chicago, Austin. US time zones, USD. Kazakhstan data from the earlier edition is kept only as legacy records and is not offered in the public UI.
- **180 fictional adults:** 18 hand-written characters (stable IDs, now in US cities) + 162 generated (`npm run demo:generate`, seeded, no AI calls): NYC 54, SF 36, Chicago 36, Austin 36. Some are incomplete, paused, or intentionally incompatible. Old browser state is migrated (retired fixture IDs dropped; consented answers, decisions and messages kept).
- **Try the live AI demo:** no sign-up. `/onboarding` sends the guest's fictional answers to Gemini through the server (`/api/ai/onboard`). Piper opens with one question and asks one primary question at a time (`PIPER_INSTRUCTION` in `src/lib/onboarding.ts`).
- **Agent conversations, one message at a time:** `/api/ai/agents` streams NDJSON. Each message is a separate Gemini call with its own agent context; Agent B receives Agent A's actual verified message; each turn is validated and streamed as soon as it is ready (`no-transform`, `X-Accel-Buffering: no`). The UI shows "Agent A/B is thinking…", auto-scrolls, keeps completed turns on failure and names the agent that failed. Labels: **LIVE AI**, **SCRIPTED DEMO**, or unavailable.
- **Coach Mode — "Ask your matchmaker":** suggest a question during an investigation. It is screened (relevance + safety) on client and server, queued while a call is running, and asked by your own matchmaker in the next round without restarting the conversation. Free: 2 per introduction. Unanswerable topics are marked unknown.
- **Your matchmaker's take:** private, evidence-backed recap (common ground, differences, unknowns, suggested next step). No chemistry scores.
- **Money & Lifestyle (optional):** broad styles only (first-date budget, saving vs. spending, planned vs. spontaneous purchases, travel budget, financial priority, comfort talking about money). Never salary, debt, credit or bank data; never inferred. Used only with explicit consent, as explanations and agent facts; ranking scores and eligibility are unchanged.
- **Break the ice with Piper:** after mutual interest, three openers (casual, playful, thoughtful): grounded templates by default, optionally personalized by one verified Gemini call (`/api/ai/starters`). The person edits and sends; AI never sends.
- **Date places:** 66 real OpenStreetMap records (retrieved 2026-11-15 via Overpass; `scripts/build-us-places.mjs`). Only OSM tags are stored (name, address, coordinates, website). No ratings, prices or hours; parks are "free to enter". There are **no dated US events** because no permitted live event source is configured, so concert venues are suggested instead.
- **Voice:** browser SpeechRecognition (en-US) for input; browser speechSynthesis for optional spoken replies, now choosing the most natural available en-US voice, with a voice picker, speed control and "Piper is speaking" state. Gemini TTS / Live API are not used (not configured or budgeted).
- **Pricing (`/pricing`):** Free ($0) and the proposed **Pied Piper Plus ($19/month, coming soon)**. No checkout exists.

## Quick start

Use Node.js 24 and npm. The package name is `pied-piper`, regardless of the checkout folder name.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3000**. `npm.cmd` avoids Windows PowerShell execution-policy restrictions on `npm.ps1`. On macOS/Linux, use `npm` normally.

The existing `.env.local` was preserved unchanged. For a **new clone only**, create `.env.local` from `.env.example` and fill in your own settings. Never overwrite a configured environment file or commit credentials.

```bash
npm run build
npm start
```

## What is implemented

| Capability                         | Actual behavior                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page                       | Editorial hero (“Stop swiping. Start something real.”), overlapping fictional profile cards with an AI-matchmaker insight, three-step explanation, differentiation section, safety section and final CTA; honest fictional-demo framing      |
| Gemini interview                   | Server-side conversation, adaptive follow-ups, structured extraction, Zod validation, manual review                                                                                                                                          |
| Guest demonstration                | No sign-in or Supabase required; 180 fictional adult profiles; local browser storage                                                                                                                                                         |
| Profile                            | Editable biography, essentials, interests, values, lifestyle, age/gender/location preferences, hard dealbreakers                                                                                                                             |
| Introductions                      | Reciprocal eligibility, deterministic weighted ranking, supported evidence, differences, unknowns                                                                                                                                            |
| Investigation                      | Four supported dimensions, relevant unknowns only, opt-in question wording, explicit answer-sharing consent, decline tracking, recalculation                                                                                                 |
| Mutual interest                    | No connection until both decisions are interested; guest counterpart decisions are explicitly simulated                                                                                                                                      |
| Messages                           | Local persistent demo messages; synthetic replies only when explicitly requested and clearly labeled                                                                                                                                         |
| Feedback                           | Passed introductions record feedback; an explicit opt-in increases the interest weight from 20 to 30                                                                                                                                         |
| Safety                             | Adult self-attestation, profile approval, local deletion, blocking, reporting, privacy disclosures                                                                                                                                           |
| Real account path                  | Supabase registration/login/logout, approved profiles, real decisions, questions, matches, human messages, blocks, reports, deletion APIs and RLS migration                                                                                  |
| Deployment                         | Next.js production build, Vercel configuration, CI workflow                                                                                                                                                                                  |
| **AI Matchmakers** (P0)            | Two Gemini agents with separate contexts, 2 sequential Q&A rounds (a 3rd only for a relevant open question), ID-verified evidence, rule-based "unknown" answers without a model call, deterministic summary, reuse of recent results         |
| **Gemini reliability** (2.2)       | Configurable preferred + fallback model, per-category error handling, bounded exponential backoff honoring retry delays, server-side cooldowns, no retry storms, `/diagnostics` page                                                         |
| **Mutual availability** (P0)       | Weekly editor, IANA time zones, deterministic UTC-interval overlap, explicit sharing consent, editable/clearable, never inferred                                                                                                             |
| **Discover Your First Date** (2.2) | Real places (OpenStreetMap) and upcoming events (manually verified Ticketon pages) for Astana/Almaty; city, category, budget, time, indoor/outdoor and shared-interest filters; deterministic ranking; optional verified Gemini explanations |
| **First-date planning** (P0)       | After mutual interest only: activity-type ideas plus real venue/event proposals that are not confirmed until both accept; nothing is booked or purchased                                                                                     |
| **Profile enrichment** (P1)        | "Let Piper Understand Your Interests": your own text (and, if enabled, your own photos) → pending suggestions; confirmed / suggested / unknown / private labels; delete everything you pasted                                                |
| **Instagram** (2.2, P1)            | Optional username: syntax check only, private by default, visibility toggle, removable; never fetched, scraped or sent to agents                                                                                                             |
| **Ready to Connect** (P1)          | Pause/resume new introductions in both directions; existing matches and messages preserved; enforced in JS and SQL                                                                                                                           |

**Configuration limits:** Supabase and Vercel credentials were not present. The real-account code and SQL authorization were tested locally, but hosted Supabase sign-up/email/persistence were not verified. No Vercel deployment URL has been created or verified. Real profiles are entered manually; the guest UI does not send real dating interviews to Gemini.

## Phase 2 judge walkthrough (about five minutes)

Everything below works without signing in and without Supabase. Every simulated counterpart action is labeled as fictional.

1. Open `/onboarding?demo=1` (or **Try interactive demo**). Confirm you are an adult.
2. **Jamie talks to Gemini**: consent to sending fictional details and use the sample-message buttons, or choose **Explore the predefined demonstration** (scripted, labeled, no AI).
3. **Gemini creates Jamie's profile**; choose **Review my profile**.
4. **Jamie reviews and approves** the profile (edit anything, then approve).
5. **The reciprocal engine recommends Lena** on **Discover**.
6. On Lena's card choose **Let our AIs talk**.
7. Tick the Gemini consent and choose **Let our AIs talk** to watch two live Gemini matchmakers, or **Play the scripted demonstration** (template-based, clearly labeled, no AI). Both run the same orchestration and verification code. The agents find common ground (hiking, music, coffee, art; kindness, curiosity, family; long-term), **things you could enjoy together** (Parks & Outdoors, Concerts & Events, Food & Coffee, Culture & Activities), and an **important unknown**: Lena has not shared family plans, a firm requirement for Jamie. That question is answered _by rule_ ("not shared yet") without asking the AI to guess.
8. In **Still unknown**, choose **Ask Lena with consent**. This is the existing Phase 1 consent workflow: choose a fictional answer and explicitly simulate Lena's approval (or decline).
9. **The recommendation updates** from approved information only ("Resolved with consent"; the introduction is recalculated; a conflicting answer removes it, which no AI can override).
10. Choose **I'm interested in Lena**.
11. Choose **Lena is also interested** (explicitly simulated).
12. **A mutual connection is created**; choose **Plan your first date**.
13. In **When could you meet?** choose **Add my general availability → Use Jamie's fictional sample**, tick **Share my general availability with mutual connections**, and save. Overlapping windows appear (Lena's sharing consent is part of the fictional data).
14. In **Discover your first date** (Astana is the default city) choose **Concerts & Events**. Verified upcoming events that fit both people's availability appear — for example _«The Music of Hans Zimmer»_ at QAZAQCONCERT, Sunday 19:00 — with venue, time, listed price, why it suits you both, the data source and the official **Ticketon page** / **Open location** links. Optionally tick the consent and **Explain with Gemini** (one verified call), or **Explore alternatives**.
15. Choose **Suggest this date**. The proposal shows _Proposed · not confirmed until both accept_ until you simulate **Lena accepts** (labeled simulated). Nothing is booked or purchased; tickets are bought by the people themselves on Ticketon. The older **First-date ideas** card (activity types; Gemini or labeled templates) still works too.

Also try switching the city to **Almaty**, the **Parks & Outdoors** and **Food & Coffee** tiles, **My AI Matchmaker** (journey tracker, Ready-to-Connect pause, availability editor, "Let Piper Understand Your Interests" with **Use Jamie's fictional sample**), the **Instagram** card on **My Profile**, **/diagnostics**, other introductions (Maya has no overlap; Sophie has not shared; Jules has not entered availability; Nora is not open to meeting soon), and **Stop sharing my availability** (open proposals are withdrawn).

### Phase 1 walkthrough (still supported)

1. Open `/` and choose **Try interactive demo**.
2. Confirm the adults-only gate. To use Gemini, also consent to sending **fictional** interview details, then choose **Start talking to Piper**. Use the sample message buttons or type invented details.
3. For a reliable offline presentation, explicitly choose **Explore the predefined demonstration**. Send the two fictional sample messages. Scripted responses are always labeled; this path makes no Gemini onboarding calls.
4. Choose **Review my profile**. Inspect and edit Jamie’s details and requirements. Check the approval box and continue.
5. In **For you**, open Lena’s **A question worth asking**. Family plans are unknown and important to Jamie. You can ask Gemini to phrase the question, or use the labeled standard question.
6. Select a fictional answer. Sharing stays disabled until you explicitly simulate Lena’s consent. “Wants children” resolves the unknown and raises the ranking; “Does not want children” reveals a hard conflict and removes the introduction. Declining preserves the unknown and prevents a repeated question for that pair.
7. Click **I’m interested**, then explicitly simulate **Also interested**. A mutual connection opens.
8. Send a demo message. **Simulate a reply** inserts a clearly labeled scripted response. Refresh to verify browser persistence.
9. Explore profile edits, pass feedback, blocking, and **Delete demo data**. No real person is contacted.

Guest storage is isolated under `pied-piper:fictional-demo:v2`. Saved Phase 1 (`v1`) data is migrated automatically on first load: progress is kept, Phase 2 fields are added, and the legacy key is removed only after the migrated state is written. Interview transcripts are kept in component memory only, not local storage or the database. Demo data is never uploaded to real account tables.

## Environment configuration

| Variable                               | Required                | Purpose                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                       | For live AI             | Server-only Google API credential                                                                                                                                                                                                             |
| `GEMINI_MODEL`                         | For live AI             | Preferred model for all Gemini calls; recommended `gemini-3.5-flash-lite`                                                                                                                                                                     |
| `GEMINI_FALLBACK_MODEL`                | Optional                | Tried only for model-specific failures (404, 5xx/timeout after retries, per-model quota) and only when not cooling down; defaults to `gemini-3.5-flash` (or `gemini-3.5-flash-lite` when `GEMINI_MODEL` is another model); `none` disables it |
| `ALLOW_PHOTO_ANALYSIS`                 | Optional, default false | Enables photo suggestions. Leave off on free-tier keys; enable only with a provider configuration suitable for personal images                                                                                                                |
| `PLACES_OSM_LIVE`                      | Optional, default false | Enables the optional live OpenStreetMap (Overpass) places endpoint `/api/places` (cached 24 h)                                                                                                                                                |
| `OVERPASS_URL`                         | Optional                | Overpass endpoint for the live provider                                                                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_URL`             | For real accounts       | Supabase project URL                                                                                                                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For real accounts       | Public/publishable key, protected by database RLS                                                                                                                                                                                             |
| `ALLOW_REAL_AI_PROCESSING`             | Optional, default false | Explicit operator gate for real-data API requests; manual account profiles remain the UI default                                                                                                                                              |

Never put Gemini credentials in a `NEXT_PUBLIC_` variable. No service-role Supabase key is needed by this application. Public Supabase settings must be set before building because Next.js embeds them into the browser bundle.

### Gemini behavior and verification

The official `@google/genai` SDK runs only in server code. Model output uses JSON Schema and is validated with Zod. `/api/ai/onboard` produces a draft, not an approved profile. Unknown facts stay blank/null. Users must review and approve every shared profile. AI extraction can still be mistaken; review is essential.

#### Model selection (Phase 2.2)

Root cause of the Phase 2 failures, measured on 2026-11-14 with the SDK (`models.get` plus a minimal JSON request): `gemini-3.8-flash` hung until the 30 s client timeout (the 504s users saw), and the old fallback `gemini-3.5-flash` returned **429** with `QuotaFailure: GenerateRequestsPerDayPerProjectPerModel-FreeTier` (20 requests/day) and a ~17 h `RetryInfo` delay. That is the "Gemini quota or rate limit reached" message. `gemini-3.5-flash-lite` was available to the project and answered in ~1 s.

The local `.env.local` therefore now sets only `GEMINI_MODEL=gemini-3.5-flash-lite` (the key was not touched). The model stays configurable; nothing hard-codes it.

#### Error handling and quota recovery (`src/lib/gemini.ts`, `src/lib/gemini-health.ts`)

| Failure                    | Detected by                                     | What happens                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401/403 (or 400 "API key") | HTTP status                                     | No retry, no model switch; project cools down 10 min; "check credentials" message                                                                                                                |
| 404                        | HTTP status                                     | Model marked unavailable for 1 h; fallback tried once                                                                                                                                            |
| 429 short rate limit       | `QuotaFailure` per-minute / short `RetryInfo`   | Up to 2 retries with exponential backoff + jitter, honoring `RetryInfo` if ≤ 10 s; longer delays are not waited out: the model cools down and the fallback is tried                              |
| 429 daily quota            | `…PerDay…` quota id, "daily", or delay > 15 min | **No retries.** Cools down until the provider's reset time. If the quota is per-model, the fallback is tried once; if project-wide, everything stops and later calls fail fast without a request |
| 500/503                    | HTTP status                                     | Bounded backoff (≤ 2 retries), then 3-minute circuit breaker and fallback                                                                                                                        |
| 504 / client timeout       | Status or `AbortError`                          | One retry, then circuit breaker and fallback                                                                                                                                                     |
| Network failure            | `fetch failed`, `ECONN…`                        | One retry; short project cooldown                                                                                                                                                                |
| Malformed JSON / schema    | Parse/Zod                                       | No retry, no cooldown (not an outage)                                                                                                                                                            |

Each call has a request cap (`maxRequests`) and respects an orchestration deadline, so there are no retry storms. Cooldowns are short-lived, in server memory, and contain only model names, categories and timestamps — never keys, prompts, provider messages or profile data. Users only see category-specific, user-safe messages.

#### Live, scripted, or unavailable — always explicit

`GET /api/ai/status` (no Gemini request) reports the selected/fallback model, availability (`available`, `degraded` = fallback in use, `unavailable`, `unknown`, `not-configured`), the last error category, cooldowns, and whether scripted mode is recommended. The UI shows a **Live Gemini**, **Scripted demonstration · no AI**, or **Live Gemini temporarily unavailable · retry in about N h** badge, and disables live buttons while unavailable. The developer page **`/diagnostics`** shows the same non-sensitive data plus a throttled (once per minute) **Run one minimal live request** button.

Grounded explanations are especially constrained: Gemini selects indices from the deterministic engine’s evidence list; the server returns the original facts. It cannot invent a new explanation claim. Question generation sends only the relevant dimension, not private interview transcripts or the other person’s preference.

```bash
npm run test:gemini
# With the application running:
npm run test:api
```

The smoke scripts use fictional inputs and do not print credentials or configured model values. The API smoke covers all three live AI routes and rejection of an invalid/unconsented request. Provider calls may consume API quota.

#### Live verification on 2026-11-14 (`gemini-3.5-flash-lite`, no fallback used)

- Structured JSON extraction (onboarding), relevant opt-in question generation, grounded explanation, invalid-request rejection: **PASS** (`npm run test:api`).
- Bounded agent conversation: complete, 2 rounds, **3 HTTP requests**, 2.6 s; round 1 "family plans" answered by rule (unknown), round 2 confirmed with 5 verified fact IDs; summary deterministic. A repeat request was served from the reuse cache in 21 ms with **0** new requests.
- Venue explanations: 3 of 3 verified (each cited shared interests/preferences), 0 rejected.
- Text enrichment: 12 pending suggestions, each quoting the user's own words.
- Diagnostics live check: PASS. Photo analysis was **not** live-tested (disabled by design on the free tier).

## AI matchmakers: agent-to-agent investigation

Implementation: `src/lib/agents.ts` (pure, isomorphic, unit-tested), streamed by `src/app/api/ai/agents/route.ts`, shown by `src/components/agents.tsx`.

Pipeline (deterministic filtering is never replaced):

1. **Hard eligibility** (`eligibility`) and **ranking** (`recommend`) run first. The orchestrator refuses an ineligible pair, and the route validates fictional + approved + eligible + consent before streaming.
2. **Approved, shareable contexts** (`buildApprovedContext`): age, general city, intention, interests, values, _known_ lifestyle attributes, and the person's own bio, each with a stable ID such as `b.interest.hiking` or `a.attr.children`. Partner preferences, dealbreakers, blocks, interview transcripts, availability, and pending AI suggestions are **never** included.
3. **Deterministic planning** (`planInvestigation`): the most important uncertainty for Jamie first (unknown hard preferences, then soft ones), then a **reciprocal** question from Lena's agent. **Two rounds by default.** A third is planned only when it targets a relevant open uncertainty (an unanswered or firm-requirement dimension), and it runs only if no retries were needed so far and time/request budget remains; otherwise it is skipped with a notice. Declined questions are never re-asked.
4. **Actual sequential exchanges**: for each round, the asking agent's Gemini call receives only **its own principal's facts relevant to the topic**, the topic, and the earlier questions (no transcript), and produces one question. A **separate** Gemini call for the answering agent receives only _its_ principal's facts for that topic and the question, and returns `{answer, status: confirmed|unknown, evidence: [fact IDs]}`. When the answerer has **no approved fact** that could answer (e.g. unshared family plans), the answer is produced **by rule** as an explicit unknown and no model call is made: a model could only guess. This is not one prompt fabricating a transcript.
5. **Verification before display** (`verifyAnswer`): cited IDs must exist in the answerer's approved facts. Answers with no valid evidence become an explicit **unknown**; answers citing unapproved or foreign IDs are **rewritten** from verified facts and marked "rewritten from approved facts only". For lifestyle dimensions the check is strict: an unshared attribute can never be reported as known.
6. **Summary**: assembled **deterministically** from verified facts (common ground, stated differences, unknowns, verdict `clarify-first` vs `worth-introducing`) — no extra model call, because verified structured facts already contain everything a summary may say. It also lists **shared activities** (Food & Coffee, Parks & Outdoors, Concerts & Events, Culture & Activities) derived only from confirmed shared interests; after a mutual yes each links to verified real options. Agents never name venues or events. There is no score, percentage, or probability.
7. **Consent loop**: an open unknown links to the existing compatibility-question workflow. Only a consented, validated answer updates the profile; the deterministic recommendation is recalculated, and the saved investigation is marked stale.

**Bounds and failure handling.** 2 rounds by default (≤3), ≤6 logical model calls and ≤8 HTTP requests including at most 2 retries per investigation (retries happen inside `generateJSON`), 1,200 output tokens per turn, a whole-investigation deadline of 85 s with per-call timeouts and abort on client disconnect (`maxDuration` 120). Typical live cost: **3 requests** (Phase 2: up to 7 calls + 2 retries). Investigations start only on an explicit click — never on render or refresh — and a completed live conversation for identical approved facts is **reused for 30 minutes** (server memory, fictional data only); "Live with Gemini" under _Run it again_ bypasses reuse. Failures never throw away verified work: no turns yields an explicit error and the scripted option; a mid-way failure keeps completed rounds, drops a dangling question, and labels the summary as assembled without AI. Raw provider errors are never shown.

**Prompt-injection resistance.** System instructions are constant strings: names, bios, and questions travel only in the JSON data payload, which is labeled untrusted. Defense does not rely on the prompt: the model cannot change eligibility, cannot cite facts that were never sent to it, and its unverifiable claims are replaced. Tests simulate a model that obeys an injected bio.

**Scripted demonstration.** `scriptedBrain()` is a template "brain" that goes through the same orchestrator and verifier, runs in the browser, makes no network calls, and is labeled _PREDEFINED DEMONSTRATION · SCRIPTED · NOT AI-GENERATED_ on every turn.

## Real-world date recommendations (Phase 2.2)

Implementation: `src/lib/places/` (types, curated data, providers), `src/lib/date-discovery.ts` (engine), `src/components/date-discovery.tsx` (UI), `/api/ai/dates` (`mode: "venues"`), `/api/places` (optional live OSM).

**Kazakhstan demo configuration.** Country Kazakhstan, default city **Astana**, optional **Almaty**, time zone `Asia/Almaty` (UTC+5 since 2024), currency KZT. Cities are configuration entries (`cities` in `places/types.ts`) with a bounding box and budget bands, so US cities can be added later with data or a provider and no engine/UI changes.

**Providers.**

| Provider           | Kind                  | Data                                                                                                                    | Notes                                                                                                                                                                                                                                                                   |
| ------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Curated places     | Real, curated         | 26 cafés, restaurants, parks, museums from **OpenStreetMap** (retrieved 2026-11-14 via a handful of Nominatim requests) | OSM IDs, names, coordinates, street addresses and website tags exactly as recorded (transliterated street names alongside the original). No ratings, prices or opening hours. © OpenStreetMap contributors (ODbL). Parks are the only "free" items.                     |
| Curated events     | Real, curated         | 10 upcoming events from **Ticketon.kz**, checked by hand on 2026-11-14                                                  | Title, venue/address (when shown), date and time with `+05:00`, lowest listed "from" price, age limit, official Ticketon URL. Listing-only items are marked "venue not shown". Where the page omitted the year, it is labeled "year inferred from the current listing". |
| Live OpenStreetMap | Real, live (optional) | Overpass query per city bbox                                                                                            | Off unless `PLACES_OSM_LIVE=true`; 24 h cache, one in-flight request per city, failures isolated and reported. Public Overpass servers were at capacity during development, which is why the demo never depends on them.                                                |
| Google Places      | —                     | Not implemented                                                                                                         | Would need valid credentials and billing; the provider interface (`VenueProvider`) is ready for it.                                                                                                                                                                     |

**Ticketon.** No documented public API, partner or affiliate API was found (site footer: "For Organizers", "For Advertisers"; robots.txt allows the pages). No scraping, private endpoints or access-control bypasses are used — only a small, manually verified list with links to the official pages. Ticket availability is never claimed; nothing is purchased or reserved.

**Event freshness.** Past events are excluded automatically at runtime (a scheduled event disappears at its start time; an exhibition run after its last day). Every card shows the source and verification date; after 14 days the section warns that the curated list is old. When nothing matches (for example once the November/December events have passed), an honest empty state explains why, instead of inventing events. Only the Bosch exhibition runs into January 2027; refresh `src/lib/places/curated.ts` before later demos.

**Deterministic ranking** (`recommendDates`): (1) mutual match required; (2) approved shared interests; (3) consented mutual availability over 35 days; (4) candidates from the verified layer only; (5) city filter; (6) scheduled events must fit a shared window (an exhibition must overlap its daily hours by ≥ 90 min); (7) budget applies **only to verified prices** (KZT bands: free 0, budget ≤ ₸5,000, moderate ≤ ₸15,000) — unknown prices are labeled "Price not listed" and never filtered; (8) score = shared-interest matches, both/one person's stated activity types, availability fit, verified price/location; (9) up to three, one per group when no category is selected, with **Explore alternatives**. General places get a suggested time inside a shared window but are labeled "opening hours not verified". No travel times are estimated.

**Explanations.** Deterministic reasons cite fact IDs (`shared.interest.music`, `a.kind.concerts-events`, `availability.overlap`). **Explain with Gemini** (explicit consent, one call for up to three items) sends only verified item fields plus approved shared facts; the server recomputes the items itself. Output must cite allowed IDs and is rejected if it adds prices, hours, links, addresses, other venue names, availability claims or scores.

**Proposals.** **Suggest this date** creates a pending proposal with a venue reference (id, name, address, official/map link, source, fixed-time flag). Fixed-time events are checked against the shared availability. It is confirmed only when the other person accepts (simulated and labeled in the guest demo). Real accounts: `003_phase2_2.sql` adds a validated `venue` column and `/api/account` accepts it.

## Availability, first dates, enrichment, and consent

- **Availability** (`src/lib/planning.ts`): general weekly windows in the person's IANA time zone. Overlap converts both patterns into absolute UTC intervals (DST-correct), intersects them, and keeps windows of at least 60 minutes. Results are shown only when **both** people opted to share; missing availability is never treated as "free"; "not open to meeting soon" yields no suggestions. Availability never changes compatibility. Turning sharing off hides the overlap and withdraws open proposals.
- **First-date ideas** (`src/lib/dates.ts`, `/api/ai/dates`): available only after a mutual connection. Gemini suggests 2–3 activity _types_ citing shared facts; a guard rejects invented venue facts; labeled templates fill gaps. Real venues come only from the discovery layer above.
- **Proposals**: _proposed_ is never a confirmed date; _accepted_ by the other person is. In the guest demo the counterpart response is an explicit simulation. Proposals can be withdrawn, replaced, or cancelled; blocking withdraws them.
- **Let Piper Understand Your Interests** (`src/lib/enrichment.ts`, `/api/ai/enrich`, `/api/ai/enrich-photo`): only material the person provides — bio, captions they wrote (e.g. on Instagram, pasted by hand), favorite music/artists, hobbies, activities, and optionally their own photos. Text suggestions must quote the person's words verbatim; photo suggestions are ordinary activities/objects phrased as questions ("This photo appears to show hiking. Would you like to add hiking to your interests?"). Nothing about people is inferred (no attractiveness, body, age, ethnicity, health, religion, income, personality); sensitive terms are filtered. Everything is **pending** until approved one by one. The UI labels **confirmed by you**, **AI suggestion**, **unknown (never guessed)** and **private (stays on this device)**. Pasted text and photo previews live only in page memory; **Delete my pasted content & suggestions** clears them and every unapproved suggestion. Guest mode offers a fictional sample. **Photo analysis is off by default** (`ALLOW_PHOTO_ANALYSIS`): free-tier Gemini is not an appropriate configuration for personal photos; when enabled, images are sent once and never stored.
- **Instagram username** (`src/lib/social.ts`): optional; syntax-checked only (1–30 letters, digits, periods, underscores; no links). It does **not** verify identity or ownership. Piper never fetches, scrapes, logs into or reads Instagram (no unofficial APIs, sessions, headless browsers or third parties) and never asks for passwords. Private by default; a visibility switch shows a plain link to potential matches; removable at any time. It is stored outside the profile, so agents never receive it. Real accounts store it in `member_social` (003) with RLS. An official OAuth integration would require verified permissions and permitted data uses first.
- **Ready to Connect**: pausing removes you from new introductions in both directions (`recommend` and SQL `eligible_pair`) and blocks new interest; existing matches and messages remain.
- **Fictional-only AI**: all Phase 2 AI routes accept only fictional demo profiles (or require `ALLOW_REAL_AI_PROCESSING=true` in real mode). Agents never message people; private interviews are never sent to another agent.

## Matching logic

Implementation: `src/lib/matching.ts`. Configurable defaults: `DEFAULT_WEIGHTS`.

**Eligibility is reciprocal.** Both profiles must be approved adults with completed essentials. Both age ranges and gender preferences must accept the other person. A local preference requires the same normalized city; cross-city recommendations require both people to accept them. Strict intentions must match. A confirmed answer conflicting with either person’s hard preference excludes the pair. Either direction of blocking excludes the pair.

An unknown hard-preference answer **does not prove compatibility**. It leaves a provisional introduction with an explicit unanswered question. There is no guessed answer or hidden imputation.

| Ranking signal            | Default weight | Calculation                                                                                                   |
| ------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------- |
| Relationship goal         |             30 | 1 for identical intentions; 0 otherwise                                                                       |
| Lifestyle preferences     |             25 | Confirmed desired-answer agreements across both people / all stated desired dimensions; unknowns contribute 0 |
| Shared interests          |             20 | Case-normalized unique intersection / larger set size                                                         |
| Shared values             |             20 | Same overlap calculation                                                                                      |
| Reciprocal preference fit |              5 | Average centered fit within each other’s age range                                                            |

The weighted sum determines ordering only; it is **not** a romantic compatibility probability and is never shown as one. Ties break by profile ID. An explicit feedback choice changes the interest weight to 30; hard filters are unchanged. No embeddings or trained recommendation model are used without a genuine dataset.

Investigations support `children`, `smoking`, `drinking`, and `pace`. Questions arise only for an unknown answer with a stated preference on the other side. Hard preferences are prioritized. Only a consented, validated answer becomes a profile attribute. The next ranking uses the updated facts. Declines are recorded per pair/dimension and never interpreted as an answer.

## Voice onboarding and the expanded demo (Phase 2.2 additions)

The landing page’s **Talk to Piper** opens the guest onboarding flow. Confirm adult status and Gemini processing consent, then start the interview. In the interview, consent to the browser speech service and press **Talk to Piper**. The browser asks for microphone access. Speak for about a minute, stop, review/correct the text, and press Send. Nothing is automatically sent to Gemini. Continue in either voice or text; both update the same draft and conversation.

Voice capture uses `SpeechRecognition` or `webkitSpeechRecognition` with live interim transcription when the browser service supports it. A 90-second cap stops a session, and permission errors, network errors, missing microphones, unsupported browsers, and insecure origins leave ordinary text entry available. Microphone permission is restricted to this app’s own origin. Raw audio is never retained by the app. Browser recognition may send audio to the browser vendor’s speech service. Optional opt-in spoken replies use `speechSynthesis`; they are browser voices, not Gemini-generated audio. Stop playback and clear/delete interview controls are available. The interview and draft stay in component memory until explicit profile approval.

Unstated age ranges, locality, and intention filters now remain `null` in Gemini’s interview schema. Piper asks focused follow-ups rather than inventing defaults. If the user finishes early, the review form requires missing preference choices and explicit confirmation. The approved profile schema remains strict. Tentative AI interpretations appear separately and never enter matching unless the user deliberately adds them to the reviewed profile. All draft profile facts still require human review and approval before matching.

**Speech approach investigated:** native browser recognition was selected because it reuses the reliable text/Gemini path without spending additional Gemini transcription requests. MediaRecorder can capture audio on more browsers but needs a transcription service; audio capture alone is not transcription. Gemini’s audio-input APIs could support a future backend fallback, but current free-tier/model entitlement and quota cannot be assumed. Ordinary text is the implemented cross-browser fallback. The configured key’s current model inventory advertised **zero Live/native-audio models** in our check. No Live WebSocket session was verified and full-duplex Live streaming is not enabled. No paid speech service is required.

**Current verification:** a minimal request and two live Gemini onboarding turns succeeded. The fictional Astana example correctly left gender and partner age/locality/intention preferences unknown; a second explicit answer supplied those fields. The browser E2E journey uses controlled speech events and mocked Gemini responses for repeatability, then real local ranking, scripted agents, availability, and date proposals. It does not prove physical microphone capture, browser-vendor recognition quality, or speaker playback on a particular device. Test those with the actual presentation browser before the hackathon. The existing quota/cooldown handling remains active; success now is not a guarantee of free-tier capacity during judging.

The pool now contains **180 fictional adult profiles**: the original 18 scenario profiles are preserved, plus 162 generated profiles (72 Astana, 30 Almaty, 30 New York City, 30 San Francisco). The generator uses a fixed seed, local templates, and deliberately stratified age/gender/intention cohorts, with varied smoking/family plans, hard preferences, unknowns, readiness, weekly availability, activity preferences, and budgets. Nobody is added by an API call. Original special cases such as Lena’s unknown family plans, Sophie’s unshared availability, and Jules’s missing availability remain intact. New York/NYC/New York City normalize to the same city for matching.

`scripts/generate-demo-population.mjs` produces the committed `src/lib/generated/demo-population.json`. `npm run demo:generate` regenerates it; `npm run demo:check` verifies reproducibility. Imported profiles are validated with Zod, and tests validate every planning record. Profile IDs are stable. Version-1 and version-2 guest data append only missing fixture IDs and retain consented answers, blocks, interest decisions, messages, agent sessions, date proposals, and saved planning. The dataset fits within ordinary local-storage limits; storage failures still have explicit error handling.

Discover starts with three introductions and offers one further batch of up to three within the existing six-introduction collection limit. The presented IDs persist across reloads, passes do not silently refill the list, and new batches revalidate reciprocal eligibility and readiness. You can open an approved profile, launch its agents, pass or express interest, and explicitly simulate mutual approval. Empty results show aggregate exclusion counts with overlapping constraints; no preference is widened automatically.

New tests cover all 36 city × gender × relationship-intention cohorts with **at least three mutually eligible candidates each**, representative ages 21–45, restrictive empty cases, confirmed hard conflicts, paused profiles, deterministic ranking, migration/persistence, generated-candidate scripted investigations, and general availability overlap. A performance check repeats ranking over all 180 profiles 20 times and requires the total to remain below four seconds. This is a test-environment threshold, not a production latency guarantee.

For the main demonstration: voice description → transcript correction → Gemini follow-ups → editable profile approval → three curated introductions → **Let our AIs talk** (live with consent or explicitly scripted) → simulated mutual approval → shared availability → template or Gemini date ideas → proposal and simulated acceptance. The no-quota path remains explicitly **Explore the predefined demonstration**, then scripted agents and template dates; live voice is never silently replaced with scripted speech.

```bash
npm run demo:check
# With the app running, two fictional provider calls:
node scripts/smoke-voice-profile.mjs
# Read-only model inventory; never prints credentials or configured values:
node --env-file=.env.local scripts/check-voice-capabilities.mjs
```

References: [browser SpeechRecognition support and service behavior](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [Gemini audio input](https://ai.google.dev/gemini-api/docs/audio), [Gemini Live API](https://ai.google.dev/gemini-api/docs/live), [model-dependent free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing). Published availability does not establish entitlement for this project.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` **once in a new project** using the SQL editor, or apply it with the Supabase CLI migration workflow. Review the migration before applying it to any shared database: it explicitly sets grants on the application’s `public` schema.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and your deployment environment. Restart/rebuild.
4. Enable email/password authentication. Set the Site URL to your application origin and allow `/auth/callback` on localhost and the production origin as redirect URLs. Keep email confirmation enabled and configure email delivery for real invitations/verification.
5. Visit `/account`, register, confirm the email, and create an approved profile. A second adult test account is needed to test actual mutual interest.
6. Use two separate browser sessions to verify one-sided interest, mutual interest, participant-only messages, optional questions, blocking, and deletion against your hosted project.

**Phase 2:** then run `supabase/migrations/002_phase2.sql` (additive; `001` is unchanged). It makes `eligible_pair` respect Ready-to-Connect, and adds `member_planning` (availability and date preferences; readable only by the owner and, when the owner opts to share, by mutual, unblocked matches) and `date_proposals` (match members only; responses via `respond_date_proposal`, so nobody can accept their own proposal). `/api/account` exposes `planning`, `propose`, and `proposal-response` actions and returns visible planning and proposals. The real-account page does not yet render a date planner; wiring the existing `DatePlanner` UI to these actions is the remaining integration step once a Supabase project is available. AI investigations are not enabled for real accounts.

**Phase 2.2:** then run `supabase/migrations/003_phase2_2.sql` (additive). It adds a validated `venue` JSON column to `date_proposals` and the `member_social` table for the optional Instagram username. Because 001 lets approved members read `profiles.data`, the username is deliberately **not** stored there: `member_social` is writable only by its owner and readable by others only while visibility is on, the owner is approved, and neither person blocked the other. `/api/account` gains a `social` action, accepts `venue` on `propose`, and returns visible usernames.

The migration creates `profiles`, `decisions`, `compatibility_questions`, `matches`, `messages`, `feedback`, `blocks`, and `reports`. All have row-level security. Anonymous users receive no table access. Publicly shareable profiles are visible only to authenticated, unblocked users; draft profiles stay with their owner. No interview transcript table exists.

`record_decision` serializes each pair with a database transaction lock and creates a match only after reciprocal interest and SQL eligibility checks. Clients cannot insert matches or impersonate another person’s decision. Messages require membership in an unblocked match and a sender ID equal to `auth.uid()`. Consent updates run through `answer_question`; only the subject can approve an answer. Block/report and application-data deletion use authenticated RPCs with fixed search paths.

Authentication is verified server-side with `auth.getUser()`, and RLS remains the final authorization boundary. No service-role bypass is used. Real messages are persisted and refresh every eight seconds; there is no AI-generated human message. Real-data deletion removes the application profile and dependent rows; deleting the authentication identity itself requires Supabase/operator tooling.

**Locally verified, not hosted verification:** The PostgreSQL tests run the actual migration in PGlite, providing minimal Supabase `auth.users` and `auth.uid()` scaffolding. They exercise real SQL roles, grants, policies, and RPCs. They do not verify Supabase email delivery, hosted auth cookies, production concurrency behavior, or operational moderation.

## UI/UX design system (redesign)

The interface was redesigned from four reference mockups into a warm, profile-first dating product while keeping every flow, consent step and state transition unchanged.

- **Design system** – `src/app/design-system.css` defines tokens (ivory/cream surfaces, terracotta accent, sage secondary, charcoal text, a type scale, spacing, radii, shadows) and shared primitives: buttons, cards, pills, status chips (confirmed / suggested / unknown / live / scripted / error), inputs, notices, empty/loading (skeleton) states, modal, sidebar and mobile tab bar, visible focus rings and a reduced-motion override. `src/app/screens.css` holds the screen layouts. The older `globals.css` remains as the base layer; its 7–11px text sizes were scaled up across the board for readability.
- **Typography** – Newsreader (editorial serif, headings) and Inter (interface text) via `next/font/google`, self-hosted at build time so visitors' browsers never contact Google. The build needs network access to download them once.
- **Portraits** – `src/components/portrait.tsx` procedurally generates original illustrated portraits from each fictional profile's id, gender and age (skin tone, hair style/colour, facial hair, glasses, earrings, clothing, background), so the 180-person population doesn't repeat one face. They are labeled as fictional and illustrated; no stock photos of real people are used.
- **Screens** – Landing; Talk to Piper (voice/typing switch, large microphone with recording timer and waveform, editable transcript, conversation history, a “What Piper understood” panel that marks extracted values _Suggested_ or _Unknown_, never _Confirmed_ before approval, a profile preview and a review step); Discover (one featured person with prompt-style sections built only from approved fields, a small queue for the rest of the batch of three, real preference pills linking to the profile editor, and a “Why Piper introduced …” panel covering shared interests, aligned intentions, possible differences and the unresolved question); Agent Conversations (two person cards with distinct matchmaker identities, a progress row, Live / Scripted / Interrupted status, progressive turn bubbles, a structured summary column, a consent-based follow-up band and an action bar that never bypasses mutual interest); My Profile (profile hero and section navigation around the unchanged editor); My AI Matchmaker (a summary of the approved profile and a voice/typing entry point); Connections and date cards (category-tinted venue cards with verified facts and source links only).
- **Responsive** – Sidebar navigation on desktop; a bottom tab bar and stacked layouts on tablets and phones (≤950px). Checked at 1440, 1280, 900 and 390px wide.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

- **160 unit/PostgreSQL tests** (Vitest, 11 files):
  - Phase 1 (34): reciprocal ages/genders/locations/goals, hard constraints, blocks, deterministic ranking, evidence, unknowns, consent/decline/update behavior, explicit mutual interest, message authorization, feedback updates, SQL impersonation prevention and deletion.
  - Expanded population (11) and voice-profile handoff (6): all fixtures/planning, cohort coverage, strict filters, pause behavior, migration, bounded batches, ranking performance, generated-candidate agents, consent, absent preferences, partial age ranges, quota errors, and speech fallback messages.
  - Gemini client (16, `tests/gemini.test.ts`): model configuration and fallback rules, classification of 401/403/400-key/404/429 short/429 daily (per-model vs project)/500/503/504/abort/network, no retries after daily quota, fail-fast during cooldown, backoff honoring `RetryInfo`, not waiting for long delays, one 504 retry then circuit breaker, request caps, no switching after auth errors, 404 memory, malformed JSON, request accounting, diagnostics and error messages free of secrets.
  - Agents (24, `tests/agents.test.ts`): two default rounds, a conditional third round (runs when healthy, skipped after retries), call-count limits, rule answers without a model call, topic-only fact minimization, no transcript, context separation, constant system instructions, prompt injection (the compromised answer model is never asked about unshared dimensions), grounding rewrites, deterministic summary without scores, shared activities grounded in both people's facts, failures and partial results, the scripted path.
  - Places, events and recommendations (27, `tests/places.test.ts`): curated data validation, source attribution, official link validation (look-alike hosts rejected), no stored ratings/hours, `+05:00` times, mutual-match requirement, city and category filters, variety, expired-event exclusion, time-zone formatting, availability compatibility, unshared availability, exhibition slots, missing prices, budget filtering, grounded ranking, empty state, provider failure isolation, OSM tag mapping, caching/single-flight, Gemini explanation verification, venue proposal transitions.
  - Instagram and enrichment (11, `tests/social-enrichment.test.ts`): username validation, visibility consent, removal, never in the profile or agent context, no network requests, no Instagram access anywhere in the source, migration of older saved data, photo label filtering of personal/sensitive content, pending approval/rejection, deletion of pasted-content suggestions, photo route disabled by default.
  - Availability, dates, enrichment, Ready to Connect, persistence (21, `tests/phase2.test.ts`), now in Astana time.
  - SQL Phase 2 (5) and **SQL Phase 2.2 (5, `tests/database-phase2-2.test.ts`)**: hidden usernames unreadable even by a match, visibility and blocking, owner-only writes, username validation, venue column validation, cascade on deletion.
- **44 browser tests** (Playwright, 22 scenarios × desktop + mobile): redesign checks (landing entry points and honest framing; voice/typing switch, Suggested/Unknown draft statuses and the approval gate; featured Discover person with queue switching and evidence sections; agent person cards, status, summary, follow-up CTA and back navigation; profile and matchmaker section navigation), the original 26 checks plus voice/transcript correction through profile approval, matching, scripted agents and a confirmed demo date; unsupported recognition and typed fallback; permission-denial recovery and opt-in speech playback; three/six introduction limits, approved profile viewing, and expanded-pool persistence/migration. The existing checks cover Discover Your First Date in Astana, verified venue fields, Ticketon/OSM links, availability fit, proposals, expiry, explicit Gemini failures, diagnostics, Instagram privacy and deletion. Event-dependent tests pin the browser clock to 2026-11-14.
- **Live provider checks** (2026-11-14): see _Live verification_ above.
- Production build, TypeScript, and ESLint pass.

Browser tests use installed Microsoft Edge on Windows and Playwright Chromium on other platforms. On a new Linux/macOS environment, run `npx playwright install chromium`. The test configuration starts a local server when needed. CI tests the production build. Mobile verification is Chromium device emulation, not a physical iPhone or Safari test. Screenshots are written to ignored `artifacts/`; traces on failure go to ignored `test-results/`.

`npm audit --omit=dev` found no production vulnerabilities during verification. The development dependency tree still reports seven moderate transitive findings related to the TypeScript ESLint parser’s `minimatch`; the compatible `npm audit fix` did not resolve them. Recheck upstream updates before wider adoption rather than forcing an unverified major-version override.

## Vercel deployment

No deployment has been made from this environment; a production URL is not yet verified.

1. Push this project to `https://github.com/akzholkarsybek/PiedPiper`.
2. In Vercel choose **Add New → Project**, import that repository, and select **Next.js** with the repository root as Root Directory.
3. Use **Node.js 24.x**, `npm ci`, and `npm run build`. `vercel.json` supplies the framework/build/install settings.
4. Add `GEMINI_API_KEY`, `GEMINI_MODEL`, and optionally `GEMINI_FALLBACK_MODEL` to the appropriate Vercel environments. Use a currently accessible model. Do not upload `.env.local` to GitHub. Supabase variables are optional for the judge demo.
5. Deploy. Environment changes require a new deployment.
6. For the public hackathon demo, make sure the production URL’s deployment protection permits judge access without a Vercel account. Leave real accounts unconfigured until their safety and operational requirements are ready.
7. Open the resulting URL in a signed-out/private window and complete the guest walkthrough. Confirm live Gemini or the explicitly selected predefined alternative. Do not announce the URL as working until verified.

Optional CLI path after authenticating:

```bash
npx vercel login
npx vercel link
npx vercel env add GEMINI_API_KEY production
npx vercel env add GEMINI_MODEL production
npx vercel --prod
```

Enter secrets only at the CLI prompt or through Vercel’s encrypted environment settings. Never place the key in a command argument or source file.

## GitHub workflow

The origin is intended to be `https://github.com/akzholkarsybek/PiedPiper.git`. `.gitignore` excludes local environments, dependencies, build output, reports, screenshots, and browser state. `.env.example` contains placeholders only. Never force-push or overwrite existing remote history.

If push authentication is unavailable, install GitHub CLI, then:

```bash
gh auth login
gh auth setup-git
git remote -v
git fetch origin
git log --oneline --all --decorate -10
git push -u origin Piper
```

Phase 2 and Phase 2.2 are developed on the `Piper` branch and are not merged into `main`.

If the remote gained commits, reconcile them normally before pushing. `.github/workflows/ci.yml` runs checks, the production build, and browser tests on pushes/PRs without AI credentials.

## Architecture

```text
src/app/                  App Router pages and API handlers
src/components/           Landing, interview, profile editor, introductions, messaging,
                          agents (AI Matchmakers), date-planner, availability-editor, matchmaker hub
src/components/ui/        Locally owned shadcn-style Radix/CVA Button
src/components/portrait.tsx  Procedural illustrated portraits for fictional profiles
src/app/design-system.css Design tokens and shared UI primitives
src/app/screens.css       Screen layouts (landing, onboarding, discover, agents, profile, connections)
src/lib/agents.ts         Approved contexts, planner, bounded orchestrator, verification, scripted brain
src/lib/gemini-health.ts  Error classification, short-lived cooldowns, non-sensitive status
src/lib/activities.ts     The four discovery groups and interest → group mapping
src/lib/places/           Place/event schemas, city config, curated OSM/Ticketon data, providers
src/lib/date-discovery.ts Deterministic real-world date ranking
src/lib/social.ts         Optional Instagram username (syntax only, private by default)
src/lib/planning.ts       Availability schema, IANA time-zone overlap, proposals
src/lib/dates.ts          Grounded first-date ideas, venue-fact guard, templates
src/lib/enrichment.ts     Quoted, non-sensitive, pending profile suggestions
src/lib/profile.ts        Zod schemas, supported dimensions, unknown handling
src/lib/matching.ts       Reciprocal filters, weighted rank, explainability
src/lib/demo-store.ts     Isolated, validated local-storage adapter and pure transitions
src/lib/fixtures.ts       Original 18 scenario profiles plus 162 seeded generated profiles
src/lib/generated/        Committed reproducible demo population and planning fixtures
src/lib/speech.ts         Browser speech adapter and explicit fallback messages
src/lib/onboarding.ts     Nullable interview preferences and approval handoff
src/lib/gemini.ts         Server-only SDK, structured output, bounded retries, fallback, user-safe errors
src/lib/supabase/         Browser/server auth clients
src/proxy.ts              Supabase cookie refresh for account routes
supabase/migrations/      PostgreSQL tables, grants, RLS, transactional RPCs
tests/                    Matching, store, SQL authorization, browser journeys
scripts/                  Fictional AI smoke checks and tracked-file secret scan
```

The stack is Next.js App Router, React, TypeScript, Tailwind CSS 4, shadcn-compatible locally owned components, Radix Slot, Lucide, Motion, Zod, Google Gen AI, and Supabase. Original procedurally generated vector portraits avoid representing real people as fictional dating profiles. Fonts (Newsreader and Inter) are self-hosted by `next/font` at build time.

## Before public launch

- Replace self-attestation with an appropriate age-assurance process; establish reporting escalation and staffed moderation.
- Add shared/distributed rate limiting, bot controls, monitoring, and spending limits. The current process-local 30-requests/15-minutes limiter is not a global serverless quota boundary.
- Review provider data terms and consent/retention controls before enabling real dating information in AI requests. Do not use free-tier APIs for sensitive real-person testing.
- Run an independent security/privacy review, accessibility audit, real-device tests, and hosted two-account integration tests.
- Add account identity deletion, recovery flows, retention/audit policy, moderation tooling, and delivery guarantees before production membership.
- Matching uses a normalized city string, not distance/geospatial lookup. Real discovery is limited to 200 visible rows; message fetches are limited to 500 rows and are not production pagination.
- Guest storage is local, readable by other users of the same browser profile, and not cross-device. Private interviews disappear on reload. Synthetic answers remain marked as demo behavior.
- AI extraction can misinterpret wording; human review remains mandatory. No calibrated romantic probability is claimed.
- Agent conversations are bounded, user-initiated, and fictional-only. They are not autonomous and never run on real profiles. Enabling them for real accounts requires a provider data agreement, explicit per-person consent, server-side profile loading (not client-supplied profiles), and persistent rate limiting.
- Free-tier Gemini quotas are small. A live investigation now costs about 3 requests, but repeated demos can still exhaust a daily quota; the app then labels live AI as unavailable until the provider's reset and offers the scripted demonstration. Cooldown state is per server process (not shared across serverless instances) and resets on restart.
- Guest AI routes trust client-supplied fictional profiles and the client's assertion of a mutual match; this is acceptable only for fictional demo data. Real-account mutual checks live in SQL.
- Real places and events are a small, manually verified snapshot (26 places, 10 events, verified 2026-11-14). Most events take place in November–December 2026; after that the empty state appears until `curated.ts` is refreshed. Prices are "from" prices at verification; ticket availability and opening hours are not verified. Some Ticketon listings did not show a venue or year (labeled). Venue names in Kazakh/Russian are shown with English names only where a standard translation exists. Grounding of free text is enforced via cited IDs and pattern guards, which reduce but cannot eliminate model error.
- No Ticketon API integration (none is publicly documented) and no Google Places provider (needs credentials and billing). The live OpenStreetMap provider depends on public Overpass servers, which were overloaded during development.
- Photo analysis is implemented but disabled by default and was not live-tested; it requires an operator decision and a suitable provider configuration.
- The real-account UI does not yet render the date planner, discovery, or Instagram card; the API and SQL support them.
- Full-duplex Gemini Live, embeddings, and advanced learning remain outside this MVP. Browser voice input and optional browser-spoken replies are implemented.

## Official references

- [Next.js installation and App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
