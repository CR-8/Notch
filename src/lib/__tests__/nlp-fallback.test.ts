import { describe, it, expect } from 'vitest';
import {
  tokenize,
  rankChunksByKeywords,
  answerWithOfflineNLP,
  buildOfflineCaptureMarkdown,
} from '../nlp-fallback';

describe('tokenize', () => {
  it('lowercases, strips punctuation and removes stop words', () => {
    const tokens = tokenize('The Quick, Brown FOX!');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).not.toContain('the');
  });
});

describe('rankChunksByKeywords', () => {
  const chunks = [
    { text: 'Photosynthesis converts sunlight into chemical energy in plants.', paragraphIndex: 0 },
    { text: 'The stock market rallied on strong earnings reports.', paragraphIndex: 1 },
    { text: 'Chlorophyll absorbs light during photosynthesis.', paragraphIndex: 2 },
  ];

  it('ranks the most relevant chunk first', () => {
    const ranked = rankChunksByKeywords('how does photosynthesis work', chunks, 3);
    expect(ranked[0].paragraphIndex === 0 || ranked[0].paragraphIndex === 2).toBe(true);
  });

  it('respects the k limit', () => {
    const ranked = rankChunksByKeywords('photosynthesis', chunks, 1);
    expect(ranked).toHaveLength(1);
  });

  it('returns something even with no keyword overlap', () => {
    const ranked = rankChunksByKeywords('zzzz', chunks, 2);
    expect(ranked.length).toBeGreaterThan(0);
  });
});

describe('answerWithOfflineNLP', () => {
  it('returns a not-found message for no chunks', () => {
    expect(answerWithOfflineNLP('anything', [])).toMatch(/cannot find/i);
  });

  it('produces a cited answer from ranked chunks', () => {
    const answer = answerWithOfflineNLP('what is photosynthesis', [
      { text: 'Photosynthesis converts sunlight into energy.', paragraphIndex: 0, source: 'document' },
    ]);
    expect(answer).toMatch(/\[1\]/);
    expect(answer.toLowerCase()).toContain('photosynthesis');
  });
});

describe('buildOfflineCaptureMarkdown', () => {
  it('emits a titled markdown document with the expected sections', () => {
    const md = buildOfflineCaptureMarkdown('My Title', 'First sentence here. Second sentence follows.\n\nA second paragraph.');
    expect(md).toContain('# My Title');
    expect(md).toContain('## SUMMARY');
    expect(md).toContain('## KEY POINTS');
    expect(md).toContain('## Main Content');
  });

  it('falls back to a default title when none is given', () => {
    const md = buildOfflineCaptureMarkdown('', 'Some content.');
    expect(md).toContain('# Imported Document');
  });
});
