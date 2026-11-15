import { test, expect, type Page } from "@playwright/test";
import { sampleProfile, legacyDemoProfiles } from "../../src/lib/fixtures";
import { mockStatus, createJamie } from "./helpers";

async function mockSpeech(page: Page) {
  await page.addInitScript(() => {
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        (window as unknown as { voiceTest: Recognition }).voiceTest = this;
      }
      emit(text: string, isFinal = true) {
        this.onresult?.({
          resultIndex: 0,
          results: [{ 0: { transcript: text }, isFinal }],
        });
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Recognition,
      configurable: true,
    });
  });
}
async function beginInterview(page: Page) {
  const response = await page.goto("/onboarding");
  expect(response?.headers()["permissions-policy"]).toContain(
    "microphone=(self)",
  );
  await page.getByLabel("I am at least 18 years old.").check();
  await page
    .getByLabel("I consent to sending fictional interview details to Gemini.")
    .check();
  await page.getByRole("button", { name: "Start talking to Piper" }).click();
}

test("voice review, Gemini follow-up, approval, 180-profile matching, scripted agents and date plan", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await mockSpeech(page);
  await mockStatus(page);
  let requests = 0;
  let sent = "";
  await page.route("**/api/ai/onboard", async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    sent = body.messages.at(-1).content;
    const draft = sampleProfile();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "gemini",
        message:
          requests === 1
            ? "What age range, locality and intention filter should I use?"
            : "Your explicit preferences are captured. Please review your draft.",
        draft:
          requests === 1
            ? {
                ...draft,
                preferences: {
                  ...draft.preferences,
                  minAge: null,
                  maxAge: null,
                  locationMode: null,
                  strictIntent: null,
                },
              }
            : draft,
        readyForReview: requests > 1,
        proposedInterpretations: [
          "An outdoor first date may be worth considering.",
        ],
      }),
    });
  });
  await beginInterview(page);
  await expect(
    page.getByRole("button", { name: "Talk to Piper", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I consent to microphone use and my browser’s speech service processing fictional speech.",
    )
    .check();
  await page
    .getByRole("button", { name: "Talk to Piper", exact: true })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as {
        voiceTest: { emit: (t: string, f: boolean) => void };
      }
    ).voiceTest.emit("Fictional Jamie is 23 in New York City.", false);
  });
  await expect(
    page.getByText(
      "Live transcript (not final): Fictional Jamie is 23 in New York City.",
    ),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page.evaluate(() => {
    (
      window as unknown as {
        voiceTest: { emit: (t: string, f: boolean) => void };
      }
    ).voiceTest.emit("Fictional Jamie is 23 in New York City.", true);
  });
  await page.getByRole("button", { name: "Stop recording" }).click();
  const box = page.getByRole("textbox", {
    name: "Message to Piper",
    exact: true,
  });
  await box.fill(
    "I'm fictional Jamie, 32, a man in New York City. I want a long-term relationship with women and nonbinary people. I enjoy hiking, music, coffee, cooking and art. Kindness, curiosity and family matter to me.",
  );
  await page.getByRole("button", { name: "Send message to Piper" }).click();
  await expect(
    page.getByText(
      "What age range, locality and intention filter should I use?",
    ),
  ).toBeVisible();
  expect(sent).toContain("32");
  expect(sent).not.toContain("23");
  await box.fill(
    "Partner ages 27–36, same city and same long-term intention only. I want children, do not smoke, drink socially, and prefer active days. No smoking and wanting children are hard requirements.",
  );
  await page.getByRole("button", { name: "Send message to Piper" }).click();
  await expect(
    page.getByText(
      "Your explicit preferences are captured. Please review your draft.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByText("AI-proposed interpretations · not used for matching"),
  ).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Jamie");
  await expect(
    page.getByRole("button", { name: "Approve & meet your introductions" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pied-piper:fictional-demo:v2"),
    ),
  ).toBeNull();
  await page
    .getByLabel("I’ve reviewed this profile and approve sharing it.")
    .check();
  await page
    .getByRole("button", { name: "Approve & meet your introductions" })
    .click();
  await expect(page).toHaveURL("/discover");
  await expect(page.locator("article")).toHaveCount(3);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pied-piper:fictional-demo:v2")!),
  );
  expect(saved.candidates.length).toBe(180);
  expect(saved.profile.interests).not.toContain("outdoor first date");
  await page.screenshot({
    path: `artifacts/${info.project.name}-voice-discover.png`,
    fullPage: true,
  });
  const lena = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Lena, 30" }) });
  await lena.getByRole("link", { name: "Let our AIs talk" }).click();
  await page
    .getByRole("button", { name: "Play the scripted demonstration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "One important question first." }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "I’m interested in Lena" }).click();
  await page.getByRole("button", { name: "Lena is also interested" }).click();
  await page.getByRole("link", { name: "Plan your first date" }).click();
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
  await page
    .getByRole("radiogroup", { name: "Shared time windows" })
    .getByRole("radio")
    .first()
    .click();
  await page
    .getByRole("button", { name: "Use template ideas (no AI)" })
    .click();
  await expect(
    page
      .getByRole("radiogroup", { name: "First-date ideas" })
      .getByRole("radio"),
  ).toHaveCount(3);
  await page
    .getByRole("radiogroup", { name: "First-date ideas" })
    .getByRole("radio")
    .first()
    .click();
  await page.getByRole("button", { name: "Propose this plan to Lena" }).click();
  await page.getByRole("button", { name: "Lena accepts" }).click();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".proposal-status")
      .getByText("Confirmed by both · counterpart simulated"),
  ).toBeVisible();
});
test("unsupported speech remains explicit, with working typed input and clear session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await beginInterview(page);
  await page
    .getByLabel(
      "I consent to microphone use and my browser’s speech service processing fictional speech.",
    )
    .check();
  await page
    .getByRole("button", { name: "Talk to Piper", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Speech recognition is not available" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message to Piper", exact: true })
    .fill("A typed fictional description");
  await page.getByRole("button", { name: "Clear transcript" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message to Piper", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Clear & delete interview session" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, possibility." }),
  ).toBeVisible();
});
test("permission denial releases recording, preserves text, and optional browser playback is stoppable", async ({
  page,
}, info) => {
  await mockSpeech(page);
  await page.addInitScript(() => {
    const w = window as unknown as { spoken: string[]; cancelled: number };
    w.spoken = [];
    w.cancelled = 0;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        text: string;
        lang = "";
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        cancel: () => {
          w.cancelled++;
        },
        speak: (u: { text: string }) => {
          w.spoken.push(u.text);
        },
      },
    });
  });
  await beginInterview(page);
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken.length,
    ),
  ).toBe(0);
  await page.getByLabel("Read Piper’s responses aloud (browser voice)").check();
  expect(
    await page.evaluate(
      () => (window as unknown as { spoken: string[] }).spoken.length,
    ),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop spoken response" }).click();
  const box = page.getByRole("textbox", {
    name: "Message to Piper",
    exact: true,
  });
  await box.fill("My existing fictional draft");
  await page
    .getByLabel(
      "I consent to microphone use and my browser’s speech service processing fictional speech.",
    )
    .check();
  await page
    .getByRole("button", { name: "Talk to Piper", exact: true })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as {
        voiceTest: { onerror: (e: { error: string }) => void };
      }
    ).voiceTest.onerror({ error: "not-allowed" });
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "permission was denied" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);
  await expect(box).toHaveValue("My existing fictional draft");
  await expect(
    page.getByRole("button", { name: "Send message to Piper" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/${info.project.name}-voice-input.png`,
    fullPage: true,
  });
});
test("small batches, approved profile and migrated 180-profile browser persistence", async ({
  page,
}) => {
  await createJamie(page);
  const first = await page.locator("article h2").allTextContents();
  await expect(page.locator("article")).toHaveCount(3);
  await page
    .locator("article")
    .first()
    .getByRole("button", { name: "Open approved profile" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Approved interests & values",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  const next = page.getByRole("button", { name: /Meet the next/ });
  await next.click();
  await expect(page.locator("article")).toHaveCount(6);
  await expect(page.getByRole("button", { name: /Meet the next/ })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.locator("article")).toHaveCount(6);
  expect(await page.locator("article h2").allTextContents()).toEqual(
    expect.arrayContaining(first),
  );
  await page.evaluate((legacy) => {
    const key = "pied-piper:fictional-demo:v2";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.candidates = legacy;
    delete saved.introducedIds;
    localStorage.setItem(key, JSON.stringify(saved));
  }, legacyDemoProfiles);
  await page.reload();
  await expect(page.locator("article")).toHaveCount(3);
  const count = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("pied-piper:fictional-demo:v2")!)
        .candidates.length,
  );
  expect(count).toBe(180);
});
