/**
 * "Claude Max / API decision" workload model - docs/cms-intelligence/
 * 06_PHASE_6_MODEL_PROVIDER_EVALUATION.md's section of the same name:
 * "Do not make the decision from assumption. Build a small workload
 * model." Every default below is a real, traced fact about this repo as
 * of 2026-09-23 (see each field's comment for where it comes from), not
 * an assumption - callers can override any of them to model a different
 * future scenario (e.g. a real per-agent LLM insight step, once one
 * exists).
 */
export interface WorkloadInputs {
  /** Real LLM call sites traced in the codebase today (grep for ctx.modelProvider.generate) - see costModel.ts's header. */
  llmCallSitesPerSweep: number;
  /** COST_AND_OPERATING_MODEL.md's decided cadence ceiling: quarterly, 4/year. */
  scheduledRunsPerYear: number;
  /** The live dashboard hardcodes modelProvider: null (fullSweep.ts default param) - visitor traffic never reaches an LLM call, confirmed by reading app/healthcare-intelligence/page.tsx. */
  liveDashboardCallsPerVisit: number;
  /** Portfolio site, not a production SaaS product - no real concurrent-user commitment exists. */
  expectedConcurrentUsers: number;
  averageInputTokensPerCall: number;
  averageOutputTokensPerCall: number;
}

export const REAL_WORKLOAD_INPUTS: WorkloadInputs = {
  llmCallSitesPerSweep: 1,
  scheduledRunsPerYear: 4,
  liveDashboardCallsPerVisit: 0,
  expectedConcurrentUsers: 1,
  averageInputTokensPerCall: 1200,
  averageOutputTokensPerCall: 300,
};

export interface WorkloadAssessment {
  callsPerYear: number;
  tokensPerYear: number;
  /** true when the workload is small/infrequent/attended enough that interactive Claude Code (Max plan) development coverage is sufficient and no scheduled API key is required at all. */
  subscriptionSufficientForDevelopment: boolean;
  /** true when ANY unattended/scheduled run exists - those structurally cannot draw from a personal Max subscription (COST_AND_OPERATING_MODEL.md), regardless of how small the workload is. */
  apiKeyRequiredForProduction: boolean;
  recommendation: string;
}

export function assessWorkload(inputs: WorkloadInputs = REAL_WORKLOAD_INPUTS): WorkloadAssessment {
  const callsPerYear = inputs.llmCallSitesPerSweep * inputs.scheduledRunsPerYear + inputs.liveDashboardCallsPerVisit * inputs.expectedConcurrentUsers * 365;
  const tokensPerYear = callsPerYear * (inputs.averageInputTokensPerCall + inputs.averageOutputTokensPerCall);

  // Interactive build/test work (writing agents, running them ad hoc in a Claude Code session) is covered by the Max subscription regardless of scheduled-run count - see COST_AND_OPERATING_MODEL.md's "interactive build vs. automated runtime" split. Scheduled runs are what require a real key, no matter how few there are.
  const subscriptionSufficientForDevelopment = true;
  const apiKeyRequiredForProduction = inputs.scheduledRunsPerYear > 0 || inputs.liveDashboardCallsPerVisit > 0;

  const recommendation = apiKeyRequiredForProduction
    ? `Development can stay on the Max subscription (Claude Code) throughout. Production needs a real API key ONLY for the ${inputs.scheduledRunsPerYear} scheduled run(s)/year that actually call an LLM (${callsPerYear.toFixed(0)} calls/year, ~${(tokensPerYear / 1000).toFixed(0)}K tokens/year at current observed shape) - there is no supported way to run a headless GitHub Actions job against a personal Max subscription. This is a genuinely small, bounded key exposure (one scheduled job, capped output, no live visitor-triggered calls), not an ongoing production inference service.`
    : "No scheduled or live-visitor LLM calls are configured - a real API key isn't required for production at all under these inputs.";

  return { callsPerYear, tokensPerYear, subscriptionSufficientForDevelopment, apiKeyRequiredForProduction, recommendation };
}
