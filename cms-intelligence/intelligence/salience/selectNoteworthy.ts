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
import { checkGrounding } from "../../reasoning/grounding";

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
  /**
   * Which extreme of primaryMetric is noteworthy - "highest" (default,
   * preserves every call site's original behavior) or "lowest". Added
   * after a real mismatch: commercial-marketplace's plan-availability
   * insight correctly headlines "ranges from 27 to 122" but its chart
   * only ever showed the highest-count (least interesting) areas,
   * because the old hardcoded highest-first ranking had no way to
   * express that fewer plans is the actual competitive-intensity signal.
   */
  direction?: "highest" | "lowest";
}

export interface SelectNoteworthyResult {
  selections: NoteworthySelection[];
  source: "llm" | "deterministic";
}

function deterministicSelection(candidates: Candidate[], topN: number, direction: "highest" | "lowest"): SelectNoteworthyResult {
  const ranked = [...candidates]
    .sort((a, b) => (direction === "lowest" ? a.primaryMetric - b.primaryMetric : b.primaryMetric - a.primaryMetric))
    .slice(0, topN);
  return {
    source: "deterministic",
    selections: ranked.map((c) => ({
      candidateId: c.id,
      rationale: `Ranked by its primary metric - the ${direction} available in this cycle's real data.`,
    })),
  };
}

export const SALIENCE_SYSTEM_PROMPT =
  "You select and briefly explain which of a given set of real candidates is most noteworthy - you never invent a candidate, number, or fact. You only choose among and explain what's given to you.";
/**
 * Raised from 500 on 2026-09-25: thinking models spend hidden thinking
 * tokens from this same budget, and in the salience benchmark Sonnet 5 at
 * its default effort thought through all 2,048 tokens before writing a
 * word. A ceiling, not a charge - billing is per token actually generated.
 */
export const SALIENCE_MAX_OUTPUT_TOKENS = 4096;
/** Picking among given candidates is a simple task - Anthropic's guidance is low effort for this kind of work. */
export const SALIENCE_EFFORT = "low" as const;

export type SelectionCheck = { ok: true; selections: NoteworthySelection[] } | { ok: false; reason: string };

/**
 * Production's acceptance test for a model's salience response - exported
 * so evaluation/salienceBenchmark.ts measures models against exactly the
 * rule they'd face live, not a copy of it.
 */
export function checkModelSelections(raw: string, validIds: Set<string>, topN: number, groundingSource: string): SelectionCheck {
  let parsed: unknown;
  try {
    // Models sometimes wrap JSON in a markdown fence despite instructions not to - strip it defensively rather than failing outright.
    const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "not a JSON array" };

  const seen = new Set<string>();
  const selections: NoteworthySelection[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidateId = (entry as Record<string, unknown>).candidateId;
    const rationale = (entry as Record<string, unknown>).rationale;
    if (typeof candidateId !== "string" || typeof rationale !== "string") continue;
    // A candidateId the model invented (not in the real list given to it) invalidates trust in the whole response - never surface a fact this system can't trace back to a real candidate.
    if (!validIds.has(candidateId)) return { ok: false, reason: `invented candidate id "${candidateId}"` };
    if (seen.has(candidateId)) continue;
    // Rationales get published without human review in autonomous runs - one that cites a number or carrier name the candidates don't contain invalidates the whole response, same as an invented id.
    const grounding = checkGrounding(rationale, groundingSource);
    if (!grounding.grounded) {
      return { ok: false, reason: `ungrounded rationale (${[...grounding.ungroundedNumbers, ...grounding.ungroundedCarriers].join(", ")})` };
    }
    seen.add(candidateId);
    selections.push({ candidateId, rationale: rationale.trim().slice(0, 300) });
  }
  if (selections.length === 0) return { ok: false, reason: "no usable selections" };
  return { ok: true, selections: selections.slice(0, topN) };
}

export async function selectNoteworthy(options: SelectNoteworthyOptions, ctx: AgentContext): Promise<SelectNoteworthyResult> {
  const { candidates, topN, taskDescription, direction = "highest" } = options;

  // Nothing to reason about, or no room for judgment to matter - deterministic fallback is not just cheaper here, it's equally correct.
  if (!ctx.modelProvider || candidates.length <= topN) {
    return deterministicSelection(candidates, topN, direction);
  }

  const candidateList = candidates.map((c) => `- id="${c.id}" | ${c.label}: ${c.summary}`).join("\n");
  const directionNote = direction === "lowest" ? " A LOWER primary-metric value is the noteworthy signal here, not a higher one." : "";
  const prompt = `Task: select the ${topN} most noteworthy of the following ${candidates.length} real candidates for "${taskDescription}", for an executive reader.${directionNote}\n\nCandidates:\n${candidateList}\n\nRespond with ONLY a raw JSON array (no markdown fence, no prose) of up to ${topN} objects: [{"candidateId": "<must exactly match an id above>", "rationale": "<one sentence, using only facts already given above>"}]. Never invent a candidate id, number, or fact not present above.`;

  let raw: string | null = null;
  try {
    raw = await ctx.modelProvider.generate({
      system: SALIENCE_SYSTEM_PROMPT,
      user: prompt,
      maxOutputTokens: SALIENCE_MAX_OUTPUT_TOKENS,
      effort: SALIENCE_EFFORT,
    });
  } catch {
    raw = null;
  }

  if (!raw) return deterministicSelection(candidates, topN, direction);

  const check = checkModelSelections(raw, new Set(candidates.map((c) => c.id)), topN, `${taskDescription}\n${candidateList}`);
  if (!check.ok) return deterministicSelection(candidates, topN, direction);

  return { source: "llm", selections: check.selections };
}
