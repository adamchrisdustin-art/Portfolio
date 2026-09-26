/**
 * Display names for every source an agent cites, used to list live sources on the
 * dashboard from what the agents actually used this cycle. sourceLabels.test.ts fails
 * if an agent cites a source missing here, so a new source can't ship unnamed.
 */
export interface SourceLabel {
  name: string;
  group: "cms" | "other-federal";
}

export const SOURCE_LABELS: Record<string, SourceLabel> = {
  "cms:hospital-general-information": { name: "Hospital General Information", group: "cms" },
  "cms:home-health-care-agencies": { name: "Home Health Care Agencies", group: "cms" },
  "cms:medicare-physician-by-provider": { name: "Medicare Physician & Other Practitioners by Provider", group: "cms" },
  "cms:medicare-physician-by-service": { name: "Medicare Physician & Other Practitioners by Service", group: "cms" },
  "cms:ma-part-d-enrollment": { name: "Medicare Advantage/Part D Monthly Enrollment by Plan", group: "cms" },
  "cms:marketplace-rate-puf": { name: "ACA Marketplace Rate and Plan Attributes PUFs", group: "cms" },
  "cms:marketplace-oep-state": { name: "Marketplace Open Enrollment state-level PUFs", group: "cms" },
  "cms:medicaid-state-enrollment": { name: "State Medicaid and CHIP monthly enrollment reports", group: "cms" },
  "cms:medicaid-managed-care-plans": { name: "Medicaid Managed Care Enrollment by Program and Plan", group: "cms" },
  "federal-register:cms-documents": { name: "Federal Register documents published by CMS", group: "cms" },
  "sec-edgar:healthcare-8k-filings": { name: "SEC EDGAR 8-K filings for a 6-company health-insurer watchlist", group: "other-federal" },
  "openfda:drugsfda-novel-approvals": { name: "openFDA novel drug approvals", group: "other-federal" },
  "nih-reporter:project-awards": { name: "NIH RePORTER award notices", group: "other-federal" },
  "clinicaltrials-gov:phase3-results": { name: "ClinicalTrials.gov Phase 3 results postings", group: "other-federal" },
};
