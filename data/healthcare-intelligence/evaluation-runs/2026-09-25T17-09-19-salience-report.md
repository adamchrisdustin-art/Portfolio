# Salience Benchmark

The real per-agent salience prompts production sends (16 this run), each judged by production's own acceptance rule. **Accepted** = production would use the model's picks; a rejected answer falls back to the fixed ranking (safe, but the model added nothing). **Specific** = the reason cites a fact from its own candidate rather than something generic. Cost is estimated at ~4 characters per token.

| Model | Accepted | Specific reasons | Filled requested picks | Mean latency | Est. cost per monthly run | Rejection reasons |
|---|---|---|---|---|---|---|
| anthropic:claude-sonnet-5 | 94% | 91% | 100% | 5.3s | $0.1116 | ungrounded rationale (…) ×1 |
| anthropic:claude-opus-5-5 | 81% | 99% | 100% | 6.2s | $0.2377 | ungrounded rationale (…) ×3 |
