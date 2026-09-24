# adamdustin.me

Personal portfolio site for Adam Dustin (RevOps / Deal Desk / Salesforce, plus
hands-on data + agentic AI projects). See `CLAUDE.md` and `ROADMAP.md` for the
full project plan and guardrails — this file is the practical "how to run it."

## What's built

**Site (Track A)** — Next.js App Router, three pages (Home / Portfolio /
Contact), no CSS framework (plain CSS custom properties in
`app/globals.css` — see "Visual direction" below). Builds clean:

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build, verified passing
```

**CMS data pipeline (Track C)** — a real, working watcher/analyst agent
pair, verified live against the CMS Provider Data Catalog:

```bash
npm run cms:pull      # pulls the live dataset -> data/cms/.../snapshots/<date>.json
npm run cms:watch     # diffs the two most recent snapshots -> diffs/<date>.json
npm run cms:analyze   # rule-based brief, + optional LLM read if OPENAI_API_KEY is set
# or all three:
npm run cms:pipeline
```

Runs weekly via `.github/workflows/cms-pipeline.yml` (cron + manual
`workflow_dispatch`), committing updated data back to the repo. Dataset:
CMS "Hospital General Information" (facility type, ownership, emergency
services, overall rating) — the closest live, no-registration dataset to
ROADMAP's "bed size / provider counts by care setting" goal. HCRIS Cost
Reports and the ONC EMR-adoption dataset are documented next steps, not
yet implemented (see `pipeline/pullCmsData.ts` header for why — Cost
Reports ship as flat files, not a query API).

**Content agent** — `npm run content:card -- "description"` drafts a new
Portfolio project card via OpenAI and writes it to
`data/project-drafts/<slug>.json` for manual review before you paste it
into `lib/projects.ts`. It never writes directly into the site's source —
same parse-then-confirm discipline CLAUDE.md requires for the Salesforce
assistant, applied here to copy instead of CRM writes, and for the same
reason: an LLM won't reliably self-enforce your content rules (no
fabricated claims, "reviewed" not "authored" for SQL/Python, etc.), so a
human stays the last check before anything ships publicly.

## Visual direction

A RevOps/data-systems aesthetic, not a startup-SaaS gradient look — the
subject matter (Deal Desk, reporting, CMS data pipelines) should read as
credible and operational, not decorative. Slate/navy base, one restrained
amber accent (signal/attention, fits reporting), monospace reserved for
figures and metrics only, so a measured fact is visually distinct from
prose. Full rationale lives as comments in `app/globals.css`.

Self-check against the accessibility/interaction basics before calling
this done: skip-link to main content, visible focus rings (not browser
default, not suppressed), semantic heading order, nav as a landmark,
responsive grids via `auto-fit`/`minmax` rather than fixed breakpoints.
Not a substitute for a real audit once there's more than three pages and
real user traffic — rerun `ux-ui-audit` against the deployed site once
Track B's chat assistant ships, since that's the first genuinely
interactive surface.

## What's live now

- **Deployed**: https://www.adamdustin.me, via Vercel + Porkbun DNS. See `DEPLOYMENT.md` for the actual configuration (DNS records, domain setup, auth notes) — don't reconstruct this from memory if it ever needs redoing.
- **GitHub repo**: https://github.com/adamchrisdustin-art/Portfolio (public). The CMS project card's "Pipeline source" link points here for real.
- **`public/resume.pdf` exists** — generated from `resume/resume.html` (source of truth; see `resume/README.md` for how to regenerate it after editing).
- **CMS pipeline cron is live**: `.github/workflows/cms-pipeline.yml` has run automatically on schedule (confirmed via `gh run list`), pulling real data and committing it back weekly.
- **Portfolio → Data Visualization & Complex Analysis** section embeds a live Tableau Public dashboard (`lib/dataViz.ts` / `components/TableauEmbed.tsx`) — if you resize the workbook in Tableau, update `nativeWidth`/`nativeHeight` there to match (see the comment on that field for why the right number isn't always what Tableau's own Size panel reports).

## What's NOT done yet (be honest with yourself before calling this fully done)

- **Track B (Salesforce playground + chat assistant) not started.** The
  Portfolio card for it is marked `planned`, not `live` — don't change
  that until it's real.
- **`OPENAI_API_KEY` isn't set anywhere yet.** The pipeline runs today
  with zero API cost (rule-based summaries only) — that's the correct
  default, not a bug. Set it as a GitHub Actions secret (with a hard usage
  cap set at platform.openai.com first) once you actually want the LLM
  read in the weekly brief.
- **CMS project card description on `/portfolio`** was written generically
  (see the comment in `lib/dataViz.ts`) — review it against what the live
  Tableau dashboard actually shows and tighten if needed.
- **CMS Intelligence Executive Dashboard** (the much larger 12-agent
  project) — Phases 1–5 done (repository discovery, intelligence
  blueprint, agent implementation, data source & pipeline, dashboard &
  UX). Live at `/healthcare-intelligence` on the site itself (also
  linked from its Portfolio card): 7 executive layers, evidence drawers
  on every real finding, a demo-mode banner, a plain-language "how this
  works" panel, and a full case study. See `docs/cms-intelligence/`,
  `cms-intelligence/` (deterministic metrics/trend/data-quality logic,
  evidence schema + validator, source registry, 11 domain agents behind
  a shared orchestrator, 3 of them run against two real live-pulled CMS
  datasets — Hospital General Information and Home Health Care
  Agencies), and `.claude/agents/` (12 invocable Claude Code subagent
  definitions, one per domain). Confidence and trend detection are
  computed dynamically from real snapshot history (never hardcoded).
  Real charts (`components/charts/`: bar, donut, boxplot with proper
  Tukey whiskers, stat tiles) render wherever an agent has real
  cross-sectional or time-series data to show, built per the `dataviz`
  skill's method. Three independent CMS datasets are wired to real
  agents (hospital directory, home health quality/spending/service-mix,
  physician claims-vs-payment), and the Emerging Trends agent computes a
  real cross-dataset correlation between two of them. A state-level
  home-health capacity/investment signal ranks states by a real
  utilization proxy (episodes per agency) against quality and spending
  efficiency — auditable component by component, deliberately not
  overclaiming demand growth without a population denominator. The
  dashboard's Executive Pulse layer shows an actual synthesized
  narrative, not just a card list. A standalone "Data Explorer" section
  (`components/AnalyticsExplorer.tsx`) gives a Tableau-style overview of
  all the underlying data — KPI tiles, donuts, histograms, a boxplot,
  and time-series line charts — separate from the per-agent finding
  cards. `npm test` runs the suite (74 tests).

## Verified live during this build

- `npm run build` — passes clean, all five routes statically generated
  (including `/healthcare-intelligence`, which runs the full agent sweep
  at build time).
- `npm run cms:pull` — ran for real against
  `data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0`,
  pulled 5,419 real hospital rows; re-run again on 2026-09-23, now 3
  real dated snapshots (Sep 16/21/23) with zero material change observed
  so far — a correct, honest baseline finding, not a bug.
- `npm run cms:watch` / `npm run cms:analyze` — ran against those
  snapshots, correctly identified no material change, wrote real briefs
  to `data/cms/.../briefs/`.
- `npm test` (healthcare intelligence project, `cms-intelligence/`) — 62
  tests pass, including an orchestrator test that routes real questions
  to real specialist agents and gets back genuine, schema-valid insights
  computed from live CMS data already in this repo (not mocked):
  Hospital General Information (data/cms/, pulled by Track C v1) and
  Home Health Care Agencies (data/healthcare-intelligence/, pulled
  directly by this project's own adapter — 12,460 real agencies,
  verified live 2026-09-23). Confidence and trend detection are computed
  dynamically from that real snapshot history, not hardcoded. `npx tsc
  --noEmit` and `npm run build` both pass clean.
- Dashboard verified in a real headless browser (Playwright): zero
  console errors on `/healthcare-intelligence` and `/portfolio`, real
  sparkline charts render from the snapshot history above, evidence
  drawer confirmed to actually open on click, no "UnitedHealthcare" or
  "Optum" text anywhere in rendered output.
