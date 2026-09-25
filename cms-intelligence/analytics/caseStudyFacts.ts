/**
 * Facts the case study states about the data, computed from the committed data
 * rather than written into the page, so each monthly refresh + redeploy keeps the
 * copy true (year ranges, report counts, days of history, window lengths).
 */
import { WINDOW_DAYS as TRIALS_WINDOW } from "../data/adapters/clinicalTrialsResults";
import { WINDOW_DAYS as FDA_WINDOW } from "../data/adapters/fdaDrugApprovals";
import { WINDOW_DAYS as FEDERAL_REGISTER_WINDOW } from "../data/adapters/federalRegisterDocuments";
import { listSnapshotFiles as listHospitalSnapshots } from "../data/adapters/hospitalGeneralInformation";
import { loadAllMonths as loadMaMonths } from "../data/adapters/maPartDHistory";
import { loadAllPlanYears as loadMarketplaceYears } from "../data/adapters/marketplaceRatePuf";
import { WINDOW_DAYS as NIH_WINDOW } from "../data/adapters/nihReporterAwards";
import { loadAllYears as loadPhysicianYears } from "../data/adapters/physicianByProviderSummary";
import { WINDOW_DAYS as SEC_WINDOW } from "../data/adapters/secEdgarFilings";
import { dateFromSnapshotFilename } from "../data/sources/snapshotHistory";

export interface CaseStudyFacts {
  physician: { firstYear: number; lastYear: number; latestProviderCount: number } | null;
  maMonths: { count: number; first: string; last: string } | null;
  marketplacePlanYears: { first: number; last: number } | null;
  /** Days between the first and latest hospital snapshot - the forward-only history CMS's Provider Data Catalog allows. */
  snapshotHistoryDays: number;
  /** Rolling windows of the Federal Register feed and the four Market/Catalyst sources, deduplicated. */
  rollingWindowDays: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCaseStudyFacts(): CaseStudyFacts {
  const physicianYears = loadPhysicianYears();
  const maMonths = loadMaMonths();
  const marketplaceYears = loadMarketplaceYears();
  const snapshotDates = listHospitalSnapshots().map(dateFromSnapshotFilename).sort();
  const snapshotHistoryDays =
    snapshotDates.length >= 2 ? Math.round((Date.parse(snapshotDates[snapshotDates.length - 1]) - Date.parse(snapshotDates[0])) / DAY_MS) : 0;

  return {
    physician: physicianYears.length
      ? {
          firstYear: physicianYears[0].dataYear,
          lastYear: physicianYears[physicianYears.length - 1].dataYear,
          latestProviderCount: physicianYears[physicianYears.length - 1].providerCount,
        }
      : null,
    maMonths: maMonths.length
      ? { count: maMonths.length, first: maMonths[0].reportPeriod, last: maMonths[maMonths.length - 1].reportPeriod }
      : null,
    marketplacePlanYears: marketplaceYears.length
      ? { first: marketplaceYears[0].planYear, last: marketplaceYears[marketplaceYears.length - 1].planYear }
      : null,
    snapshotHistoryDays,
    rollingWindowDays: Array.from(new Set([FEDERAL_REGISTER_WINDOW, NIH_WINDOW, FDA_WINDOW, SEC_WINDOW, TRIALS_WINDOW])).sort((a, b) => a - b),
  };
}

/** "about a week", "about 3 weeks", "about 2 months" - for prose about how much snapshot history exists. */
export function describeDuration(days: number): string {
  if (days < 2) return "a single day";
  if (days < 11) return days <= 8 && days >= 6 ? "about a week" : `${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  return `about ${Math.round(days / 365)} years`;
}
