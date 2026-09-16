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
    slug: "cms-market-intelligence-agents",
    title: "CMS Market Intelligence Agents",
    status: "in-progress",
    summary:
      "A watcher/analyst agent pipeline that pulls CMS.gov provider and reimbursement data on a schedule, detects what actually changed since the last pull, and writes a plain-language brief — reimbursement trends, bed size, and provider counts by care setting. Built to demonstrate the same discipline RevOps reporting requires: define the metric once, then let the pipeline keep it current instead of re-running the same query by hand.",
    stack: ["GitHub Actions (cron)", "TypeScript", "DuckDB", "CMS.gov Data API", "OpenAI API"],
    links: [
      // TODO: confirm the real GitHub org/user this repo gets pushed to
      // before deploying - placeholder, not yet verified.
      { label: "Pipeline source", href: "https://github.com/adamchrisdustin-art/adamdustin-me/tree/main/pipeline" },
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
