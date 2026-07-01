import type { LayoutInput } from './types';

const COMPARISON_PATTERNS = [
  /\b(compare|comparison|versus|vs\.?|alternative)\b/i,
  /\b(advantages?|disadvantages?|benefits?|drawbacks?|pros?|cons?)\b/i,
  /\b(better|worse|faster|slower|cheaper|higher|lower|more efficient)\b/i,
  /\b(feature|capability|supported|unsupported)\b/i,
  /\b(model\s+\w+\s*(?:=|:)\s*\d+)/i,
  /\b((\w+)\s*(?:=|:)\s*\d+[%x])/i,
];

const BENCHMARK_PATTERN = /(\w+)\s*(?:=|:)\s*(\d+(?:\.\d+)?\s*[%×xX])/g;

function containsComparisonLanguage(text: string): boolean {
  return COMPARISON_PATTERNS.some((p) => p.test(text));
}

function extractBenchmarkPairs(text: string): string[][] {
  const pairs: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = BENCHMARK_PATTERN.exec(text)) !== null) {
    pairs.push([m[1].trim(), m[2].trim()]);
  }
  return pairs;
}

export function detectAndGenerateTables(md: string, input: LayoutInput): string {
  let result = md;

  const paragraphs = result.split(/\n\n+/);
  const newParagraphs: string[] = [];

  for (const para of paragraphs) {
    newParagraphs.push(para);

    if (para.trim().length > 40 && containsComparisonLanguage(para)) {
      const pairs = extractBenchmarkPairs(para);
      if (pairs.length >= 2) {
        const header = '| Item | Value |';
        const sep = '| --- | --- |';
        const rows = pairs.map(([item, val]) => `| ${item} | ${val} |`).join('\n');
        newParagraphs.push(`\n${header}\n${sep}\n${rows}\n`);
      }
    }
  }

  result = newParagraphs.join('\n\n');

  if (input.timeline.length >= 2) {
    const header = '| Date | Event |';
    const sep = '| --- | --- |';
    const rows = input.timeline.map((t) => `| ${t.year} | ${t.event.slice(0, 120)} |`).join('\n');
    result += `\n\n## Timeline\n\n${header}\n${sep}\n${rows}\n`;
  }

  if (input.concepts.length >= 2) {
    const header = '| Concept | Definition |';
    const sep = '| --- | --- |';
    const rows = input.concepts
      .slice(0, 12)
      .map((c) => {
        const def = c.definition.length > 120 ? c.definition.slice(0, 120) + '…' : c.definition;
        return `| **${c.concept}** | ${def} |`;
      })
      .join('\n');
    result += `\n\n## Concepts\n\n${header}\n${sep}\n${rows}\n`;
  }

  return result;
}
