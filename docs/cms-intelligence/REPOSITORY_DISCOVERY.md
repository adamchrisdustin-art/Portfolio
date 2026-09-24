# Repository Discovery — Healthcare Intelligence Executive Dashboard

Phase 1 deliverable per `01_PHASE_1_REPOSITORY_DISCOVERY.md`. Written after
inspecting the actual repository, not inferred from file names.

**Path note:** the phase doc asks for this at `docs/healthcare-intelligence/`.
This repo already has an established `docs/cms-intelligence/` folder (created
before Phase 1 started, holding the whole prompt pack) and `ROADMAP.md`
already points there ("Full plan: `docs/cms-intelligence/`"). Following this
existing convention rather than the template's generic path — that's the
"adapt to the actual repository" instruction in the phase doc itself.

## Repository overview

`adamdustin-me` is Adam Dustin's personal portfolio site — a single Next.js
repo, not a monorepo. It currently ships three pages (Home / Portfolio /
Contact) plus one working data pipeline (Track C v1: a single-dataset CMS
watcher/analyst agent pair). This healthcare intelligence project is a
planned expansion of that same Track C line, not a new repo.

Repo root:

```
adamdustin-me/
  app/            Next.js App Router routes (/, /portfolio, /contact)
  components/     Shared UI (Nav, Footer, ProjectCard, TableauEmbed)
  lib/            Site content as typed data (projects.ts, experience.ts, skills.ts, dataViz.ts)
  pipeline/       Track C v1: CMS watcher/analyst pipeline (tsx scripts, run via npm + GH Actions cron)
  data/cms/       Track C v1's pulled data (snapshots/diffs/briefs), committed to git
  docs/cms-intelligence/   This prompt pack + phase docs (being built out now)
  public/         Static assets, resume.pdf
  resume/         resume.html (source of truth for the PDF) + regen instructions
  .github/workflows/       cms-pipeline.yml (weekly cron)
  types/          exists as an empty directory — no shared type files in it yet
```

## Detected stack

| Area | Finding |
|---|---|
| Framework | Next.js 15.1 (App Router), React 19, TypeScript 5.7, strict mode on |
| Package manager | npm (`package-lock.json` present, `npm ci` used in CI) |
| Styling | No CSS framework. Plain CSS custom properties in `app/globals.css`, documented "Visual direction" (slate/navy base, one amber accent, monospace reserved for figures/metrics only). Inline `style={{}}` objects are the norm in page/component code — no CSS Modules, no Tailwind, no styled-components. |
| Routing | File-based App Router. Three top-level route folders under `app/`, each a plain `page.tsx` exporting a default component + a `Metadata` export. No route groups, no nested layouts beyond the root `layout.tsx`. |
| Components | 4 shared components, all default-export function components, no barrel file, imported via `@/components/X` path alias (`@/*` → repo root, set in `tsconfig.json`). |
| Data/content pattern | Site copy lives in typed arrays in `lib/*.ts` (`Project[]`, `ExperienceEntry[]`, etc.), imported directly into pages — no CMS, no database, no fetch-at-runtime for site content. Explicitly designed to grow (comments call this out on `projects.ts` and `dataViz.ts`). |
| State/data fetching | None. No SWR, no React Query, no client-side fetch for content. The one client component (`TableauEmbed.tsx`) uses local `useState`/`useEffect`/`ResizeObserver` only, no data library. |
| Data viz / charts | No charting library (no Recharts/D3/visx/Plotly/nivo) anywhere in `package.json` or the codebase. The only current visualization is one embedded Tableau Public `<iframe>` via `TableauEmbed.tsx`. Streamlit is used for Adam's other dashboards (Eleos Health, planned Track B) but is a *separate deployed app*, embedded by iframe — never a dependency inside this repo. |
| Tables/maps | None exist yet. |
| AI/agent utilities | `pipeline/` has three hand-rolled agent scripts (pull / watch / analyze) plus a content-drafting agent (`projectCardAgent.ts`). All call OpenAI's `/v1/responses` endpoint directly via `fetch` — no SDK dependency (`openai` npm package is not installed), no shared LLM-call helper, no provider abstraction. Each script inlines its own system prompt, model name (`gpt-4o-mini`, hardcoded per-file), and output-token cap. There is no Claude/Anthropic SDK usage anywhere in the repo yet — CLAUDE.md documents Claude API as a *planned* v2 swap-in, not present today. |
| Test infrastructure | **None.** No test runner in `devDependencies` (no Jest, Vitest, Playwright, Testing Library). No `test` script in `package.json`. No `*.test.ts` / `*.spec.ts` files anywhere. `npm run lint` exists but there is no `eslint` package in `devDependencies` and no eslint config file (`.eslintrc*`, `eslint.config.*`) in the repo — the script would currently fail or silently rely on a global install. |
| Build/deploy | Vercel, auto-deploy on push to `main` (per `DEPLOYMENT.md`). `next.config.ts` has a comment stating "static export is the default assumption" but does **not** actually set `output: "export"` — this is a stated intent, not an enforced constraint. Nothing today would stop a server-only feature (API route, server action, ISR) from being added without anyone noticing the assumption broke. |
| Env vars | Root `.env.example` documents one var, `OPENAI_API_KEY` (optional — pipeline degrades to rule-based summaries without it). Convention: `.env.local` for the Next site (gitignored), shell-exported or GitHub Actions secret for pipeline scripts. No Anthropic/Claude key exists yet anywhere in the repo or `DEPLOYMENT.md`'s "what's not set up" list. |
| Scheduling | One GitHub Actions workflow, `.github/workflows/cms-pipeline.yml` — weekly cron (`0 13 * * 1`) + manual `workflow_dispatch`, `permissions: contents: write`, commits pipeline output straight back to `data/cms/` on `main`. This is the only existing scheduling mechanism in the repo — confirms `COST_AND_OPERATING_MODEL.md`'s framing that automated runs need this same GH Actions + API-key pattern, not a Max-plan-backed process. |
| DuckDB | Listed in `devDependencies` (`^1.1.3`) but **not imported or used anywhere** in `pipeline/` or elsewhere — the actual pipeline writes plain JSON files via `node:fs`. This is a stale/aspirational dependency from CLAUDE.md's original "DuckDB/SQLite" framing, not a working integration. Treat as unused until something actually imports it. |

## Existing conventions worth following

- **Growable-array content pattern**: `lib/projects.ts`, `lib/dataViz.ts` are typed arrays with an explicit comment that they're meant to grow incrementally, plus a `status: "live" | "in-progress" | "planned"` field kept honest rather than implying everything shown is finished. The healthcare intelligence project's own status on the Portfolio card should follow this same field and the same "don't mark live until it's real" discipline already stated in `README.md`.
- **Data-on-disk, not a database**: pulled/derived data lives under `data/<namespace>/...` as dated JSON/Markdown files, committed to git so history is inspectable via `git log`/diff. No live DB connection anywhere in the site or pipeline.
- **Gate expensive calls behind a free rule-based path**: `analystAgent.ts`'s `hasMaterialChange(diff)` gate (LLM call only fires when the diff is non-empty) is the exact pattern `COST_AND_OPERATING_MODEL.md` says to replicate across all 12 new agents — it's already implemented once, not just specified.
- **Parse-then-confirm for anything written into site source**: `projectCardAgent.ts` never writes into `lib/projects.ts` directly — it writes a reviewable draft to `data/project-drafts/` (gitignored) and a human pastes it in. Same discipline CLAUDE.md requires for the Salesforce assistant. Any new agent that could touch dashboard copy or site content should follow this, not just data-fetching agents.
- **Path helpers over inline paths**: `pipeline/lib/paths.ts` centralizes `data/cms/<dataset>/{snapshots,diffs,briefs}` path construction rather than each script inlining paths. Worth mirroring for the new project's own data layout.
- **Headers as rationale comments, not planning docs**: every pipeline file opens with a comment block explaining *why* the file exists and what tradeoff it encodes (e.g. `analystAgent.ts`'s cost-gating rationale, `projectCardAgent.ts`'s parse-then-confirm rationale). No separate design-doc files back these decisions — the comment is the doc. Consistent with this repo's overall low-ceremony documentation style outside of `docs/cms-intelligence/` itself.
- **Model name and cap hardcoded per-agent, not centralized**: `MODEL = "gpt-4o-mini"` and `MAX_OUTPUT_TOKENS` are repeated constants in each pipeline script today, not a shared config. The 12-agent system's provider abstraction (Phase 6) is a deliberate change from this pattern, not a continuation of it — worth calling out explicitly since it's new architecture, not "the way this repo already does it."
- **No CI beyond the pipeline cron**: no lint/build/test GitHub Actions workflow currently gates commits to `main`. Whatever testing Phase 7 adds should decide explicitly whether it also needs a CI workflow, since none exists to extend.

## Dependencies already available

- Next.js 15 / React 19 / TypeScript 5.7 (strict) — dashboard UI can be built directly in `app/`, no framework migration needed.
- `tsx` — already the runtime for all pipeline scripts; the new system's agents/pipeline scripts should use the same rather than introducing `ts-node` or a build step.
- `@types/node`, `@types/react`, `@types/react-dom` — standard typing already in place.
- Native `fetch` — used directly for OpenAI calls today; sufficient for CMS data-source calls and any new provider HTTP calls without adding an HTTP client library.
- GitHub Actions (free tier, public repo) — proven scheduling mechanism, reusable for the new agents' cron runs per `COST_AND_OPERATING_MODEL.md`.

## Dependencies likely needed

- A model-provider SDK or direct-`fetch` pattern for **Claude** specifically (Anthropic API) — none exists yet; Phase 3/6 will need to decide `@anthropic-ai/sdk` vs. continuing the raw-`fetch` pattern already used for OpenAI. Raw `fetch` is more consistent with existing conventions and avoids a new dependency for a single endpoint.
- A test runner (Vitest is the natural fit given the existing TS/`tsx` toolchain and zero current Jest config to migrate away from) — needed before Phase 7, and arguably useful starting Phase 3 for the deterministic-analytics pieces (diffing, aggregation, thresholding) the master orchestrator explicitly wants as code, not LLM calls.
- A working `eslint` setup (package + config) if `npm run lint` is meant to actually run — currently a dangling script. Not blocking for this project, but worth a one-line flag since new code will be added under a lint script that doesn't currently function.
- Possibly a lightweight charting approach for Phase 5's dashboard (no charting library exists today). Given the "reuse existing infrastructure" instruction and that Streamlit is already the site's actual charting tool elsewhere (Eleos, planned Track B), the lowest-new-dependency path is likely: keep this Next.js repo as the **shell/narrative layer** (question catalog, evidence, agent output, provenance) and either (a) embed a Streamlit dashboard the same way `TableauEmbed.tsx` embeds Tableau, or (b) add a minimal in-repo charting library only if native interactivity inside Next.js is required. This is a Phase 5 decision, flagged here only because it affects whether a new frontend dependency is needed at all.
- `ANTHROPIC_API_KEY` (and possibly other provider keys) added to `.env.example` and documented in `DEPLOYMENT.md`'s "not set up yet" list, mirroring how `OPENAI_API_KEY` is already documented.

## Risks

- **`npm run lint` is currently non-functional** (no eslint dependency, no config) — not caused by this project, but new code added under this project will not actually be linted by that script until it's fixed. Flagging, not fixing, per Phase 1's stop condition.
- **DuckDB is an unused dependency** — if the new project's data layer is expected to use it (CLAUDE.md's original framing implied this), that's new integration work, not something already working that can be extended.
- **Static-export assumption is unenforced** — `next.config.ts`'s comment states the site is meant to stay statically exportable, but nothing in config actually prevents a server-only Next.js feature from being introduced. If the healthcare intelligence dashboard needs server-side rendering, API routes, or server actions to read pre-computed agent output at request time, that could silently violate an assumption nobody encoded as a real constraint. Needs an explicit decision before Phase 5, not a default.
- **No existing test harness to extend** — Phase 7's "evaluation suite" and general test coverage will be greenfield, not additive to an existing pattern. This is a bigger lift than the phase docs' framing might imply for a repo that "already has conventions."
- **Provider abstraction is genuinely new architecture** — every existing agent (`pipeline/*.ts`) is OpenAI-specific with inline `fetch` calls and no interface. Phase 6's "Model Router" (per `09_PROJECT_DIRECTORY_RECOMMENDATION.md`) has no precedent in this repo to build on; it will be designed from scratch, and the existing `pipeline/` scripts will **not** be refactored to use it unless a later phase explicitly decides to unify v1 and the new system (out of scope for Phase 1).
- **Two CMS pipelines living side by side** — `pipeline/` (Track C v1, single dataset, OpenAI, already live in prod) and the new 12-agent system will coexist. Without a clearly separate directory and a clearly separate GitHub Actions workflow, there's real risk of the two getting tangled (shared `data/cms/` paths, shared cron file, shared "the CMS pipeline" name in commit messages/docs). Addressed directly in `PROJECT_BOUNDARY.md`.

## Assumptions

- The existing `pipeline/` v1 system stays exactly as-is through this project — it is not being replaced, merged, or refactored as part of Phases 1–7 unless a future phase explicitly says so. The Portfolio card for it (`cms-market-intelligence-agents`, `status: "in-progress"`) and the new healthcare intelligence project get **separate** Portfolio cards once the new one is real, not one card rewritten to describe both.
- "Public-data-first" and "no PHI/proprietary data" apply with zero exceptions, consistent with both the master orchestrator's non-negotiable context and this repo's existing budget/data-safety guardrails in `CLAUDE.md`.
- Interactive Claude Code sessions (this one) continue drawing on the Max20 subscription for build-time work; any scheduled/unattended piece requires its own API key and its own spend cap, set before it goes live — per `COST_AND_OPERATING_MODEL.md`, already decided, not re-litigated here.
- The site stays a single Next.js repo (no monorepo tooling like Turborepo/Nx introduced) — the isolation the master orchestrator asks for is achieved through directory structure and naming, not repo separation.

## Proposed implementation plan (directory boundary)

See `PROJECT_BOUNDARY.md` for the full rationale. Summary:

- New top-level directory **`cms-intelligence/`** at repo root holds all non-route code for the 12-agent system: `agents/`, `intelligence/` (questions, metrics, trends, evidence, policies), `data/adapters/`, `data/fixtures/`, `evaluation/`, `providers/`. This parallels the existing `pipeline/` directory (a second, clearly-named, isolated top-level folder) rather than nesting inside `lib/` or `pipeline/` itself.
- Dashboard routes live under the existing `app/` directory (Next.js requires this) at `app/healthcare-intelligence/`, importing from `cms-intelligence/` the same way existing pages import from `lib/`.
- Pulled/derived data lands under a new `data/healthcare-intelligence/` root (sibling to the existing `data/cms/`, not inside it) — keeps the v1 pipeline's data directory untouched and avoids two systems writing into the same folder.
- A new, separate GitHub Actions workflow file (not a rider on `cms-pipeline.yml`) so the two systems' cron schedules, secrets, and commit history stay independently readable.
- `docs/cms-intelligence/` (this folder) continues to hold the prompt pack and phase-tracking docs; project-specific technical docs produced *by* later phases (agent map, source catalog, etc.) also land here rather than a second docs folder, to avoid the same "two similarly-named doc folders" confusion flagged above for data.

No large-scale feature code is being written in this phase — only these two documents, per the phase doc's stop condition. A thin proof-of-life route is not included here since nothing yet needs to be integration-tested; Phase 2 (blueprint) is the next real gate.
