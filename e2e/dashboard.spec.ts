import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automates checks that were previously one-time manual Playwright runs
 * (see README.md's "Verified live" section). Naming-privacy rule (revised
 * 2026-09-24, see docs/cms-intelligence/MANIFEST.md): a real carrier name
 * is allowed only as a genuine, sourced finding inside an insight card
 * (an <article class="card"> - see InsightCard.tsx) - e.g. the MA/Part D
 * agent's real parent-organization enrollment ranking. It must never
 * appear in static marketing/narrative copy (hero text, nav, footer, the
 * "how this works" panel, or the case study's own prose) - that would be
 * this project claiming something about a carrier rather than reporting
 * a real number an agent computed.
 */
const CARRIER_TERMS = ["UnitedHealthcare", "United Healthcare", "UnitedHealth", "Optum", "UHC", "Humana"];

const ROUTES = ["/", "/healthcare-intelligence"];

for (const route of ROUTES) {
  test(`${route} loads with zero console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await page.waitForLoadState("networkidle");
    expect(consoleErrors).toEqual([]);
  });

  test(`${route} never renders a real carrier name outside of a sourced insight`, async ({ page }) => {
    await page.goto(route);
    // Any carrier term found after removing every insight card (<article class="card"> -
    // see InsightCard.tsx) and the Executive Pulse synthesis narrative
    // ([data-testid="synthesis"] - literally quotes real insight headlines, see
    // synthesis.ts's rule-based fallback) is a real violation: static/marketing
    // copy must never name a carrier, only a real, sourced insight may.
    const termsOutsideInsights: string[] = await page.evaluate((terms: string[]) => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      // Next.js embeds its RSC hydration payload in <script> tags - never
      // visible/rendered content, so it doesn't count as "outside" text.
      clone.querySelectorAll('article.card, [data-testid="synthesis"], script').forEach((el) => el.remove());
      const text = clone.textContent ?? "";
      return terms.filter((t) => text.includes(t));
    }, CARRIER_TERMS);
    expect(termsOutsideInsights).toEqual([]);
  });

  test(`${route} has no horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test(`${route} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

// Most findings sit inside closed <details>, which the checks above never see.
for (const colorScheme of ["light", "dark"] as const) {
  test(`/healthcare-intelligence with every drawer open (${colorScheme}) has no overflow or accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/healthcare-intelligence");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("a chart wider than its card starts scrolled to its left edge, not centered (labels visible, never clipped)", async ({ page }) => {
  // Phone width: on desktop the wide Data Explorer charts now fit their full-width panels, so nothing would overflow to check.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/healthcare-intelligence");
  await page.waitForLoadState("networkidle");
  // Real bug this guards against: `justifyContent: "center"` on an overflowing scroll
  // container left scrollLeft centered by default, permanently hiding chart labels on
  // the left edge (e.g. "Diagnostic Radiology" -> "agnostic Radiology" in a screenshot).
  const overflowingWrappers = await page.evaluate(() => {
    const wrappers = Array.from(document.querySelectorAll<HTMLElement>('[tabindex="0"]')).filter(
      (el) => el.scrollWidth > el.clientWidth + 1
    );
    return wrappers.map((el) => el.scrollLeft);
  });
  expect(overflowingWrappers.length).toBeGreaterThan(0); // sanity check: this page does have overflowing charts to verify
  for (const scrollLeft of overflowingWrappers) {
    expect(scrollLeft).toBe(0);
  }
});

test("category > finding > evidence drawer opens down to the confidence rationale", async ({ page }) => {
  await page.goto("/healthcare-intelligence");
  const category = page.locator("details.category-details").first();
  await category.locator(":scope > summary").click();
  const finding = category.locator("details.insight-details").first();
  await finding.locator(":scope > summary").click();
  const evidence = finding.locator("details", { hasText: "Inspect evidence" }).first();
  await evidence.locator(":scope > summary").click();
  await expect(evidence.getByText(/Why (low|medium|high) confidence:/)).toBeVisible();
});

test("each finding appears once on the page, not duplicated across sections", async ({ page }) => {
  await page.goto("/healthcare-intelligence");
  const ids = await page.locator("article.card[id]").evaluateAll((els) => els.map((el) => el.id));
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
});

test("an anchor link to a finding opens its category and the finding itself", async ({ page }) => {
  await page.goto("/healthcare-intelligence");
  await page.waitForLoadState("networkidle"); // hydrated, so OpenOnHash is listening (like a real in-page link click)
  const id = await page.locator("article.card[id]").first().getAttribute("id");
  await page.goto(`/healthcare-intelligence#${id}`);
  await expect(page.locator(`[id="${id}"]`).locator("xpath=ancestor::details[contains(@class,'category-details')]")).toHaveAttribute("open", "");
  await expect(page.locator(`[id="${id}"] details.insight-details`)).toHaveAttribute("open", "");
});
