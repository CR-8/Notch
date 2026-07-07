import { describe, it, expect } from 'vitest';
import { parseInline, inlineToPlainText } from '../markdown/inline-md';

describe('parseInline', () => {
  it('parses bold so **DevOps** no longer leaks (Problem 6)', () => {
    const t = parseInline('**DevOps**');
    expect(t).toEqual([{ type: 'bold', text: 'DevOps' }]);
  });

  it('parses inline code and italics', () => {
    expect(parseInline('`docker`')).toEqual([{ type: 'code', text: 'docker' }]);
    expect(parseInline('_emphasis_')).toEqual([{ type: 'italic', text: 'emphasis' }]);
  });

  it('parses links with href', () => {
    expect(parseInline('[k8s](https://k8s.io)')).toEqual([
      { type: 'link', text: 'k8s', href: 'https://k8s.io' },
    ]);
  });

  it('mixes text and markup in order', () => {
    const t = parseInline('Use **Docker** with `kubectl` daily');
    expect(t.map((x) => x.type)).toEqual(['text', 'bold', 'text', 'code', 'text']);
    expect(t[1]).toEqual({ type: 'bold', text: 'Docker' });
  });

  it('leaves plain text untouched', () => {
    expect(parseInline('just words')).toEqual([{ type: 'text', text: 'just words' }]);
  });

  it('does not mis-split bold into italics', () => {
    expect(parseInline('**bold**').every((t) => t.type !== 'italic')).toBe(true);
  });
});

describe('inlineToPlainText', () => {
  it('strips all markers for sorting/filtering', () => {
    expect(inlineToPlainText('**Docker** and `k8s`')).toBe('Docker and k8s');
  });
});
