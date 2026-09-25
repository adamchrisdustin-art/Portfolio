# Salience Benchmark

The real per-agent salience prompts production sends (16 this run), each judged by production's own acceptance rule. **Accepted** = production would use the model's picks; a rejected answer falls back to the fixed ranking (safe, but the model added nothing). **Specific** = the reason cites a fact from its own candidate rather than something generic. Cost is estimated at ~4 characters per token.

| Model | Accepted | Specific reasons | Filled requested picks | Mean latency | Est. cost per monthly run | Rejection reasons |
|---|---|---|---|---|---|---|
| anthropic:claude-haiku-4-5-20251001 | 88% | 79% | 100% | 4.2s | $0.0627 | ungrounded rationale (…) ×2 |
| anthropic:claude-sonnet-5 | 81% | 100% | 100% | 9.6s | $0.1067 | no output ×2; not valid JSON ×1 |
| anthropic:claude-opus-5-5 | 88% | 100% | 100% | 8.3s | $0.2425 | ungrounded rationale (…) ×2 |
| openai:gpt-4o-mini | 81% | 86% | 100% | 3.2s | $0.0078 | invented candidate id "…" ×3 |
| openai:gpt-6-luna | 100% | 87% | 100% | 6.9s | $0.0057 | none |
| openai:gpt-6-sol | 100% | 97% | 100% | 7.8s | $0.1093 | none |
