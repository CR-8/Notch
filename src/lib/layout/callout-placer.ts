import type { LayoutInput } from './types';

const WARNING_SIGNALS =
  /\b(caution|warning|important|critical|must not|never|avoid|danger|risk|careful)\b/i;
const NOTE_SIGNALS = /\b(note:|important:|key insight:|fundamentally|critically|notably)\b/i;
const TIP_SIGNALS =
  /\b(tip:|best practice|recommend|suggestion|you should|consider using|we suggest)\b/i;

export function detectAndInsertCallouts(md: string, _input: LayoutInput): string {
  const result = md;

  if (result.includes('[!NOTE]') || result.includes('[!WARNING]') || result.includes('[!TIP]')) {
    return result;
  }

  const paragraphs = result.split(/\n\n+/);
  const newParagraphs: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 20) {
      newParagraphs.push(para);
      continue;
    }

    const lower = trimmed.toLowerCase();

    if (WARNING_SIGNALS.test(lower) && !trimmed.startsWith('>')) {
      newParagraphs.push(`> [!WARNING]\n> ${trimmed.replace(/\n/g, '\n> ')}`);
    } else if (NOTE_SIGNALS.test(lower) && !trimmed.startsWith('>')) {
      newParagraphs.push(`> [!NOTE]\n> ${trimmed.replace(/\n/g, '\n> ')}`);
    } else if (TIP_SIGNALS.test(lower) && !trimmed.startsWith('>')) {
      newParagraphs.push(`> [!TIP]\n> ${trimmed.replace(/\n/g, '\n> ')}`);
    } else {
      newParagraphs.push(para);
    }
  }

  return newParagraphs.join('\n\n');
}
