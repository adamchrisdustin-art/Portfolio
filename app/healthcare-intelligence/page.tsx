import type { Metadata } from "next";
import { LAYER_LABELS } from "@/cms-intelligence/agents/dashboardLayers";
import { runFullSweep } from "@/cms-intelligence/agents/orchestrator/fullSweep";
import { buildAnalyticsOverview } from "@/cms-intelligence/analytics/overview";
import { currentReasonedRun } from "@/cms-intelligence/reasoning/monthlyRun";
import AnalyticsExplorer from "@/components/AnalyticsExplorer";
import InsightCard from "@/components/InsightCard";
import EmptyLayerState from "@/components/EmptyLayerState";
import StatTile from "@/components/charts/StatTile";

export const metadata: Metadata = {
  title: "Healthcare Intelligence Dashboard",
  description:
    "A multi-agent executive intelligence system built on public CMS data - evidence-backed insights, traceable to source, never fabricated.",
};

const LAYER_EMPTY_REASONS: Record<string, string> = {
  "reimbursement-provider-economics":
    "This layer's agent tracks CMS rule-making (Federal Register, fee schedules) - a live data source hasn't been wired to it yet.",
  "policy-program-watch":
    "This layer's agent watches the Federal Register for CMS rules - no documents matched its most recent pull window.",
  "emerging-signals":
    "This layer synthesizes findings across the other layers - it needs at least two independent real signals to compare, and there isn't enough real data yet to do that honestly.",
};

export default async function HealthcareIntelligencePage() {
  // A saved autonomous run is used only while it describes exactly the committed data (see monthlyRun.ts); otherwise the zero-cost deterministic sweep.
  const reasoned = currentReasonedRun();
  const sweep = reasoned?.sweep ?? (await runFullSweep());
  const analyst = reasoned?.analyst.source === "llm" ? reasoned.analyst : null;
  const analyticsOverview = buildAnalyticsOverview();
  const failedAgents = sweep.agentStatuses.filter((s) => !s.ok);
  const insightById = new Map(sweep.allInsights.map((i) => [i.id, i]));
  const reasonedOn = reasoned ? reasoned.generatedAt.slice(0, 10) : null;

  // The analyst's ranking leads when there is one; everything else follows by confidence.
  const analystRank = new Map((analyst?.topFindings ?? []).map((f, i) => [f.insightId, i]));
  const pulseInsights = [...sweep.allInsights].sort((a, b) => {
    const ra = analystRank.get(a.id) ?? Infinity;
    const rb = analystRank.get(b.id) ?? Infinity;
    if (ra !== rb) return ra - rb;
    const weight = { high: 3, medium: 2, low: 1 } as const;
    return weight[b.confidence] - weight[a.confidence];
  });

  const dashboardLayers: { key: keyof typeof sweep.insightsByLayer; label: string }[] = [
    { key: "market-growth", label: LAYER_LABELS["market-growth"] },
    { key: "claims-cost", label: LAYER_LABELS["claims-cost"] },
    { key: "reimbursement-provider-economics", label: LAYER_LABELS["reimbursement-provider-economics"] },
    { key: "provider-network", label: LAYER_LABELS["provider-network"] },
    { key: "policy-program-watch", label: LAYER_LABELS["policy-program-watch"] },
    { key: "emerging-signals", label: LAYER_LABELS["emerging-signals"] },
  ];

  return (
    <>
      <section className="container" style={{ padding: "56px 24px 32px" }}>
        <p className="eyebrow">Portfolio Project · In Progress</p>
        <h1 style={{ fontSize: "2rem", margin: "10px 0 12px" }}>Healthcare Intelligence Dashboard</h1>
        <p style={{ maxWidth: 700, color: "var(--text-muted)", marginBottom: 20 }}>
          A coordinated team of specialized agents that watches public healthcare data, decides what actually
          matters, and explains it in plain language — with every claim traceable back to its source. Built as a
          demonstration of agentic software architecture applied to a real executive-intelligence problem.
        </p>
      </section>

      <section className="container" style={{ padding: "32px 24px", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: 14 }}>How this works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              What it watches
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>
              Public datasets published by Medicare&apos;s administrator (CMS) — hospital directories, home health
              agency quality and spending data, and more being added over time. No private or proprietary data.
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              What the agents do
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>
              Think of it as a team of specialized reviewers, each focused on one part of the picture — market
              growth, provider networks, costs, policy. A calculator does the math; the reviewer explains what it
              means and why it&apos;s worth a leader&apos;s attention.
            </p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              How a claim gets traced
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.92rem" }}>
              Every card below has an &quot;Inspect evidence&quot; section — open it to see exactly which dataset
              produced the number, when that data was published, and the confidence level with a plain-language
              reason for it.
            </p>
          </div>
        </div>
      </section>

      <AnalyticsExplorer overview={analyticsOverview} />

      <section className="container" style={{ padding: "32px 24px 32px", borderTop: "1px solid var(--border)" }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Agent findings
        </p>
        <h2 style={{ fontSize: "1.3rem", margin: "0 0 16px" }}>What the agents flagged as worth your attention</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <StatTile label="Specialist agents run this cycle" value={String(sweep.agentStatuses.length)} />
          <StatTile label="Evidence-backed insights" value={String(sweep.allInsights.length)} />
          <StatTile label="Real data sources wired" value="10" />
          <StatTile
            label="Layers with real findings"
            value={`${Object.values(sweep.insightsByLayer).filter((l) => l.length > 0).length} / 6`}
          />
        </div>
      </section>

      {failedAgents.length > 0 && (
        <section className="container" style={{ padding: "0 24px" }}>
          <div className="card" style={{ padding: 16, borderColor: "#8a3a3a", fontSize: "0.88rem" }}>
            {failedAgents.length} agent(s) couldn&apos;t run this cycle: {failedAgents.map((a) => a.agentId).join(", ")}.
            Everything else below reflects the agents that did run successfully.
          </div>
        </section>
      )}

      <section className="container" style={{ padding: "32px 24px", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 6 }}>Executive Pulse</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 20 }}>
          {analyst
            ? "Ranked by the executive-analyst agent's judgment of what matters most to a healthcare leader this cycle, then by confidence."
            : "The highest-confidence findings across every layer, ranked — not a wall of competing metrics."}
        </p>
        <div data-testid="synthesis" className="card" style={{ padding: 18, marginBottom: 24, background: "var(--surface-2)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            {analyst ? `Executive briefing · reasoned autonomously on ${reasonedOn}` : "Synthesis this cycle"}
          </p>
          <p style={{ margin: 0, fontSize: "0.92rem", whiteSpace: "pre-line" }}>{analyst?.briefing ?? sweep.synthesis}</p>
          {analyst && analyst.topFindings.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: "16px 0 8px" }}>
                What matters most, and why
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: "0.9rem" }}>
                {analyst.topFindings.map((f) => (
                  <li key={f.insightId}>
                    <a href={`#${f.insightId}`}>{insightById.get(f.insightId)?.headline ?? f.insightId}</a>
                    <span style={{ color: "var(--text-muted)" }}> — {f.whyItMatters}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {analyst && analyst.patterns.length > 0 && (
            <>
              <p className="eyebrow" style={{ margin: "16px 0 8px" }}>
                Patterns across domains
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: "0.9rem" }}>
                {analyst.patterns.map((p) => (
                  <li key={p.insightIds.join("+")}>
                    {p.pattern}{" "}
                    <span style={{ color: "var(--text-muted)" }}>
                      (links{" "}
                      {p.insightIds.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <a href={`#${id}`}>{insightById.get(id)?.questionId ?? id}</a>
                        </span>
                      ))}
                      )
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {analyst && (
            <p style={{ margin: "14px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Reasoned by {reasoned?.models.analyst}; per-agent selections by {reasoned?.models.salience ?? "fixed ranking"}.
              Every number and company name above was checked against the agents&apos; real computed facts before
              publishing{analyst.rejected.length > 0 ? `; ${analyst.rejected.length} statement(s) that failed that check were dropped` : ""}.
            </p>
          )}
        </div>
        {pulseInsights.length === 0 ? (
          <EmptyLayerState reason="No agent has produced a finding yet this cycle." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            {pulseInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </section>

      {dashboardLayers.map(({ key, label }) => {
        const insights = sweep.insightsByLayer[key];
        return (
          <section key={key} className="container" style={{ padding: "32px 24px", borderTop: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: 16 }}>{label}</h2>
            {insights.length === 0 ? (
              <EmptyLayerState reason={LAYER_EMPTY_REASONS[key] ?? "A live data source hasn't been wired to this layer yet."} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
                {insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="container" style={{ padding: "48px 24px 72px", borderTop: "1px solid var(--border)" }}>
        <p className="eyebrow">Case study</p>
        <h2 style={{ fontSize: "1.5rem", margin: "10px 0 28px" }}>Why this project exists, and how it&apos;s built</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Problem</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Healthcare leadership teams have more data available than they have attention. The bottleneck isn&apos;t
              access to data — it&apos;s knowing which changes actually matter, and being able to trust the answer
              enough to act on it.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Approach</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              A coordinated system of specialized agents turns public data into evidence-backed executive
              intelligence — deterministic code handles the math (rates, trends, thresholds), and language-model
              reasoning is reserved for synthesis and interpretation, never for calculating a number that code can
              calculate more reliably.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Architecture</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", marginBottom: 10 }}>
              Dashboard → Executive Orchestrator → 12 domain specialist agents (market, claims, reimbursement,
              provider network, Medicare Advantage/Part D, Medicaid, Marketplace, policy, emerging signals,
              market/catalyst intelligence, plus two infrastructure agents for data-source monitoring and the
              shared semantic model) → data adapters → public sources (CMS program data plus SEC EDGAR, openFDA,
              NIH RePORTER, and ClinicalTrials.gov). A model-provider interface sits behind every agent&apos;s
              reasoning step, so the same system can run on different language models without changing any
              business logic.
            </p>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              {sweep.agentStatuses.length} agents ran this cycle, producing {sweep.allInsights.length} evidence-backed
              insight{sweep.allInsights.length === 1 ? "" : "s"} from real public data — every one traceable through
              the &quot;Inspect evidence&quot; drawer above.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Data</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Currently live: 6 CMS-focused sources — Hospital General Information, Home Health Care Agencies,
              Medicare Physician &amp; Other Practitioners (a 5-state sample, not the full national file), the
              Federal Register API filtered to CMS as the publishing agency, CMS&apos;s Medicare Advantage/Part D
              Monthly Enrollment by Plan file, and CMS&apos;s ACA Marketplace Rate PUF — plus 4 non-CMS sources behind
              the Market/Catalyst agent: SEC EDGAR 8-K filings for a fixed 6-company health-insurer watchlist,
              openFDA novel drug approvals, NIH RePORTER award notices, and ClinicalTrials.gov Phase 3 results
              postings. The Federal Register feed and the 4 Market/Catalyst sources each use a rolling 730-day
              (2-year) window, not full history — a real, live-verified choice: those sources&apos; own APIs support
              historical date-range queries, unlike CMS&apos;s Provider Data Catalog API, which exposes only the
              current dataset vintage (no historical-vintage parameter exists), so the CMS-program sources can only
              accumulate real history forward from each future pull. The Marketplace file exposes only category
              fields and an opaque issuer/plan identifier used solely as a count, never a carrier name; the MA/Part D
              file does name a real parent organization on every row, and this project surfaces that name only for a
              genuine, sourced finding (an enrollment ranking), never a fabricated or implied-proprietary claim (see
              &quot;Known limitations&quot; below). The first three CMS sources are public, no-registration CMS Provider
              Data Catalog / Datastore datasets; the rest are separate public federal/registry sources — chosen
              because each is directly fetchable and updates on a predictable cadence, which matters for a project
              run on a fixed budget and a monthly refresh schedule rather than a live production feed. Two
              independent CMS sources sharing the same states is also what makes the Emerging Signals cross-check
              below possible.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Intelligence</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              A single data point is never called a trend. A finding only earns that label once it holds across
              multiple periods, or a specific, cited event explains it — otherwise it&apos;s labeled a baseline, plainly.
              Confidence levels aren&apos;t a vibe — they&apos;re computed from whether a finding has enough history,
              persists, and is corroborated by an independent source, and every card shows its reasoning, not just a
              label. Every number is still computed by deterministic code, never an LLM — but which of several real,
              computed candidates is worth an executive&apos;s attention is a judgment call, so agents route that
              specific decision through a reasoning layer that can only choose among and briefly explain real
              candidates it&apos;s given, never invent one. Once a month, after the data refresh, the agents re-run
              with a real model and an executive-analyst agent ranks what matters most across every domain and
              looks for connections between them. Because that output publishes without a human review step,
              every number and company name a model writes is checked against the real computed facts first,
              and anything that doesn&apos;t trace back is dropped rather than published.{" "}
              {reasoned
                ? `The current briefing was reasoned on ${reasonedOn}.`
                : "No reasoned run matches the currently committed data yet, so this page is showing the fixed-ranking fallback."}
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Evaluation</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              The agent-reasoning layer runs behind a provider-agnostic interface, with Anthropic and OpenAI
              implementations. Each model is chosen from a live head-to-head evaluation, not a default: the same
              12-task suite, scored for accuracy, evidence fidelity, refusal behavior, source citation, latency,
              and cost, run through several Claude and GPT models. A cheaper model handles narrow per-agent picks;
              a stronger one handles the cross-domain executive reasoning where the evaluation showed real
              quality differences.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Future state</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Every data adapter in this system is built behind the same interface a real enterprise data source
              would implement — membership, claims, provider, reimbursement, pharmacy, and network. Swapping a
              public CMS adapter for an internal one wouldn&apos;t require changing the agents, the evidence model, or
              the dashboard — only the adapter itself.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>Known limitations</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", marginBottom: 10 }}>
              Stated plainly rather than left for a visitor to discover — a demo that hides its own gaps is less
              trustworthy than one that names them:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              <li>
                Medicaid/CHIP/Duals is a deliberate stub, not a gap being actively chased — Medicaid data (T-MSIS) is
                the most fragmented CMS source and was deprioritized on purpose.
              </li>
              <li>
                The model evaluation&apos;s own scorer was wrong on its first live runs. It counted &quot;not the full
                national file&quot; as an overclaim and missed several correctly worded refusals, so every model looked
                like it had fabricated. That was caught by reading the raw answers, then fixed and re-scored from
                the saved outputs. Automated evaluation needs the same auditing as the models it grades.
              </li>
              {!reasoned && (
                <li>
                  No autonomous reasoning run matches the currently committed data, so every ranking on this page is
                  the fixed deterministic fallback, not a model&apos;s judgment.
                </li>
              )}
              <li>
                The physician dataset is a 5-state sample, not the full national file; the Federal Register feed,
                and the 4 corporate/regulatory/research sources behind the Market/Catalyst agent, are each a rolling
                730-day (2-year) window, not full history — CMS&apos;s own program datasets (hospital counts,
                MA/Part D enrollment, Marketplace rates), by contrast, can only accumulate real history forward from
                each future pull, since CMS&apos;s own live API exposes no historical-vintage parameter to backfill
                from.
              </li>
              <li>
                Confidence scores read low across the board — genuinely, not a bug — because there&apos;s only about
                a week of real snapshot history behind them so far.
              </li>
              <li>
                No proprietary insurer data is used anywhere — every number below is public CMS data. A real
                carrier name (e.g. in the Medicare Advantage enrollment ranking below) only ever appears when it&apos;s
                a genuine, sourced finding computed from that public data, the same kind of reading a real industry
                directory publishes — never a fabricated claim or an implied look at any carrier&apos;s real internal
                systems.
              </li>
              <li>
                Every insight carries a &quot;contradictoryEvidence&quot; field in its schema, but no agent has
                populated it yet — named directly here rather than left as a silently unused field.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
