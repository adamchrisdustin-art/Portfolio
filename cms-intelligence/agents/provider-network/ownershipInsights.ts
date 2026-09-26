/**
 * Facility M&A insights from CMS's change-of-ownership and All Owners files
 * (data/adapters/facilityOwnership.ts). Added 2026-09-25.
 *
 * - Hospital ownership changes by year and type, the most active buyers,
 *   and the CMS star rating of acquired hospitals against all rated
 *   hospitals (Hospital General Information, joined by CCN) - a
 *   cross-check, never a claim that ownership changes move quality.
 * - Skilled nursing facility (SNF) ownership changes by state, per 100
 *   nursing homes (Provider of Services counts), with the parent
 *   organizations behind the buyers named from CMS's owner records.
 * - Facilities that report a private equity owner, and how many of those
 *   owner relationships are new versus newly reported.
 *
 * Buyer and owner names are public Medicare enrollment records, shown only
 * as counted from the data. A change of ownership takes 12-18 months to
 * finish appearing in CMS's files, so years are compared only as each was
 * reported at the same lag.
 */
import {
  CHOW_SOURCE_ID,
  loadLatestChowSnapshot,
  loadPrivateEquityMonths,
  PE_SOURCE_ID,
  sameLagComparison,
  type ChowSnapshot,
  type FacilityKind,
  type OwnershipChange,
  type PrivateEquityMonth,
} from "../../data/adapters/facilityOwnership";
import { listSnapshotFiles, loadSnapshot, SOURCE_ID as HGI_SOURCE_ID } from "../../data/adapters/hospitalGeneralInformation";
import { combinedHistory, loadAllQuarters, SOURCE_ID as POS_SOURCE_ID } from "../../data/adapters/providerOfServices";
import { STATE_CODES } from "../../data/sources/states";
import type { Insight } from "../../intelligence/evidence/schema";
import { validateInsight } from "../../intelligence/evidence/validate";
import { selectNoteworthy, type Candidate } from "../../intelligence/salience/selectNoteworthy";
import type { AgentContext } from "../types";

const AGENT_ID = "provider-network-intelligence";
/** Recent activity is read over the last complete years. */
const RECENT_YEARS = 3;
const TOP_N_BUYERS = 8;
const TOP_N_PARENTS = 6;
const TOP_N_STATES = 8;
const MIN_NURSING_HOMES_FOR_STATE = 50;
const MIN_RATED_FOR_COMPARISON = 20;
const CHOW_URL = "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/hospital-change-of-ownership";
const SNF_CHOW_URL = "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership";
const ALL_OWNERS_URL = "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/hospital-all-owners";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-US");
const title = (name: string) => name; // names are shown exactly as CMS records them

const OWNERSHIP_LIMITATIONS = [
  "A change of ownership keeps appearing in CMS's files for 12-18 months after it takes effect, so the most recent year is always incomplete and is compared only with the prior year as it was reported at the same point.",
  "Buyers are counted by the legal name on each enrollment; one health system or chain can buy under several names, so totals per organization are understated.",
];

function recentWindow(snapshot: ChowSnapshot, kind: FacilityKind): { from: number; to: number } {
  const versionYear = Number(snapshot.versions[kind].periodStart.slice(0, 4));
  return { from: versionYear - RECENT_YEARS, to: versionYear - 1 };
}

const inWindow = (c: OwnershipChange, w: { from: number; to: number }) => {
  const y = Number(c.effectiveDate.slice(0, 4));
  return y >= w.from && y <= w.to;
};

function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function yearlySeries(snapshot: ChowSnapshot, kind: FacilityKind): { year: number; count: number }[] {
  const latestKey = Object.keys(snapshot.vintages)
    .filter((k) => k.startsWith(`${kind}|`))
    .sort()
    .at(-1);
  if (!latestKey) return [];
  const versionYear = Number(latestKey.split("|")[1].slice(0, 4));
  // Years reported at least 18 months after they ended; the newer ones are still filling in.
  return Object.entries(snapshot.vintages[latestKey])
    .map(([y, count]) => ({ year: Number(y), count }))
    .filter((p) => p.year >= 2016 && p.year <= versionYear - 2);
}

/** Star rating by CCN from the latest Hospital General Information snapshot. */
function starRatings(): { byCcn: Map<string, number>; date: string } | null {
  const files = listSnapshotFiles();
  if (files.length === 0) return null;
  const file = files[files.length - 1];
  const snapshot = loadSnapshot(file);
  const byCcn = new Map<string, number>();
  for (const row of snapshot.rows) {
    const star = Number(row.hospital_overall_rating);
    if (row.facility_id && !Number.isNaN(star)) byCcn.set(row.facility_id, star);
  }
  return { byCcn, date: snapshot.pulledAt.slice(0, 10) };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function hospitalChangesInsight(snapshot: ChowSnapshot): Insight | null {
  const version = snapshot.versions.hospital;
  const hospital = snapshot.changes.filter((c) => c.kind === "hospital");
  const window = recentWindow(snapshot, "hospital");
  const recent = hospital.filter((c) => inWindow(c, window));
  const lag = sameLagComparison(snapshot, "hospital");
  const series = yearlySeries(snapshot, "hospital");
  if (recent.length === 0 || !lag || series.length < 2) return null;

  const buyers = countBy(recent, (c) => c.buyerName).filter(([, count]) => count >= 2).slice(0, TOP_N_BUYERS);
  const types = countBy(recent, (c) => c.chowType);
  const cah = recent.filter((c) => /CRITICAL ACCESS/.test(c.providerType)).length;
  const lagChange = lag.count / lag.priorCount - 1;

  const ratings = starRatings();
  const acquiredStars = ratings ? [...new Set(recent.map((c) => c.ccn))].map((ccn) => ratings.byCcn.get(ccn)).filter((s): s is number => s !== undefined) : [];
  const allStars = ratings ? [...ratings.byCcn.values()] : [];
  const starNote =
    ratings && acquiredStars.length >= MIN_RATED_FOR_COMPARISON
      ? `Hospitals whose ownership changed in ${window.from}-${window.to} and have a current CMS overall star rating (${acquiredStars.length} of ${new Set(recent.map((c) => c.ccn)).size}) average ${mean(acquiredStars).toFixed(2)} stars, against ${mean(allStars).toFixed(2)} across all ${n(allStars.length)} rated hospitals. The rating is today's, after the change, so this describes which hospitals changed hands, not an effect of the change.`
      : null;

  const end = version.periodEnd;
  return validateInsight({
    id: `sig-provider-network-${end}-hospital-ownership-changes`,
    headline: `${n(lag.count)} hospital ownership changes took effect in ${lag.year} as of CMS's ${lag.version} release, ${lagChange < 0 ? "down" : "up"} ${pct(Math.abs(lagChange)).slice(1)} from ${n(lag.priorCount)} for ${lag.priorYear} at the same point; ${buyers.length ? `${title(buyers[0][0])} was the most active buyer in ${window.from}-${window.to} (${buyers[0][1]} hospitals)` : `no buyer acquired more than one hospital in ${window.from}-${window.to}`}.`,
    questionId: "Q039",
    signalType: "baseline",
    period: { start: "2016-01-01", end },
    population: "cross-population",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: Math.round(lagChange * 1000) / 10, unit: "percent", comparedTo: `${lag.priorYear} hospital ownership changes as reported in ${lag.priorVersion}`, delta: lag.count - lag.priorCount },
    drivers: [
      {
        description: `Hospital changes of ownership by effective year, as CMS reports them now (years at least 18 months past): ${series.map((p) => `${p.year} ${p.count}`).join(", ")}. At the same reporting lag: ${lag.year} ${lag.count} (${lag.version}) against ${lag.priorYear} ${lag.priorCount} (${lag.priorVersion}). ${window.from}-${window.to}: ${n(recent.length)} changes, ${types.map(([t, c]) => `${c} ${t.toLowerCase()}`).join(", ")}; ${cah} involved critical access hospitals.`,
        supportingEvidenceIds: ["ev-hospital-chow"],
        relationship: "correlation",
      },
      ...(buyers.length
        ? [
            {
              description: `Buyers with more than one hospital ownership change in ${window.from}-${window.to}, by legal name on the enrollment: ${buyers.map(([name, count]) => `${title(name)} ${count}`).join("; ")}.`,
              supportingEvidenceIds: ["ev-hospital-chow"],
              relationship: "correlation" as const,
            },
          ]
        : []),
      ...(starNote ? [{ description: starNote, supportingEvidenceIds: ["ev-hospital-chow", "ev-hgi-stars"], relationship: "correlation" as const }] : []),
    ],
    businessRelevance:
      "Hospital ownership changes reshape who a plan negotiates with: an acquired hospital usually moves onto the buyer's contracts and rates. Knowing which systems are buying, and where, is an early read on contracting leverage.",
    evidence: [
      { id: "ev-hospital-chow", sourceId: CHOW_SOURCE_ID, description: `CMS Hospital Change of Ownership, every change effective 2016 onward (${version.periodStart} to ${version.periodEnd} release), with each past quarterly release's counts for the same-lag comparison`, datasetVintage: end, url: CHOW_URL },
      ...(starNote && ratings ? [{ id: "ev-hgi-stars", sourceId: HGI_SOURCE_ID, description: "CMS Hospital General Information, current overall star rating, joined by CMS certification number", datasetVintage: ratings.date }] : []),
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale: "One year against one year at the same reporting lag; counts this small move a lot from year to year, so this is a baseline, not a trend.",
    freshness: { dataAsOf: end, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...OWNERSHIP_LIMITATIONS,
      "Covers changes CMS processed for Medicare-enrolled hospitals; deals that don't change the Medicare enrollment (for example a purchase of a parent company above the hospital) may not appear.",
      "Star ratings are from the current Hospital General Information file, not from before the change.",
    ],
    nextSignal: `CMS's next quarterly release will add more ${lag.year} changes; watch whether ${lag.year} ends above or below ${lag.priorYear} once both are fully reported.`,
    recommendedInternalValidation: "Check which of the acquired hospitals are in a plan's network and whether their contracts move to the buyer's terms.",
    sourceIds: starNote ? [CHOW_SOURCE_ID, HGI_SOURCE_ID] : [CHOW_SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: { label: "Hospital changes of ownership by effective year", unit: "changes", points: series.map((p) => ({ date: `${p.year}-12-31`, value: p.count })) },
    chart: buyers.length
      ? { type: "bar", title: `Most active hospital buyers, ${window.from}-${window.to}`, unit: "hospitals", bars: buyers.map(([name, count]) => ({ label: title(name), value: count })) }
      : { type: "bar", title: "Hospital changes of ownership by effective year", unit: "changes", orientation: "vertical", bars: series.map((p) => ({ label: String(p.year), value: p.count })) },
  });
}

async function snfChangesByStateInsight(snapshot: ChowSnapshot, ctx: AgentContext): Promise<Insight | null> {
  const window = recentWindow(snapshot, "snf");
  const recent = snapshot.changes.filter((c) => c.kind === "snf" && inWindow(c, window));
  const lag = sameLagComparison(snapshot, "snf");
  const history = combinedHistory(loadAllQuarters());
  const latestPos = history.at(-1);
  const homes = latestPos?.types.get("nursing-home");
  if (recent.length === 0 || !lag || !homes || !latestPos) return null;

  const byState = new Map(countBy(recent, (c) => c.state));
  const rows = [...homes.byState]
    .filter(([state, v]) => STATE_CODES.has(state) && v.providers >= MIN_NURSING_HOMES_FOR_STATE)
    .map(([state, v]) => ({ state, changes: byState.get(state) ?? 0, homes: v.providers, per100: ((byState.get(state) ?? 0) / v.providers) * 100 }));
  if (rows.length === 0) return null;
  const totalHomes = rows.reduce((s, r) => s + r.homes, 0);
  const totalChanges = rows.reduce((s, r) => s + r.changes, 0);
  const national = (totalChanges / totalHomes) * 100;
  const ranked = [...rows].sort((a, b) => b.per100 - a.per100);

  const describe = (r: (typeof rows)[number]) => `${r.changes} ownership changes across ${r.homes} nursing homes (${r.per100.toFixed(1)} per 100)`;
  const candidates: Candidate[] = rows.map((r) => ({ id: r.state, label: r.state, summary: describe(r), primaryMetric: r.per100 }));
  const { selections, source } = await selectNoteworthy(
    { candidates, topN: TOP_N_STATES, taskDescription: `skilled nursing facility ownership changes per 100 nursing homes by state, ${window.from}-${window.to}` },
    ctx
  );
  const rowByState = new Map(rows.map((r) => [r.state, r]));
  const selected = selections.map((s) => ({ row: rowByState.get(s.candidateId)!, rationale: s.rationale })).filter((s) => s.row);
  if (selected.length === 0) return null;

  const parents = countBy(
    recent.flatMap((c) => (snapshot.buyerOwners[c.buyerEnrollmentId] ?? []).map((owner) => ({ owner }))),
    (x) => x.owner
  ).slice(0, TOP_N_PARENTS);
  const withParent = recent.filter((c) => (snapshot.buyerOwners[c.buyerEnrollmentId] ?? []).length > 0).length;
  const lagChange = lag.count / lag.priorCount - 1;
  const end = snapshot.versions.snf.periodEnd;

  return validateInsight({
    id: `sig-provider-network-${end}-snf-ownership-changes-by-state`,
    headline: `${n(recent.length)} skilled nursing facilities changed owners in ${window.from}-${window.to}, ${national.toFixed(1)} for every 100 nursing homes nationally; ${ranked[0].state} had the highest rate (${ranked[0].per100.toFixed(1)} per 100), and ${lag.year} is running ${pct(lagChange)} against ${lag.priorYear} at the same reporting lag.`,
    questionId: "Q039",
    signalType: "baseline",
    period: { start: `${window.from}-01-01`, end },
    population: "cross-population",
    geography: { level: "state", code: "US-STATES", label: `${rows.length} states with at least ${MIN_NURSING_HOMES_FOR_STATE} nursing homes` },
    magnitude: { value: Math.round(national * 10) / 10, unit: "changes per 100 nursing homes", comparedTo: `active nursing homes in ${latestPos.quarter}` },
    drivers: [
      {
        description: `SNF ownership changes effective ${window.from}-${window.to} per 100 active nursing homes (${latestPos.quarter}): ${selected
          .map(({ row, rationale }) => `${row.state}: ${describe(row)}${source === "llm" ? ` - ${rationale}` : ""}`)
          .join("; ")}. At the same reporting lag: ${lag.year} ${lag.count} (${lag.version}) against ${lag.priorYear} ${lag.priorCount} (${lag.priorVersion}).${source === "llm" ? ` States shown were chosen by model-reasoned salience ranking over all ${rows.length}.` : ""}`,
        supportingEvidenceIds: ["ev-snf-chow", "ev-pos-homes"],
        relationship: "correlation",
      },
      ...(parents.length
        ? [
            {
              description: `Organizations on file as 5%-or-greater owners of the most buyers in ${window.from}-${window.to} (${n(withParent)} of ${n(recent.length)} buyers list an organization owner): ${parents.map(([name, count]) => `${title(name)} ${count}`).join("; ")}. Related entities of one chain can appear under separate names.`,
              supportingEvidenceIds: ["ev-snf-chow"],
              relationship: "correlation" as const,
            },
          ]
        : []),
    ],
    businessRelevance:
      "Nursing home ownership turns over far faster than hospital ownership, and a new owner can change staffing, quality and which plans a facility contracts with. States with high turnover are where post-acute networks need the closest watch.",
    evidence: [
      { id: "ev-snf-chow", sourceId: CHOW_SOURCE_ID, description: `CMS Skilled Nursing Facility Change of Ownership and its owner information file (${snapshot.versions.snf.periodStart} to ${end} release), with each past release's counts for the same-lag comparison`, datasetVintage: end, url: SNF_CHOW_URL },
      { id: "ev-pos-homes", sourceId: POS_SOURCE_ID, description: `CMS Provider of Services file, active nursing homes by state, ${latestPos.quarter}`, datasetVintage: latestPos.periodEnd },
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale: "A three-year count against today's nursing home count, from two public CMS files; not yet compared across periods by state.",
    freshness: { dataAsOf: end, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      ...OWNERSHIP_LIMITATIONS,
      "Rates divide changes over three years by today's nursing home count; a home that changed owners twice counts twice.",
      "Owners are the 5%-or-greater organization owners on file for each buyer today; individuals, trusts and public hospital districts that own nursing homes appear under their own names.",
    ],
    nextSignal: `Watch whether ${lag.year} ends above or below ${lag.priorYear} once both are fully reported, and whether the high-turnover states stay on top.`,
    recommendedInternalValidation: "Check contracted nursing homes in the high-turnover states for recent owner changes and any quality or staffing shift afterward.",
    sourceIds: [CHOW_SOURCE_ID, POS_SOURCE_ID],
    generatingAgent: AGENT_ID,
    chart: {
      type: "bar",
      title: source === "llm" ? `SNF ownership changes per 100 nursing homes, ${window.from}-${window.to}, ${selected.length} states selected as most noteworthy` : `SNF ownership changes per 100 nursing homes, ${window.from}-${window.to}`,
      unit: "per 100 nursing homes",
      bars: selected.map(({ row }) => ({ label: row.state, value: Math.round(row.per100 * 10) / 10 })).sort((a, b) => b.value - a.value),
    },
  });
}

interface PeRead {
  kind: FacilityKind;
  first: PrivateEquityMonth;
  latest: PrivateEquityMonth;
  facilities: number;
  firstFacilities: number;
  /** Owner links in the latest month with an association date on or after the first flagged month. */
  newLinks: number;
  links: number;
  owners: [string, number][];
}

function peRead(months: PrivateEquityMonth[], kind: FacilityKind): PeRead | null {
  const list = months.filter((m) => m.kind === kind);
  if (list.length === 0) return null;
  const first = list[0];
  const latest = list[list.length - 1];
  const facilities = new Set(latest.rows.map((r) => r[0])).size;
  const firstFacilities = new Set(first.rows.map((r) => r[0])).size;
  const newLinks = latest.rows.filter((r) => r[3] >= `${first.month}-01`).length;
  // Only organizations are named; an owner row with no organization name is a person.
  const owners = countBy(
    [...new Map(latest.rows.filter((r) => r[2] !== "").map((r) => [`${r[0]}|${r[2]}`, r])).values()],
    (r) => r[2]
  );
  return { kind, first, latest, facilities, firstFacilities, newLinks, links: latest.rows.length, owners };
}

function privateEquityInsight(months: PrivateEquityMonth[], snapshot: ChowSnapshot | null): Insight | null {
  const hospital = peRead(months, "hospital");
  const snf = peRead(months, "snf");
  if (!hospital || !snf) return null;
  const snfSeries = months.filter((m) => m.kind === "snf").map((m) => ({ date: `${m.month}-01`, value: new Set(m.rows.map((r) => r[0])).size }));
  const window = snapshot ? recentWindow(snapshot, "snf") : null;
  const snfPeIds = new Set(snf.latest.rows.map((r) => r[0]));
  const recentSnfBuyers = snapshot && window ? snapshot.changes.filter((c) => c.kind === "snf" && inWindow(c, window)) : [];
  const peBuyers = recentSnfBuyers.filter((c) => snfPeIds.has(c.buyerEnrollmentId)).length;
  const topOwners = [...hospital.owners.map(([name, c]) => ({ name, c, kind: "hospitals" })), ...snf.owners.map(([name, c]) => ({ name, c, kind: "SNFs" }))]
    .sort((a, b) => b.c - a.c)
    .slice(0, 8);
  const describe = (r: PeRead, noun: string) =>
    `${noun}: ${r.facilities} with a private equity owner on file in ${r.latest.month}, against ${r.firstFacilities} in ${r.first.month} when the field first appeared; ${r.newLinks} of ${r.links} private equity owner links began in ${r.first.month} or later, the rest were older ownership newly reported`;
  const end = snf.latest.month > hospital.latest.month ? snf.latest.month : hospital.latest.month;
  // The monthly release covers the whole month, so the period ends on its last day.
  const endDate = new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const mostlyOlder = hospital.newLinks + snf.newLinks < (hospital.links + snf.links) / 2;

  return validateInsight({
    id: `sig-provider-network-${endDate}-private-equity-owners`,
    headline: `${n(hospital.facilities)} hospitals and ${n(snf.facilities)} skilled nursing facilities report a private equity owner to Medicare as of ${end}; ${mostlyOlder ? "most of the rise since CMS added the field is older ownership being reported, not new deals" : "most private equity owner links on file began after CMS added the field"}${window ? `, and ${peBuyers} of the ${n(recentSnfBuyers.length)} nursing homes that changed owners in ${window.from}-${window.to} now report one` : ""}.`,
    questionId: "Q041",
    signalType: "baseline",
    period: { start: `${snf.first.month}-01`, end: endDate },
    population: "cross-population",
    geography: { level: "national", code: "US", label: "United States" },
    magnitude: { value: hospital.facilities + snf.facilities, unit: "facilities", comparedTo: `hospitals and SNFs reporting a private equity owner when the field first appeared (${hospital.firstFacilities + snf.firstFacilities})` },
    drivers: [
      {
        description: `${describe(hospital, "Hospitals")}. ${describe(snf, "Skilled nursing facilities")}.`,
        supportingEvidenceIds: ["ev-all-owners"],
        relationship: "correlation",
      },
      {
        description: `Private equity owners on file for the most facilities (${end}), as CMS records each fund's name: ${topOwners.map((o) => `${title(o.name)} ${o.c} ${o.kind}`).join("; ")}.${window ? ` Of ${n(recentSnfBuyers.length)} SNF buyers with changes effective ${window.from}-${window.to}, ${peBuyers} now list a private equity owner.` : ""}`,
        supportingEvidenceIds: ["ev-all-owners", ...(window ? ["ev-chow-buyers"] : [])],
        relationship: "correlation",
      },
    ],
    businessRelevance:
      "Private equity ownership of hospitals and nursing homes draws regulatory attention and can change a facility's staffing, pricing and contracting posture. This is the first federal flag that names it directly, so it's the baseline to track.",
    evidence: [
      { id: "ev-all-owners", sourceId: PE_SOURCE_ID, description: `CMS Hospital All Owners and Skilled Nursing Facility All Owners, every monthly release since each added a private equity owner field (hospitals ${hospital.first.month}, SNFs ${snf.first.month}) through ${end}`, datasetVintage: endDate, url: ALL_OWNERS_URL },
      ...(window && snapshot ? [{ id: "ev-chow-buyers", sourceId: CHOW_SOURCE_ID, description: `CMS Skilled Nursing Facility Change of Ownership, buyers with changes effective ${window.from}-${window.to}`, datasetVintage: snapshot.versions.snf.periodEnd, url: SNF_CHOW_URL }] : []),
    ],
    contradictoryEvidence: [],
    confidence: "low",
    confidenceRationale: "The private equity field is new and self-reported, and most of its growth so far is reporting catching up, so the count can't yet be read as a trend.",
    freshness: { dataAsOf: endDate, generatedAt: new Date().toISOString(), isStale: false },
    limitations: [
      "Facilities report their own owner types; a private equity firm that owns through a holding company or operating company may not be flagged, so these counts are a floor, not the full extent of private equity ownership.",
      "Months before the field existed can't be compared, so the history starts when CMS added it.",
      "Private equity firms often hold facilities through several fund entities; each fund name is counted separately as CMS records it.",
      ...(window ? ["Owners are as of the latest month, not at the time of each ownership change."] : []),
    ],
    nextSignal: "Watch the count of private equity owner links with a recent start date: once late reporting catches up, that is the measure of new private equity acquisitions.",
    recommendedInternalValidation: "Flag contracted hospitals and nursing homes with a private equity owner on file and review their recent rate requests and quality scores.",
    sourceIds: window ? [PE_SOURCE_ID, CHOW_SOURCE_ID] : [PE_SOURCE_ID],
    generatingAgent: AGENT_ID,
    series: { label: "Skilled nursing facilities reporting a private equity owner", unit: "facilities", points: snfSeries },
    chart: {
      type: "bar",
      title: `Private equity owners by facilities on file, ${end}`,
      unit: "facilities",
      bars: topOwners.map((o) => ({ label: `${title(o.name)} (${o.kind})`, value: o.c })),
    },
  });
}

export async function buildOwnershipInsights(ctx: AgentContext): Promise<Insight[]> {
  const snapshot = loadLatestChowSnapshot();
  const out: Insight[] = [];
  if (snapshot) {
    const hospital = hospitalChangesInsight(snapshot);
    if (hospital) out.push(hospital);
    const snf = await snfChangesByStateInsight(snapshot, ctx);
    if (snf) out.push(snf);
  }
  const pe = privateEquityInsight(loadPrivateEquityMonths(), snapshot);
  if (pe) out.push(pe);
  return out;
}
