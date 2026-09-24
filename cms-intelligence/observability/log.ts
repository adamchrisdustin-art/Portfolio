/**
 * Minimal structured operational logging - Phase 7's "log useful
 * operational information without exposing sensitive data" requirement.
 * Deliberately not a paid observability backend (Datadog/Sentry/etc.) -
 * this project's cost guardrail is $0 for infrastructure, so a single
 * structured JSON line to stdout (visible in Vercel/GitHub Actions logs
 * as-is) is the right scope, not a gap to fill later.
 *
 * Never logs raw API responses, request/response bodies, or secrets -
 * only the fields below, which are already either public (agentId,
 * sourceIds) or non-sensitive metadata (timing, pass/fail).
 */

export type ValidationResult = "passed" | "failed-validation" | "failed-other";

export interface AgentRunLogRecord {
  taskId: string;
  agentId: string;
  /** Model-provider name (see providers/types.ts), or null when no provider is configured. */
  provider: string | null;
  /**
   * Always null today - ModelProvider (providers/types.ts) exposes a
   * provider name but not a specific model string, so there is nothing
   * real to report here yet. Kept as an explicit field rather than
   * omitted, so a future provider that does expose it doesn't need a
   * schema change.
   */
  model: string | null;
  latencyMs: number;
  dataSourcesUsed: string[];
  success: boolean;
  validationResult: ValidationResult;
}

/** Emits one structured JSON line. Never throws - a logging failure must never break an agent sweep. */
export function logAgentRun(record: AgentRunLogRecord): void {
  try {
    console.log(
      JSON.stringify({
        event: "agent-run",
        ...record,
      })
    );
  } catch {
    // Logging is best-effort - swallow serialization failures rather than risk the caller.
  }
}
