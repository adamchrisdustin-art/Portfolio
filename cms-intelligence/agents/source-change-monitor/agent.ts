/**
 * Data Source & CMS Change Monitor agent - see docs/cms-intelligence/
 * AGENT_ARCHITECTURE.md section 11. Infrastructure agent: owns no
 * executive questions and never makes an LLM call, per
 * COST_AND_OPERATING_MODEL.md's explicit example of this exact agent.
 *
 * Phase 4 gives this agent a real implementation: `checkAllSources()`
 * generalizes pipeline/watcherAgent.ts's proven diffing pattern (via
 * cms-intelligence/data/sources/diff.ts) across every
 * "verified-implemented" entry in the source registry - today, the two
 * real datasets Phase 3/4 wired up. Its output is a diff report, not an
 * Insight - see AGENT_ARCHITECTURE.md's note that this agent's real
 * output isn't represented in EVIDENCE_MODEL.md's schema, which is for
 * executive findings, not internal source-freshness bookkeeping. run()
 * still satisfies the DomainAgent interface (returns []) for uniformity
 * with the other 11 agents; checkAllSources() is this agent's actual job.
 */
import { hasMaterialChange, diffRows, type RowDiff } from "../../data/sources/diff";
import { getSourceById, SOURCE_REGISTRY } from "../../data/sources/registry";
import {
  listSnapshotFiles as listHomeHealthSnapshots,
  loadSnapshot as loadHomeHealthSnapshot,
} from "../../data/adapters/homeHealthCareAgencies";
import {
  listSnapshotFiles as listHospitalSnapshots,
  loadSnapshot as loadHospitalSnapshot,
} from "../../data/adapters/hospitalGeneralInformation";
import type { Insight } from "../../intelligence/evidence/schema";
import type { AgentContext, DomainAgent } from "../types";

export interface SourceCheckResult {
  sourceId: string;
  status: "no-data-yet" | "baseline" | "unchanged" | "changed" | "unreachable";
  diff?: RowDiff<Record<string, unknown>>;
  message: string;
}

function checkHospitalSource(): SourceCheckResult {
  const sourceId = "cms:hospital-general-information";
  const files = listHospitalSnapshots();
  if (files.length === 0) return { sourceId, status: "no-data-yet", message: "No snapshot found." };
  if (files.length === 1) return { sourceId, status: "baseline", message: "Only one snapshot exists - baseline established." };

  const prev = loadHospitalSnapshot(files[files.length - 2]);
  const curr = loadHospitalSnapshot(files[files.length - 1]);
  const diff = diffRows(
    prev.rows as unknown as Record<string, unknown>[],
    curr.rows as unknown as Record<string, unknown>[],
    "facility_id",
    ["hospital_type", "hospital_ownership", "emergency_services", "hospital_overall_rating"]
  );
  return {
    sourceId,
    status: hasMaterialChange(diff) ? "changed" : "unchanged",
    diff,
    message: hasMaterialChange(diff)
      ? `${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} field changes.`
      : "No material change since the prior snapshot.",
  };
}

function checkHomeHealthSource(): SourceCheckResult {
  const sourceId = "cms:home-health-care-agencies";
  const files = listHomeHealthSnapshots();
  if (files.length === 0) return { sourceId, status: "no-data-yet", message: "No snapshot found." };
  if (files.length === 1) return { sourceId, status: "baseline", message: "Only one snapshot exists - baseline established." };

  const prev = loadHomeHealthSnapshot(files[files.length - 2]);
  const curr = loadHomeHealthSnapshot(files[files.length - 1]);
  const diff = diffRows(
    prev.rows as unknown as Record<string, unknown>[],
    curr.rows as unknown as Record<string, unknown>[],
    "cms_certification_number_ccn",
    ["type_of_ownership", "quality_of_patient_care_star_rating"]
  );
  return {
    sourceId,
    status: hasMaterialChange(diff) ? "changed" : "unchanged",
    diff,
    message: hasMaterialChange(diff)
      ? `${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} field changes.`
      : "No material change since the prior snapshot.",
  };
}

/**
 * Checks every "verified-implemented" source in the registry. This is
 * the agent's real job - see the file header for why it isn't shaped as
 * DomainAgent.run(). Callers (e.g. the orchestrator, or a future
 * scheduled workflow) use this to decide whether any downstream agent's
 * expensive work is worth running this cycle, per
 * COST_AND_OPERATING_MODEL.md's gating requirement.
 */
export function checkAllSources(): SourceCheckResult[] {
  const results: SourceCheckResult[] = [];
  for (const source of SOURCE_REGISTRY) {
    if (source.verificationStatus !== "verified-implemented") continue;
    if (source.sourceId === "cms:hospital-general-information") results.push(checkHospitalSource());
    if (source.sourceId === "cms:home-health-care-agencies") results.push(checkHomeHealthSource());
  }
  return results;
}

export function isSourceRegistered(sourceId: string): boolean {
  return getSourceById(sourceId) !== undefined;
}

export const sourceChangeMonitorAgent: DomainAgent = {
  id: "data-source-cms-change-monitor",
  questionIds: [], // infrastructure agent - owns no executive questions, see AGENT_ARCHITECTURE.md section 11

  async run(_ctx: AgentContext): Promise<Insight[]> {
    return [];
  },
};
