/**
 * Grounding checks for model-written text that gets published without a
 * human review step (autonomous monthly runs auto-publish to main, per
 * Adam's 2026-09-25 decision). Every number and every health-insurer name
 * in model output must trace back to the real, code-computed facts the
 * model was given - otherwise that piece of text is rejected.
 *
 * Deliberately strict: a model that rounds "1,234,567" to "1.2 million"
 * gets rejected even though it's arguably right, because a check that
 * tries to judge "close enough" is exactly where a fabricated number
 * would slip through. The prompts tell every model to copy numbers
 * exactly as written.
 */

// Matches 12, 1,234, 0.97, $4.50, 23%, and scaled forms like $109.4M or 13.1 million
const NUMBER_PATTERN = /\$?\d[\d,]*(?:\.\d+)?(?:%|[KMB]\b|\s?(?:thousand|million|billion)\b)?/gi;

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

/** Real health-insurer names this project's naming rule covers (AGENT_ARCHITECTURE.md §13). */
export const CARRIER_TERMS = [
  "UnitedHealthcare",
  "United Healthcare",
  "UnitedHealth",
  "Optum",
  "UHC",
  "Humana",
  "Aetna",
  "CVS Health",
  "Cigna",
  "Elevance",
  "Anthem",
  "Centene",
  "Molina",
  "Kaiser",
] as const;

interface NumberToken {
  raw: string;
  /** The number as written, before any K/M/B scaling. */
  value: number;
  decimals: number;
  /** 1 unless written with a K/M/B/thousand/million/billion suffix. */
  scale: number;
}

function parseTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const raw = match[0];
    const suffix = raw.match(/([KMB]|thousand|million|billion)$/i)?.[1]?.toLowerCase();
    const cleaned = raw.replace(/[$,%]/g, "").replace(/\s?([KMB]|thousand|million|billion)$/i, "");
    const value = Number(cleaned);
    if (Number.isNaN(value)) continue;
    const dot = cleaned.indexOf(".");
    tokens.push({ raw, value, decimals: dot === -1 ? 0 : cleaned.length - dot - 1, scale: suffix ? SCALE[suffix] : 1 });
  }
  return tokens;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Numbers in `output` that don't appear in `source`. A number counts as
 * grounded if some source number equals it after rounding to the same
 * number of decimal places (0.5612 supports "0.56"), or equals it as a
 * percentage of a fraction (0.23 supports "23%"), or equals it abbreviated
 * ($109,438,442 supports "$109.4M"). Small integers 0-10 are ignored:
 * they're almost always counts or ordinals ("top 3", "2 agents") rather
 * than data claims.
 */
export function ungroundedNumbers(output: string, source: string): string[] {
  const sourceValues = parseTokens(source).map((t) => t.value * t.scale);
  const ungrounded: string[] = [];
  for (const token of parseTokens(output)) {
    if (token.scale === 1 && token.decimals === 0 && token.value <= 10) continue;
    const grounded = sourceValues.some(
      (s) =>
        roundTo(s / token.scale, token.decimals) === token.value ||
        (token.scale === 1 && roundTo(s * 100, token.decimals) === token.value)
    );
    if (!grounded) ungrounded.push(token.raw);
  }
  return ungrounded;
}

/** Carrier names in `output` that never appear in `source` - a named insurer may only reach the site as a real, sourced finding. */
export function ungroundedCarrierNames(output: string, source: string): string[] {
  const out = output.toLowerCase();
  const src = source.toLowerCase();
  return CARRIER_TERMS.filter((term) => {
    const t = term.toLowerCase();
    return new RegExp(`\\b${t}\\b`).test(out) && !new RegExp(`\\b${t}\\b`).test(src);
  });
}

export interface GroundingResult {
  grounded: boolean;
  ungroundedNumbers: string[];
  ungroundedCarriers: string[];
}

export function checkGrounding(output: string, source: string): GroundingResult {
  const numbers = ungroundedNumbers(output, source);
  const carriers = ungroundedCarrierNames(output, source);
  return { grounded: numbers.length === 0 && carriers.length === 0, ungroundedNumbers: numbers, ungroundedCarriers: carriers };
}
