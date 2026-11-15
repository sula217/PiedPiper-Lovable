import { test, expect } from "@playwright/test";
test("complete predefined guest lifecycle, consent, messaging, persistence and deletion", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stop swiping. Start something real." }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-landing.png`,
    fullPage: false,
  });
  await page.getByRole("link", { name: "Watch the scripted demo" }).click();
  await expect(
    page.getByRole("button", { name: "Start talking to Piper" }),
  ).toBeDisabled();
  await page.getByLabel("I am at least 18 years old.").check();
  await page
    .getByRole("button", { name: "Explore the predefined demonstration" })
    .click();
  await expect(
    page.getByText("Predefined demonstration · scripted"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send fictional sample 1" }).click();
  await page.getByRole("button", { name: "Send fictional sample 2" }).click();
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(page.getByLabel("First name")).toHaveValue("Jamie");
  await page
    .getByLabel("I’ve reviewed this profile and approve sharing it.")
    .check();
  await page
    .getByRole("button", { name: "Approve & meet your introductions" })
    .click();
  await expect(page).toHaveURL("/discover");
  const lena = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Lena, 30" }) });
  await expect(lena).toBeVisible();
  for (const card of await page.locator("article").all())
    await expect(card).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-discover.png`,
    fullPage: false,
  });
  await lena.getByRole("button", { name: /A question worth asking/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Share & update introduction" }),
  ).toBeDisabled();
  await dialog
    .getByRole("combobox", { name: "Family plans", exact: true })
    .selectOption("yes");
  await expect(
    dialog.getByRole("button", { name: "Share & update introduction" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Simulate Lena’s explicit approval to share this answer")
    .check();
  await dialog
    .getByRole("button", { name: "Share & update introduction" })
    .click();
  await expect(page.getByRole("status")).toContainText("recalculated");
  await expect(
    lena.getByRole("button", { name: /A question worth asking/ }),
  ).toHaveCount(0);
  await lena.getByRole("button", { name: "I’m interested" }).click();
  await expect(lena.getByText("Your interest is saved.")).toBeVisible();
  await lena.getByRole("button", { name: "Also interested" }).click();
  await lena.getByRole("link", { name: "Open your connection" }).click();
  await page
    .getByLabel("Message to Lena")
    .fill("A walk and a bookstore sounds lovely.");
  await page.getByRole("button", { name: "Send demo message" }).click();
  await expect(
    page.getByText("A walk and a bookstore sounds lovely.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("SYNTHETIC DEMO REPLY", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Simulate a reply" }).click();
  await expect(
    page.getByText("SYNTHETIC DEMO REPLY", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-connections.png`,
    fullPage: false,
  });
  await page.reload();
  await expect(
    page.getByText("A walk and a bookstore sounds lovely.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Block or report Lena" }).click();
  await page
    .getByRole("button", { name: "Block profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make a little room for hello." }),
  ).toBeVisible();
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Delete demo data", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete all demo data" }).click();
  await expect(page).toHaveURL("/");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pied-piper:fictional-demo:v1"),
    ),
  ).toBeNull();
  expect(errors).toEqual([]);
});
test("AI failure stays explicit and offers a labeled predefined alternative", async ({
  page,
}) => {
  await page.route("**/api/ai/onboard", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Gemini quota reached. Try the predefined demonstration.",
        code: "RATE_LIMITED",
      }),
    }),
  );
  await page.goto("/onboarding");
  await page.getByLabel("I am at least 18 years old.").check();
  await page
    .getByLabel("I consent to sending fictional interview details to Gemini.")
    .check();
  await page.getByRole("button", { name: "Start talking to Piper" }).click();
  await page
    .getByRole("textbox", { name: "Message to Piper", exact: true })
    .fill("Fictional Jamie, 32, New York");
  await page.getByRole("button", { name: "Send message to Piper" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Gemini quota reached" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use predefined demo", exact: true })
    .click();
  await expect(
    page.getByText("Predefined demonstration · scripted"),
  ).toBeVisible();
});
test("public pages fit the viewport and all routes load", async ({ page }) => {
  for (const path of [
    "/",
    "/privacy",
    "/about-matching",
    "/account",
    "/discover",
    "/connections",
    "/profile",
    "/matchmaker",
    "/agents",
    "/diagnostics",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(page.locator("h1,h2").first()).toBeVisible();
  }
});
