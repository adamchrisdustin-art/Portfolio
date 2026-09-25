/**
 * Data Explorer analytics overview - a general-purpose BI-style view of
 * the real underlying data, distinct from the agents' evidence-backed
 * findings. Added 2026-09-23 (Phase 5 addendum, third round) after Adam
 * asked for a standalone "flashy" analytics section alongside (not
 * instead of) the per-insight charts on agent-finding cards - see
 * docs/cms-intelligence/DASHBOARD_BLUEPRINT.md's Charts section.
 *
 * Every number here is computed directly from the same real,
 * live-pulled adapters the agents use - never fabricated, never a
 * placeholder. Where a chart type from the reference dashboards Adam
 * shared isn't honestly buildable yet (a real geographic US map needs
 * boundary path data this project doesn't have and won't guess at; a
 * patient-flow Sankey needs clinical flow data no public CMS source in
 * this project provides), it's simply not included here rather than
 * faked - see this file's own header notes per panel.
 */
import { loadLatestSnapshot as loadHospitalSnapshot } from "../data/adapters/hospitalGeneralInformation";
import { loadLatestSnapshot as loadHomeHealthSnapshot } from "../data/adapters/homeHealthCareAgencies";
import { loadAllYears as loadPhysicianYears } from "../data/adapters/physicianByProviderSummary";
import { loadLatestSnapshot as loadFederalRegisterSnapshot } from "../data/adapters/federalRegisterDocuments";
import { loadLatestSnapshot as loadMaPartDSnapshot } from "../data/adapters/maPartDEnrollment";
import { loadAllPlanYears as loadMarketplaceYears } from "../data/adapters/marketplaceRatePuf";
import { panelStates } from "../intelligence/metrics/marketplaceTrends";
import { loadAllOepYears, totalRow as oepTotalRow, valueOf as oepValue } from "../data/adapters/marketplaceEnrollment";
import { tukeyBox } from "../intelligence/metrics/metrics";
import { loadAllMonths as loadMaMonths } from "../data/adapters/maPartDHistory";
import { nationalTotals } from "../intelligence/metrics/physicianTrends";
import { boxplotByState } from "../agents/claims-utilization-cost/agent";
import { cr4For } from "../agents/provider-network/agent";
import { computeStatsByProviderType, type ProviderTypeStats } from "../agents/reimbursement-payment/agent";
import type { ChartBar, ChartBoxPlot, ChartDonut, InsightSeries } from "../intelligence/evidence/schema";

const SERVICE_LABELS: Record<string, string> = {
  offers_nursing_care_services: "Nursing care",
  offers_physical_therapy_services: "Physical therapy",
  offers_occupational_therapy_services: "Occupational therapy",
  offers_speech_pathology_services: "Speech pathology",
  offers_medical_social_services: "Medical social services",
  offers_home_health_aide_services: "Home health aide",
};

export interface AnalyticsKpi {
  label: string;
  value: string;
}

export interface AnalyticsOverview {
  kpis: AnalyticsKpi[];
  facilityTypeDonut: ChartDonut | null;
  ownershipDonut: ChartDonut | null;
  hospitalRatingBar: ChartBar | null;
  homeHealthRatingBar: ChartBar | null;
  serviceMixBar: ChartBar | null;
  paymentByProviderTypeBar: ChartBar | null;
  spendingRatioBoxplot: ChartBoxPlot | null;
  maEnrollmentSeries: InsightSeries | null;
  partBPaymentSeries: InsightSeries | null;
  federalRegisterDocumentTypeDonut: ChartDonut | null;
  federalRegisterRulesByMonthBar: ChartBar | null;
  maPartDOrgTypeDonut: ChartDonut | null;
  maPartDPlanTypeBar: ChartBar | null;
  marketplacePremiumBoxplot: ChartBoxPlot | null;
  marketplacePlanAvailabilityBar: ChartBar | null;
  marketplaceFastestRisingLines: MultiLineChartData | null;
}

function donutFromCounts(title: string, unit: string, counts: Map<string, number>, topN: number): ChartDonut {
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, topN);
  const otherCount = ranked.slice(topN).reduce((sum, [, c]) => sum + c, 0);
  return {
    type: "donut",
    title,
    unit,
    slices: [...top.map(([label, value]) => ({ label, value })), ...(otherCount > 0 ? [{ label: "Other", value: otherCount }] : [])],
  };
}

function ratingBar(title: string, rows: { rating?: string }[]): ChartBar | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rating = row.rating;
    // CMS marks suppressed/not-yet-available ratings as "-" or "Not
    // Available" (same suppression convention as elsewhere in this
    // project, e.g. claims-utilization-cost/agent.ts's spending-ratio
    // parsing) - a numeric check excludes every non-rating value in one
    // place rather than an incomplete string blocklist.
    if (!rating || Number.isNaN(Number(rating))) continue;
    counts.set(rating, (counts.get(rating) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const bars = Array.from(counts.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([label, value]) => ({ label: `${label}★`, value }));
  return { type: "bar", title, unit: "facilities", bars };
}

export interface MultiLinePoint {
  date: string;
  value: number;
  /** Shown on hover alongside the value, e.g. the dollar figure behind a percent change. */
  detail: string;
}

export interface MultiLineChartData {
  title: string;
  unit: string;
  lines: { label: string; points: MultiLinePoint[] }[];
}

const FASTEST_RISING_STATES = 5;

/** A box drawn from fewer rating areas than this says little about spread. */
const MIN_RATING_AREAS_FOR_BOX = 5;

export function buildAnalyticsOverview(): AnalyticsOverview {
  const hospital = loadHospitalSnapshot();
  const homeHealth = loadHomeHealthSnapshot();
  const physicianYears = loadPhysicianYears();
  const physician = physicianYears[physicianYears.length - 1];
  const federalRegister = loadFederalRegisterSnapshot();
  const maPartD = loadMaPartDSnapshot();
  const marketplaceYears = loadMarketplaceYears();
  const marketplace = marketplaceYears[marketplaceYears.length - 1];

  const kpis: AnalyticsKpi[] = [];
  let facilityTypeDonut: ChartDonut | null = null;
  let ownershipDonut: ChartDonut | null = null;
  let hospitalRatingBar: ChartBar | null = null;
  let homeHealthRatingBar: ChartBar | null = null;
  let serviceMixBar: ChartBar | null = null;
  let paymentByProviderTypeBar: ChartBar | null = null;
  let spendingRatioBoxplot: ChartBoxPlot | null = null;
  let maEnrollmentSeries: InsightSeries | null = null;
  let partBPaymentSeries: InsightSeries | null = null;
  let federalRegisterDocumentTypeDonut: ChartDonut | null = null;
  let federalRegisterRulesByMonthBar: ChartBar | null = null;
  let maPartDOrgTypeDonut: ChartDonut | null = null;
  let maPartDPlanTypeBar: ChartBar | null = null;
  let marketplacePremiumBoxplot: ChartBoxPlot | null = null;
  let marketplacePlanAvailabilityBar: ChartBar | null = null;
  let marketplaceFastestRisingLines: MultiLineChartData | null = null;

  // Multi-year histories, not the few-day snapshot history the hospital file has so far.
  if (physicianYears.length >= 2) {
    partBPaymentSeries = {
      label: "Total Medicare Part B professional payment",
      unit: "USD",
      points: physicianYears.map((y) => ({ date: `${y.dataYear}-12-31`, value: Math.round(nationalTotals(y).medicarePayment) })),
    };
  }
  const maMonths = loadMaMonths();
  if (maMonths.length >= 2) {
    maEnrollmentSeries = {
      label: "Medicare Advantage enrollment",
      unit: "enrollees",
      points: maMonths.map((m) => ({ date: `${m.reportPeriod}-01`, value: m.totals.ma })),
    };
  }

  if (hospital && hospital.rows.length > 0) {
    kpis.push({ label: "Hospitals analyzed", value: hospital.rows.length.toLocaleString() });
    const states = new Set(hospital.rows.map((r) => r.state).filter(Boolean));
    kpis.push({ label: "States/territories covered", value: states.size.toLocaleString() });

    const typeCounts = new Map<string, number>();
    const ownershipCounts = new Map<string, number>();
    for (const row of hospital.rows) {
      const type = (row.hospital_type as string) ?? "Unknown";
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      const ownership = row.hospital_ownership ?? "Unknown";
      ownershipCounts.set(ownership, (ownershipCounts.get(ownership) ?? 0) + 1);
    }
    facilityTypeDonut = donutFromCounts("Hospital type", "facilities", typeCounts, 5);
    ownershipDonut = donutFromCounts("Hospital ownership type", "facilities", ownershipCounts, 5);

    hospitalRatingBar = ratingBar(
      "Hospital overall star rating",
      hospital.rows.map((r) => ({ rating: r.hospital_overall_rating as string | undefined }))
    );

    const cr4 = cr4For(hospital.rows);
    kpis.push({ label: "Top-4 ownership concentration (CR4)", value: `${cr4.toFixed(0)}%` });
  }

  if (homeHealth && homeHealth.rows.length > 0) {
    kpis.push({ label: "Home health agencies analyzed", value: homeHealth.rows.length.toLocaleString() });

    homeHealthRatingBar = ratingBar(
      "Home health quality star rating",
      homeHealth.rows.map((r) => ({ rating: r.quality_of_patient_care_star_rating }))
    );

    const serviceCounts = new Map<string, number>();
    for (const [field, label] of Object.entries(SERVICE_LABELS)) {
      const count = homeHealth.rows.filter((r) => r[field] === "Yes").length;
      serviceCounts.set(label, count);
    }
    serviceMixBar = {
      type: "bar",
      title: "Home health agencies offering each service, nationally",
      unit: "agencies",
      bars: Array.from(serviceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value })),
    };

    const boxes = boxplotByState(homeHealth.rows as unknown as { state: string; [key: string]: unknown }[]);
    if (boxes.length > 0) {
      spendingRatioBoxplot = { type: "boxplot", title: "Home health spending-ratio distribution by state", unit: "ratio", boxes };
    }
  }

  if (physician) {
    kpis.push({ label: `Medicare Part B providers (${physician.dataYear})`, value: physician.providerCount.toLocaleString() });

    const stats: ProviderTypeStats[] = computeStatsByProviderType(physician).slice(0, 8);
    if (stats.length > 0) {
      paymentByProviderTypeBar = {
        type: "bar",
        title: "Medicare payment as % of submitted charge, by provider type",
        unit: "% of charge",
        bars: stats.map((s) => ({ label: s.providerType, value: Math.round(s.paymentToChargeRatio * 100) })),
      };
    }
  }

  if (federalRegister && federalRegister.documents.length > 0) {
    kpis.push({ label: "CMS Federal Register documents (2-year window)", value: federalRegister.documents.length.toLocaleString() });

    const typeCounts = new Map<string, number>();
    for (const doc of federalRegister.documents) {
      typeCounts.set(doc.type, (typeCounts.get(doc.type) ?? 0) + 1);
    }
    federalRegisterDocumentTypeDonut = donutFromCounts("CMS Federal Register documents by type", "documents", typeCounts, 5);

    const rules = federalRegister.documents.filter((d) => d.type === "Rule");
    kpis.push({ label: "Rules finalized (2-year window)", value: rules.length.toLocaleString() });
    const proposed = federalRegister.documents.filter((d) => d.type === "Proposed Rule");
    kpis.push({ label: "Rules currently proposed", value: proposed.length.toLocaleString() });

    if (rules.length > 0) {
      const byMonth = new Map<string, number>();
      for (const r of rules) {
        const month = r.publicationDate.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      }
      // Every month in the span, including real zero-rule months, so the columns read as an even time axis.
      const months = Array.from(byMonth.keys()).sort();
      const bars: { label: string; value: number }[] = [];
      for (let d = new Date(`${months[0]}-01T00:00:00Z`); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const label = d.toISOString().slice(0, 7);
        bars.push({ label, value: byMonth.get(label) ?? 0 });
        if (label === months[months.length - 1]) break;
      }
      federalRegisterRulesByMonthBar = {
        type: "bar",
        orientation: "vertical",
        title: "CMS rules finalized per month (trailing 2 years)",
        unit: "rules",
        bars,
      };
    }
  }

  if (maPartD && maPartD.rows.length > 0) {
    const totalEnrollment = maPartD.rows.reduce((s, r) => s + r.enrollment, 0);
    kpis.push({ label: `MA/Part D enrollment (${maPartD.reportPeriod})`, value: totalEnrollment.toLocaleString() });

    const orgTypeCounts = new Map<string, number>();
    const planTypeCounts = new Map<string, number>();
    for (const row of maPartD.rows) {
      orgTypeCounts.set(row.organizationType, (orgTypeCounts.get(row.organizationType) ?? 0) + row.enrollment);
      planTypeCounts.set(row.planType, (planTypeCounts.get(row.planType) ?? 0) + row.enrollment);
    }
    maPartDOrgTypeDonut = donutFromCounts(`MA/Part D enrollment by organization type, ${maPartD.reportPeriod}`, "enrollees", orgTypeCounts, 5);
    maPartDPlanTypeBar = {
      type: "bar",
      orientation: "vertical",
      title: `MA/Part D enrollment by plan type, ${maPartD.reportPeriod}`,
      unit: "enrollees",
      bars: Array.from(planTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value })),
    };
  }

  const oepYears = loadAllOepYears();
  const oep = oepYears[oepYears.length - 1];
  const oepTotal = oep ? oepTotalRow(oep, "All") : null;
  const selections = oep && oepTotal ? oepValue(oep, oepTotal, "Cnsmr") : null;
  if (oep && selections !== null) {
    kpis.push({ label: `Marketplace plan selections, all states and DC (${oep.planYear} open enrollment)`, value: selections.toLocaleString() });
  }

  if (marketplace && marketplace.states.length > 0) {
    kpis.push({ label: `HealthCare.gov states with Marketplace plans (${marketplace.planYear})`, value: String(marketplace.states.length) });

    // Spread of the benchmark (second-lowest-cost silver plan) across each state's rating areas.
    const byState = new Map<string, number[]>();
    for (const a of marketplace.ratingAreas) {
      if (a.benchmark === null) continue;
      if (!byState.has(a.state)) byState.set(a.state, []);
      byState.get(a.state)!.push(a.benchmark);
    }
    const boxes = Array.from(byState.entries())
      .filter(([, values]) => values.length >= MIN_RATING_AREAS_FOR_BOX)
      .map(([state, values]) => ({ label: state, ...tukeyBox(values) }))
      .sort((a, b) => b.median - a.median);
    if (boxes.length > 0) {
      marketplacePremiumBoxplot = {
        type: "boxplot",
        title: `Benchmark silver premium across each state's rating areas, age ${marketplace.referenceAge}, plan year ${marketplace.planYear} (states with ${MIN_RATING_AREAS_FOR_BOX}+ rating areas)`,
        unit: "usd/month",
        boxes,
      };
    }

    // Issuers per state, most first.
    marketplacePlanAvailabilityBar = {
      type: "bar",
      orientation: "vertical",
      title: `Marketplace issuers per HealthCare.gov state, plan year ${marketplace.planYear} (most first)`,
      unit: "issuers",
      bars: marketplace.states.map((st) => ({ label: st.state, value: st.issuerIds.length })).sort((a, b) => b.value - a.value),
    };

    // Cumulative benchmark change since the first plan year, for the states that rose most. Only states on
    // HealthCare.gov every year, so each line is continuous and starts from the same year.
    const first = marketplaceYears[0];
    const benchmarks = panelStates(marketplaceYears).flatMap((state) => {
      const values = marketplaceYears.map((y) => ({ year: y.planYear, value: y.states.find((st) => st.state === state)?.benchmarkMedian ?? null }));
      return values.every((v) => v.value !== null) ? [{ state, values: values as { year: number; value: number }[] }] : [];
    });
    const rising = benchmarks
      .map((b) => ({ ...b, total: b.values[b.values.length - 1].value / b.values[0].value - 1 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, FASTEST_RISING_STATES);
    if (rising.length > 0 && marketplaceYears.length >= 2) {
      marketplaceFastestRisingLines = {
        title: `Benchmark silver premium change since ${first.planYear}, age ${marketplace.referenceAge}: the ${rising.length} fastest-rising HealthCare.gov states`,
        unit: "% since " + first.planYear,
        lines: rising.map((b) => ({
          label: b.state,
          points: b.values.map((v) => ({
            date: String(v.year),
            value: Math.round((v.value / b.values[0].value - 1) * 1000) / 10,
            detail: `$${Math.round(v.value).toLocaleString()}/month`,
          })),
        })),
      };
    }
  }

  return {
    kpis,
    facilityTypeDonut,
    ownershipDonut,
    hospitalRatingBar,
    homeHealthRatingBar,
    serviceMixBar,
    paymentByProviderTypeBar,
    spendingRatioBoxplot,
    maEnrollmentSeries,
    partBPaymentSeries,
    federalRegisterDocumentTypeDonut,
    federalRegisterRulesByMonthBar,
    maPartDOrgTypeDonut,
    maPartDPlanTypeBar,
    marketplacePremiumBoxplot,
    marketplacePlanAvailabilityBar,
    marketplaceFastestRisingLines,
  };
}
