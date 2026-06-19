import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameDocument, findDuplicateId } from '../dedupe';

describe('normalizeUrl', () => {
  it('strips the hash and trailing slash', () => {
    expect(normalizeUrl('https://x.com/a/#section')).toBe('https://x.com/a');
  });

  it('removes tracking params but keeps real ones', () => {
    expect(normalizeUrl('https://x.com/p?utm_source=tw&id=5&fbclid=abc'))
      .toBe('https://x.com/p?id=5');
  });

  it('is resilient to non-URL input', () => {
    expect(normalizeUrl('not a url/')).toBe('not a url');
  });
});

describe('isSameDocument', () => {
  it('treats tracking-only differences as the same page', () => {
    expect(isSameDocument('https://x.com/a?utm_source=fb', 'https://x.com/a')).toBe(true);
  });

  it('distinguishes genuinely different pages', () => {
    expect(isSameDocument('https://x.com/a', 'https://x.com/b')).toBe(false);
  });
});

describe('findDuplicateId', () => {
  const existing = [
    { id: 'doc-1', url: 'https://x.com/article' },
    { id: 'doc-2', url: 'https://y.com/post' },
  ];

  it('finds a match ignoring tracking params', () => {
    expect(findDuplicateId('https://x.com/article?utm_campaign=z', existing)).toBe('doc-1');
  });

  it('returns null when nothing matches', () => {
    expect(findDuplicateId('https://z.com/new', existing)).toBeNull();
  });
});
