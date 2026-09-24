// Portfolio project list. Deliberately an array meant to grow, not a fixed
// set of cards - add a new entry here as each project ships (see
// ROADMAP.md). `status` keeps the site honest about what's actually live
// vs. still being built, rather than implying everything is finished.
export type ProjectStatus = "live" | "in-progress" | "planned";

export interface Project {
  slug: string;
  title: string;
  status: ProjectStatus;
  summary: string;
  stack: string[];
  links?: { label: string; href: string }[];
}

export const projects: Project[] = [
  {
    slug: "healthcare-intelligence-executive-dashboard",
    title: "Healthcare Intelligence Executive Dashboard",
    status: "in-progress",
    summary:
      "A coordinated team of 11 specialized agents behind a shared orchestrator, turning public CMS data into evidence-backed executive insights — every claim traceable to its source, confidence level, and calculation. Deterministic code handles the math; language-model reasoning is reserved for synthesis, behind a provider-agnostic interface (Claude and OpenAI both implemented). Built public-data-first: no proprietary or patient data, ever.",
    stack: ["TypeScript", "Next.js", "Anthropic API", "OpenAI API", "CMS.gov Data API", "Vitest"],
    links: [
      { label: "Open the live dashboard", href: "/healthcare-intelligence" },
      { label: "Architecture docs", href: "https://github.com/adamchrisdustin-art/Portfolio/tree/main/docs/cms-intelligence" },
    ],
  },
  {
    slug: "salesforce-playground",
    title: "Salesforce Playground + Conversational Admin Assistant",
    status: "planned",
    summary:
      "A Salesforce Developer Edition org modeling real Deal Desk structure — opportunities, territories, approval flow — on synthetic data only, with Customer Success dashboards (client risk, NPS, renewals, NRR) rebuilt in Streamlit. Paired with a chat assistant that proposes Salesforce field changes and waits for explicit confirmation before writing anything, with every proposed and executed change logged.",
    stack: ["Salesforce Developer Edition", "Streamlit", "Claude API (Haiku default)"],
  },
  {
    slug: "snowflake-hands-on-essentials",
    title: "Snowflake Hands-On Essentials Badges",
    status: "planned",
    summary:
      "Snowflake University's free workshop badge track (Data Application Builders, Data Engineering, Data Science) — hands-on with Snowflake tables, external tables, and the Cortex LLM playground rather than a self-funded trial.",
    stack: ["Snowflake", "Python", "Streamlit"],
  },
];
