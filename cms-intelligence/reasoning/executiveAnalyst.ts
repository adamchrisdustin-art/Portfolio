/**
 * Executive-analyst reasoning step - the autonomous "what matters most
 * this month, and why" layer that runs after every domain agent has
 * produced its real, code-computed insights.
 *
 * Same split as selectNoteworthy.ts, one level up: code computes every
 * fact; the model only ranks, connects, and explains facts it's given.
 * Everything it writes is checked by grounding.ts before it can be
 * published, because monthly runs auto-publish with no human review
 * (Adam's 2026-09-25 decision). A finding or pattern that references an
 * insight id it wasn't given, or cites a number or carrier name not in
 * the facts, is dropped and recorded in `rejected` - never published,
 * never silently "fixed."
 */
import type { Insight } from "../intelligence/evidence/schema";
import type { ModelProvider } from "../providers/types";
import { checkGrounding } from "./grounding";

const MAX_TOP_FINDINGS = 5;
const MAX_PATTERNS = 3;
const MAX_TEXT_CHARS = 1200;
const MAX_DRIVER_CHARS = 700;

export interface RankedFinding {
  insightId: string;
  whyItMatters: string;
}

export interface CrossDomainPattern {
  insightIds: string[];
  pattern: string;
}

export interface RejectedItem {
  kind: "finding" | "pattern" | "briefing";
  reason: string;
  text: string;
}

export interface AnalystResult {
  source: "llm" | "none";
  model: string | null;
  topFindings: RankedFinding[];
  patterns: CrossDomainPattern[];
  briefing: string | null;
  rejected: RejectedItem[];
  /** Why the step produced nothing, when source is "none". */
  note?: string;
}

const SYSTEM_PROMPT = `You are the executive analyst for a healthcare-market intelligence system, advising the leadership team of a health plan or health system. Specialist agents have already computed every fact below from real public data (CMS, Federal Register, SEC, FDA, NIH, ClinicalTrials.gov). Your job is judgment, not calculation: decide what matters most to a healthcare leader this cycle, spot connections across domains, and explain why.

Rules - a response that breaks one is discarded:
- Use only the facts given. Copy every number exactly as written; never round, convert units, or compute new numbers (no sums, differences, or percentages of your own).
- Only reference insight ids that appear in the facts.
- Name a company only if that exact name appears in the facts.
- Correlation is not causation. A proposed rule is not a final rule. A baseline is not a trend. Respect each fact's confidence and limitations.
- Prefer facts marked newThisCycle when they are comparably important.`;

function factsPayload(insights: Insight[], changedSourceIds: string[]): string {
  const changed = new Set(changedSourceIds);
  return JSON.stringify(
    insights.map((i) => ({
      id: i.id,
      question: i.questionId,
      agent: i.generatingAgent,
      headline: i.headline,
      signalType: i.signalType,
      confidence: i.confidence,
      magnitude: i.magnitude,
      period: i.period,
      evidence: i.drivers.map((d) => d.description.slice(0, MAX_DRIVER_CHARS)),
      keyLimitation: i.limitations[0] ?? null,
      newThisCycle: i.sourceIds.some((s) => changed.has(s)),
    }))
  );
}

function userPrompt(facts: string, changedSourceIds: string[]): string {
  return `Sources with new data this cycle: ${changedSourceIds.length > 0 ? changedSourceIds.join(", ") : "none recorded"}.

Facts (JSON):
${facts}

Respond with ONLY a raw JSON object (no markdown fence, no prose):
{"topFindings": [{"insightId": "<id from facts>", "whyItMatters": "<1-2 sentences for a healthcare leader>"}],
 "patterns": [{"insightIds": ["<id>", "<id>"], "pattern": "<1-2 sentences connecting facts from different agents>"}],
 "briefing": "<3-5 sentence executive briefing>"}
Rank topFindings most important first, at most ${MAX_TOP_FINDINGS}. At most ${MAX_PATTERNS} patterns, each linking at least 2 insights from different agents; return [] if no genuine connection exists rather than forcing one.`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function groundingReason(text: string, facts: string): string | null {
  const g = checkGrounding(text, facts);
  if (g.grounded) return null;
  const parts = [];
  if (g.ungroundedNumbers.length > 0) parts.push(`numbers not in facts: ${g.ungroundedNumbers.join(", ")}`);
  if (g.ungroundedCarriers.length > 0) parts.push(`company names not in facts: ${g.ungroundedCarriers.join(", ")}`);
  return parts.join("; ");
}

function none(model: string | null, note: string): AnalystResult {
  return { source: "none", model, topFindings: [], patterns: [], briefing: null, rejected: [], note };
}

export async function runExecutiveAnalyst(
  insights: Insight[],
  changedSourceIds: string[],
  provider: ModelProvider | null
): Promise<AnalystResult> {
  if (!provider) return none(null, "No model provider configured.");
  if (insights.length === 0) return none(provider.name, "No insights to reason over.");

  const facts = factsPayload(insights, changedSourceIds);
  let raw: string | null = null;
  try {
    raw = await provider.generate({
      system: SYSTEM_PROMPT,
      user: userPrompt(facts, changedSourceIds),
      // The one judgment call a leader actually reads: think hard (Opus 5.5 defaults to medium), with room so thinking can't crowd out the answer.
      effort: "high",
      maxOutputTokens: 16000,
    });
  } catch {
    raw = null;
  }
  if (!raw) return none(provider.name, "Model call failed or returned nothing.");

  const parsed = parseJsonObject(raw);
  if (!parsed) return none(provider.name, "Model response was not a JSON object.");

  const validIds = new Set(insights.map((i) => i.id));
  const agentById = new Map(insights.map((i) => [i.id, i.generatingAgent]));
  const rejected: RejectedItem[] = [];

  const topFindings: RankedFinding[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(parsed.topFindings) ? parsed.topFindings : []) {
    const insightId = (entry as Record<string, unknown>)?.insightId;
    const why = (entry as Record<string, unknown>)?.whyItMatters;
    if (typeof insightId !== "string" || typeof why !== "string") continue;
    const text = why.trim().slice(0, MAX_TEXT_CHARS);
    if (!validIds.has(insightId)) {
      rejected.push({ kind: "finding", reason: `unknown insight id "${insightId}"`, text });
      continue;
    }
    if (seen.has(insightId)) continue;
    const reason = groundingReason(text, facts);
    if (reason) {
      rejected.push({ kind: "finding", reason, text });
      continue;
    }
    seen.add(insightId);
    topFindings.push({ insightId, whyItMatters: text });
    if (topFindings.length === MAX_TOP_FINDINGS) break;
  }

  const patterns: CrossDomainPattern[] = [];
  for (const entry of Array.isArray(parsed.patterns) ? parsed.patterns : []) {
    const ids = (entry as Record<string, unknown>)?.insightIds;
    const patternText = (entry as Record<string, unknown>)?.pattern;
    if (!Array.isArray(ids) || typeof patternText !== "string") continue;
    const text = patternText.trim().slice(0, MAX_TEXT_CHARS);
    const insightIds = Array.from(new Set(ids.filter((id): id is string => typeof id === "string")));
    const unknown = insightIds.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      rejected.push({ kind: "pattern", reason: `unknown insight id(s): ${unknown.join(", ")}`, text });
      continue;
    }
    if (new Set(insightIds.map((id) => agentById.get(id))).size < 2) {
      rejected.push({ kind: "pattern", reason: "does not connect insights from at least two different agents", text });
      continue;
    }
    const reason = groundingReason(text, facts);
    if (reason) {
      rejected.push({ kind: "pattern", reason, text });
      continue;
    }
    patterns.push({ insightIds, pattern: text });
    if (patterns.length === MAX_PATTERNS) break;
  }

  let briefing: string | null = null;
  if (typeof parsed.briefing === "string" && parsed.briefing.trim()) {
    const text = parsed.briefing.trim().slice(0, MAX_TEXT_CHARS);
    const reason = groundingReason(text, facts);
    if (reason) rejected.push({ kind: "briefing", reason, text });
    else briefing = text;
  }

  return { source: "llm", model: provider.name, topFindings, patterns, briefing, rejected };
}
