/**
 * Display names for every source an agent cites, used to list live sources on the
 * dashboard from what the agents actually used this cycle. sourceLabels.test.ts fails
 * if an agent cites a source missing here, so a new source can't ship unnamed or unlinked.
 */
export interface SourceLabel {
  name: string;
  group: "cms" | "other-federal";
  /** The public page a reader can open to see the source itself; evidence links fall back to it. */
  url: string;
}

export const SOURCE_LABELS: Record<string, SourceLabel> = {
  "cms:hospital-general-information": { name: "Hospital General Information", group: "cms", url: "https://data.cms.gov/provider-data/dataset/xubh-q36u" },
  "cms:home-health-care-agencies": { name: "Home Health Care Agencies", group: "cms", url: "https://data.cms.gov/provider-data/dataset/6jpm-sxkc" },
  "cms:medicare-physician-by-provider": { name: "Medicare Physician & Other Practitioners by Provider", group: "cms", url: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider" },
  "cms:medicare-physician-by-service": { name: "Medicare Physician & Other Practitioners by Service", group: "cms", url: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-geography-and-service" },
  "cms:ma-part-d-enrollment": { name: "Medicare Advantage/Part D Monthly Enrollment by Plan", group: "cms", url: "https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-plan" },
  "cms:marketplace-rate-puf": { name: "ACA Marketplace Rate and Plan Attributes PUFs", group: "cms", url: "https://www.cms.gov/marketplace/resources/data/public-use-files" },
  "cms:marketplace-oep-state": { name: "Marketplace Open Enrollment state-level PUFs", group: "cms", url: "https://www.cms.gov/data-research/statistics-trends-and-reports/marketplace-products" },
  "cms:medicaid-state-enrollment": { name: "State Medicaid and CHIP monthly enrollment reports", group: "cms", url: "https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360" },
  "cms:medicaid-managed-care-plans": { name: "Medicaid Managed Care Enrollment by Program and Plan", group: "cms", url: "https://data.medicaid.gov/dataset/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe" },
  "federal-register:cms-documents": { name: "Federal Register documents published by CMS", group: "cms", url: "https://www.federalregister.gov/agencies/centers-for-medicare-medicaid-services" },
  "sec-edgar:healthcare-8k-filings": { name: "SEC EDGAR 8-K filings for a 6-company health-insurer watchlist", group: "other-federal", url: "https://www.sec.gov/search-filings" },
  "openfda:drugsfda-novel-approvals": { name: "openFDA novel drug approvals", group: "other-federal", url: "https://open.fda.gov/apis/drug/drugsfda/" },
  "nih-reporter:project-awards": { name: "NIH RePORTER award notices", group: "other-federal", url: "https://reporter.nih.gov/" },
  "clinicaltrials-gov:phase3-results": { name: "ClinicalTrials.gov Phase 3 results postings", group: "other-federal", url: "https://clinicaltrials.gov/" },
  "cms:physician-fee-schedule": { name: "Physician Fee Schedule national relative value files", group: "cms", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files" },
  "cms:hospital-penalty-programs": { name: "Hospital Readmissions, HAC Reduction and Value-Based Purchasing programs", group: "cms", url: "https://data.cms.gov/provider-data/dataset/9n3s-kdb3" },
};
