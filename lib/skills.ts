// Grouped skills strip on Home. Grouping (not a flat tag cloud) so
// proficiency level stays honest per the career knowledge base's
// "reviewing/staging vs. authoring" distinction - SQL/Python sit under
// "Data & Reporting," not next to a claim of building/engineering. That
// distinction is a tag cloud is the wrong place to spell out in prose
// (parenthetical qualifiers read as clutter here); it's carried instead by
// the actual experience bullets on Home and the resume, which never claim
// authorship for these tools - same pattern the source resumes use.
export const skillGroups: { label: string; items: string[] }[] = [
  {
    label: "Revenue Operations",
    items: [
      "Deal Desk",
      "Salesforce",
      "Sales Compensation Design",
      "Territory & Pipeline Management",
      "RFP / Pricing & Packaging",
    ],
  },
  {
    label: "Data & Reporting",
    items: [
      "Streamlit",
      "Power BI",
      "Tableau / Tableau Prep",
      "SQL / SOQL",
      "DBT",
      "Amazon Athena & S3",
    ],
  },
  {
    label: "Statistical Modeling",
    items: [
      "Random Forest",
      "Holt-Winters Forecasting",
      "ANOVA / T-tests",
    ],
  },
  {
    label: "Emerging: Agentic AI",
    items: [
      "LLM Agent Orchestration",
      "GitHub Actions Pipelines",
      "Claude & OpenAI APIs",
    ],
  },
];
