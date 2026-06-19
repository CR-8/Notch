// ── Inline markdown tokenizer (Problem 6) ─────────────────────────────────────
// Small, dependency-free parser for the inline markdown that leaks into table
// cells: bold, italic, inline code, and links. Pure → unit testable. The React
// renderer (InlineMarkdown) consumes these tokens.

export interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link';
  text: string;
  href?: string;
}

// Order matters: bold (**) before italic (*) so "**x**" isn't mis-split.
const PATTERNS: Array<{ type: InlineToken['type']; re: RegExp }> = [
  { type: 'code', re: /`([^`]+)`/y },
  { type: 'bold', re: /\*\*([^*]+)\*\*/y },
  { type: 'bold', re: /__([^_]+)__/y },
  { type: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/y },
  { type: 'italic', re: /\*([^*]+)\*/y },
  { type: 'italic', re: /_([^_]+)_/y },
];

export function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let text = '';
  let i = 0;

  const flush = () => {
    if (text) { tokens.push({ type: 'text', text }); text = ''; }
  };

  while (i < input.length) {
    let matched = false;
    for (const { type, re } of PATTERNS) {
      re.lastIndex = i;
      const m = re.exec(input);
      if (m && m.index === i) {
        flush();
        if (type === 'link') tokens.push({ type, text: m[1], href: m[2] });
        else tokens.push({ type, text: m[1] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { text += input[i]; i += 1; }
  }
  flush();
  return tokens;
}

/** Strips inline markdown to plain text (for sorting/filtering table cells). */
export function inlineToPlainText(input: string): string {
  return parseInline(input).map((t) => t.text).join('');
}
