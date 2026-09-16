// Single source of truth for the condensed experience snapshot on Home.
// Full detail lives in Adam_Dustin_Career_Knowledge_Base.md - this is
// deliberately the one-line-per-role summary, not the resume.
export interface ExperienceEntry {
  role: string;
  org: string;
  dates: string;
  line: string;
}

export const experience: ExperienceEntry[] = [
  {
    role: "GTM Operations Analyst",
    org: "Eleos Health",
    dates: "2026–Present",
    line: "Customer Success dashboards (client risk, NPS, renewals, NRR) and dataflow reconciliation, built primarily in Streamlit.",
  },
  {
    role: "Senior Manager, Deal Desk",
    org: "PG Forsta (acquired by Qualtrics)",
    dates: "2023–2026",
    line: "Owned Deal Desk for $10M+ negotiations, ran GTM strategy and Salesforce rollout, and guided the team through four acquisitions.",
  },
  {
    role: "Senior Operations Analyst",
    org: "PG Forsta",
    dates: "2021–2023",
    line: "Restructured territories and reporting infrastructure; built predictive models for forecasting, risk, and retention.",
  },
  {
    role: "Sales Operations Analyst",
    org: "Jubilant HollisterStier",
    dates: "2018–2021",
    line: "Built a demand-planning model that improved forecast accuracy 5% and owned Salesforce CRM data governance.",
  },
];
