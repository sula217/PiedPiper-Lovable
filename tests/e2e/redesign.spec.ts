import { test, expect, type Page } from "@playwright/test";
import { sampleProfile } from "../../src/lib/fixtures";
import { createJamie, mockStatus } from "./helpers";

const fitsViewport = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );

test("landing: hero, honest demo framing and both entry points work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stop swiping. Start something real." }),
  ).toBeVisible();
  await expect(page.getByText("Your AI finds the people.")).toBeVisible();
  // No fabricated community claims: the proof line names the fictional population.
  await expect(
    page.getByText(/180 fictional adults in New York City/),
  ).toBeVisible();
  await expect(page.getByText(/growing community/i)).toHaveCount(0);
  await expect(
    page.getByText("Fictional demo profiles · illustrated"),
  ).toBeVisible();
  for (const name of [
    "How it works",
    "The Piper difference",
    "Safety & privacy",
  ])
    if (page.viewportSize()!.width > 760)
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  expect(await fitsViewport(page)).toBe(true);
  await page
    .getByRole("link", { name: "Try the live AI demo" })
    .first()
    .click();
  await expect(page).toHaveURL("/onboarding");
  await page.goto("/");
  await page.getByRole("link", { name: "Watch the scripted demo" }).click();
  await expect(page).toHaveURL("/onboarding?demo=1");
});

test("onboarding: voice/typing switch, draft statuses and approval gate", async ({
  page,
}) => {
  await page.route("**/api/ai/onboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "gemini",
        message: "Thanks! Please review your draft.",
        draft: sampleProfile(),
        readyForReview: true,
        proposedInterpretations: [],
      }),
    }),
  );
  await page.goto("/onboarding");
  await page.getByLabel("I am at least 18 years old.").check();
  await page
    .getByLabel("I consent to sending fictional interview details to Gemini.")
    .check();
  await page.getByRole("button", { name: "Start talking to Piper" }).click();
  const understood = page.getByRole("complementary", {
    name: "What Piper has understood",
  });
  // Before anything is shared, every attribute is unknown, never confirmed.
  await expect(understood.getByText("? Unknown")).toHaveCount(8);
  await expect(understood.getByText("Confirmed", { exact: true })).toHaveCount(
    0,
  );
  // Voice is the default; switching to typing keeps the transcript box.
  await expect(
    page.getByRole("button", { name: "Talk to Piper", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to typing" }).click();
  await expect(
    page.getByRole("button", { name: "Switch to typing" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Talk to Piper", exact: true }),
  ).toHaveCount(0);
  const box = page.getByRole("textbox", {
    name: "Message to Piper",
    exact: true,
  });
  await box.fill("Fictional Jamie, 32, New York City, long-term.");
  await page.getByRole("button", { name: "Send message to Piper" }).click();
  await expect(
    page.getByText("Thanks! Please review your draft."),
  ).toBeVisible();
  // Extracted values are suggestions until the person approves the profile.
  await expect(understood.getByText("Suggested")).toHaveCount(8);
  await expect(understood.getByText("Confirmed", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("region", { name: "Your profile preview" }),
  ).toContainText("Jamie’s intro");
  await page.getByRole("button", { name: "Use voice" }).click();
  await expect(
    page.getByRole("button", { name: "Talk to Piper", exact: true }),
  ).toBeVisible();
  expect(await fitsViewport(page)).toBe(true);
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByRole("button", { name: "Approve & meet your introductions" }),
  ).toBeVisible();
  // Nothing is stored for matching until explicit approval.
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pied-piper:fictional-demo:v2"),
    ),
  ).toBeNull();
});

test("discover: one featured person, a small queue, evidence sections and working actions", async ({
  page,
}) => {
  await createJamie(page);
  const feature = page.locator(".dc-feature");
  await expect(
    feature.getByRole("heading", { name: "Lena, 30" }),
  ).toBeVisible();
  for (const h of [
    "Shared interests",
    "Aligned intentions",
    "Possible differences",
    "Unresolved question",
  ])
    await expect(feature.getByRole("heading", { name: h })).toBeVisible();
  // Shared interests come from approved data only.
  await expect(
    feature.getByText("You both enjoy hiking, music, coffee and art."),
  ).toBeVisible();
  // Batch of three: one featured, two in the queue.
  const queue = page.getByRole("complementary", { name: "More introductions" });
  await expect(queue.locator("article")).toHaveCount(2);
  const next = (await queue.locator("article h2").first().textContent())!;
  const nextName = next.split(",")[0];
  await queue
    .getByRole("button", { name: `View ${nextName}’s introduction` })
    .click();
  await expect(feature.getByRole("heading", { name: next })).toBeVisible();
  await expect(
    feature.getByRole("link", { name: /Let our AIs talk/ }),
  ).toHaveAttribute("href", /\/agents\?with=/);
  await expect(
    feature.getByRole("button", { name: `Block or report ${nextName}` }),
  ).toBeVisible();
  // Preference pills are real links to the editable profile, not inert chips.
  await expect(
    page.getByRole("link", { name: "Edit preferences" }),
  ).toHaveAttribute("href", "/profile");
  expect(await fitsViewport(page)).toBe(true);
});

test("agents: two people, distinct agents, follow-up CTA and back navigation", async ({
  page,
}) => {
  await mockStatus(page);
  await createJamie(page);
  await page.goto("/agents?with=lena");
  await expect(
    page.getByText("Piper for Jamie", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Piper for Lena", { exact: true })).toBeVisible();
  await expect(page.getByText("Not started")).toBeVisible();
  await page
    .getByRole("button", { name: "Play the scripted demonstration" })
    .click();
  await expect(page.getByText(/In conversation/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "One important question first." }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Scripted demo · 2 rounds/)).toBeVisible();
  const summary = page.getByRole("complementary", {
    name: "Your matchmaker’s take",
  });
  for (const h of [
    "Confirmed common ground",
    "Possible differences",
    "Still unknown",
  ])
    await expect(summary.getByRole("heading", { name: h })).toBeVisible();
  await page.getByRole("button", { name: "Ask follow-up question" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Simulate Lena’s explicit approval",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  // Interest alone never creates a connection.
  await expect(
    page.getByRole("link", { name: "Plan your first date" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Discover" }).click();
  await expect(page).toHaveURL("/discover");
});

test("profile and matchmaker: hero summaries and section navigation", async ({
  page,
}) => {
  await createJamie(page);
  await page.goto("/profile");
  const hero = page.getByRole("region", {
    name: "Your profile as matches see it",
  });
  await expect(hero.getByRole("heading", { name: "Jamie, 32" })).toBeVisible();
  await expect(hero.getByText("Approved by you")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Profile sections" });
  await nav.getByRole("link", { name: "Partner preferences" }).click();
  await expect(page).toHaveURL(/#preferences$/);
  await page.goto("/matchmaker");
  await expect(page.getByText("Piper for Jamie")).toBeVisible();
  await expect(
    page.getByText("Summary of your approved profile · not AI-generated"),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "Availability" })
    .click();
  await expect(page).toHaveURL(/#availability$/);
  expect(await fitsViewport(page)).toBe(true);
});
