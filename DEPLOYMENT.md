# Deployment

## Current state (as of 2026-09-23)

- **Hosting:** Vercel, connected to `adamchrisdustin-art/Portfolio` on GitHub. Every push to `main` auto-deploys — no manual deploy step.
- **Domain:** `adamdustin.me`, registered at Porkbun.
  - Canonical/primary: `www.adamdustin.me` (serves the actual site)
  - `adamdustin.me` (bare) does a `308` redirect to `www.adamdustin.me`
  - Both configured under the Vercel project's **Settings → Domains**
- **DNS (at Porkbun):**
  | Type | Host | Value |
  |---|---|---|
  | A | `adamdustin.me` (root/`@`) | `216.198.79.1` |
  | CNAME | `*.adamdustin.me` (wildcard) | Vercel-issued target (per-project, looks like `xxxxxxxxxxxx.vercel-dns-0xx.com.`) |

  Porkbun's default parking records (an `ALIAS` to `pixie.porkbun.com` and a matching wildcard `CNAME`) were deleted and replaced with the above. If DNS ever needs to be redone from scratch, get the exact current values from Vercel's Domains page at add-time rather than reusing the table above verbatim — Vercel's assigned values aren't guaranteed stable across a domain removal/re-add.
- **SSL:** fully automatic (Vercel provisions/renews via Let's Encrypt once DNS resolves) — nothing to configure or maintain here.
- **GitHub auth for pushes from a Claude Code session:** `gh auth login` (device flow) then `gh auth setup-git`. The token needs the `workflow` scope specifically (`gh auth refresh -h github.com -s workflow`) to push changes to `.github/workflows/*.yml` — the default `gh auth login` scope set doesn't include it, and pushes touching workflow files get rejected without it.

## What's NOT set up yet

- `OPENAI_API_KEY` as a **GitHub Actions secret** (Settings → Secrets and variables → Actions, on the repo) — needed only if/when the CMS pipeline's LLM analyst read should be enabled. The pipeline works fine without it (rule-based summaries).
- `ANTHROPIC_API_KEY` as a GitHub Actions secret — same pattern, for the healthcare intelligence project's Claude provider (`cms-intelligence/providers/anthropic.ts`). Adam has $100 in Anthropic API credit earmarked for this project's scheduled runs and a one-time Phase 6 provider evaluation (never for interactive Claude Code sessions, which already run on the Max20 subscription per `docs/cms-intelligence/COST_AND_OPERATING_MODEL.md`). Not wired into any workflow yet because there's no scheduled workflow for this project until Phase 4. Before adding it as a secret: generate the key at console.anthropic.com and set a hard monthly spend cap there first (same requirement as `OPENAI_API_KEY`) — don't expose the full $100 balance uncapped.
- Any environment variables in **Vercel** — the site itself doesn't need any today (fully static content, no API routes).
- A staging/preview workflow beyond Vercel's automatic per-PR preview deploys (default Vercel behavor, not specially configured).
