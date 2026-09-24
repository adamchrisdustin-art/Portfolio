/**
 * Model-provider abstraction - see docs/cms-intelligence/
 * PROJECT_BOUNDARY.md's "Model Router" diagram and Phase 6's provider
 * evaluation goal. Business logic (agents, orchestrator) depends only on
 * this interface, never on a specific provider's request/response shape -
 * that isolation is the entire point of this file.
 *
 * Unlike pipeline/analystAgent.ts (which inlines OpenAI's request shape
 * directly), every new agent in cms-intelligence/ goes through this
 * interface instead - see REPOSITORY_DISCOVERY.md's note that this is
 * genuinely new architecture, not a continuation of the pipeline/ pattern.
 */

export interface GenerateOptions {
  maxOutputTokens?: number;
  /** Short, task-specific instruction - each provider implementation maps this into its own request shape. */
  system: string;
  user: string;
}

export interface ModelProvider {
  /** Stable identifier, used in logs and in Insight.generatingAgent-adjacent provenance. */
  readonly name: string;
  /**
   * Returns the model's text output, or null if the call could not be
   * made (e.g. no API key) or failed. Never throws for a missing key -
   * that's the expected, cost-free default state, not an error - matching
   * pipeline/analystAgent.ts's existing "no key -> rule-based fallback" pattern.
   */
  generate(options: GenerateOptions): Promise<string | null>;
}
