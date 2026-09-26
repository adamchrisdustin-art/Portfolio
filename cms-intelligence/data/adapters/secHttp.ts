/**
 * Rate-limited fetch for sec.gov, shared by the SEC adapters that make
 * hundreds of requests per pull (secHealthIndustry8k.ts, secFormD.ts).
 * SEC's fair-access policy (https://www.sec.gov/os/webmaster-faq#code-support)
 * caps automated clients at 10 requests per second and requires a
 * descriptive User-Agent with a contact address; this spaces requests at
 * least 150ms apart (under 7 per second, leaving headroom for other SEC
 * pulls from the same machine) and sends the same User-Agent as
 * secEdgarFilings.ts. Callers make requests one at a time.
 */
import { USER_AGENT } from "./secEdgarFilings";

const MIN_INTERVAL_MS = 150;
const MAX_ATTEMPTS = 5;

let lastRequestAt = 0;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GETs a sec.gov URL, retrying network errors, 429s and 5xx with backoff
 * (2s, 4s, 8s, 16s). Returns 404 responses to the caller (a daily index
 * that doesn't exist is an answer, not a failure); throws on other errors.
 */
export async function secFetch(url: string, accept = "application/json"): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
      if (res.ok || res.status === 404) return res;
      throw new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`SEC request failed after ${attempt} attempts (${url}): ${err}`, { cause: err });
      await sleep(2000 * 2 ** (attempt - 1));
    }
  }
}
