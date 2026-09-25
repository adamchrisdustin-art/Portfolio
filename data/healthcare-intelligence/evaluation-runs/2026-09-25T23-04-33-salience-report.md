# Salience Benchmark

The real per-agent salience prompts production sends (25 this run), each judged by production's own acceptance rule. **Accepted** = production would use the model's picks; a rejected answer falls back to the fixed ranking (safe, but the model added nothing). **Specific** = the reason cites a fact from its own candidate rather than something generic. Cost is estimated at ~4 characters per token.

| Model | Accepted | Specific reasons | Filled requested picks | Mean latency | Est. cost per monthly run | Rejection reasons |
|---|---|---|---|---|---|---|
| anthropic:claude-haiku-4-5-20251001 | 92% | 96% | 100% | 4.3s | $0.1076 | ungrounded rationale (…) ×2 |
| anthropic:claude-sonnet-5 | 100% | 100% | 100% | 5.5s | $0.1968 | none |
| anthropic:claude-opus-5-5 | 100% | 99% | 100% | 5.6s | $0.4115 | none |
| openai:gpt-4o-mini | 100% | 99% | 100% | 3.4s | $0.0141 | none |
| openai:gpt-6-luna | 56% | 100% | 100% | 8.8s | $0.0085 | no output ×11 |
| openai:gpt-6-sol | 0% | n/a | n/a | 0.0s | $0.1340 | no output ×25 |
