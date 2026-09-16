/**
 * Content agent - drafts a new Portfolio project card from a short
 * description, so adding a project is "describe it, review the draft,
 * paste it in" rather than hand-writing JSON each time.
 *
 * Deliberately follows the same parse-then-confirm pattern CLAUDE.md
 * requires for the Salesforce assistant: this agent NEVER writes directly
 * into lib/projects.ts. It only writes a reviewable draft to
 * data/project-drafts/<slug>.json - a person copies it in by hand after
 * checking it against the content rules below. That's a deliberate
 * constraint, not a missing feature: the knowledge base's copy rules
 * (no fabricated claims, "reviewed" not "authored" for SQL/Python, no
 * specific VP-turnover count, etc.) are exactly the kind of thing an LLM
 * will not reliably self-enforce, so a human gate stays in the loop.
 *
 * Usage:
 *   OPENAI_API_KEY=... npm run content:card -- "One-paragraph description of the project, stack, and status"
 */
import fs from "node:fs";
import path from "node:path";

const MODEL = "gpt-4o-mini";

// Phrases the copy rules explicitly forbid (see CLAUDE.md "Content/
// positioning rules"). The draft is flagged, not silently rewritten -
// a human decides how to fix it, since blind auto-rewriting is how this
// kind of rule quietly stops being enforced.
const BANNED_PATTERNS: RegExp[] = [
  /\bauthored\b.{0,20}\b(sql|soql|python)\b/i,
  /\bSQL-based analysis\b/i,
  /\bWSU\b/i,
  /\b7 VPs?\b|\bseven VPs?\b/i,
  /\bcurrent(ly)? (advocate|recommend).{0,20}R-?Studio\b/i,
];

async function draftProject(description: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set - required for content:card");
  }

  const schema = `{
  "slug": "kebab-case-id",
  "title": "Project title",
  "status": "live" | "in-progress" | "planned",
  "summary": "2-4 sentences, factual, no unverifiable superlatives",
  "stack": ["Tech", "Names", "Only"]
}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_output_tokens: 400,
      input: [
        {
          role: "system",
          content: `You draft portfolio project-card JSON matching this exact schema:\n${schema}\nOutput ONLY valid JSON, no markdown fence, no commentary. Never invent metrics, outcomes, or dates not present in the input.`,
        },
        { role: "user", content: description },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI call failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  const text = body.output
    ?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
    .map((c: { text?: string }) => c.text)
    .filter(Boolean)
    .join("");

  if (!text) throw new Error("Empty response from model");
  return JSON.parse(text);
}

function lintCopy(project: Record<string, unknown>): string[] {
  const flags: string[] = [];
  const haystack = JSON.stringify(project);
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(haystack)) {
      flags.push(`Matches banned pattern: ${pattern}`);
    }
  }
  return flags;
}

async function main() {
  const description = process.argv.slice(2).join(" ").trim();
  if (!description) {
    console.error('Usage: npm run content:card -- "description of the project"');
    process.exit(1);
  }

  const project = await draftProject(description);
  const flags = lintCopy(project);

  const dir = path.resolve(process.cwd(), "data", "project-drafts");
  fs.mkdirSync(dir, { recursive: true });

  // Model-generated slug is untrusted input - it's used to build a
  // filesystem path, so a prompt-injected or malformed response
  // (e.g. "../../../../whatever") must never be allowed to escape `dir`.
  // Strip to a safe kebab-case charset rather than trusting the model's
  // own schema instructions to hold.
  const safeSlug = (project.slug || "draft")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "draft";
  const outFile = path.join(dir, `${safeSlug}.json`);
  if (path.dirname(outFile) !== dir) {
    throw new Error(`Refusing to write outside ${dir} (got slug: ${JSON.stringify(project.slug)})`);
  }
  fs.writeFileSync(
    outFile,
    JSON.stringify({ project, flags, reviewed: false, draftedAt: new Date().toISOString() }, null, 2)
  );

  console.log(`[content-agent] wrote draft -> ${outFile}`);
  if (flags.length) {
    console.warn(`[content-agent] ${flags.length} content-rule flag(s) - review before merging into lib/projects.ts:`);
    flags.forEach((f) => console.warn(`  - ${f}`));
  } else {
    console.log("[content-agent] no content-rule flags. Still review before merging - this is a draft, not an approval.");
  }
}

main().catch((err) => {
  console.error("[content-agent] failed:", err);
  process.exitCode = 1;
});
