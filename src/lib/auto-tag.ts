import type { Entity, Concept } from './types';

/**
 * LIB-5 — derive a small set of normalized tags from a document's extracted
 * structure so notes are filed automatically with zero manual effort. Pure and
 * deterministic; works offline (no model call).
 */
export interface AutoTagInput {
  entities?: Array<Pick<Entity, 'name'>>;
  concepts?: Array<Pick<Concept, 'term'>>;
  domain?: string;
}

const STOP_TAGS = new Set(['the', 'a', 'an', 'introduction', 'overview', 'summary', 'conclusion', 'document']);

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function deriveAutoTags(input: AutoTagInput, max = 5): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t || t.length < 2 || STOP_TAGS.has(t) || seen.has(t)) return;
    seen.add(t);
    tags.push(t);
  };

  // Concepts are the highest-signal source, then named entities.
  for (const c of input.concepts ?? []) {
    if (tags.length >= max) break;
    add(c.term);
  }
  for (const e of input.entities ?? []) {
    if (tags.length >= max) break;
    add(e.name);
  }

  return tags.slice(0, max);
}

/** Merge user-supplied tags with auto-derived ones, de-duplicated and capped. */
export function mergeTags(userTags: string[], autoTags: string[], cap = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...userTags, ...autoTags]) {
    const norm = t.trim();
    if (!norm || seen.has(norm.toLowerCase())) continue;
    seen.add(norm.toLowerCase());
    out.push(norm);
    if (out.length >= cap) break;
  }
  return out;
}
