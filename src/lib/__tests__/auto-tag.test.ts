import { describe, it, expect } from 'vitest';
import { deriveAutoTags, normalizeTag, mergeTags } from '../auto-tag';

describe('normalizeTag', () => {
  it('lowercases, slugifies and trims punctuation', () => {
    expect(normalizeTag('  Machine Learning! ')).toBe('machine-learning');
    expect(normalizeTag('C++ & Rust')).toBe('c-rust');
  });

  it('caps length at 40 chars', () => {
    expect(normalizeTag('x'.repeat(80)).length).toBe(40);
  });
});

describe('deriveAutoTags', () => {
  it('prefers concepts then entities and de-duplicates', () => {
    const tags = deriveAutoTags({
      concepts: [{ term: 'Neural Networks' }, { term: 'Backpropagation' }],
      entities: [{ name: 'Neural Networks' }, { name: 'OpenAI' }],
    });
    expect(tags).toEqual(['neural-networks', 'backpropagation', 'openai']);
  });

  it('respects the max limit', () => {
    const tags = deriveAutoTags({
      concepts: [{ term: 'one' }, { term: 'two' }, { term: 'three' }, { term: 'four' }],
    }, 2);
    expect(tags).toHaveLength(2);
  });

  it('drops stop-word tags and too-short tokens', () => {
    const tags = deriveAutoTags({ concepts: [{ term: 'Summary' }, { term: 'a' }, { term: 'Genetics' }] });
    expect(tags).toEqual(['genetics']);
  });

  it('returns an empty list with no input', () => {
    expect(deriveAutoTags({})).toEqual([]);
  });
});

describe('mergeTags', () => {
  it('keeps user tags first and appends unique auto tags', () => {
    expect(mergeTags(['Important'], ['important', 'biology'])).toEqual(['Important', 'biology']);
  });

  it('caps the total', () => {
    expect(mergeTags(['a', 'b', 'c'], ['d', 'e', 'f', 'g'], 4)).toEqual(['a', 'b', 'c', 'd']);
  });
});
