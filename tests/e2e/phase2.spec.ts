import { test, expect } from "@playwright/test";
import { createJamie, mockStatus } from "./helpers";

test("Phase 2 journey: matchmakers investigate, consent clarifies, mutual match, availability and first-date proposal", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createJamie(page);

  // 4–5. The reciprocal engine recommends Lena; Jamie chooses "Let our AIs talk".
  const lena = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Lena, 30" }) });
  await lena.getByRole("link", { name: /Let our AIs talk/ }).click();
  await expect(page).toHaveURL(/\/agents\?with=lena/);
  await expect(
    page.getByText("Piper for Jamie", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Piper for Lena", { exact: true })).toBeVisible();
  // Live AI requires explicit consent; the scripted demo is always available.
  await expect(
    page.getByRole("button", { name: "Let our AIs talk" }),
  ).toBeDisabled();

  // 6–7. Bounded investigation finds common ground and an important unknown.
  await page
    .getByRole("button", { name: "Play the scripted demonstration" })
    .click();
  await expect(
    page.getByText(/SCRIPTED DEMO · predefined template responses/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "One important question first." }),
  ).toBeVisible({ timeout: 20000 });
  // Two rounds by default; the third runs only for an important open question.
  await expect(page.locator(".agent-turn")).toHaveCount(4);
  await expect(page.getByText("Unknown · not shared yet")).toBeVisible();
  await expect(
    page.getByText("You both enjoy hiking, music, coffee and art."),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-agents.png`,
    fullPage: true,
  });

  // 8–9. Existing consent workflow resolves the unknown; recommendation updates.
  await page.getByRole("button", { name: "Ask Lena with consent" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Family plans", exact: true })
    .selectOption("yes");
  await dialog
    .getByLabel("Simulate Lena’s explicit approval to share this answer")
    .check();
  await dialog
    .getByRole("button", { name: "Share & update introduction" })
    .click();
  await expect(page.getByText(/Resolved with consent/)).toBeVisible();
  await expect(
    page.getByText(/Something changed since this conversation/),
  ).toBeVisible();

  // 10–12. Interest, explicitly simulated approval, mutual connection.
  await page.getByRole("button", { name: "I’m interested in Lena" }).click();
  await expect(
    page.getByText("SIMULATE LENA’S DECISION · FICTIONAL DEMO"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lena is also interested" }).click();
  await page.getByRole("link", { name: "Plan your first date" }).click();
  await expect(page).toHaveURL(/\/connections\?with=lena/);
  await expect(
    page.getByRole("heading", { name: "Your first date, made easier." }),
  ).toBeVisible();

  // 13. Availability is compared only after Jamie explicitly shares.
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
  const windows = page.getByRole("radiogroup", { name: "Shared time windows" });
  await expect(windows.getByRole("radio").first()).toBeVisible();
  await windows.getByRole("radio").first().click();

  // 14. First-date ideas (labeled template fallback; Gemini path needs consent).
  await page
    .getByRole("button", { name: "Use template ideas (no AI)" })
    .click();
  const ideas = page.getByRole("radiogroup", { name: "First-date ideas" });
  await expect(ideas.getByRole("radio")).toHaveCount(3);
  await expect(ideas.getByText("TEMPLATE · NOT AI").first()).toBeVisible();
  await ideas.getByRole("radio").first().click();

  // 15. Proposal is not a confirmed date until both accept (simulated).
  await page.getByRole("button", { name: "Propose this plan to Lena" }).click();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Proposed · not confirmed until both accept"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lena accepts" }).click();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-date-planner.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();

  // Revocation: stopping availability sharing hides the overlap.
  await page
    .getByRole("button", { name: "Stop sharing my availability" })
    .click();
  await expect(
    page.getByRole("radiogroup", { name: "Shared time windows" }),
  ).toHaveCount(0);

  // My AI Matchmaker: journey, Ready-to-Connect pause, and enrichment review.
  await page.goto("/matchmaker");
  await expect(
    page.getByRole("heading", { name: /working for you/ }),
  ).toBeVisible();
  await page.getByRole("switch", { name: "Ready to Connect" }).click();
  await expect(
    page.getByRole("heading", { name: "Taking a pause." }),
  ).toBeVisible();
  await page
    .getByLabel(/Interests & hobbies/)
    .fill("I love climbing and jazz concerts.");
  await page
    .getByRole("button", { name: "Suggest from keywords (no AI)" })
    .click();
  await expect(page.getByText("KEYWORD MATCH · NOT AI").first()).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-matchmaker.png`,
    fullPage: true,
  });
  await page
    .locator(".suggestion")
    .filter({ hasText: "New interest" })
    .filter({ hasText: "climbing" })
    .getByRole("button", { name: "Approve" })
    .click();
  await page.goto("/profile");
  await expect(page.getByLabel(/^Interests/)).toHaveValue(/climbing/);
  await page.goto("/discover");
  await expect(page.getByText("Ready to Connect is paused.")).toBeVisible();
  await page.getByRole("button", { name: "Resume introductions" }).click();
  await expect(page.getByText("Ready to Connect is paused.")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("live matchmaker stream renders labeled Gemini turns and verified evidence", async ({
  page,
}) => {
  await mockStatus(page);
  await createJamie(page);
  const turn = (
    id: string,
    round: number,
    role: "question" | "answer",
    side: "a" | "b",
    text: string,
    status: "confirmed" | "unknown" | null,
    evidence: string[],
    grounding = "verified",
  ) => ({
    type: "turn",
    turn: {
      id,
      round,
      role,
      side,
      topicId: "a:interests",
      text,
      status,
      evidence,
      grounding: role === "question" ? "not-applicable" : grounding,
    },
  });
  const topics = [
    {
      id: "a:interests",
      kind: "interests",
      asker: "a",
      dimension: null,
      hard: false,
      label: "How they like to spend time",
      questionKey: null,
    },
  ];
  await page.route("**/api/ai/agents", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "plan",
            topics,
            agents: {
              a: { name: "Jamie", profileId: "guest" },
              b: { name: "Lena", profileId: "lena" },
            },
            source: "gemini",
          },
          turn(
            "r1q",
            1,
            "question",
            "a",
            "How does Lena like to spend weekends?",
            null,
            [],
          ),
          turn(
            "r1a",
            1,
            "answer",
            "b",
            "From Lena's approved profile: hiking.",
            "confirmed",
            ["b.interest.hiking"],
            "corrected",
          ),
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
  await expect(page.getByText(/LIVE AI · real Gemini calls/)).toBeVisible();
  await expect(
    page.getByText("How does Lena like to spend weekends?"),
  ).toBeVisible();
  await expect(
    page.getByText(/rewritten from approved facts only/),
  ).toBeVisible();
  // The stream ended without a completion event: partial result, honestly labeled.
  await expect(page.getByText(/ended early/)).toBeVisible();
  await expect(
    page.getByText("SUMMARY ASSEMBLED FROM VERIFIED FACTS · NO AI CALL"),
  ).toBeVisible();
});

test("AI matchmaker failure offers the labeled scripted demonstration", async ({
  page,
}) => {
  await mockStatus(page);
  await createJamie(page);
  await page.route("**/api/ai/agents", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Gemini quota or rate limit reached.",
        code: "RATE_LIMITED",
      }),
    }),
  );
  await page.goto("/agents?with=lena");
  await page
    .getByLabel(
      "Send these fictional profiles’ approved facts to Gemini for this conversation.",
    )
    .check();
  await page.getByRole("button", { name: "Let our AIs talk" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Gemini quota or rate limit reached." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play the scripted demonstration instead" })
    .click();
  await expect(
    page.getByText(/SCRIPTED DEMO · predefined template responses/),
  ).toBeVisible();
  await expect(page.locator(".agent-turn").first()).toBeVisible();
});

test("Phase 1 browser data migrates to the Phase 2 schema without losing progress", async ({
  page,
}) => {
  await page.goto("/privacy");
  await page.evaluate(() => {
    const profile = {
      id: "guest",
      name: "Jamie",
      age: 32,
      gender: "man",
      city: "New York City",
      intent: "long-term",
      bio: "Fictional.",
      interests: ["hiking", "cooking", "art", "reading"],
      values: ["kindness"],
      attributes: {
        children: "yes",
        smoking: "no",
        drinking: "socially",
        pace: "active",
      },
      preferences: {
        minAge: 27,
        maxAge: 36,
        genders: ["woman", "nonbinary"],
        locationMode: "local",
        strictIntent: true,
        desired: {
          children: "yes",
          smoking: "no",
          drinking: null,
          pace: "active",
        },
        hard: ["smoking", "children"],
      },
      approved: true,
      fictional: true,
      blockedIds: [],
    };
    localStorage.setItem(
      "pied-piper:fictional-demo:v1",
      JSON.stringify({
        version: 1,
        profile,
        candidates: [],
        decisions: {},
        counterparts: {},
        questions: {},
        messages: [],
        feedback: [],
        reports: [],
        weights: {
          goals: 30,
          lifestyle: 25,
          interests: 20,
          values: 20,
          reciprocal: 5,
        },
      }),
    );
  });
  await page.goto("/profile");
  await expect(page.getByLabel("First name")).toHaveValue("Jamie");
  const keys = await page.evaluate(() => ({
    v1: localStorage.getItem("pied-piper:fictional-demo:v1"),
    v2: localStorage.getItem("pied-piper:fictional-demo:v2"),
  }));
  expect(keys.v1).toBeNull();
  expect(JSON.parse(keys.v2!).version).toBe(2);
});
