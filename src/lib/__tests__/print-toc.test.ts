import { describe, it, expect } from 'vitest';
import { numberTocEntries } from '../print-toc';

describe('numberTocEntries', () => {
  it('numbers H2 sections sequentially', () => {
    const out = numberTocEntries([
      { level: 2, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
    ]);
    expect(out.map((e) => e.number)).toEqual(['1', '2']);
  });

  it('nests H3 under the current H2 (1.1, 1.2, 2.1)', () => {
    const out = numberTocEntries([
      { level: 2, text: 'A', id: 'a' },
      { level: 3, text: 'A1', id: 'a1' },
      { level: 3, text: 'A2', id: 'a2' },
      { level: 2, text: 'B', id: 'b' },
      { level: 3, text: 'B1', id: 'b1' },
    ]);
    expect(out.map((e) => e.number)).toEqual(['1', '1.1', '1.2', '2', '2.1']);
  });

  it('resets the H3 counter on each new H2', () => {
    const out = numberTocEntries([
      { level: 2, text: 'A', id: 'a' },
      { level: 3, text: 'A1', id: 'a1' },
      { level: 2, text: 'B', id: 'b' },
      { level: 3, text: 'B1', id: 'b1' },
    ]);
    expect(out[3].number).toBe('2.1');
  });

  it('handles H1 as top-level headings', () => {
    const out = numberTocEntries([
      { level: 1, text: 'Intro', id: 'i' },
      { level: 2, text: 'Details', id: 'd' },
      { level: 1, text: 'Conclusion', id: 'c' },
    ]);
    expect(out.map((e) => e.number)).toEqual(['1', '1.1', '2']);
  });

  it('handles deeply nested H4 headings', () => {
    const out = numberTocEntries([
      { level: 2, text: 'A', id: 'a' },
      { level: 3, text: 'A1', id: 'a1' },
      { level: 4, text: 'A1a', id: 'a1a' },
      { level: 3, text: 'A2', id: 'a2' },
    ]);
    expect(out.map((e) => e.number)).toEqual(['1', '1.1', '1.1.1', '1.2']);
  });

  it('skips missing levels without gaps', () => {
    const out = numberTocEntries([
      { level: 2, text: 'A', id: 'a' },
      { level: 5, text: 'Deep', id: 'dp' },
      { level: 2, text: 'B', id: 'b' },
    ]);
    expect(out.map((e) => e.number)).toEqual(['1', '1.0.0.1', '2']);
  });
});
