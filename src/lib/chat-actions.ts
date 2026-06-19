import type { ReadingLevel } from './types';

/**
 * Pure helpers for chat actions (CHAT-5 reading level, CHAT-6 translate,
 * CHAT-14 follow-ups). Kept side-effect-free so they are unit testable.
 */

export function readingLevelInstruction(level: ReadingLevel): string {
  return level === 'simple'
    ? 'Answer in plain, simple language a non-expert can follow. Avoid jargon; briefly explain any term you must use.'
    : 'Answer with technical precision and depth, using correct domain terminology.';
}

export function buildTranslatePrompt(text: string, targetLanguage: string): string {
  return [
    `Translate the text below into ${targetLanguage}.`,
    'Preserve any [N] citation markers exactly as they appear and keep Markdown formatting.',
    'Output only the translation with no preamble.',
    '',
    text,
  ].join('\n');
}

/** Resolve a BCP-47 code (e.g. "en-US") to a human language name. */
export function languageName(code: string): string {
  const base = code.split('-')[0];
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(base) ?? base;
  } catch {
    return base;
  }
}

export const FOLLOW_UPS: readonly string[] = [
  'Go deeper on that',
  'Give a concrete example',
  'Why does this matter?',
  'Summarize that in one line',
];
