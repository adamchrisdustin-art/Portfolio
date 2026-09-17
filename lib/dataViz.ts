// Embedded Tableau Public visualizations for the Portfolio page's "Data
// Visualization & Complex Analysis" section. Same growable-array pattern
// as lib/projects.ts - add an entry here as new vizzes get published to
// https://public.tableau.com/app/profile/adam1482/vizzes.
export interface DataVizEmbed {
  slug: string;
  title: string;
  description: string;
  /** The `{Workbook}/{Sheet}` path segment from the public.tableau.com URL. */
  tableauPath: string;
  /** Direct link to view/interact with the full viz on Tableau Public. */
  profileUrl: string;
}

export const dataVizEmbeds: DataVizEmbed[] = [
  {
    slug: "superstore-executive-dashboard",
    title: "Superstore Executive Dashboard",
    // NOTE: written generically from what's knowable about this workbook
    // without a live visual review (Tableau Public's profile pages are a
    // JS app that couldn't be scraped for exact chart-by-chart content) -
    // built on Tableau's standard "Superstore" sample retail dataset, not
    // real employer/client data (consistent with the synthetic-data rule
    // applied elsewhere on this site). Adam: please correct/tighten this
    // description to match what the dashboard actually shows.
    description:
      "An executive-level KPI dashboard built on Tableau's Superstore sample dataset — sales and profitability trends broken out by region, category, and time period, demonstrating dashboard design for leadership-level reporting rather than row-level data exploration.",
    tableauPath: "SuperstoreExecutiveDashboard_16834477538370/ExecutiveDashboard",
    profileUrl:
      "https://public.tableau.com/app/profile/adam1482/viz/SuperstoreExecutiveDashboard_16834477538370/ExecutiveDashboard",
  },
];
