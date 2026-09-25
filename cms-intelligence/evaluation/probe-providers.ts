/**
 * Connectivity check before a billed run: one tiny call per configured
 * model ("reply OK", 16-token cap - well under a cent in total), printing
 * whether it worked and, if not, the provider's own error message. Same
 * env handling as run-salience-evaluation.ts.
 *
 *   npx tsx cms-intelligence/evaluation/probe-providers.ts
 */
import { configuredProviders } from "./configuredProviders";

async function main() {
  const providers = configuredProviders();
  if (providers.length === 0) {
    console.log("[probe] No ANTHROPIC_API_KEY or OPENAI_API_KEY configured.");
    return;
  }
  for (const provider of providers) {
    const start = Date.now();
    // Thinking models spend hidden tokens from the same cap, so give them room and ask for low effort.
    const text = await provider.generate({ system: "You are a connectivity check.", user: "Reply with exactly: OK", maxOutputTokens: 1024, effort: "low" });
    console.log(`[probe] ${provider.name}: ${text ? `OK (${Date.now() - start} ms): ${text.trim().slice(0, 40)}` : "FAILED - see the error above"}`);
  }
}

main().catch((err) => {
  console.error("[probe] failed:", err);
  process.exitCode = 1;
});
