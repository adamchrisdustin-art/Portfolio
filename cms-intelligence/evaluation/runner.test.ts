import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "../providers/anthropic";
import { createOpenAIProvider } from "../providers/openai";
import { BENCHMARK_SUITE } from "./benchmarkSuite";
import { buildComparisonReport } from "./comparisonReport";
import { runSuite } from "./runner";

/**
 * Proves docs/cms-intelligence/06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's
 * acceptance criterion - "the same benchmark can be run through at least
 * two providers [...] with the same input and scoring logic" - using
 * this repo's real ModelProvider implementations (anthropic.ts,
 * openai.ts). fetch is mocked so this test never makes a real network
 * call or spends real API credit (see COST_AND_OPERATING_MODEL.md and
 * MANIFEST.md - no API key is configured anywhere for this project as
 * of 2026-09-23, and this test suite must stay that way).
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** A single generic canned answer that touches every task's required facts/refusal signals, reused for both mocked providers so scoring is genuinely comparable. */
function cannedAnswerFor(userPrompt: string): string {
  if (userPrompt.includes("Medicare Advantage members switched") || userPrompt.includes("recent change in Medicare Advantage enrollment") || userPrompt.includes("site-of-care shift")) {
    return "I don't have that data - no source is wired for this yet, so I can't provide a number.";
  }
  return "0.97 8,603 risk-adjusted 23% Diagnostic Radiology TX CA FL 79 Voluntary non-profit Proprietary 13 8 final proposed 0.74 5 states 330 medicare-physician-other-practitioners";
}

function mockFetch(shape: "anthropic" | "openai") {
  global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const userText: string = shape === "anthropic" ? body.messages?.[0]?.content ?? "" : body.input?.[1]?.content ?? "";
    const answer = cannedAnswerFor(userText);
    const responseBody =
      shape === "anthropic" ? { content: [{ type: "text", text: answer }] } : { output: [{ content: [{ text: answer }] }] };
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("runSuite across two real provider implementations", () => {
  it("runs the identical benchmark suite through Anthropic and OpenAI provider adapters with the same scoring logic", async () => {
    mockFetch("anthropic");
    const anthropicRun = await runSuite(createAnthropicProvider("fake-key-not-real"));
    expect(anthropicRun.results.length).toBe(BENCHMARK_SUITE.length);

    mockFetch("openai");
    const openaiRun = await runSuite(createOpenAIProvider("fake-key-not-real"));
    expect(openaiRun.results.length).toBe(BENCHMARK_SUITE.length);

    // Same canned answer through both providers -> same scoring logic should produce the same aggregate score.
    expect(anthropicRun.aggregate.meanScore).toBeCloseTo(openaiRun.aggregate.meanScore, 5);
    expect(anthropicRun.aggregate.totalRuns).toBe(openaiRun.aggregate.totalRuns);

    // The canned answer correctly declines on both refusal-required tasks, for both providers.
    expect(anthropicRun.aggregate.refusalAccuracy).toBe(1);
    expect(openaiRun.aggregate.refusalAccuracy).toBe(1);

    const report = buildComparisonReport([anthropicRun, openaiRun]);
    expect(report).toContain(anthropicRun.providerName);
    expect(report).toContain(openaiRun.providerName);
    expect(report.toLowerCase()).toContain("do not read this as declaring a universal winner");
  });

  it("never throws when the provider call fails, and scores that task 0", async () => {
    global.fetch = vi.fn(async () => new Response("server error", { status: 500 })) as unknown as typeof fetch;
    const run = await runSuite(createAnthropicProvider("fake-key-not-real"), [BENCHMARK_SUITE[0]]);
    expect(run.results[0].ranSuccessfully).toBe(false);
    expect(run.results[0].score).toBe(0);
  });
});
