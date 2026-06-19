/**
 * CAP-5 — duplicate detection. Normalizes URLs (drops hash, trailing slash and
 * common tracking params) so the same article saved twice is recognised. Pure.
 */
const TRACKING_PARAMS = /^(utm_|mc_|_hs)/i;
const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'gbraid', 'wbraid', 'ref', 'ref_src', 'igshid']);

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    const params = u.searchParams;
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.test(key) || TRACKING_KEYS.has(key.toLowerCase())) params.delete(key);
    }
    u.search = params.toString();
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.trim().replace(/\/$/, '').toLowerCase();
  }
}

export function isSameDocument(a: string, b: string): boolean {
  return normalizeUrl(a) === normalizeUrl(b);
}

/** Returns the id of an existing document with a matching URL, or null. */
export function findDuplicateId(
  url: string,
  existing: Array<{ id: string; url: string }>,
): string | null {
  const target = normalizeUrl(url);
  for (const doc of existing) {
    if (normalizeUrl(doc.url) === target) return doc.id;
  }
  return null;
}
