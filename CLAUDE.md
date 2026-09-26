# CLAUDE.md — adamdustin.me

Read alongside `ROADMAP.md` (source of truth for scope/sequencing) and `Adam_Dustin_Career_Knowledge_Base.md` (imported below). Global rules (~/.claude/CLAUDE.md — context/model routing, handoffs, push checklist) apply here too.

@Adam_Dustin_Career_Knowledge_Base.md
@ROADMAP.md

## What this is
Portfolio site for Adam Dustin: RevOps/Deal Desk/Salesforce case studies + hands-on data/agentic AI projects.

## Site structure
Three pages: **Home** (skills/expertise overview, not full resume — pillars: Deal Desk & Revenue Ops / Salesforce & Systems Admin / BI & Analytics / Data Pipelines & Emerging AI), **Portfolio** (growing card grid — Salesforce playground + Slack assistant, CMS market intelligence agents, Snowflake badges), **Contact** (email/LinkedIn/resume; Formspree free tier if a form is added, not a paid service).

## Tech stack
Next.js (App Router), plain CSS — Vercel/Netlify free tier — Porkbun DNS. Dashboards: Streamlit Community Cloud, iframe-embedded (`?embed=true` — Cloud doesn't support custom domains, so iframe is correct). Data: GitHub Actions cron, DuckDB/SQLite, Node/TypeScript (`pipeline/` — no Python on build machine). CRM: Salesforce Developer Edition, synthetic data only. v1 CMS agents run OpenAI gpt-4o-mini (Claude swap-in planned v2). Snowflake: free Hands-On Essentials badges only. Full CMS Intelligence docs: `docs/cms-intelligence/`, start at `00_README_START_HERE.md` / `MANIFEST.md`.

## Budget guardrails
<$100/year target. Default model: Haiku (Claude) / gpt-4o-mini (OpenAI) — escalate only with a specific reasoning-quality reason. Exception: Healthcare Intelligence monthly run routes by measured benchmark results (`docs/cms-intelligence/MODEL_EVALUATION.md`, `COST_AND_OPERATING_MODEL.md`) — any future escalation needs the same kind of evidence, not prestige. Hard spend caps required before any agent goes public. No real employer/client data ever, anywhere public. Secrets in platform secret managers only, never committed.

## Agentic guardrails (Salesforce Slack/chat assistant)
Parse-then-confirm required before any Salesforce write (same for `pipeline/projectCardAgent.ts` → draft only, never direct into `lib/projects.ts`). Integration user scoped to specific objects/fields, not admin-level. Log every proposed/executed change. Public chat needs a rate limit/gate.

## Content/positioning rules
Apply to site copy, not just resume — full rules live in the imported knowledge base above (R-Studio framing, SQL/SOQL/Python attribution level, PG Forsta tool history, leadership-through-gaps phrasing, WSU inclusion, healthcare payer/provider positioning, target title — see its "Gaps" section).

## Carrier-naming rule (CMS Intelligence)
Real carrier names OK only as genuine sourced findings — never fabricated or implying proprietary access. See `docs/cms-intelligence/EVIDENCE_MODEL.md`.

## Chart conventions
Use the `dataviz` skill for anything chart/dashboard-related. Project spec: `docs/cms-intelligence/DASHBOARD_BLUEPRINT.md`.

## Deployment
See `DEPLOYMENT.md`.

## Open items
- Whether WSU experience appears on the site
- CMS datasets beyond Hospital General Information (HCRIS Cost Reports — flat files, see `pipeline/pullCmsData.ts`; ONC/healthit.gov EMR adoption)
- `public/resume.pdf` — regenerate from the knowledge base whenever it changes materially
