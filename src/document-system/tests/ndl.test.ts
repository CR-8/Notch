/**
 * NDL Parser Tests
 *
 * Tests the full parse → validate → transform → export pipeline.
 */

import { describe, it, expect } from 'vitest';
import { parseDocument } from '../parser';
import { validate } from '../validator';
import { transform } from '../transformers';
import { exportToMarkdown } from '../exporters/markdown';
import { exportToPrintHTML } from '../exporters/pdf';

/* ── Basic Markdown ──────────────────────────────────────────────────── */

describe('NDL Parser', () => {
  it('parses a simple document with title and paragraph', () => {
    const doc = parseDocument('# Hello\n\nThis is a paragraph.');
    expect(doc.title).toBe('Hello');
    expect(doc.metadata.wordCount).toBeGreaterThan(0);
    expect(doc.nodes.length).toBeGreaterThanOrEqual(2);
    expect(doc.nodes[0].type).toBe('heading');
    expect(doc.nodes[1].type).toBe('paragraph');
  });

  it('parses heading hierarchy correctly', () => {
    const doc = parseDocument('# A\n\n## B\n\n### C\n\n## D');
    const headings = doc.nodes.filter((n) => n.type === 'heading');
    expect(headings).toHaveLength(4);
    expect((headings[0] as any).level).toBe(1);
    expect((headings[1] as any).level).toBe(2);
    expect((headings[2] as any).level).toBe(3);
    expect((headings[3] as any).level).toBe(2);
  });

  it('builds TOC hierarchy from headings', () => {
    const doc = parseDocument('# Root\n\n## Child\n\n### Grandchild\n\n## Child2');
    expect(doc.hierarchy.toc).toHaveLength(1);
    expect(doc.hierarchy.toc[0].text).toBe('Root');
    expect(doc.hierarchy.toc[0].children).toHaveLength(2);
    expect(doc.hierarchy.toc[0].children[0].children).toHaveLength(1);
  });
});

/* ── Lists ───────────────────────────────────────────────────────────── */

describe('NDL Parser — Lists', () => {
  it('parses unordered lists', () => {
    const doc = parseDocument('- Item 1\n- Item 2\n- Item 3');
    const lists = doc.nodes.filter((n) => n.type === 'list');
    expect(lists.length).toBeGreaterThanOrEqual(1);
    const list = lists[0] as any;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
  });

  it('parses ordered lists', () => {
    const doc = parseDocument('1. First\n2. Second\n3. Third');
    const lists = doc.nodes.filter((n) => n.type === 'list');
    const list = lists[0] as any;
    expect(list.ordered).toBe(true);
    expect(list.items).toHaveLength(3);
  });
});

/* ── Code Blocks ─────────────────────────────────────────────────────── */

describe('NDL Parser — Code Blocks', () => {
  it('parses code blocks with language', () => {
    const doc = parseDocument('```typescript\nconst x = 1;\n```');
    const codes = doc.nodes.filter((n) => n.type === 'code');
    expect(codes).toHaveLength(1);
    const code = codes[0] as any;
    expect(code.language).toBe('typescript');
    expect(code.content).toContain('const x = 1');
  });

  it('normalizes language aliases', () => {
    const doc = parseDocument('```ts\nlet y = 1;\n```');
    const doc2 = transform(doc, { normalizeLanguages: true });
    const code = doc2.nodes.find((n) => n.type === 'code') as any;
    expect(code.language).toBe('typescript');
  });

  it('detects mermaid code blocks as diagrams', () => {
    const doc = parseDocument('```mermaid\nflowchart TD\nA-->B\n```');
    const diagrams = doc.nodes.filter((n) => n.type === 'diagram');
    expect(diagrams).toHaveLength(1);
    const d = diagrams[0] as any;
    expect(d.engine).toBe('mermaid');
    expect(d.content).toContain('flowchart TD');
  });
});

/* ── Callouts ────────────────────────────────────────────────────────── */

describe('NDL Parser — Callouts', () => {
  it('detects GFM callouts in blockquotes', () => {
    const doc = parseDocument('> [!NOTE]\n> This is a note');
    const callouts = doc.nodes.filter((n) => n.type === 'callout');
    expect(callouts.length).toBeGreaterThanOrEqual(1);
    const c = callouts[0] as any;
    expect(c.kind).toBe('note');
  });

  it('handles all callout kinds', () => {
    const kinds = [
      'NOTE',
      'WARNING',
      'TIP',
      'DANGER',
      'INFO',
      'IMPORTANT',
      'CAUTION',
      'SUCCESS',
      'QUESTION',
    ];
    for (const kind of kinds) {
      const doc = parseDocument(`> [!${kind}]\n> Callout content`);
      const callouts = doc.nodes.filter((n) => n.type === 'callout') as any[];
      expect(callouts.length).toBeGreaterThanOrEqual(1);
      expect(callouts[0].kind).toBe(kind.toLowerCase());
    }
  });
});

/* ── Tables ──────────────────────────────────────────────────────────── */

describe('NDL Parser — Tables', () => {
  it('parses markdown tables', () => {
    const doc = parseDocument('| A | B |\n|---|---|\n| 1 | 2 |');
    const tables = doc.nodes.filter((n) => n.type === 'table');
    expect(tables).toHaveLength(1);
    const t = tables[0] as any;
    expect(t.columns).toHaveLength(2);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0][0]).toBe('1');
  });

  it('handles alignment', () => {
    const doc = parseDocument('| L | C | R |\n|:---|:---:|---:|\n| a | b | c |');
    const t = doc.nodes.find((n) => n.type === 'table') as any;
    expect(t.columns[0].align).toBe('left');
    expect(t.columns[1].align).toBe('center');
    expect(t.columns[2].align).toBe('right');
  });
});

/* ── Images & Media ──────────────────────────────────────────────────── */

describe('NDL Parser — Images', () => {
  it('parses images', () => {
    const doc = parseDocument('![Alt text](https://example.com/img.png)');
    const images = doc.nodes.filter((n) => n.type === 'image');
    expect(images.length).toBeGreaterThanOrEqual(1);
    const img = images[0] as any;
    expect(img.alt).toBe('Alt text');
    expect(img.url).toBe('https://example.com/img.png');
  });
});

/* ── Equations ────────────────────────────────────────────────────────── */

describe('NDL Parser — Equations', () => {
  it('treats $$ as paragraph content', () => {
    const doc = parseDocument('$$E = mc^2$$');
    // $$ is inline in paragraphs; so we'll have a paragraph
    const paragraphs = doc.nodes.filter((n) => n.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
  });
});

/* ── Validation ───────────────────────────────────────────────────────── */

describe('NDL Validator', () => {
  it('validates a correct document with no errors', () => {
    const doc = parseDocument('# Valid\n\nContent here.');
    const result = validate(doc);
    expect(result.valid).toBe(true);
  });

  it('warns on heading hierarchy jumps', () => {
    const doc = parseDocument('# A\n\n### C');
    const result = validate(doc);
    const hierarchyErrors = result.errors.filter((e) => e.rule === 'heading-hierarchy');
    expect(hierarchyErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on empty sections', () => {
    const doc = parseDocument('# A\n\n## B\n\n## C\n\nContent');
    const result = validate(doc);
    const empties = result.warnings.filter((w) => w.rule === 'empty-section');
    // "B" has no content after it
    expect(empties.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on missing image alt text', () => {
    const doc = parseDocument('![](https://example.com/img.png)');
    const result = validate(doc);
    const altWarnings = result.warnings.filter((w) => w.rule === 'image-alt');
    expect(altWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('validates allowed callout kinds', () => {
    const doc = parseDocument('> [!NOTE]\n> Note content');
    const result = validate(doc, {
      allowedCallouts: ['info', 'warning'],
      strict: true,
    });
    const calloutErrors = result.errors.filter((e) => e.rule === 'callout-kind');
    expect(calloutErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('validates code language', () => {
    const doc = parseDocument('```unknownlang\ncode\n```');
    const result = validate(doc, { strict: true });
    const langErrors = result.errors.filter((e) => e.rule === 'code-language');
    expect(langErrors.length).toBeGreaterThanOrEqual(1);
  });
});

/* ── Transformers ────────────────────────────────────────────────────── */

describe('NDL Transformers', () => {
  it('adds IDs to nodes when generateIds is true', () => {
    const doc = parseDocument('# Title\n\nPara.');
    const transformed = transform(doc, { generateIds: true });
    for (const node of transformed.nodes) {
      expect(node.id).toBeTruthy();
    }
  });

  it('does not overwrite existing IDs', () => {
    const doc = parseDocument('# Hello\n\nWorld.');
    const t1 = transform(doc, { generateIds: true });
    const t2 = transform(t1, { generateIds: true });
    expect(t2.nodes[0].id).toBe(t1.nodes[0].id);
  });
});

/* ── Exporters ────────────────────────────────────────────────────────── */

describe('NDL Exporters', () => {
  it('exports to markdown round-trips', () => {
    const original = '# Round Trip\n\nA paragraph.\n\n- Item 1\n- Item 2';
    const doc = parseDocument(original);
    const md = exportToMarkdown(doc);
    expect(md).toBeTruthy();
    expect(md).toContain('Round Trip');
    expect(md).toContain('paragraph');
    expect(md).toContain('Item');
  });

  it('exports to print HTML', () => {
    const doc = parseDocument('# Print Doc\n\nContent to print.');
    const html = exportToPrintHTML(doc, { title: 'Print Test', includeTOC: false });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Print Doc');
    expect(html).toContain('Content to print');
    expect(html).toContain('@page');
  });

  it('exports markdown with metadata', () => {
    const doc = parseDocument('# Meta Doc\n\nSome content.');
    doc.metadata.tags = ['test', 'example'];
    const md = exportToMarkdown(doc, { includeMetadata: true });
    expect(md).toContain('title:');
    expect(md).toContain('tags:');
  });
});

/* ── Full Pipeline ────────────────────────────────────────────────────── */

describe('NDL Full Pipeline', () => {
  it('parse → validate → transform → export produces valid output', () => {
    const input = `# Pipeline Test

A complete pipeline test document.

## Section 1

This section has content.

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

## Section 2

> [!NOTE]
> This is a note inside a section.

### Subsection

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

| Name | Value |
|------|-------|
| Test | 42    |

## Section 3

Final content.`;

    const doc = parseDocument(input);
    expect(doc.nodes.length).toBeGreaterThan(0);

    const validation = validate(doc);
    expect(validation.valid).toBe(true);

    const transformed = transform(doc);
    expect(transformed.nodes.every((n) => n.id)).toBe(true);

    const md = exportToMarkdown(transformed);
    expect(md).toContain('Pipeline Test');
    expect(md).toContain('Hello, world!');

    const html = exportToPrintHTML(transformed, { title: 'Pipeline Test' });
    expect(html).toContain('Pipeline Test');
  });
});
