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

## What's NOT done yet (be honest with yourself before calling this live)

- **No resume.pdf exists.** `/resume.pdf` is linked from Home and Contact
  but the file isn't in `public/` — I didn't fabricate a PDF from the
  knowledge base without you reviewing the actual formatted document
  first. Add the real file before deploying, or the links 404.
- **Not deployed.** No Vercel/Netlify project or Porkbun DNS wired up yet
  — that's the next concrete step (ROADMAP Track A).
- **Track B (Salesforce playground + chat assistant) not started.** The
  Portfolio card for it is marked `planned`, not `live` — don't change
  that until it's real.
- **GitHub repo doesn't exist yet either** — the "Pipeline source" link
  on the CMS project card is a placeholder pointing at a guessed
  org/repo path; fix it once this is actually pushed somewhere.
- **`OPENAI_API_KEY` isn't set anywhere yet.** The pipeline runs today
  with zero API cost (rule-based summaries only) — that's the correct
  default, not a bug. Set the secret in GitHub Actions (with a hard usage
  cap set at platform.openai.com first) once you actually want the LLM
  read in the weekly brief.

## Verified live during this build

- `npm run build` — passes clean, all three routes statically generated.
- `npm run cms:pull` — ran for real against
  `data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0`, pulled
  5,419 real hospital rows, wrote a real snapshot file.
- `npm run cms:watch` / `npm run cms:analyze` — ran against that snapshot,
  correctly identified it as a baseline (only one snapshot exists so far)
  and wrote a real brief to `data/cms/.../briefs/`.
