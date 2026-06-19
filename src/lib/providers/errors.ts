export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_KEY' | 'API_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' = 'API_ERROR',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

/**
 * Turn a failed HTTP response into a short, human-readable message instead of
 * dumping a raw HTML/JSON body (which is what produced unreadable error walls).
 * `provider` is a friendly label, e.g. "OpenAI-compatible" or "Gemini".
 */
export function describeHttpError(provider: string, status: number, rawBody: string): string {
  const body = (rawBody ?? '').trim();
  const looksLikeHtml = /^<(?:!doctype|html|\?xml|head|body)/i.test(body) || body.startsWith('<');

  // Pull a clean message out of a JSON error envelope when present.
  let detail = '';
  if (!looksLikeHtml && body) {
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
      const fromError = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
      detail = fromError ?? parsed.message ?? '';
    } catch { /* not JSON — fall through */ }
  }

  if (status === 401 || status === 403) {
    return `${provider}: authentication failed (${status}). Check your API key.`;
  }
  if (status === 404) {
    return looksLikeHtml
      ? `${provider}: the Base URL doesn't point at an API (404 returned a web page). Check the Base URL — it usually ends in /v1.`
      : `${provider}: not found (404)${detail ? ` — ${detail}` : ' — check the Base URL and model id.'}`;
  }
  if (status === 429) {
    return `${provider}: rate limit or quota exceeded (429). Wait a moment or check your plan.`;
  }
  if (status >= 500) {
    return `${provider}: server error (${status}). Try again shortly.`;
  }
  if (looksLikeHtml) {
    return `${provider}: unexpected non-API response (${status}). Check the Base URL.`;
  }
  const short = detail || body.slice(0, 200);
  return `${provider}: request failed (${status})${short ? ` — ${short}` : ''}`;
}
