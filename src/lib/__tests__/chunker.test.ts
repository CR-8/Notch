import { describe, it, expect } from 'vitest';
import { chunkDocument } from '../chunker';

describe('chunkDocument', () => {
  it('produces chunks tagged with the note id', () => {
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    const chunks = chunkDocument('note-1', text);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.noteId).toBe('note-1');
      expect(c.text.length).toBeGreaterThan(0);
      expect(typeof c.paragraphIndex).toBe('number');
      expect(c.id).toBeTruthy();
    }
  });

  it('splits long content into multiple chunks', () => {
    const para = 'word '.repeat(200).trim();
    const text = Array.from({ length: 10 }, (_, i) => `${para} ${i}`).join('\n\n');
    const chunks = chunkDocument('note-2', text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('returns an empty array for empty content', () => {
    expect(chunkDocument('note-3', '')).toEqual([]);
  });

  it('extracts headings from HTML when provided', () => {
    const text = 'Intro paragraph.\n\nBody paragraph about topics.';
    const html = '<h2>Section Title</h2><p>Intro paragraph.</p><p>Body paragraph about topics.</p>';
    const chunks = chunkDocument('note-4', text, html);
    expect(chunks.some(c => c.heading === 'Section Title')).toBe(true);
  });
});
