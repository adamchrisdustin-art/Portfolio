# CLAUDE.md — adamdustin.me

Project memory for Claude Code. Read this at session start alongside `ROADMAP.md` and `Adam_Dustin_Career_Knowledge_Base.md` (import below).

@Adam_Dustin_Career_Knowledge_Base.md
@ROADMAP.md

## What this project is
A personal portfolio site for Adam Dustin (adamdustin.me) combining a RevOps/Deal Desk/Salesforce case-study presence with hands-on data + agentic AI projects. Full plan lives in `ROADMAP.md` — treat that as the source of truth for scope and sequencing, this file is about *how* to build it.

## Site structure (decided)
Three pages: **Home / Portfolio / Contact**.

- **Home** — overview of skills, expertise, experience. NOT the full resume. Sections: hero positioning statement, expertise pillars (Deal Desk & Revenue Ops / Salesforce & Systems Admin / BI & Analytics / Data Pipelines & Emerging AI), condensed experience snapshot (one line per role), grouped skills strip, resume PDF download link.
- **Portfolio** — card grid of projects (Salesforce playground + Slack admin assistant, CMS market intelligence agents, Snowflake Hands-On Essentials badges). Designed to keep growing as new projects ship — don't build this as a fixed/static list.
- **Contact** — email + LinkedIn direct links, resume download. If a form is added, use Formspree free tier (50 submissions/month, no server-side code) rather than a paid form service.

## Tech stack
- Site: Next.js (App Router), plain CSS custom properties (no framework) — Vercel or Netlify (free tier) — Porkbun DNS
- Dashboards: Streamlit Community Cloud (free tier), embedded into project pages via `<iframe src="...streamlit.app/?embed=true">` — Community Cloud does not support custom top-level domains directly, iframe embedding is the correct approach, not a workaround
- Data: GitHub Actions (cron) — DuckDB/SQLite for the CMS pipeline (implemented in Node/TypeScript, not Python — Python isn't installed on the build machine; see `pipeline/`)
- CRM: Salesforce Developer Edition (free, permanent) — synthetic/playground data only, never real employer or client data
- Agents: v1 CMS watcher/analyst agents run on OpenAI (`pipeline/`, gpt-4o-mini, capped, gated behind `OPENAI_API_KEY`); Claude API / Agent SDK swap-in stays a planned v2
- Snowflake: only via Snowflake University's free Hands-On Essentials badge workshops (Data Application Builders, Data Engineering, Data Science) — not a self-funded trial

## Budget guardrails — enforce these, don't just note them
- Target: <$100/year total for the project (domain is the only truly fixed cost)
- Any Claude API usage in agents defaults to **Haiku**; escalate to Sonnet only where reasoning quality clearly requires it. For the OpenAI-based v1 CMS agents, the equivalent rule is gpt-4o-mini as the default, hardcoded — do not upgrade the model without a specific reasoning-quality reason.
- Hard spend caps must be set in the Anthropic Console (or platform.openai.com/settings/organization/limits for OpenAI) before any agent goes live publicly — flag if code is being written that would call an API without a cap already in place
- No real employer/client data in any public repo or public app, ever — Eleos Health and PG Forsta data stays inside those employers' own systems. Portfolio dashboards use Salesforce Developer Edition synthetic data only
- Secrets (Salesforce connected app credentials, API keys) go in the platform's secrets manager (Streamlit Secrets, Vercel/Netlify env vars, GitHub Actions secrets) — never committed to the repo, which is public

## Agentic feature guardrails (Salesforce Slack/chat assistant)
- Parse-then-confirm pattern is required: proposed change shown to the user before any Salesforce write fires — do not implement direct writes without a confirmation step. The same pattern applies to `pipeline/projectCardAgent.ts` (content, not CRM data): it only ever writes a reviewable draft, never directly into `lib/projects.ts`.
- Connected app / integration user must be scoped to specific objects/fields only, not admin-level access
- Log every proposed and executed change somewhere visible (even a simple table)
- Public-facing chat needs a rate limit or gate (session/message caps) — don't leave an unthrottled agent open to the public internet

## Content/positioning rules (carried over from the career knowledge base — apply to site copy, not just resume)
- R-Studio: describe the statistical methods (Holt-Winters, random forest, ANOVA, T-tests), don't brand it as a current tool or imply current advocacy. List the language plainly as "R" in skills lists.
- SQL/SOQL/Python: frame as "staging," "reporting," or "reviewed/audited" — not "authored" or "SQL-based analysis" (proficiency is real but at the reviewing/querying level, not building level)
- PG Forsta tool history: both Tableau and Power Platform are legitimate to attribute to PG Forsta (contract transition mid-tenure) — don't strip either out
- Leadership-through-gaps story: describe generally ("rose to lead through a sustained lack of permanent leadership") — do NOT cite the specific leadership-transition count on any public-facing page; that detail is for interview conversation only
- WSU (2016–2018): left off the resume/site by default; open question whether to include on the site since it's not as space-constrained — don't add without checking
- **Healthcare payer/provider positioning (resolved 2026-09-16)**: PG Forsta (formerly Press Ganey) work centered on payers, providers, and health systems as the primary client base; the HyperLift acquisition specifically targeted health insurers, while Forsta/InMoment/Rio were commercial CX space — don't blur "4 acquisitions" into "4 healthcare acquisitions," that overclaims. Combined with Eleos Health and the CMS.gov project, this is the site's real, honest healthcare throughline — lead with it.
- Target job title/function: Revenue Operations / Deal Desk, anchored in healthcare payer/provider/health-system markets — no longer an open decision, see Career Knowledge Base "Gaps" section.

## Open items
- Whether WSU experience appears on the site
- Which CMS datasets beyond Hospital General Information to add (HCRIS Cost Reports for reimbursement — ships as flat files, not a query API, documented as a next step in `pipeline/pullCmsData.ts`; ONC/healthit.gov for EMR vendor adoption by care setting)
- `public/resume.pdf` — generated from this knowledge base as a general-purpose (not single-posting-tailored) document; regenerate via the process documented in `pipeline/` or by hand whenever the knowledge base changes materially
