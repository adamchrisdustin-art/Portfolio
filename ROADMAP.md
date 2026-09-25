# adamdustin.me — Portfolio Roadmap

*A living roadmap for a personal portfolio site combining RevOps/Sales Ops case studies with hands-on data + agentic AI projects. Budget target: <$100/year.*

## Goals
- Showcase real, relevant experience (RevOps, Deal Desk, Salesforce admin, CS analytics), anchored in healthcare payer/provider/health-system markets, alongside forward-looking technical projects (agents, data pipelines).
- Keep recurring costs near zero — domain renewal is close to the only fixed cost.
- Build incrementally; this doc grows as projects ship.

---

## Track A — Site Skeleton
**Goal:** get adamdustin.me live fast, then layer projects in as they're built.

- [x] Scaffold site (Next.js, App Router)
- [x] Pages: Home / Portfolio / Contact
- [ ] Deploy to Vercel or Netlify (free tier)
- [ ] Point Porkbun DNS at the host
- [ ] Add `public/resume.pdf` (general-purpose, not tailored to one posting)
- [ ] Add first real project card once Track B produces something demoable

**Cost:** $0 beyond the domain itself.

---

## Track B — Salesforce Playground (highest relevance-per-hour)
**Goal:** demonstrate real Salesforce/RevOps skill on data you control, plus a conversational admin assistant as a differentiator.

- [ ] Create Salesforce Developer Edition org (free, permanent)
- [ ] Model sample data: opportunities, accounts, territories, approval flow — mirror real Deal Desk structure without real client data
- [ ] Build a Streamlit dashboard replicating the *shape* of the Eleos CS dashboards (client risk, NPS, renewals, NRR) against this synthetic data
- [ ] Deploy dashboard to Streamlit Community Cloud (public app, public repo)
- [ ] Embed via iframe (`?embed=true`) into a project page on adamdustin.me
- [ ] **Conversational admin assistant (Slack or web chat):**
  - [ ] Connected app / integration user scoped to specific objects & fields only
  - [ ] Parse-then-confirm pattern: model proposes structured change → user confirms → then write fires
  - [ ] Audit log of proposed + executed changes
  - [ ] Default to Haiku model; set hard spend cap in Anthropic Console before going live
  - [ ] Gate public access (session/message limits) or ship as a recorded demo for the public site, with a live version available on request

**Cost:** $0 (Salesforce Dev Edition, Streamlit Community Cloud) + a few $/month capped Claude API spend once the assistant is live.

---

## Track C — CMS Market Analysis + Agents (flagship / differentiator)
**Goal:** market analysis project (reimbursement by care setting, trends, bed size/provider counts, EMR vendor adoption) powered by agents that monitor and summarize updates — the site's most direct proof point for the healthcare payer/provider positioning.

- [x] Pick initial dataset: CMS Provider Data Catalog "Hospital General Information" (facility type, ownership, emergency services, overall rating) — verified live during implementation
- [x] Pull agent (`pipeline/pullCmsData.ts`) — fetches from the real CMS datastore API
- [x] Watcher agent (`pipeline/watcherAgent.ts`) — diffs consecutive snapshots on the fields that matter
- [x] Analyst agent (`pipeline/analystAgent.ts`) — rule-based brief by default, optional gpt-4o-mini read if `OPENAI_API_KEY` is set
- [x] GitHub Actions cron wiring (`.github/workflows/cms-pipeline.yml`) — weekly, commits data back to the repo
- [ ] Add HCRIS Cost Reports (reimbursement, bed size, provider counts) — ships as flat files, not a query API; needs its own ingestion approach, not yet implemented
- [ ] Add ONC/healthit.gov EMR/EHR vendor adoption by care setting
- [ ] Visualize in Streamlit, embed on site same as Track B
- [ ] Write up the project as a case study: why these datasets, what the agents do, what's next

**Cost:** GitHub Actions free tier (public repo) + capped OpenAI API spend if the LLM read is enabled, same discipline as Track B.

**Superseding plan (2026-09-23):** the CMS pipeline above is being expanded into a much larger "Healthcare Intelligence Executive Dashboard" project - a multi-agent (12 specialized agents), multi-dataset, multi-LLM-provider executive dashboard modeled on the kind of questions an Optum/UnitedHealthcare executive team would ask, built public-data-first (no proprietary/PHI data, ever). Full plan: `docs/cms-intelligence/` (`00_README_START_HERE.md` for the phase sequence, `00_MASTER_ORCHESTRATOR.md` for the full spec). This is a materially larger scope than the bullets above - see that plan's own Phase 1-7 breakdown rather than tracking it as a few more Track C checkboxes.

**Budget question resolved (2026-09-23, Phase 6 scaffolding):** Phase 6's multi-provider evaluation is bounded and cheap, not a material addition to the <$100/year guardrail. Traced against the actual code: this system has exactly one LLM call site (`cms-intelligence/agents/orchestrator/synthesis.ts`), gated and capped, called once per quarterly scheduled run — at current verified pricing (checked live 2026-09-23) that's a fraction of a cent per run, and the full 12-task Phase 6 benchmark suite through both Anthropic and OpenAI costs under $0.05 to actually run. See `docs/cms-intelligence/MODEL_EVALUATION.md` for the framework and the real numbers. The framework is built and tested (mocked, no spend); the live comparison run is a deliberate manual step, not yet taken, and doesn't need a revised budget ceiling to fit.

**Phase 7 (hardening/portfolio) underway (2026-09-24):** targeted testing gaps closed (routing table, 3 new source-monitoring quality checks covering the remaining fixture types), a minimal structured logger, a real CI workflow (`.github/workflows/ci.yml` — typecheck/lint/test/build/e2e on every push/PR, previously only manual), a Playwright e2e smoke suite (caught and fixed a real keyboard-accessibility gap across every chart's scrollable wrapper), and the case study's "Known limitations" section (kept current with each real change since). Same extended session: a 12th agent (Market/Catalyst Intelligence, 4 new non-CMS sources), new Provider & Network insights (star rating vs. quality outcomes, facility entries/exits), and a full round of real bug fixes from a live dashboard review (label clipping, a degenerate-tie chart, a mechanically-obvious correlation, a bar chart redesigned into a linked list) plus a live-verified 2-year historical window for the sources that support it. Still open: a live Phase 6 provider run (blocked on an API key) and retrofitting the salience layer into the remaining 6 real agents. See `docs/cms-intelligence/07_PHASE_7_HARDENING_TESTING_AND_PORTFOLIO.md` for the full checklist and `docs/cms-intelligence/MANIFEST.md`'s "Start here" for the current state in full.

---

## Track D — Snowflake Hands-On Essentials (credential layer, not a dependency)
**Goal:** legitimate, free Snowflake experience via Snowflake University's badge program — not a self-funded trial.

- [ ] Complete **Data Application Builders Workshop** badge (Streamlit + Python + Snowflake tables + GitHub + REST API — closest match to existing stack)
- [ ] Optional: **Data Engineering Workshop** badge (staging, external tables, UDFs — echoes PG Forsta pipeline work)
- [ ] Optional: **Data Science Workshop** badge (ML forecasting/classification, Cortex LLM playground — echoes statistical-modeling work)
- [ ] Add Credly badge(s) to site + LinkedIn
- [ ] Keep this separate from Track C's live pipeline unless/until there's a specific reason to run CMS data through Snowflake itself

**Cost:** $0 — each workshop provisions its own scoped trial account, no billing risk.

---

## Sequencing
1. **Site live** (Track A) — cheap, fast, don't let the domain sit blank
2. **Salesforce playground** (Track B) — fastest path to something directly relevant to target roles
3. **CMS agents** (Track C) — the differentiated, "ahead of the market" piece; pipeline is built, now needs deployment + a second dataset
4. **Snowflake badges** (Track D) — fold in opportunistically, not a blocker for anything else

## Cost Summary

| Item | Cost |
|---|---|
| Domain (Porkbun) | ~$10–15/yr |
| Site hosting (Vercel/Netlify) | $0 |
| GitHub public repo + Actions | $0 |
| Salesforce Developer Edition | $0 |
| Streamlit Community Cloud | $0 |
| Snowflake Hands-On Essentials | $0 |
| OpenAI API (gpt-4o-mini, capped, gated) | ~$0–5/mo |
| Claude API (Haiku-default, capped, gated, Track B) | ~$1–5/mo |
| **Total** | **~$25–75/year** |

## Guardrails (apply across all tracks)
- Hard spend caps set in the relevant provider console before any public-facing agent goes live
- Default to the cheapest capable model tier; escalate only where reasoning quality clearly matters
- No real employer/client data in any public repo or public app — synthetic/playground data only
- Secrets (Salesforce connected app credentials, API keys) live in platform secrets managers, never committed to the repo
- Confirm-before-write pattern for any agent action that modifies data or public-facing content

---

## Open items to fill in as tracks progress
- [ ] Finalize HCRIS ingestion approach (flat-file parsing vs. a hosted mirror)
- [ ] Decide public vs. gated access for the Salesforce admin assistant demo
- [ ] Case study write-ups for each shipped project
- [ ] Whether WSU experience appears on the site
