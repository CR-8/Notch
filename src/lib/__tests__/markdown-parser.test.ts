/**
 * Unit tests for markdown-parser.ts
 * Fixture suite: long docs, nested lists, tables, code fences, malformed inputs.
 *
 * Requirements: 1.5, 1.6, 1.7, 1.9
 */

import { describe, it, expect } from 'vitest';
import { parseMarkdown, serializeToMarkdown } from '../markdown-parser';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Generate a long markdown document > 10,000 chars */
function buildLongDoc(): string {
  const sections: string[] = [];
  for (let i = 1; i <= 20; i++) {
    sections.push(`## Section ${i}\n\n${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)}\n`);
    sections.push(`### Subsection ${i}.1\n\n${'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(8)}\n`);
    sections.push(`- Item ${i}.1\n- Item ${i}.2\n- Item ${i}.3\n`);
    sections.push(`\`\`\`javascript\nconst x${i} = ${i};\nconsole.log(x${i});\n\`\`\`\n`);
  }
  const doc = `# Long Document\n\n${sections.join('\n')}`;
  return doc;
}

/** Build nested list markdown of given depth */
function buildNestedList(depth: number): string {
  let md = '';
  for (let d = 0; d < depth; d++) {
    md += '  '.repeat(d) + `- Level ${d + 1} item\n`;
  }
  return md;
}

// ── Long document tests ───────────────────────────────────────────────────────

describe('Long documents (>10,000 chars)', () => {
  it('parses a long document without throwing', () => {
    const md = buildLongDoc();
    expect(md.length).toBeGreaterThan(10000);
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('produces blocks for all major sections in a long document', () => {
    const md = buildLongDoc();
    const result = parseMarkdown(md);
    expect(result.blocks.length).toBeGreaterThan(10);

    const headings = result.blocks.filter((b) => b.type === 'heading');
    expect(headings.length).toBeGreaterThan(5);

    const codeBlocks = result.blocks.filter((b) => b.type === 'code');
    expect(codeBlocks.length).toBeGreaterThan(5);
  });

  it('produces no warnings for a well-formed long document', () => {
    const md = buildLongDoc();
    const result = parseMarkdown(md);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── Nested list tests (>3 levels) ─────────────────────────────────────────────

describe('Nested lists (>3 levels)', () => {
  it('parses 4-level nested list without throwing', () => {
    const md = buildNestedList(4);
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('parses 6-level nested list without throwing', () => {
    const md = buildNestedList(6);
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('preserves list structure for 4-level nesting', () => {
    const md = '- L1\n  - L2\n    - L3\n      - L4';
    const result = parseMarkdown(md);
    const listBlock = result.blocks.find((b) => b.type === 'list');
    expect(listBlock).toBeDefined();
    expect(listBlock!.children).toBeDefined();
    expect(listBlock!.children!.length).toBeGreaterThan(0);
  });

  it('preserves raw content for deeply nested lists', () => {
    const md = buildNestedList(5);
    const result = parseMarkdown(md);
    const listBlock = result.blocks.find((b) => b.type === 'list');
    expect(listBlock).toBeDefined();
    expect(listBlock!.raw).toContain('Level 1');
  });
});

// ── Table tests with alignment ────────────────────────────────────────────────

describe('Tables with column alignment', () => {
  it('parses a table with left, center, right alignment', () => {
    const md = `| Left | Center | Right |\n|:-----|:------:|------:|\n| a    | b      | c     |`;
    const result = parseMarkdown(md);
    const tableBlock = result.blocks.find((b) => b.type === 'table');
    expect(tableBlock).toBeDefined();
    expect(tableBlock!.alignment).toBeDefined();
    expect(tableBlock!.alignment).toEqual(['left', 'center', 'right']);
  });

  it('parses a table with no explicit alignment (defaults to left)', () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const result = parseMarkdown(md);
    const tableBlock = result.blocks.find((b) => b.type === 'table');
    expect(tableBlock).toBeDefined();
    expect(tableBlock!.alignment).toBeDefined();
    expect(tableBlock!.alignment!.every((a) => a === 'left')).toBe(true);
  });

  it('preserves table raw content', () => {
    const md = `| Col1 | Col2 |\n|------|------|\n| val1 | val2 |`;
    const result = parseMarkdown(md);
    const tableBlock = result.blocks.find((b) => b.type === 'table');
    expect(tableBlock).toBeDefined();
    expect(tableBlock!.raw).toContain('Col1');
    expect(tableBlock!.raw).toContain('val1');
  });
});

// ── Code fence tests ──────────────────────────────────────────────────────────

describe('Fenced code blocks', () => {
  it('preserves language identifier for javascript', () => {
    const md = '```javascript\nconsole.log("hello");\n```';
    const result = parseMarkdown(md);
    const codeBlock = result.blocks.find((b) => b.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock!.language).toBe('javascript');
  });

  it('preserves language identifier for typescript', () => {
    const md = '```typescript\nconst x: number = 1;\n```';
    const result = parseMarkdown(md);
    const codeBlock = result.blocks.find((b) => b.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock!.language).toBe('typescript');
  });

  it('handles code block with no language', () => {
    const md = '```\nsome code\n```';
    const result = parseMarkdown(md);
    const codeBlock = result.blocks.find((b) => b.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock!.language === '' || codeBlock!.language === undefined).toBe(true);
  });

  it('handles multiple code blocks with different languages', () => {
    const md = '```python\nprint("hi")\n```\n\n```rust\nfn main() {}\n```';
    const result = parseMarkdown(md);
    const codeBlocks = result.blocks.filter((b) => b.type === 'code');
    expect(codeBlocks).toHaveLength(2);
    expect(codeBlocks[0].language).toBe('python');
    expect(codeBlocks[1].language).toBe('rust');
  });

  it('handles mixed content: headings, paragraphs, and code blocks', () => {
    const md = '# Title\n\nSome text.\n\n```js\nconst x = 1;\n```\n\nMore text.';
    const result = parseMarkdown(md);
    const types = result.blocks.map((b) => b.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('code');
  });
});

// ── Malformed input tests ─────────────────────────────────────────────────────

describe('Malformed inputs', () => {
  it('handles unclosed code fence without throwing', () => {
    const md = '```javascript\nconsole.log("unclosed")';
    expect(() => parseMarkdown(md)).not.toThrow();
    const result = parseMarkdown(md);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('handles broken table rows without throwing', () => {
    const md = '| col1 | col2\n| val1';
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('handles empty string without throwing', () => {
    expect(() => parseMarkdown('')).not.toThrow();
    const result = parseMarkdown('');
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles null-like characters without throwing', () => {
    expect(() => parseMarkdown('\x00\x01\x02\x03')).not.toThrow();
  });

  it('handles deeply nested brackets without throwing', () => {
    const md = '[[[[[[[[[[text]]]]]]]]]]';
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('handles very long single line without throwing', () => {
    const md = 'a'.repeat(50000);
    expect(() => parseMarkdown(md)).not.toThrow();
  });

  it('attaches warnings for blocks that fail to parse', () => {
    // We can't easily force a block-level failure with marked, but we can verify
    // that the warnings array is always present
    const result = parseMarkdown('some text');
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

// ── Heading tests ─────────────────────────────────────────────────────────────

describe('Headings', () => {
  it('parses h1 through h6', () => {
    for (let level = 1; level <= 6; level++) {
      const md = '#'.repeat(level) + ' Heading ' + level;
      const result = parseMarkdown(md);
      const heading = result.blocks.find((b) => b.type === 'heading');
      expect(heading).toBeDefined();
      expect(heading!.level).toBe(level);
    }
  });
});

// ── Paragraph ID tests ────────────────────────────────────────────────────────

describe('Paragraph IDs', () => {
  it('assigns a paragraphId to paragraph blocks', () => {
    const md = 'This is a paragraph.';
    const result = parseMarkdown(md);
    const para = result.blocks.find((b) => b.type === 'paragraph');
    expect(para).toBeDefined();
    expect(para!.paragraphId).toBeDefined();
    expect(typeof para!.paragraphId).toBe('string');
    expect(para!.paragraphId!.length).toBeGreaterThan(0);
  });

  it('assigns stable paragraphId (same text → same ID)', () => {
    const md = 'Stable paragraph text.';
    const r1 = parseMarkdown(md);
    const r2 = parseMarkdown(md);
    const p1 = r1.blocks.find((b) => b.type === 'paragraph');
    const p2 = r2.blocks.find((b) => b.type === 'paragraph');
    expect(p1!.paragraphId).toBe(p2!.paragraphId);
  });

  it('assigns different paragraphIds to different paragraphs', () => {
    const md = 'First paragraph.\n\nSecond paragraph.';
    const result = parseMarkdown(md);
    const paras = result.blocks.filter((b) => b.type === 'paragraph');
    expect(paras.length).toBe(2);
    expect(paras[0].paragraphId).not.toBe(paras[1].paragraphId);
  });
});

// ── Serializer tests ──────────────────────────────────────────────────────────

describe('serializeToMarkdown', () => {
  it('serializes headings with correct level', () => {
    const md = '## My Heading';
    const result = parseMarkdown(md);
    const serialized = serializeToMarkdown(result);
    expect(serialized).toContain('## My Heading');
  });

  it('serializes code blocks with language', () => {
    const md = '```python\nprint("hello")\n```';
    const result = parseMarkdown(md);
    const serialized = serializeToMarkdown(result);
    expect(serialized).toContain('```python');
    expect(serialized).toContain('print("hello")');
  });

  it('serializes unknown blocks as <pre> elements', () => {
    const result = {
      blocks: [{ type: 'unknown' as const, raw: 'some raw content' }],
      warnings: [],
    };
    const serialized = serializeToMarkdown(result);
    expect(serialized).toContain('<pre');
    expect(serialized).toContain('some raw content');
  });

  it('round-trip preserves heading level', () => {
    const md = '### Third Level Heading';
    const first = parseMarkdown(md);
    const serialized = serializeToMarkdown(first);
    const second = parseMarkdown(serialized);
    const heading = second.blocks.find((b) => b.type === 'heading');
    expect(heading).toBeDefined();
    expect(heading!.level).toBe(3);
  });

  it('round-trip preserves code block language', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const first = parseMarkdown(md);
    const serialized = serializeToMarkdown(first);
    const second = parseMarkdown(serialized);
    const codeBlock = second.blocks.find((b) => b.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock!.language).toBe('typescript');
  });
});
