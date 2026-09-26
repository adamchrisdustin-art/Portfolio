/**
 * "What changed": the lead list at the top of the Executive Pulse when no
 * reasoned run matches the committed data (Adam, 2026-09-25, after the
 * Phase 7 reviewer test found the fallback Pulse gave an executive
 * nothing to read first). Fixed rules, no model:
 * - only findings that describe a change (trend, anomaly, structural
 *   change, policy), never a static baseline;
 * - never stale data, and not the Market Catalysts event log;
 * - higher confidence first, then trend > anomaly > structural change >
 *   policy, then the Pulse's own order;
 * - at most 2 per agent, so one domain can't fill the list.
 * When the executive analyst's ranking is current, it replaces this list.
 */
import { layerForQuestion } from "../agents/dashboardLayers";
import type { Insight } from "../intelligence/evidence/schema";

const SIGNAL_PRIORITY: Partial<Record<Insight["signalType"], number>> = { trend: 0, anomaly: 1, "structural-change": 2, policy: 3 };
const CONFIDENCE = { high: 0, medium: 1, low: 2 } as const;
const PER_AGENT = 2;

export function leadFindings(insightsInPulseOrder: Insight[], limit = 6): Insight[] {
  const eligible = insightsInPulseOrder
    .map((insight, order) => ({ insight, order }))
    .filter(
      ({ insight }) =>
        SIGNAL_PRIORITY[insight.signalType] !== undefined &&
        insight.freshness.recency !== "stale" &&
        !insight.freshness.isStale &&
        layerForQuestion(insight.questionId) !== "market-catalysts"
    )
    .sort(
      (a, b) =>
        CONFIDENCE[a.insight.confidence] - CONFIDENCE[b.insight.confidence] ||
        SIGNAL_PRIORITY[a.insight.signalType]! - SIGNAL_PRIORITY[b.insight.signalType]! ||
        a.order - b.order
    );
  const perAgent = new Map<string, number>();
  const picked: Insight[] = [];
  for (const { insight } of eligible) {
    const count = perAgent.get(insight.generatingAgent) ?? 0;
    if (count >= PER_AGENT) continue;
    perAgent.set(insight.generatingAgent, count + 1);
    picked.push(insight);
    if (picked.length === limit) break;
  }
  return picked;
}
