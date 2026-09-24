/**
 * Data Explorer analytics overview - a general-purpose BI-style view of
 * the real underlying data, distinct from the agents' evidence-backed
 * findings. Added 2026-09-23 (Phase 5 addendum, third round) after Adam
 * asked for a standalone "flashy" analytics section alongside (not
 * instead of) the per-insight charts on agent-finding cards - see
 * docs/cms-intelligence/DASHBOARD_BLUEPRINT.md's Charts section.
 *
 * Every number here is computed directly from the same three real,
 * live-pulled adapters the agents use - never fabricated, never a
 * placeholder. Where a chart type from the reference dashboards Adam
 * shared isn't honestly buildable yet (a real geographic US map needs
 * boundary path data this project doesn't have and won't guess at; a
 * patient-flow Sankey needs clinical flow data no public CMS source in
 * this project provides), it's simply not included here rather than
 * faked - see this file's own header notes per panel.
 */
import {
  listSnapshotFiles as listHospitalSnapshots,
  loadSnapshot as loadHospitalSnapshotAt,
  loadLatestSnapshot as loadHospitalSnapshot,
} from "../data/adapters/hospitalGeneralInformation";
import { loadLatestSnapshot as loadHomeHealthSnapshot } from "../data/adapters/homeHealthCareAgencies";
import { loadLatestSnapshot as loadPhysicianSnapshot } from "../data/adapters/physicianOtherPractitioners";
import { loadLatestSnapshot as loadFederalRegisterSnapshot } from "../data/adapters/federalRegisterDocuments";
import { loadLatestSnapshot as loadMaPartDSnapshot } from "../data/adapters/maPartDEnrollment";
import { loadLatestSnapshot as loadMarketplaceSnapshot } from "../data/adapters/marketplaceRatePuf";
import { tukeyBox } from "../intelligence/metrics/metrics";
import { dateFromSnapshotFilename } from "../data/sources/snapshotHistory";
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
  facilityCountSeries: InsightSeries | null;
  ownershipConcentrationSeries: InsightSeries | null;
  federalRegisterDocumentTypeDonut: ChartDonut | null;
  federalRegisterRulesByMonthBar: ChartBar | null;
  maPartDOrgTypeDonut: ChartDonut | null;
  maPartDPlanTypeBar: ChartBar | null;
  marketplacePremiumBoxplot: ChartBoxPlot | null;
  marketplacePlanAvailabilityBar: ChartBar | null;
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

export function buildAnalyticsOverview(): AnalyticsOverview {
  const hospital = loadHospitalSnapshot();
  const homeHealth = loadHomeHealthSnapshot();
  const physician = loadPhysicianSnapshot();
  const federalRegister = loadFederalRegisterSnapshot();
  const maPartD = loadMaPartDSnapshot();
  const marketplace = loadMarketplaceSnapshot();

  const kpis: AnalyticsKpi[] = [];
  let facilityTypeDonut: ChartDonut | null = null;
  let ownershipDonut: ChartDonut | null = null;
  let hospitalRatingBar: ChartBar | null = null;
  let homeHealthRatingBar: ChartBar | null = null;
  let serviceMixBar: ChartBar | null = null;
  let paymentByProviderTypeBar: ChartBar | null = null;
  let spendingRatioBoxplot: ChartBoxPlot | null = null;
  let facilityCountSeries: InsightSeries | null = null;
  let ownershipConcentrationSeries: InsightSeries | null = null;
  let federalRegisterDocumentTypeDonut: ChartDonut | null = null;
  let federalRegisterRulesByMonthBar: ChartBar | null = null;
  let maPartDOrgTypeDonut: ChartDonut | null = null;
  let maPartDPlanTypeBar: ChartBar | null = null;
  let marketplacePremiumBoxplot: ChartBoxPlot | null = null;
  let marketplacePlanAvailabilityBar: ChartBar | null = null;

  const hospitalFiles = listHospitalSnapshots();
  if (hospitalFiles.length >= 2) {
    const snapshots = hospitalFiles.map((f) => ({ date: dateFromSnapshotFilename(f), snapshot: loadHospitalSnapshotAt(f) }));
    facilityCountSeries = {
      label: "Total hospital facility count",
      unit: "facilities",
      points: snapshots.map((s) => ({ date: s.date, value: s.snapshot.rowCount })),
    };
    ownershipConcentrationSeries = {
      label: "Hospital ownership concentration (CR4)",
      unit: "percent",
      points: snapshots.map((s) => ({ date: s.date, value: Math.round(cr4For(s.snapshot.rows) * 10) / 10 })),
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

  if (physician && physician.rows.length > 0) {
    kpis.push({ label: "Claims lines sampled", value: physician.rows.length.toLocaleString() });

    const stats: ProviderTypeStats[] = computeStatsByProviderType(physician.rows).slice(0, 8);
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
    kpis.push({ label: "CMS Federal Register documents (120-day window)", value: federalRegister.documents.length.toLocaleString() });

    const typeCounts = new Map<string, number>();
    for (const doc of federalRegister.documents) {
      typeCounts.set(doc.type, (typeCounts.get(doc.type) ?? 0) + 1);
    }
    federalRegisterDocumentTypeDonut = donutFromCounts("CMS Federal Register documents by type", "documents", typeCounts, 5);

    const rules = federalRegister.documents.filter((d) => d.type === "Rule");
    kpis.push({ label: "Rules finalized (120-day window)", value: rules.length.toLocaleString() });
    const proposed = federalRegister.documents.filter((d) => d.type === "Proposed Rule");
    kpis.push({ label: "Rules currently proposed", value: proposed.length.toLocaleString() });

    if (rules.length > 0) {
      const byMonth = new Map<string, number>();
      for (const r of rules) {
        const month = r.publicationDate.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      }
      federalRegisterRulesByMonthBar = {
        type: "bar",
        title: "CMS rules finalized per month (trailing 120 days)",
        unit: "rules",
        bars: Array.from(byMonth.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([label, value]) => ({ label, value })),
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
      title: `MA/Part D enrollment by plan type, ${maPartD.reportPeriod}`,
      unit: "enrollees",
      bars: Array.from(planTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value })),
    };
  }

  if (marketplace && marketplace.rows.length > 0) {
    // Same disclosed empirical exclusion as commercial-marketplace/agent.ts - see that file's header for why $0/$9999 exact values are excluded.
    const plausible = marketplace.rows.filter((r) => r.individualRate > 0 && r.individualRate < 9999);
    kpis.push({ label: `Marketplace plan-rate rows sampled (${marketplace.planYear})`, value: plausible.length.toLocaleString() });

    const byState = new Map<string, number[]>();
    for (const r of plausible) {
      if (!byState.has(r.state)) byState.set(r.state, []);
      byState.get(r.state)!.push(r.individualRate);
    }
    const boxes = Array.from(byState.entries())
      .filter(([, values]) => values.length >= 20)
      .map(([state, values]) => ({ label: state, ...tukeyBox(values) }))
      .sort((a, b) => a.median - b.median);
    if (boxes.length > 0) {
      marketplacePremiumBoxplot = {
        type: "boxplot",
        title: `Individual Marketplace premium distribution by state (age ${marketplace.referenceAge}, tobacco-neutral)`,
        unit: "usd/month",
        boxes,
      };
    }

    const issuersByState = new Map<string, Set<string>>();
    for (const r of plausible) {
      if (!issuersByState.has(r.state)) issuersByState.set(r.state, new Set());
      issuersByState.get(r.state)!.add(r.issuerId);
    }
    marketplacePlanAvailabilityBar = {
      type: "bar",
      // State, not rating area, and distinct ISSUERS, not distinct plans -
      // redesigned 2026-09-24 to match commercial-marketplace/agent.ts's
      // Q071 insight redesign (see that file for the real degenerate-tie
      // bug this fixes: rating-area-level plan counts are near-uniform
      // within a state, since issuers file consistently across every
      // rating area they enter - state-level issuer count is the real,
      // non-tied signal). Sorted ascending (fewest issuers first) - the
      // low end is the real competitive-intensity signal.
      title: "Marketplace states with the fewest distinct issuers sampled",
      unit: "issuers",
      bars: Array.from(issuersByState.entries())
        .map(([label, issuers]) => ({ label, value: issuers.size }))
        .sort((a, b) => a.value - b.value),
    };
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
    facilityCountSeries,
    ownershipConcentrationSeries,
    federalRegisterDocumentTypeDonut,
    federalRegisterRulesByMonthBar,
    maPartDOrgTypeDonut,
    maPartDPlanTypeBar,
    marketplacePremiumBoxplot,
    marketplacePlanAvailabilityBar,
  };
}
