/**
 * Reimbursement insights from the Physician Fee Schedule RVU files
 * (data/adapters/physicianFeeSchedule.ts), read against the national
 * per-code claims in data/adapters/physicianServiceSummary.ts. Added
 * 2026-09-25.
 *
 * A code's fee-schedule price is its total RVUs times the conversion
 * factor. Codes paid in both an office and a facility have two prices, so
 * each code's price is blended by the share of its Medicare payment that
 * was in a facility in the claims year being compared; that keeps a
 * code's site mix fixed, so a change is the fee schedule's alone.
 *
 * Only codes the RVU file prices are compared. Part B drugs, anesthesia,
 * lab tests and ambulance are paid on other schedules and are left out
 * (and disclosed). Code descriptions shown come from CMS's claims file,
 * never the RVU file's CPT descriptions (AMA copyright).
 */
import { loadAllFeeScheduleYears, SOURCE_ID as FEE_SOURCE_ID, type FeeScheduleYear } from "../../data/adapters/physicianFeeSchedule";
import { loadAllServiceYears, loadRbcsMap, SOURCE_ID as SERVICE_SOURCE_ID, type ServiceRow, type ServiceYearData } from "../../data/adapters/physicianServiceSummary";
import type { EvidenceRef, Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { pearsonCorrelation } from "../../intelligence/metrics/metrics";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import { classifyConfidence } from "../../intelligence/trends/trend";
import type { AgentContext } from "../types";

const AGENT_ID = "reimbursement-payment-intelligence";
const TOP_N_CODES = 8;
/** Codes below this much claims-year payment are too small to rank or to judge a price change on. */
const MIN_CODE_PAYMENT = 1_000_000;
/** A fee change this large or larger counts as a real move when checking whether claims followed it. */
const MEANINGFUL_FEE_CHANGE = 0.02;
/** Year-over-year changes past +/-100% are code redefinitions, not price changes. */
const MAX_PLAUSIBLE_CHANGE = 1;

const pct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const money = (x: number) => (Math.abs(x) >= 1e9 ? `${x < 0 ? "-" : ""}$${(Math.abs(x) / 1e9).toFixed(2)}B` : `${x < 0 ? "-" : ""}$${(Math.abs(x) / 1e6).toFixed(0)}M`);
const short = (text: string) => (text.length > 60 ? `${text.slice(0, 57).trimEnd()}...` : text);

/** The date a quarterly release took effect: A January, B April, C July, D October. */
export function releaseEffectiveDate(year: FeeScheduleYear): string {
  const month = { A: "01", B: "04", C: "07", D: "10" }[year.release.charAt(5)] ?? "01";
  return `${year.year}-${month}-01`;
}

/** A code's national fee-schedule price in dollars, blended by facility share; null when the year doesn't price it. */
export function blendedPrice(year: FeeScheduleYear, rows: Map<string, { nonFacilityTotalRvu: number; facilityTotalRvu: number }>, code: string, facilityShare: number): number | null {
  const r = rows.get(code);
  if (!r) return null;
  const rvu = (1 - facilityShare) * r.nonFacilityTotalRvu + facilityShare * r.facilityTotalRvu;
  return rvu > 0 ? rvu * year.conversionFactor : null;
}

interface PricedYear {
  year: FeeScheduleYear;
  rows: Map<string, { nonFacilityTotalRvu: number; facilityTotalRvu: number }>;
}

const facilityShare = (s: ServiceRow) => (s.medicarePayment > 0 ? s.facilityPayment / s.medicarePayment : 0);

function feeEvidence(fees: FeeScheduleYear[], id: string): EvidenceRef {
  const latest = fees[fees.length - 1];
  return {
    id,
    sourceId: FEE_SOURCE_ID,
    description: `CMS Physician Fee Schedule national relative value files, latest release of each year ${fees[0].year}-${latest.year} (${latest.release}: ${latest.fileName}); codes and relative values only`,
    datasetVintage: releaseEffectiveDate(latest),
    url: latest.zipUrl,
  };
}

function claimsEvidence(years: ServiceYearData[], id: string): EvidenceRef {
  return {
    id,
    sourceId: SERVICE_SOURCE_ID,
    description: `CMS Medicare Physician & Other Practitioners - by Geography and Service, national totals for every procedure code, data years ${years[0].dataYear}-${years[years.length - 1].dataYear}`,
    datasetVintage: `${years[years.length - 1].dataYear}-12-31`,
  };
}

const PRICED_ONLY =
  "Covers only services priced by the Physician Fee Schedule; Part B drugs, anesthesia, lab tests and ambulance are paid on other schedules and are left out.";
const NATIONAL_ONLY = "National prices before geographic adjustment; a practice's actual rate differs by locality.";

function conversionFactorInsight(fees: FeeScheduleYear[]): Insight {
  const first = fees[0];
  const latest = fees[fees.length - 1];
  const prior = fees[fees.length - 2];
  const change = latest.conversionFactor / first.conversionFactor - 1;
  const lastChange = latest.conversionFactor / prior.conversionFactor - 1;
  const peak = [...fees].sort((a, b) => b.conversionFactor - a.conversionFactor)[0];
  const cuts = fees.slice(1).filter((y, i) => y.conversionFactor < fees[i].conversionFactor).length;
  const confidence = classifyConfidence({ persistenceMet: true, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-reimbursement-${latest.year}-conversion-factor-trend`,
    headline: `Medicare's physician conversion factor is $${latest.conversionFactor.toFixed(4)} for ${latest.year}: ${pct(lastChange)} on ${prior.year}, and ${pct(change)} since ${first.year} ($${first.conversionFactor.toFixed(4)}) before inflation.`,
    questionId: "Q026",
    signalType: "trend",
    period: { start: `${first.year}-01-01`, end: `${latest.year}-12-31` },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: latest.conversionFactor, unit: "usd", comparedTo: `${first.year} conversion factor`, delta: latest.conversionFactor - first.conversionFactor, deltaPercent: change * 100 },
    drivers: [
      {
        description: `Conversion factor on the latest release of each year: ${fees.map((y) => `${y.year} $${y.conversionFactor.toFixed(4)}`).join(", ")}. It peaked in ${peak.year} at $${peak.conversionFactor.toFixed(4)} and fell in ${cuts} of ${fees.length - 1} years.${latest.fileName.includes("nonQPP") ? ` From ${latest.year} CMS publishes two factors; this is the one for clinicians who are not qualifying participants in an advanced alternative payment model.` : ""}`,
        supportingEvidenceIds: ["ev-pfs-cf"],
        relationship: "stated-mechanism",
      },
    ],
    businessRelevance:
      "The conversion factor turns every physician service's relative value into dollars, so it moves all Medicare physician rates at once, and many commercial and Medicaid fee schedules are set as a percent of Medicare.",
    evidence: [feeEvidence(fees, "ev-pfs-cf")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} The factor is published by CMS, not estimated.`,
    freshness: { dataAsOf: releaseEffectiveDate(latest), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "The conversion factor is one lever; relative values for individual services change every year as well, so a service's price can move against the factor.",
      "Nominal dollars, not adjusted for inflation.",
      "Uses each year's last quarterly release, the rate in effect at year end, which includes mid-year corrections.",
    ],
    nextSignal: `Watch the final Physician Fee Schedule rule for ${latest.year + 1}, which sets next year's conversion factor.`,
    recommendedInternalValidation: "Check which of a plan's or group's contracts are indexed to the Medicare fee schedule, and whether they reset on this factor each January.",
    sourceIds: [FEE_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      orientation: "vertical",
      title: `Medicare physician conversion factor, ${first.year}-${latest.year}`,
      unit: "USD per RVU",
      bars: fees.map((y) => ({ label: String(y.year), value: Math.round(y.conversionFactor * 100) / 100 })),
    },
  });
}

/** Per-year and pooled check of whether fee-schedule price changes show up in claims' allowed amount per service. */
export function feeVersusClaims(claims: ServiceYearData[], priced: Map<number, PricedYear>) {
  const years: { year: number; r: number; pairs: number; sameDirection: number; meaningful: number }[] = [];
  const allFee: number[] = [];
  const allClaims: number[] = [];
  for (let i = 1; i < claims.length; i++) {
    const prevYear = claims[i - 1];
    const curYear = claims[i];
    const a = priced.get(prevYear.dataYear);
    const b = priced.get(curYear.dataYear);
    if (!a || !b) continue;
    const prev = new Map(prevYear.services.map((s) => [s.code, s]));
    const fee: number[] = [];
    const real: number[] = [];
    let meaningful = 0;
    let sameDirection = 0;
    for (const s of curYear.services) {
      const p = prev.get(s.code);
      if (!p || s.isDrug || s.allowedAmount < MIN_CODE_PAYMENT || p.allowedAmount < MIN_CODE_PAYMENT || s.services <= 0 || p.services <= 0) continue;
      const share = facilityShare(s);
      const before = blendedPrice(a.year, a.rows, s.code, share);
      const after = blendedPrice(b.year, b.rows, s.code, share);
      if (!before || !after) continue;
      const feeChange = after / before - 1;
      const claimsChange = s.allowedAmount / s.services / (p.allowedAmount / p.services) - 1;
      if (Math.abs(feeChange) > MAX_PLAUSIBLE_CHANGE || Math.abs(claimsChange) > MAX_PLAUSIBLE_CHANGE) continue;
      fee.push(feeChange);
      real.push(claimsChange);
      if (Math.abs(feeChange) >= MEANINGFUL_FEE_CHANGE) {
        meaningful++;
        if (Math.sign(feeChange) === Math.sign(claimsChange)) sameDirection++;
      }
    }
    if (fee.length < 3) continue;
    years.push({ year: curYear.dataYear, r: pearsonCorrelation(fee, real), pairs: fee.length, sameDirection, meaningful });
    allFee.push(...fee);
    allClaims.push(...real);
  }
  const meaningful = years.reduce((s, y) => s + y.meaningful, 0);
  const sameDirection = years.reduce((s, y) => s + y.sameDirection, 0);
  return { years, pooledR: allFee.length >= 3 ? pearsonCorrelation(allFee, allClaims) : null, pairs: allFee.length, meaningful, sameDirection };
}

function leadingIndicatorInsight(claims: ServiceYearData[], priced: Map<number, PricedYear>, fees: FeeScheduleYear[]): Insight | null {
  const result = feeVersusClaims(claims, priced);
  if (result.years.length === 0 || result.pooledR === null || result.meaningful === 0) return null;
  const first = result.years[0];
  const last = result.years[result.years.length - 1];
  const weakest = [...result.years].sort((a, b) => a.r - b.r)[0];
  const sameShare = result.sameDirection / result.meaningful;
  const confidence = classifyConfidence({ persistenceMet: result.years.length >= 3, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-reimbursement-${last.year}-fee-schedule-leading-indicator`,
    headline: `Fee schedule price changes carried into Medicare claims: when a service's price moved ${(MEANINGFUL_FEE_CHANGE * 100).toFixed(0)}% or more, its allowed amount per service moved the same way ${(sameShare * 100).toFixed(0)}% of the time, ${first.year - 1}-${last.year} (r = ${result.pooledR.toFixed(2)}).`,
    questionId: "Q034",
    signalType: "baseline",
    period: { start: `${first.year - 1}-01-01`, end: `${last.year}-12-31` },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: sameShare * 100, unit: "percent", comparedTo: `${result.meaningful.toLocaleString()} service-years with a fee change of at least ${(MEANINGFUL_FEE_CHANGE * 100).toFixed(0)}%` },
    drivers: [
      {
        description: `Each service's year-over-year change in fee-schedule price (site mix held at the later year's) against its change in Medicare allowed amount per service, for services with at least ${money(MIN_CODE_PAYMENT)} allowed in both years, drugs excluded: ${result.pairs.toLocaleString()} service-years. Correlation by year: ${result.years.map((y) => `${y.year} r = ${y.r.toFixed(2)} (${y.pairs.toLocaleString()} services)`).join(", ")}. Weakest year: ${weakest.year}.`,
        supportingEvidenceIds: ["ev-pfs-lead", "ev-claims-lead"],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Shows that a final fee schedule rule is a reliable early read on next year's Medicare physician payment by service, well before claims data arrives, so rate changes can be planned for rather than discovered.",
    evidence: [feeEvidence(fees, "ev-pfs-lead"), claimsEvidence(claims, "ev-claims-lead")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Every priced service with enough volume, across ${result.years.length} year pairs.`,
    freshness: { dataAsOf: `${last.year}-12-31`, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      PRICED_ONLY,
      "Allowed amount per service also moves with where services are performed, geographic mix and billing modifiers, so the link is strong but not one to one.",
      "Uses each year's last quarterly release; services billed earlier in a year may have been paid at an earlier release's rate.",
    ],
    nextSignal: `When ${last.year + 1} claims data arrives, check whether services priced lower for ${last.year + 1} show lower allowed amounts per service.`,
    recommendedInternalValidation: "Run the same comparison on a plan's own Medicare-indexed contracts to see how quickly rate changes reach its paid claims.",
    sourceIds: [FEE_SOURCE_ID, SERVICE_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      orientation: "vertical",
      title: `How closely claims followed fee schedule price changes, by year (correlation)`,
      unit: "r",
      bars: result.years.map((y) => ({ label: String(y.year), value: Math.round(y.r * 100) / 100 })),
    },
  });
}

interface CodeExposure {
  service: ServiceRow;
  change: number;
  exposure: number;
}

/** Each priced service's claims-year payment and its fee change to the target year. Exported for tests. */
export function exposureByCode(claimsYear: ServiceYearData, from: PricedYear, to: PricedYear): CodeExposure[] {
  const rows: CodeExposure[] = [];
  for (const s of claimsYear.services) {
    if (s.isDrug || s.medicarePayment <= 0) continue;
    const share = facilityShare(s);
    const before = blendedPrice(from.year, from.rows, s.code, share);
    const after = blendedPrice(to.year, to.rows, s.code, share);
    if (!before || !after) continue;
    const change = after / before - 1;
    if (Math.abs(change) > MAX_PLAUSIBLE_CHANGE) continue;
    rows.push({ service: s, change, exposure: s.medicarePayment * change });
  }
  return rows;
}

async function procedureExposureInsight(claims: ServiceYearData, exposures: CodeExposure[], from: FeeScheduleYear, to: FeeScheduleYear, fees: FeeScheduleYear[], allClaims: ServiceYearData[], ctx: AgentContext): Promise<Insight | null> {
  const ranked = exposures.filter((e) => e.service.medicarePayment >= MIN_CODE_PAYMENT && e.exposure !== 0);
  if (ranked.length === 0) return null;
  const covered = exposures.reduce((s, e) => s + e.service.medicarePayment, 0);
  const net = exposures.reduce((s, e) => s + e.exposure, 0);
  const cutCount = exposures.filter((e) => e.change < 0).length;
  const deepestCut = [...ranked].sort((a, b) => a.exposure - b.exposure)[0];
  const biggestRaise = [...ranked].sort((a, b) => b.exposure - a.exposure)[0];
  const label = (e: CodeExposure) => `${e.service.code}${e.service.description ? ` ${short(e.service.description)}` : ""}`;
  const describe = (e: CodeExposure) => `${money(e.service.medicarePayment)} paid in ${claims.dataYear}, price ${pct(e.change)} by ${to.year}, ${money(e.exposure)} at ${claims.dataYear} volume`;

  const candidates: Candidate[] = ranked.map((e) => ({ id: e.service.code, label: label(e), summary: describe(e), primaryMetric: Math.abs(e.exposure) }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_CODES, taskDescription: `Medicare physician services most exposed to fee schedule price changes, ${claims.dataYear} volume at ${from.year} vs ${to.year} prices` },
    ctx
  );
  const byCode = new Map(ranked.map((e) => [e.service.code, e]));
  const selected = selections.map((s) => ({ row: byCode.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-reimbursement-${to.year}-procedure-fee-exposure`,
    headline: `At ${claims.dataYear} volumes, ${to.year} fee schedule prices move Medicare physician payment ${pct(net / covered)} (${money(net)}) from ${from.year}; ${deepestCut.service.code} takes the largest cut (${pct(deepestCut.change)}, ${money(deepestCut.exposure)}) and ${biggestRaise.service.code} the largest gain (${pct(biggestRaise.change)}, ${money(biggestRaise.exposure)}).`,
    questionId: "Q028",
    signalType: "policy",
    period: { start: `${from.year}-01-01`, end: `${to.year}-12-31`, isComparisonWindow: true },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: deepestCut.exposure, unit: "usd", comparedTo: `${deepestCut.service.code} ${claims.dataYear} Medicare payment (${money(deepestCut.service.medicarePayment)})`, deltaPercent: deepestCut.change * 100 },
    drivers: [
      {
        description: `${exposures.length.toLocaleString()} priced services covering ${money(covered)} of ${claims.dataYear} Medicare payment; ${cutCount.toLocaleString()} are priced lower in ${to.year} than ${from.year}. Services with at least ${money(MIN_CODE_PAYMENT)} paid, largest dollar effect: ${selected.map(({ row, rationale }) => `${label(row)} (${describe(row)})${source === "llm" ? ` - ${rationale}` : ""}`).join("; ")}. Candidate selection method: ${source === "llm" ? `model-reasoned salience ranking over all ${ranked.length} services` : "deterministic ranking by dollar effect"}.`,
        supportingEvidenceIds: ["ev-pfs-codes", "ev-claims-codes"],
        relationship: "stated-mechanism",
      },
    ],
    businessRelevance:
      "Names the individual services whose Medicare price changed most in dollar terms since the latest claims year, the service lines where providers' revenue and payers' Medicare-indexed costs will shift first.",
    evidence: [feeEvidence(fees, "ev-pfs-codes"), claimsEvidence(allClaims, "ev-claims-codes")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Prices are published; the dollar effect assumes ${claims.dataYear} volumes and site mix, which will have moved.`,
    freshness: { dataAsOf: releaseEffectiveDate(to), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      PRICED_ONLY,
      NATIONAL_ONLY,
      `A projection at ${claims.dataYear} volume, not observed payment: services and site of care will have changed since.`,
    ],
    nextSignal: `Watch ${claims.dataYear + 1} and ${claims.dataYear + 2} claims data for these services' allowed amount per service, and whether volume shifts as prices change.`,
    recommendedInternalValidation: "Price a plan's or group's own volume on these codes at both years' rates to size its own exposure.",
    sourceIds: [FEE_SOURCE_ID, SERVICE_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Payment effect of ${from.year}-${to.year} fee changes at ${claims.dataYear} volume, by service`,
      unit: "USD",
      bars: selected.map(({ row }) => ({ label: row.service.code, value: Math.round(row.exposure) })),
    },
  });
}

function categoryExposureInsight(claims: ServiceYearData, exposures: CodeExposure[], from: FeeScheduleYear, to: FeeScheduleYear, fees: FeeScheduleYear[], allClaims: ServiceYearData[]): Insight | null {
  const rbcs = loadRbcsMap();
  const byCategory = new Map<string, { payment: number; exposure: number; services: number }>();
  for (const e of exposures) {
    const category = rbcs[e.service.code]?.category ?? "Unclassified";
    const c = byCategory.get(category) ?? { payment: 0, exposure: 0, services: 0 };
    c.payment += e.service.medicarePayment;
    c.exposure += e.exposure;
    c.services++;
    byCategory.set(category, c);
  }
  const rows = [...byCategory]
    .map(([category, c]) => ({ category, ...c, change: c.exposure / c.payment }))
    .filter((r) => r.category !== "Unclassified" && r.payment >= 100 * MIN_CODE_PAYMENT)
    .sort((a, b) => a.change - b.change);
  if (rows.length < 2) return null;
  const hardest = rows[0];
  const best = rows[rows.length - 1];
  const confidence = classifyConfidence({ persistenceMet: false, hasFullBaseline: true, hasExternalCorroboration: false });

  return validateInsight({
    id: `sig-reimbursement-${to.year}-fee-change-by-category`,
    headline: `${to.year} fee schedule prices have not reached Medicare claims data yet: at ${claims.dataYear} volumes they move ${hardest.category} payment ${pct(hardest.change)} and ${best.category} ${pct(best.change)} compared with ${from.year} prices.`,
    questionId: "Q035",
    signalType: "policy",
    period: { start: `${from.year}-01-01`, end: `${to.year}-12-31`, isComparisonWindow: true },
    population: "medicare-ffs",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: hardest.change * 100, unit: "percent", comparedTo: `${hardest.category} ${claims.dataYear} Medicare payment (${money(hardest.payment)}) at ${from.year} prices` },
    drivers: [
      {
        description: `Fee change from ${from.year} to ${to.year} for every priced service, weighted by its ${claims.dataYear} Medicare payment and grouped by CMS's service categories (RBCS): ${rows.map((r) => `${r.category}: ${money(r.payment)} paid across ${r.services.toLocaleString()} services, ${pct(r.change, 2)} (${money(r.exposure)})`).join("; ")}. The newest claims year is ${claims.dataYear}, so none of these changes are in claims yet.`,
        supportingEvidenceIds: ["ev-pfs-cat", "ev-claims-cat"],
        relationship: "stated-mechanism",
      },
    ],
    businessRelevance:
      "Sets what to expect in the next two years of physician claims: which kinds of care will cost Medicare less per service and which more, before any utilization response.",
    evidence: [feeEvidence(fees, "ev-pfs-cat"), claimsEvidence(allClaims, "ev-claims-cat")],
    contradictoryEvidence: [],
    confidence: confidence.level,
    confidenceRationale: `${confidence.rationale} Published prices applied to observed ${claims.dataYear} volume; the realized effect depends on volume and site of care after ${claims.dataYear}.`,
    freshness: { dataAsOf: releaseEffectiveDate(to), generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      PRICED_ONLY,
      NATIONAL_ONLY,
      "Grouped by kind of service, not by specialty: the public claims data here does not split each service by the specialty that billed it.",
    ],
    nextSignal: `When CMS publishes ${claims.dataYear + 1} claims data, check whether ${hardest.category} payment per service fell as these prices imply.`,
    recommendedInternalValidation: "Group a plan's own professional claims by the same public service categories and apply both years' prices.",
    sourceIds: [FEE_SOURCE_ID, SERVICE_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: `Fee schedule price change ${from.year} to ${to.year} by kind of service, at ${claims.dataYear} volume`,
      unit: "% change",
      bars: rows.map((r) => ({ label: r.category, value: Math.round(r.change * 1000) / 10 })),
    },
  });
}

export async function feeScheduleInsights(ctx: AgentContext): Promise<Insight[]> {
  const fees = loadAllFeeScheduleYears();
  if (fees.length < 2) return [];
  const priced = new Map(fees.map((y) => [y.year, { year: y, rows: new Map(y.rows.map((r) => [r.code, r])) }]));
  const insights: Insight[] = [conversionFactorInsight(fees)];

  const claims = loadAllServiceYears();
  const latestClaims = claims[claims.length - 1];
  const latestFees = fees[fees.length - 1];
  if (!latestClaims) return insights;
  const lead = leadingIndicatorInsight(claims, priced, fees);
  if (lead) insights.push(lead);

  const from = priced.get(latestClaims.dataYear);
  const to = priced.get(latestFees.year);
  if (!from || !to || from.year.year === to.year.year) return insights;
  const exposures = exposureByCode(latestClaims, from, to);
  const procedures = await procedureExposureInsight(latestClaims, exposures, from.year, to.year, fees, claims, ctx);
  if (procedures) insights.push(procedures);
  const categories = categoryExposureInsight(latestClaims, exposures, from.year, to.year, fees, claims);
  if (categories) insights.push(categories);
  return insights;
}
