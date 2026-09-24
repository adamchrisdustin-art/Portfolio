import { describe, expect, it } from "vitest";
import { assessWorkload, REAL_WORKLOAD_INPUTS } from "./workloadModel";

describe("assessWorkload", () => {
  it("using this repo's real traced inputs, confirms Max-subscription development is sufficient but production still needs a real key for scheduled runs", () => {
    const assessment = assessWorkload(REAL_WORKLOAD_INPUTS);
    expect(assessment.subscriptionSufficientForDevelopment).toBe(true);
    expect(assessment.apiKeyRequiredForProduction).toBe(true);
    // 1 call/sweep x 4 scheduled runs/year + 0 live-visitor calls = 4/year - a small, bounded number, not a production inference service.
    expect(assessment.callsPerYear).toBe(4);
  });

  it("a hypothetical live-visitor-triggered workload correctly flags a much larger call volume", () => {
    const assessment = assessWorkload({ ...REAL_WORKLOAD_INPUTS, liveDashboardCallsPerVisit: 1, expectedConcurrentUsers: 10 });
    expect(assessment.callsPerYear).toBeGreaterThan(3000);
  });

  it("zero scheduled runs and zero live calls means no API key is required at all", () => {
    const assessment = assessWorkload({ ...REAL_WORKLOAD_INPUTS, scheduledRunsPerYear: 0, liveDashboardCallsPerVisit: 0 });
    expect(assessment.apiKeyRequiredForProduction).toBe(false);
  });
});
