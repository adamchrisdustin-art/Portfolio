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
