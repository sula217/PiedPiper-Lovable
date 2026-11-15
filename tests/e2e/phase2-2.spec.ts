import { test, expect, type Page } from "@playwright/test";
import { createJamie, mockStatus } from "./helpers";

/** Monday 16 Nov 2026, 10:00 in New York, the day after the US places were verified. */
const VERIFIED_DAY = new Date("2026-11-16T15:00:00.000Z");

async function matchWithLena(page: Page) {
  await page.goto("/agents?with=lena");
  await page
    .getByRole("button", { name: "Play the scripted demonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "One important question first." }),
  ).toBeVisible({ timeout: 20000 });
  // Shared activities come from confirmed shared interests, never invented venues.
  await expect(
    page.getByRole("heading", { name: "Things you could enjoy together" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Concerts & Events — you both enjoy music/),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’m interested in Lena" }).click();
  await expect(
    page.getByText(/unlock after you both say yes/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lena is also interested" }).click();
  await page.getByRole("link", { name: "Plan your first date" }).click();
  await expect(page).toHaveURL(/\/connections\?with=lena/);
}
async function shareAvailability(page: Page) {
  await page
    .getByRole("button", { name: "Add my general availability" })
    .click();
  await page
    .getByRole("button", { name: "Use Jamie’s fictional sample" })
    .click();
  await page
    .getByLabel(/Share my general availability with mutual connections/)
    .check();
  await page
    .getByRole("button", { name: "Save availability & preferences" })
    .click();
}

test("Discover your first date: real US places, verified sources, simulated approval", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(VERIFIED_DAY);
  await mockStatus(page);
  await createJamie(page);
  await matchWithLena(page);

  const discover = page.locator("#discover");
  await expect(
    discover.getByRole("heading", { name: "Discover your first date." }),
  ).toBeVisible();
  for (const name of [
    "Food & Coffee",
    "Parks & Outdoors",
    "Concerts & Events",
    "Culture & Activities",
  ])
    await expect(discover.getByRole("button", { name })).toBeVisible();
  // Jamie lives in New York City, so NYC is preselected; only US cities exist.
  await expect(discover.getByRole("combobox", { name: /^City/ })).toHaveValue(
    "new-york",
  );
  await expect(
    discover
      .getByRole("combobox", { name: /^City/ })
      .locator("option[value=astana]"),
  ).toHaveCount(0);
  await expect(
    discover.getByText(/Availability isn’t compared yet/),
  ).toBeVisible();

  await shareAvailability(page);
  await discover.getByRole("button", { name: "Concerts & Events" }).click();
  await expect(
    discover.getByRole("button", { name: "Concerts & Events" }),
  ).toHaveAttribute("aria-pressed", "true");
  const card = discover.locator("article").first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/You both enjoy music/)).toBeVisible();
  await expect(card.getByText("Price not listed")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "OpenStreetMap" }),
  ).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\//);
  await expect(
    card.getByRole("link", { name: "Open location" }),
  ).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\//);
  // No invented US shows: venues only, and the page says why.
  await expect(
    discover.getByText(/No dated US events are listed/),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-discover.png`,
    fullPage: true,
  });

  await card.getByRole("button", { name: "Suggest this date" }).click();
  await expect(
    page.getByText(/stays pending until Lena accepts/),
  ).toBeVisible();
  const proposal = page.locator(".proposal").first();
  await expect(
    proposal.getByText("Proposed · not confirmed until both accept"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lena accepts" }).click();
  await expect(
    proposal.getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();

  // Other US cities have their own OpenStreetMap places.
  await discover
    .getByRole("combobox", { name: /^City/ })
    .selectOption("chicago");
  await discover.getByRole("button", { name: "Concerts & Events" }).click();
  await discover.getByRole("button", { name: "Parks & Outdoors" }).click();
  await expect(
    discover.getByText("Free to enter (public park)").first(),
  ).toBeVisible();
  await discover.getByRole("button", { name: "Parks & Outdoors" }).click();
  const first = await discover.locator("article h3").first().textContent();
  await discover.getByRole("button", { name: /Explore alternatives/ }).click();
  await expect(discover.locator("article h3").first()).not.toHaveText(first!);
  await page.reload();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();

  // The matchmakers’ shared activities lead straight to verified options.
  await page.goto("/agents?with=lena");
  await page
    .locator(".shared-activities li")
    .filter({ hasText: "Concerts & Events" })
    .getByRole("link", { name: /See real options/ })
    .click();
  await expect(page).toHaveURL(/kind=concerts-events/);
  await expect(
    page
      .locator("#discover")
      .getByRole("button", { name: "Concerts & Events" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("an old curated list is flagged as stale instead of being presented as current", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2027-03-01T08:00:00.000Z"));
  await mockStatus(page);
  await createJamie(page);
  await matchWithLena(page);
  const discover = page.locator("#discover");
  await expect(
    discover.getByText(/This curated list is \d+ days old/),
  ).toBeVisible();
  await discover.getByRole("button", { name: "Food & Coffee" }).click();
  await expect(discover.locator("article").first()).toBeVisible();
});

test("Gemini unavailable: live mode is clearly labeled and the scripted demo still works", async ({
  page,
}) => {
  await mockStatus(page, "unavailable");
  await createJamie(page);
  await page.goto("/agents?with=lena");
  await expect(
    page.getByText(/Live Gemini temporarily unavailable/).first(),
  ).toBeVisible();
  await page
    .getByLabel(
      "Send these fictional profiles’ approved facts to Gemini for this conversation.",
    )
    .check();
  await expect(
    page.getByRole("button", { name: "Let our AIs talk" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Play the scripted demonstration" })
    .click();
  await expect(
    page.getByText(/SCRIPTED DEMO · predefined template responses/),
  ).toBeVisible();
  await expect(page.locator(".agent-turn").first()).toBeVisible();
});

test("live stream marks rule-based answers and keeps completed rounds", async ({
  page,
}) => {
  await mockStatus(page);
  await createJamie(page);
  const topic = {
    id: "a:dimension:children",
    kind: "dimension",
    asker: "a",
    dimension: "children",
    hard: true,
    label: "Family plans",
    questionKey: "guest:lena:children",
  };
  await page.route("**/api/ai/agents", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "plan",
            topics: [topic],
            agents: {
              a: { name: "Jamie", profileId: "guest" },
              b: { name: "Lena", profileId: "lena" },
            },
            source: "gemini",
          },
          {
            type: "turn",
            turn: {
              id: "r1q",
              round: 1,
              role: "question",
              side: "a",
              topicId: topic.id,
              text: "Has Lena shared her family plans?",
              status: null,
              evidence: [],
              grounding: "not-applicable",
              answeredBy: "model",
            },
          },
          {
            type: "turn",
            turn: {
              id: "r1a",
              round: 1,
              role: "answer",
              side: "b",
              topicId: topic.id,
              text: "Lena hasn't shared family plans yet, so I can't answer that.",
              status: "unknown",
              evidence: [],
              grounding: "verified",
              answeredBy: "rule",
            },
          },
        ]
          .map((e) => JSON.stringify(e))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/agents?with=lena");
  await page
    .getByLabel(
      "Send these fictional profiles’ approved facts to Gemini for this conversation.",
    )
    .check();
  await page.getByRole("button", { name: "Let our AIs talk" }).click();
  await expect(page.getByText("RULE · NO AI CALL")).toBeVisible();
  await expect(
    page.getByText(/answered by rule without asking the AI to guess/),
  ).toBeVisible();
  await expect(page.getByText(/completed turns are kept/)).toBeVisible();
});

test("developer diagnostics show non-sensitive Gemini status only", async ({
  page,
}) => {
  await page.goto("/diagnostics");
  await expect(
    page.getByRole("heading", { name: "Gemini status" }),
  ).toBeVisible();
  await expect(page.getByText("Selected model")).toBeVisible();
  await expect(page.getByTestId("diag-availability")).toBeVisible();
  const html = await page.content();
  // Google API keys start with "AIza"; nothing key-like may appear.
  expect(html).not.toMatch(/AIza[0-9A-Za-z_-]{10,}/);
  expect(html).not.toMatch(/GEMINI_API_KEY=/);
});

test("Instagram is optional, validated, private by default and removable; photos stay local", async ({
  page,
}) => {
  await mockStatus(page);
  await createJamie(page);
  await page.goto("/profile");
  const ig = page.getByLabel("Instagram username");
  await ig.fill("https://instagram.com/jamie");
  await expect(page.getByText(/Enter just the username/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Instagram" }),
  ).toBeDisabled();
  await ig.fill("@Jamie.Hikes");
  await expect(
    page.getByText("Looks like a valid username: @jamie.hikes"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Instagram" }).click();
  await expect(page.getByText(/Saved privately/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /How matches see it/ }),
  ).toHaveCount(0);
  await page.getByLabel("Show this link to potential matches").check();
  await page.getByRole("button", { name: "Save Instagram" }).click();
  await expect(
    page.getByRole("link", { name: /How matches see it/ }),
  ).toHaveAttribute("href", "https://www.instagram.com/jamie.hikes/");
  await expect(page.getByText(/does not verify your identity/)).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/no longer stored/)).toBeVisible();

  await page.goto("/matchmaker");
  await expect(
    page.getByRole("heading", { name: /Let Piper understand your interests/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/AI suggestion · needs your approval/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use Jamie’s fictional sample" })
    .last()
    .click();
  await expect(page.getByLabel(/Captions you’ve written/)).toHaveValue(/trail/);
  await expect(
    page.getByText(/Photo analysis is off on this server/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Suggest from keywords (no AI)" })
    .click();
  await expect(page.getByText("KEYWORD MATCH · NOT AI").first()).toBeVisible();
  await page.getByRole("button", { name: /Delete my pasted content/ }).click();
  await expect(page.getByText(/Deleted the text you pasted/)).toBeVisible();
  await expect(page.getByLabel(/Captions you’ve written/)).toHaveValue("");
  await expect(page.locator(".suggestion")).toHaveCount(0);
});
