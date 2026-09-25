/**
 * Runs the benchmark suite through one ModelProvider and aggregates the
 * results - the mechanism behind Phase 6's acceptance criterion: "the
 * same benchmark can be run through at least two providers or two model
 * configurations with the same input and scoring logic." Depends only on
 * the ModelProvider interface (cms-intelligence/providers/types.ts), not
 * on any specific provider's request/response shape - the "critical
 * architecture principle" the phase doc states explicitly.
 */
import type { ModelProvider } from "../providers/types";
import { BENCHMARK_SUITE } from "./benchmarkSuite";
import { scoreResponse } from "./scorer";
import type { BenchmarkTask, EvaluationResult, ProviderAggregate, ProviderRunResult } from "./types";

/**
 * Raised from 400 on 2026-09-25: the first Opus 5.5 run wrote long,
 * formatted markdown and got cut off mid-answer before stating the facts
 * the scorer checks for, so the benchmark was measuring verbosity against
 * a cap, not reasoning quality. 1024 leaves room for every model tested
 * so far to finish.
 */
export const BENCHMARK_MAX_OUTPUT_TOKENS = 1024;

const SYSTEM_PROMPT =
  "You are a healthcare-market intelligence analyst. Answer using only the facts given in the context below - never invent a number, date, source, or company name. If the context doesn't contain enough information to answer, say so plainly rather than guessing. Never name a specific real health insurer.";

export async function runTask(provider: ModelProvider, task: BenchmarkTask): Promise<EvaluationResult> {
  const start = Date.now();
  let rawOutput: string | null = null;
  try {
    rawOutput = await provider.generate({
      system: SYSTEM_PROMPT,
      user: `Context:\n${task.context}\n\nQuestion: ${task.question}`,
      maxOutputTokens: BENCHMARK_MAX_OUTPUT_TOKENS,
    });
  } catch {
    rawOutput = null; // a provider failure is a reliability data point, not a thrown error - same "never throws" posture as fullSweep.ts
  }
  const latencyMs = Date.now() - start;
  return scoreResponse(task, provider.name, rawOutput, latencyMs);
}

export function aggregate(results: EvaluationResult[]): ProviderAggregate {
  const total = results.length;
  const successful = results.filter((r) => r.ranSuccessfully);
  const refusalTasks = results.filter((r) => r.refusalCorrect !== null);

  return {
    meanScore: total === 0 ? 0 : results.reduce((s, r) => s + r.score, 0) / total,
    schemaComplianceRate: total === 0 ? 0 : successful.length / total,
    forbiddenClaimRate: total === 0 ? 0 : results.filter((r) => r.forbiddenClaimsTriggered.length > 0).length / total,
    refusalAccuracy: refusalTasks.length === 0 ? null : refusalTasks.filter((r) => r.refusalCorrect === true).length / refusalTasks.length,
    sourceCitationRate: total === 0 ? 0 : results.filter((r) => r.citedExpectedSource).length / total,
    meanLatencyMs: total === 0 ? 0 : results.reduce((s, r) => s + r.latencyMs, 0) / total,
    totalRuns: total,
    failedRuns: total - successful.length,
  };
}

export async function runSuite(provider: ModelProvider, suite: BenchmarkTask[] = BENCHMARK_SUITE): Promise<ProviderRunResult> {
  const results: EvaluationResult[] = [];
  for (const task of suite) {
    results.push(await runTask(provider, task));
  }
  return { providerName: provider.name, results, aggregate: aggregate(results) };
}
