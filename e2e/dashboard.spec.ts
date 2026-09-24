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

test("a chart wider than its card starts scrolled to its left edge, not centered (labels visible, never clipped)", async ({ page }) => {
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

test("the evidence drawer opens and shows a confidence rationale", async ({ page }) => {
  await page.goto("/healthcare-intelligence");
  // Scope to the actual <summary> toggle, not the "Inspect evidence" prose
  // in the "How this works" panel above it (getByText would match that
  // plain text first and click a no-op element).
  const details = page.locator("details", { hasText: "Inspect evidence" }).first();
  await details.locator("summary").click();
  await expect(details.getByText(/Why (low|medium|high) confidence:/)).toBeVisible();
});
