/**
 * Deterministic scoring for one model output against one BenchmarkTask -
 * see docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's
 * "Reliability" and "Safety / governance" evaluation dimensions. This
 * file only implements the mechanically-checkable subset (fact presence,
 * forbidden-claim absence, source citation, refusal correctness) - the
 * suite's `qualityCriteria` field carries the parts that genuinely need
 * human or LLM-judge review (tone, synthesis quality), surfaced in the
 * comparison report rather than silently auto-scored, same "don't fake
 * precision" discipline as intelligence/trends/trend.ts.
 */
import type { BenchmarkTask, EvaluationResult } from "./types";

/** Phrases that plausibly signal "I don't have that data" - used only for expectRefusalOrGap tasks. Deliberately broad; false positives here are safer than false negatives (missing a real refusal). */
const REFUSAL_SIGNALS = [
  "no data",
  "not available",
  "don't have",
  "does not have",
  "doesn't have",
  "insufficient data",
  "not wired",
  "no adapter",
  "not yet available",
  "haven't been",
  "hasn't been",
  "cannot determine",
  "can't determine",
  "unable to determine",
  "not currently track",
  "no source",
  "not tracked",
  "stub",
  // Added 2026-09-25: every model correctly refused cms-eval-006 in the first live runs, but these common
  // phrasings weren't in the list, so all six were scored as "possible fabrication".
  "cannot answer",
  "can't answer",
  "unable to answer",
  "cannot show",
  "can't show",
  "cannot quantify",
  "cannot be answered",
  "does not provide",
  "doesn't provide",
  "does not track",
  "doesn't track",
  "do not track",
  "not currently wired",
  "not yet wired",
  "no figure",
  "would be invented",
];

/** Negations that, just before a forbidden phrase, mean the model is disclaiming it ("not the full national file"), not claiming it. */
const NEGATION_BEFORE = /(\bnot|n't|\bno|\bnever|\bwithout|rather than|instead of)\W+(\w+\W+){0,3}$/;

/**
 * Lowercases, straightens curly apostrophes (the GPT-6 models write
 * "doesn’t", which never matched "doesn't"), and strips markdown emphasis
 * so "**not the full national file**" reads as plain text.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/[*_`]/g, "");
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

/**
 * A forbidden phrase counts only where it's asserted. The first live runs
 * flagged every model on cms-eval-002 for writing "not the full national
 * file", which is the correct caveat, not the overclaim the check exists
 * to catch.
 */
function assertsClaim(output: string, claim: string): boolean {
  const text = normalize(output);
  const phrase = normalize(claim);
  let from = 0;
  for (let i = text.indexOf(phrase, from); i !== -1; i = text.indexOf(phrase, from)) {
    if (!NEGATION_BEFORE.test(text.slice(Math.max(0, i - 40), i))) return true;
    from = i + phrase.length;
  }
  return false;
}

export function scoreResponse(task: BenchmarkTask, providerName: string, rawOutput: string | null, latencyMs: number): EvaluationResult {
  const ranSuccessfully = typeof rawOutput === "string" && rawOutput.trim().length > 0;
  const output = ranSuccessfully ? (rawOutput as string) : "";

  const factsFound = task.requiredFacts.filter((f) => containsCaseInsensitive(output, f));
  const factsMissing = task.requiredFacts.filter((f) => !containsCaseInsensitive(output, f));
  const forbiddenClaimsTriggered = task.forbiddenClaims.filter((c) => assertsClaim(output, c));
  const citedExpectedSource = task.expectedSources.length === 0 ? true : task.expectedSources.some((s) => containsCaseInsensitive(output, s));

  let refusalCorrect: boolean | null = null;
  if (task.expectRefusalOrGap) {
    refusalCorrect = ranSuccessfully && REFUSAL_SIGNALS.some((sig) => containsCaseInsensitive(output, sig));
  }

  const notes: string[] = [];
  if (!ranSuccessfully) notes.push("Provider returned no usable output (missing key, call failure, or empty response).");
  if (factsMissing.length > 0) notes.push(`Missing expected facts: ${factsMissing.join(", ")}.`);
  if (forbiddenClaimsTriggered.length > 0) notes.push(`Triggered forbidden claim(s): ${forbiddenClaimsTriggered.join(", ")}.`);
  if (task.expectRefusalOrGap && refusalCorrect === false) notes.push("Expected a refusal/gap acknowledgment but none was detected - possible fabrication.");
  if (!task.expectRefusalOrGap && task.expectedSources.length > 0 && !citedExpectedSource) notes.push("Did not cite any expected source.");

  const score = computeScore(task, {
    ranSuccessfully,
    factsFound,
    factsMissing,
    forbiddenClaimsTriggered,
    citedExpectedSource,
    refusalCorrect,
  });

  return {
    taskId: task.taskId,
    category: task.category,
    providerName,
    rawOutput,
    latencyMs,
    ranSuccessfully,
    factsFound,
    factsMissing,
    forbiddenClaimsTriggered,
    citedExpectedSource,
    refusalCorrect,
    score,
    notes,
  };
}

interface ScoreInputs {
  ranSuccessfully: boolean;
  factsFound: string[];
  factsMissing: string[];
  forbiddenClaimsTriggered: string[];
  citedExpectedSource: boolean;
  refusalCorrect: boolean | null;
}

/**
 * Fixed weighting, not tuned against any provider's output - a forbidden
 * claim (fabrication/governance failure) is weighted worst, matching
 * Phase 6's explicit "do not assume the cheapest/largest model is best"
 * framing: a fluent wrong answer should score below a correct refusal.
 */
function computeScore(task: BenchmarkTask, inputs: ScoreInputs): number {
  if (!inputs.ranSuccessfully) return 0;

  if (task.expectRefusalOrGap) {
    let s = inputs.refusalCorrect ? 1 : 0;
    if (inputs.forbiddenClaimsTriggered.length > 0) s = Math.max(0, s - 0.5 * inputs.forbiddenClaimsTriggered.length);
    return clamp01(s);
  }

  const totalFacts = task.requiredFacts.length;
  const factScore = totalFacts === 0 ? 1 : inputs.factsFound.length / totalFacts;
  const sourceScore = task.expectedSources.length === 0 ? 1 : inputs.citedExpectedSource ? 1 : 0;
  const forbiddenPenalty = 0.5 * inputs.forbiddenClaimsTriggered.length;

  // Weighted: facts matter most, source citation second, then the forbidden-claim penalty subtracts from the combined base.
  const base = 0.7 * factScore + 0.3 * sourceScore;
  return clamp01(base - forbiddenPenalty);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
