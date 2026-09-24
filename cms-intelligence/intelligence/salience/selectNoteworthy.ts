/**
 * Salience/triage reasoning layer - added 2026-09-23 after Adam pointed
 * out that every agent's "what's worth surfacing" logic was a fixed
 * top-N rule, so the same shape of signal gets surfaced every cycle
 * regardless of what's actually most notable in a given real pull.
 *
 * Deliberately keeps this project's standing "never let an LLM compute
 * or invent a fact" rule intact by splitting the two concerns an agent
 * used to conflate:
 *   1. Computing candidates - stays 100% deterministic code, unchanged.
 *      Every number in a Candidate's `summary` is still code-computed
 *      from real data, exactly as before.
 *   2. Selecting/explaining which candidates matter THIS cycle - this
 *      file. The model may only choose among and briefly explain the
 *      real candidates it's given; it is explicitly instructed never to
 *      introduce a new number, candidate, or claim - closer to how
 *      synthesis.ts already reasons over insights, one level earlier in
 *      the pipeline (before an Insight is built, not after).
 *
 * Same cost-gate shape as every other LLM call site in this repo
 * (AGENT_ARCHITECTURE.md's cross-cutting rule): with no configured
 * provider, this always falls back to the exact deterministic top-N
 * ranking every real agent already used before this file existed - zero
 * behavior change, zero cost, by default. Never throws - a malformed or
 * unparseable model response falls back to the same deterministic
 * ranking rather than breaking the calling agent (same "never throws"
 * posture as fullSweep.ts's per-agent isolation).
 */
import type { AgentContext } from "../../agents/types";

export interface Candidate {
  /** Stable id (e.g. a state code or provider-type name) - the only thing the model is allowed to reference back. */
  id: string;
  label: string;
  /** A real, code-generated, human-readable description of this candidate's computed numbers - never written by the model. */
  summary: string;
  /** The metric used for deterministic ranking (and as the fallback when no model is configured or its response can't be trusted). */
  primaryMetric: number;
}

export interface NoteworthySelection {
  candidateId: string;
  rationale: string;
}

export interface SelectNoteworthyOptions {
  candidates: Candidate[];
  topN: number;
  /** What's being ranked, e.g. "home health capacity signals by state" - goes into the model prompt, not into any Insight field directly. */
  taskDescription: string;
}

export interface SelectNoteworthyResult {
  selections: NoteworthySelection[];
  source: "llm" | "deterministic";
}

function deterministicSelection(candidates: Candidate[], topN: number): SelectNoteworthyResult {
  const ranked = [...candidates].sort((a, b) => b.primaryMetric - a.primaryMetric).slice(0, topN);
  return {
    source: "deterministic",
    selections: ranked.map((c) => ({
      candidateId: c.id,
      rationale: "Ranked by its primary metric - the highest available in this cycle's real data.",
    })),
  };
}

function parseModelSelections(raw: string, candidates: Candidate[], topN: number): NoteworthySelection[] | null {
  const validIds = new Set(candidates.map((c) => c.id));
  try {
    // Models sometimes wrap JSON in a markdown fence despite instructions not to - strip it defensively rather than failing outright.
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    const seen = new Set<string>();
    const selections: NoteworthySelection[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const candidateId = (entry as Record<string, unknown>).candidateId;
      const rationale = (entry as Record<string, unknown>).rationale;
      if (typeof candidateId !== "string" || typeof rationale !== "string") continue;
      // A candidateId the model invented (not in the real list given to it) invalidates trust in the whole response - never surface a fact this system can't trace back to a real candidate.
      if (!validIds.has(candidateId)) return null;
      if (seen.has(candidateId)) continue;
      seen.add(candidateId);
      selections.push({ candidateId, rationale: rationale.trim().slice(0, 300) });
    }
    if (selections.length === 0) return null;
    return selections.slice(0, topN);
  } catch {
    return null;
  }
}

export async function selectNoteworthy(options: SelectNoteworthyOptions, ctx: AgentContext): Promise<SelectNoteworthyResult> {
  const { candidates, topN, taskDescription } = options;

  // Nothing to reason about, or no room for judgment to matter - deterministic fallback is not just cheaper here, it's equally correct.
  if (!ctx.modelProvider || candidates.length <= topN) {
    return deterministicSelection(candidates, topN);
  }

  const candidateList = candidates.map((c) => `- id="${c.id}" | ${c.label}: ${c.summary}`).join("\n");
  const prompt = `Task: select the ${topN} most noteworthy of the following ${candidates.length} real candidates for "${taskDescription}", for an executive reader.\n\nCandidates:\n${candidateList}\n\nRespond with ONLY a raw JSON array (no markdown fence, no prose) of up to ${topN} objects: [{"candidateId": "<must exactly match an id above>", "rationale": "<one sentence, using only facts already given above>"}]. Never invent a candidate id, number, or fact not present above.`;

  let raw: string | null = null;
  try {
    raw = await ctx.modelProvider.generate({
      system:
        "You select and briefly explain which of a given set of real candidates is most noteworthy - you never invent a candidate, number, or fact. You only choose among and explain what's given to you.",
      user: prompt,
      maxOutputTokens: 500,
    });
  } catch {
    raw = null;
  }

  if (!raw) return deterministicSelection(candidates, topN);

  const parsed = parseModelSelections(raw, candidates, topN);
  if (!parsed) return deterministicSelection(candidates, topN);

  return { source: "llm", selections: parsed };
}
