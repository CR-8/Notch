import { describe, it, expect } from 'vitest';
import { readingLevelInstruction, buildTranslatePrompt, languageName, FOLLOW_UPS } from '../chat-actions';

describe('readingLevelInstruction', () => {
  it('differs between simple and technical', () => {
    const simple = readingLevelInstruction('simple');
    const technical = readingLevelInstruction('technical');
    expect(simple).not.toBe(technical);
    expect(simple.toLowerCase()).toContain('simple');
    expect(technical.toLowerCase()).toContain('technical');
  });
});

describe('buildTranslatePrompt', () => {
  it('names the target language and preserves the source text and citation note', () => {
    const prompt = buildTranslatePrompt('Hello [1]', 'Spanish');
    expect(prompt).toContain('Spanish');
    expect(prompt).toContain('Hello [1]');
    expect(prompt).toMatch(/\[N\] citation/i);
  });
});

describe('languageName', () => {
  it('resolves a BCP-47 code to a readable name', () => {
    expect(languageName('en-US').toLowerCase()).toContain('english');
  });

  it('falls back gracefully on a bad code', () => {
    expect(typeof languageName('zz')).toBe('string');
  });
});

describe('FOLLOW_UPS', () => {
  it('offers a few non-empty suggestions', () => {
    expect(FOLLOW_UPS.length).toBeGreaterThan(0);
    expect(FOLLOW_UPS.every(s => s.length > 0)).toBe(true);
  });
});
