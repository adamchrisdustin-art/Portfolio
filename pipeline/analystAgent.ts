/**
 * Analyst agent (Track C, ROADMAP.md step 3).
 *
 * Turns the watcher's diff.json into a short written brief. Two modes:
 *
 *  - No OPENAI_API_KEY set: rule-based summary only (counts + a sample of
 *    the most notable changes). Zero API cost - this is the default, and
 *    is a complete, honest output on its own.
 *  - OPENAI_API_KEY set: also asks a model for a 2-3 sentence plain-
 *    language read on the diff, appended under the rule-based summary.
 *
 * CLAUDE.md's budget guardrails ("hard spend caps before any agent goes
 * live," "default to Haiku/cheapest tier, escalate only where needed")
 * are written for Claude/Anthropic Console specifically, but this project
 * runs v1 agents on OpenAI per its own "start in Codex" direction - the
 * same discipline applies here: gpt-4o-mini (cheapest current tier) is
 * hardcoded, output is capped, and this only ever runs on a weekly
 * GitHub Actions cron (see .github/workflows/cms-pipeline.yml), never
 * per-request from public traffic. Set a hard usage limit at
 * platform.openai.com/settings/organization/limits before enabling this
 * in CI - do not skip that step just because the code has a cap.
 */
import fs from "node:fs";
import { briefsDir, diffsDir, ensureDir, listSnapshots } from "./lib/paths";

const DATASET_NAME = "hospital-general-information";
const MODEL = "gpt-4o-mini";
const MAX_OUTPUT_TOKENS = 300;

interface ChangedRow {
  facility_id: string;
  facility_name: string;
  state: string;
  field: string;
  from: unknown;
  to: unknown;
}

interface Diff {
  baseline: boolean;
  comparedAt: string;
  previousSnapshot?: string;
  currentSnapshot?: string;
  added: { facility_id: string; facility_name: string; state: string }[];
  removed: { facility_id: string; facility_name: string; state: string }[];
  changed: ChangedRow[];
}

function latestDiffFile(): string | null {
  const dir = diffsDir(DATASET_NAME);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.length ? `${dir}/${files[files.length - 1]}` : null;
}

function ruleBasedSummary(diff: Diff): string {
  if (diff.baseline) {
    return "Baseline snapshot established - no prior snapshot to compare against yet. Next run will report real change.";
  }
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    return `No material change between ${diff.previousSnapshot} and ${diff.currentSnapshot}.`;
  }

  const lines: string[] = [
    `Comparing ${diff.previousSnapshot} → ${diff.currentSnapshot}:`,
    `- ${diff.added.length} facilities added`,
    `- ${diff.removed.length} facilities removed`,
    `- ${diff.changed.length} field-level changes (type, ownership, rating, or emergency services)`,
  ];

  if (diff.changed.length > 0) {
    lines.push("", "Sample changes:");
    for (const c of diff.changed.slice(0, 5)) {
      lines.push(`- ${c.facility_name} (${c.state}): ${c.field} changed from "${c.from}" to "${c.to}"`);
    }
  }

  return lines.join("\n");
}

async function llmSummary(diff: Diff, ruleBased: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "system",
          content:
            "You write brief, factual market-analysis notes from CMS hospital data diffs. 2-3 sentences max. No speculation beyond what the data shows. No markdown headers.",
        },
        {
          role: "user",
          content: `Here is a structured diff and its rule-based summary. Write a short plain-language read for a RevOps/healthcare-market audience.\n\nRule-based summary:\n${ruleBased}\n\nRaw diff (truncated):\n${JSON.stringify(diff).slice(0, 4000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`[analyst] OpenAI call failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const body = await res.json();
  // Responses API: output is an array of items; find the first text output.
  const text = body.output
    ?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
    .map((c: { text?: string }) => c.text)
    .filter(Boolean)
    .join("\n");

  return text || null;
}

async function main() {
  const diffFile = latestDiffFile();
  if (!diffFile) {
    console.log("[analyst] no diff file found - run cms:pull and cms:watch first");
    return;
  }

  const diff: Diff = JSON.parse(fs.readFileSync(diffFile, "utf-8"));
  const ruleBased = ruleBasedSummary(diff);
  const llm = await llmSummary(diff, ruleBased);

  const brief = [
    `# CMS Hospital General Information — Brief`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    ruleBased,
  ];

  if (llm) {
    brief.push("", "## Analyst read (gpt-4o-mini)", llm);
  } else {
    brief.push(
      "",
      "## Analyst read",
      "Not generated - OPENAI_API_KEY not set. Rule-based summary above is the complete output."
    );
  }

  const dir = briefsDir(DATASET_NAME);
  ensureDir(dir);
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = `${dir}/${stamp}.md`;
  fs.writeFileSync(outFile, brief.join("\n"));

  console.log(`[analyst] wrote ${outFile}`);
}

main().catch((err) => {
  console.error("[analyst] failed:", err);
  process.exitCode = 1;
});
