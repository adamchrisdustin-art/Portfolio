# Project Boundary — Healthcare Intelligence Executive Dashboard

Phase 1 deliverable per `01_PHASE_1_REPOSITORY_DISCOVERY.md`. Explains how
this project stays isolated from the rest of the portfolio repo — especially
from the existing, already-live Track C v1 CMS pipeline — while reusing the
site infrastructure that already exists.

## Why isolation matters here specifically

This repo already has a CMS pipeline: `pipeline/` (Track C v1), pulling one
dataset (CMS Hospital General Information), diffing it weekly, and writing a
rule-based/OpenAI brief to `data/cms/hospital-general-information/`. It is
live in production (`.github/workflows/cms-pipeline.yml` runs on a real
cron, confirmed via `gh run list` per `README.md`).

The healthcare intelligence project is **not** a rewrite of that pipeline —
it's a much larger, separate system (12 agents, multiple datasets, multiple
LLM providers, a dashboard) that happens to share a subject (CMS data) and a
repo. The two must stay legible as separate things: separate directories,
separate data roots, separate workflow files, separate Portfolio cards. If
they share a name too loosely ("the CMS pipeline"), it becomes easy to
accidentally edit or schedule the wrong one.

## Directory boundary

```
adamdustin-me/
├── app/
│   ├── page.tsx                      (existing — unchanged)
│   ├── portfolio/page.tsx            (existing — unchanged)
│   ├── contact/page.tsx              (existing — unchanged)
│   └── healthcare-intelligence/      NEW — dashboard route(s), Phase 5
│       └── page.tsx
│
├── components/                       (existing, reused where generic —
│                                       e.g. the .card / .container CSS
│                                       classes, not duplicated)
│
├── lib/                              (existing — projects.ts gets ONE new
│                                       entry for this project when it's
│                                       real; nothing else here changes)
│
├── pipeline/                         (existing Track C v1 — UNTOUCHED)
├── data/cms/                         (existing Track C v1 data — UNTOUCHED)
│
├── cms-intelligence/                 NEW — all non-route code for the
│   ├── agents/                       12-agent system (Phase 3)
│   │   ├── orchestrator/
│   │   ├── market-growth/
│   │   ├── claims-utilization-cost/
│   │   ├── reimbursement-payment/
│   │   ├── provider-network/
│   │   ├── medicare-advantage-part-d/
│   │   ├── medicaid-chip-dual-eligible/
│   │   ├── commercial-marketplace/
│   │   ├── policy-regulation-cms/
│   │   ├── emerging-trends/
│   │   ├── source-change-monitor/
│   │   └── data-architecture-semantic-model/
│   ├── intelligence/                 Phase 2 blueprint artifacts made real:
│   │   ├── questions/                 executive question catalog
│   │   ├── metrics/                   metric dictionary
│   │   ├── trends/                    trend/anomaly framework
│   │   ├── evidence/                  evidence model
│   │   └── policies/                  policy/reimbursement tracking
│   ├── data/
│   │   ├── adapters/                  per-CMS-dataset adapter modules (Phase 4)
│   │   ├── fixtures/                  synthetic/demo data, explicitly labeled
│   │   ├── sources/                   source registry/catalog metadata
│   │   └── processed/                 normalized output the dashboard reads
│   ├── providers/                     Phase 6 — Claude / OpenAI / other
│   │                                  adapters behind one interface
│   └── evaluation/                    Phase 6/7 — provider eval suite,
│       ├── tasks/                     fixtures, results
│       ├── fixtures/
│       └── results/
│
├── data/healthcare-intelligence/     NEW — pulled/derived data root for
│                                      this project, sibling to data/cms/,
│                                      never written into by pipeline/ or
│                                      vice versa
│
├── .github/workflows/
│   ├── cms-pipeline.yml              (existing Track C v1 — UNTOUCHED)
│   └── healthcare-intelligence.yml   NEW — this project's own cron
│                                      (Phase 4+), its own secrets, its
│                                      own commit trail
│
└── docs/cms-intelligence/            (existing — this prompt pack; later
                                       phases add their own docs here:
                                       agent map, source catalog, etc.)
```

## What is reused vs. newly created

**Reused as-is (no changes needed to adopt):**
- Next.js App Router, TypeScript strict mode, `@/*` path alias
- `app/layout.tsx`, `components/Nav.tsx`, `components/Footer.tsx` — every
  new route renders inside the existing shell
- Global design tokens and utility classes in `app/globals.css` (`.card`,
  `.container`, `.eyebrow`, `.btn`, CSS custom properties) — new dashboard
  UI should read as part of the same site, not a visually separate app
- `tsx` as the script runtime for any new pipeline-style scripts, matching
  `pipeline/`'s existing pattern
- GitHub Actions (free tier) as the scheduling mechanism, and the
  `hasMaterialChange`-style gate from `pipeline/analystAgent.ts` as the
  pattern every new agent's expensive call must follow
- `lib/projects.ts`'s `Project` type and `status` field — the new project
  gets one more array entry here when Phase 5 ships something real,
  exactly like every other portfolio project

**Newly created, isolated from existing code:**
- `cms-intelligence/` — all agent logic, intelligence-layer code, data
  adapters, provider abstraction, and evaluation harness. Nothing in
  `pipeline/` imports from here and nothing here imports from `pipeline/`.
- `data/healthcare-intelligence/` — this project's own pulled/derived data,
  never sharing a folder with `data/cms/`
- `app/healthcare-intelligence/` — the dashboard's actual routes (Next.js
  requires routes to live under the single top-level `app/`, so this is the
  one place the new project necessarily sits inside an existing top-level
  folder rather than its own — everything the route needs beyond rendering
  is imported from `cms-intelligence/`, keeping the route itself thin)
- `.github/workflows/healthcare-intelligence.yml` — its own cron schedule,
  its own `permissions`, its own secrets (`ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` as needed), separate from `cms-pipeline.yml` so the two
  systems' run history and failures are independently diagnosable

## Portfolio-safe data boundary

Applies to every dataset, fixture, and agent output this project produces —
restated here per the phase doc's explicit requirement, not just implied by
the master orchestrator's non-negotiable context:

| Category | Rule |
|---|---|
| Public CMS data | **Allowed**, and the intended default source for all real signals — Medicare FFS, MA/Part D enrollment, Marketplace PUFs, provider enrollment, HCRIS, etc. per the master orchestrator's Phase 4 list. |
| Synthetic/demo data | **Allowed**, and required anywhere an internal-enterprise concept (e.g. UHC-specific membership, contracted rates) is being demonstrated — must be clearly labeled as synthetic in both the data file and anywhere it's rendered, not just in a code comment. |
| Proprietary UHC/Optum/Eleos/PG Forsta data | **Prohibited**, no exceptions. Where an internal data source would normally exist, this project creates an adapter interface and documents the expected schema instead of fabricating rows — same rule `00_MASTER_ORCHESTRATOR.md` states, restated here as a boundary condition on `cms-intelligence/data/adapters/`. |
| PHI | **Prohibited**, no exceptions — no real patient-level data of any kind, public or otherwise. |
| Secrets/API keys | **Prohibited** in the repo. Live only in GitHub Actions secrets (automated runs) or local `.env.local` (interactive dev, gitignored) — same convention `.env.example` already documents for `OPENAI_API_KEY`, extended to any new provider key this project adds. |

## How this stays legible over time

- Anything described as "the CMS pipeline" in future conversation should be
  disambiguated: **Track C v1** (`pipeline/`, one dataset, live today) vs.
  **the healthcare intelligence system** (`cms-intelligence/`, 12 agents,
  multiple datasets, still being built). This document is the reference
  point for that distinction.
- The two Portfolio cards stay separate. `cms-market-intelligence-agents`
  (existing) keeps describing Track C v1 honestly. A new card gets added
  for the healthcare intelligence project only once Phase 5 has something
  real to show — not before, per the site's existing "don't mark live
  until it's real" discipline.
- Nothing in this phase merges, refactors, or deletes any part of
  `pipeline/` or `data/cms/`. If a later phase decides unification is
  worth it (e.g. migrating Track C v1 into `cms-intelligence/` as one of
  the 12 agents), that is an explicit future decision, not a side effect
  of building the new system next to it.
