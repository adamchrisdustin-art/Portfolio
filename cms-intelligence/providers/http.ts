/**
 * Shared POST for the model providers. Returns the parsed JSON body, or
 * null after logging why the call failed. Added 2026-09-25 after a
 * benchmark run failed with only "401 Unauthorized" to go on: the logs
 * now carry the provider's own error message (which never includes the
 * full key) and, for requests that throw before any response (network
 * errors, Node fetch's 5-minute wait for response headers), the
 * underlying error code.
 */
const MAX_ERROR_CHARS = 500;

export async function postJson(label: string, url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown> | null> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    console.error(`[${label}] request error: ${(err as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ""}`);
    return null;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[${label}] call failed: ${res.status} ${res.statusText}${detail ? ` - ${detail.slice(0, MAX_ERROR_CHARS)}` : ""}`);
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}
