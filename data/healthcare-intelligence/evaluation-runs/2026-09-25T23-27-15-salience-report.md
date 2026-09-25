# Salience Benchmark

The real per-agent salience prompts production sends (25 this run), each judged by production's own acceptance rule. **Accepted** = production would use the model's picks; a rejected answer falls back to the fixed ranking (safe, but the model added nothing). **Specific** = the reason cites a fact from its own candidate rather than something generic. Cost is estimated at ~4 characters per token.

| Model | Accepted | Specific reasons | Filled requested picks | Mean latency | Est. cost per monthly run | Rejection reasons |
|---|---|---|---|---|---|---|
| anthropic:claude-haiku-4-5-20251001 | 96% | 96% | 100% | 4.1s | $0.1080 | ungrounded rationale (…) ×1 |
| anthropic:claude-sonnet-5 | 100% | 100% | 100% | 5.0s | $0.1963 | none |
| anthropic:claude-opus-5-5 | 96% | 100% | 100% | 5.4s | $0.4114 | not valid JSON ×1 |
| openai:gpt-4o-mini | 96% | 95% | 100% | 3.6s | $0.0141 | invented candidate id "…" ×1 |
| openai:gpt-6-luna | 100% | 94% | 100% | 6.6s | $0.0100 | none |
| openai:gpt-6-sol | 100% | 98% | 100% | 6.9s | $0.1945 | none |
