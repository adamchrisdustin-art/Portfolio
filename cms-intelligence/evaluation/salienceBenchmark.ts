/**
 * Salience benchmark - measures models on the exact job they'd do in the
 * autonomous monthly run: each agent hands the model a list of real,
 * code-computed candidates and asks it to pick the noteworthy ones with a
 * one-sentence reason. Added 2026-09-25 because the general 12-task suite
 * (benchmarkSuite.ts) asks open-ended questions and never tested this.
 *
 * The prompts are captured from a real run of every agent over the
 * committed data - the same ~16 prompts production sends - and every
 * response is judged by production's own acceptance rule
 * (checkModelSelections). Nothing here is a hand-written test case.
 */
import { runFullSweep } from "../agents/orchestrator/fullSweep";
import {
  checkModelSelections,
  SALIENCE_EFFORT,
  SALIENCE_MAX_OUTPUT_TOKENS,
  SALIENCE_SYSTEM_PROMPT,
  type NoteworthySelection,
} from "../intelligence/salience/selectNoteworthy";
import type { ModelProvider } from "../providers/types";
import { getPricing } from "./costModel";

export interface SalienceCall {
  taskDescription: string;
  topN: number;
  prompt: string;
  /** Candidate id -> its full line in the prompt ("- id=... | label: summary"). */
  candidates: Record<string, string>;
  groundingSource: string;
}

export interface SalienceResult {
  taskDescription: string;
  rawOutput: string | null;
  latencyMs: number;
  accepted: boolean;
  rejectionReason: string | null;
  selections: NoteworthySelection[];
  /** Accepted selections whose rationale cites a fact from that candidate's own line, rather than something generic. */
  specificRationales: number;
  topN: number;
}

export interface SalienceAggregate {
  calls: number;
  acceptanceRate: number;
  rejectionReasons: Record<string, number>;
  specificityRate: number | null;
  fillRate: number | null;
  meanLatencyMs: number;
  estimatedCostUsd: number | null;
}

export interface SalienceRun {
  providerName: string;
  results: SalienceResult[];
  aggregate: SalienceAggregate;
}

function parseCall(prompt: string): SalienceCall | null {
  const taskDescription = prompt.match(/real candidates for "(.*)", for an executive reader/)?.[1];
  const topN = Number(prompt.match(/select the (\d+) most noteworthy/)?.[1]);
  const start = prompt.indexOf("Candidates:\n");
  const end = prompt.indexOf("\n\nRespond with ONLY");
  if (!taskDescription || !topN || start === -1 || end === -1) return null;
  const candidateList = prompt.slice(start + "Candidates:\n".length, end);
  const candidates: Record<string, string> = {};
  for (const line of candidateList.split("\n")) {
    const id = line.match(/^- id="([^"]*)" \| /)?.[1];
    if (id !== undefined) candidates[id] = line;
  }
  return { taskDescription, topN, prompt, candidates, groundingSource: `${taskDescription}\n${candidateList}` };
}

/** Runs every agent once with a recording stand-in for the model and returns the real salience prompts it was sent. */
export async function captureSalienceCalls(): Promise<SalienceCall[]> {
  const prompts: string[] = [];
  const recorder: ModelProvider = {
    name: "recorder",
    generate: async ({ system, user }) => {
      if (system === SALIENCE_SYSTEM_PROMPT) prompts.push(user);
      return null; // null -> production's deterministic fallback, so the sweep completes normally
    },
  };
  await runFullSweep({ modelProvider: recorder });
  return prompts.map(parseCall).filter((c): c is SalienceCall => c !== null);
}

function isSpecific(rationale: string, candidateLine: string): boolean {
  const label = candidateLine.replace(/^- id="[^"]*" \| /, "").split(":")[0].trim().toLowerCase();
  if (label.length > 0 && label.length <= 40 && rationale.toLowerCase().includes(label)) return true;
  const ownNumbers = new Set(candidateLine.match(/\d[\d,]*(?:\.\d+)?/g)?.map((n) => n.replace(/,/g, "")) ?? []);
  return (rationale.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).some((n) => n.replace(/,/g, "").length >= 2 && ownNumbers.has(n.replace(/,/g, "")));
}

export function scoreSalienceResponse(call: SalienceCall, rawOutput: string | null, latencyMs: number): SalienceResult {
  const base = { taskDescription: call.taskDescription, rawOutput, latencyMs, topN: call.topN };
  if (!rawOutput) return { ...base, accepted: false, rejectionReason: "no output", selections: [], specificRationales: 0 };
  const check = checkModelSelections(rawOutput, new Set(Object.keys(call.candidates)), call.topN, call.groundingSource);
  if (!check.ok) return { ...base, accepted: false, rejectionReason: check.reason, selections: [], specificRationales: 0 };
  return {
    ...base,
    accepted: true,
    rejectionReason: null,
    selections: check.selections,
    specificRationales: check.selections.filter((s) => isSpecific(s.rationale, call.candidates[s.candidateId])).length,
  };
}

function estimateCostUsd(providerName: string, results: SalienceResult[], calls: SalienceCall[]): number | null {
  const pricing = getPricing(providerName);
  if (!pricing) return null;
  // ~4 characters per token - an estimate, labeled as one in the report.
  const inputTokens = calls.reduce((s, c) => s + (SALIENCE_SYSTEM_PROMPT.length + c.prompt.length) / 4, 0);
  const outputTokens = results.reduce((s, r) => s + (r.rawOutput?.length ?? 0) / 4, 0);
  return (inputTokens / 1e6) * pricing.inputPerMillionUsd + (outputTokens / 1e6) * pricing.outputPerMillionUsd;
}

export function aggregateSalience(providerName: string, results: SalienceResult[], calls: SalienceCall[]): SalienceAggregate {
  const accepted = results.filter((r) => r.accepted);
  const selectionCount = accepted.reduce((s, r) => s + r.selections.length, 0);
  const rejectionReasons: Record<string, number> = {};
  for (const r of results) {
    if (r.rejectionReason) {
      const key = r.rejectionReason.replace(/"[^"]*"/, '"…"').replace(/\(.*\)/, "(…)");
      rejectionReasons[key] = (rejectionReasons[key] ?? 0) + 1;
    }
  }
  return {
    calls: results.length,
    acceptanceRate: results.length === 0 ? 0 : accepted.length / results.length,
    rejectionReasons,
    specificityRate: selectionCount === 0 ? null : accepted.reduce((s, r) => s + r.specificRationales, 0) / selectionCount,
    fillRate: accepted.length === 0 ? null : accepted.reduce((s, r) => s + r.selections.length / r.topN, 0) / accepted.length,
    meanLatencyMs: results.length === 0 ? 0 : results.reduce((s, r) => s + r.latencyMs, 0) / results.length,
    estimatedCostUsd: estimateCostUsd(providerName, results, calls),
  };
}

export async function runSalienceBenchmark(provider: ModelProvider, calls: SalienceCall[]): Promise<SalienceRun> {
  const results: SalienceResult[] = [];
  for (const call of calls) {
    const start = Date.now();
    let raw: string | null = null;
    try {
      raw = await provider.generate({
        system: SALIENCE_SYSTEM_PROMPT,
        user: call.prompt,
        maxOutputTokens: SALIENCE_MAX_OUTPUT_TOKENS,
        effort: SALIENCE_EFFORT,
      });
    } catch {
      raw = null;
    }
    results.push(scoreSalienceResponse(call, raw, Date.now() - start));
  }
  return { providerName: provider.name, results, aggregate: aggregateSalience(provider.name, results, calls) };
}

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);

export function buildSalienceReport(runs: SalienceRun[]): string {
  const lines = [
    "# Salience Benchmark",
    "",
    `The real per-agent salience prompts production sends (${runs[0]?.results.length ?? 0} this run), each judged by production's own acceptance rule. **Accepted** = production would use the model's picks; a rejected answer falls back to the fixed ranking (safe, but the model added nothing). **Specific** = the reason cites a fact from its own candidate rather than something generic. Cost is estimated at ~4 characters per token.`,
    "",
    "| Model | Accepted | Specific reasons | Filled requested picks | Mean latency | Est. cost per monthly run | Rejection reasons |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of runs) {
    const a = r.aggregate;
    const reasons = Object.entries(a.rejectionReasons).map(([k, v]) => `${k} ×${v}`).join("; ") || "none";
    lines.push(
      `| ${r.providerName} | ${pct(a.acceptanceRate)} | ${pct(a.specificityRate)} | ${pct(a.fillRate)} | ${(a.meanLatencyMs / 1000).toFixed(1)}s | ${a.estimatedCostUsd === null ? "unpriced" : `$${a.estimatedCostUsd.toFixed(4)}`} | ${reasons} |`
    );
  }
  return lines.join("\n") + "\n";
}
