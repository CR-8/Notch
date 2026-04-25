/**
 * Property 10: Markdown Export Preserves Required Fields
 *
 * For any Document, the exported markdown string SHALL contain the document
 * title, source URL, capture date, and all structured content sections, with
 * Mermaid and PlantUML fenced code blocks preserved with their correct
 * language identifiers.
 *
 * Validates: Requirements 5.1, 5.2, 5.4
 *
 * Property 11: Image Positions Preserved in Export
 *
 * For any Document where doc.content contains image markdown references
 * (![alt](url)), each image reference SHALL appear in the exported markdown
 * at the same relative position as in doc.content.
 *
 * Validates: Requirements 5.5, 9.5
 *
 * Property 13: PDF Export Embeds Diagrams as Inline SVG (pure logic variant)
 *
 * For any Document containing Mermaid/PlantUML fenced code blocks,
 * buildMarkdownExport preserves those blocks with their correct language
 * identifiers — a prerequisite for the PDF export transformation to work.
 *
 * Validates: Requirements 5.6, 5.7, 7.6, 8.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildMarkdownExport } from '../export';
import type {
  Document,
  Entity,
  TimelineEvent,
  Concept,
  ImageRef,
  GenerationMode,
  LLMProvider,
} from '../types';

// ── Arbitraries ───────────────────────────────────────────────────────────────

const generationModeArb: fc.Arbitrary<GenerationMode> = fc.constantFrom('FAST', 'DEEP', 'LOCAL');
const llmProviderArb: fc.Arbitrary<LLMProvider> = fc.constantFrom('gemini', 'openai', 'anthropic', 'ollama');

const entityArb: fc.Arbitrary<Entity> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.string({ minLength: 1, maxLength: 30 }),
  paragraphIndex: fc.nat(100),
});

const timelineEventArb: fc.Arbitrary<TimelineEvent> = fc.record({
  date: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  paragraphIndex: fc.nat(100),
});

const conceptArb: fc.Arbitrary<Concept> = fc.record({
  term: fc.string({ minLength: 1, maxLength: 50 }),
  definition: fc.string({ minLength: 1, maxLength: 300 }),
  paragraphIndex: fc.nat(100),
});

const imageRefArb: fc.Arbitrary<ImageRef> = fc.record({
  url: fc.webUrl(),
  alt: fc.string({ maxLength: 100 }),
  sectionIndex: fc.nat(50),
  paragraphContext: fc.string({ maxLength: 200 }),
});

/** Builds a Document with arbitrary content (no special blocks). */
const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.webUrl(),
  domain: fc.domain(),
  capturedAt: fc
    .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map((ms) => new Date(ms).toISOString()),
  wordCount: fc.nat(100000),
  mode: generationModeArb,
  provider: llmProviderArb,
  content: fc.string({ maxLength: 5000 }),
  summary: fc.string({ maxLength: 500 }),
  keyEntities: fc.array(entityArb, { maxLength: 10 }),
  timeline: fc.array(timelineEventArb, { maxLength: 10 }),
  concepts: fc.array(conceptArb, { maxLength: 10 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 20 }),
  images: fc.array(imageRefArb, { maxLength: 10 }),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }),
});

/** Builds a safe tag string (no double-quotes, no newlines) for front-matter. */
const safeTagArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => !s.includes('"') && !s.includes('\n') && !s.includes('\r'),
);

/** Builds a Document whose title/url/capturedAt are safe for YAML front-matter. */
const safeDocumentArb: fc.Arbitrary<Document> = documentArb.chain((doc) =>
  fc
    .record({
      title: fc.string({ minLength: 1, maxLength: 100 }).filter(
        (s) => !s.includes('"') && !s.includes('\n'),
      ),
      tags: fc.array(safeTagArb, { maxLength: 10 }),
    })
    .map(({ title, tags }) => ({ ...doc, title, tags })),
);

/** Builds a Document whose content contains one or more ```mermaid blocks. */
const mermaidContentArb = fc
  .tuple(
    fc.string({ maxLength: 200 }),
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.string({ maxLength: 200 }),
  )
  .map(([before, diagram, after]) => `${before}\n\`\`\`mermaid\n${diagram}\n\`\`\`\n${after}`);

const documentWithMermaidArb: fc.Arbitrary<Document> = documentArb.chain((doc) =>
  mermaidContentArb.map((content) => ({ ...doc, content })),
);

/** Builds a Document whose content contains one or more ```plantuml blocks. */
const plantumlContentArb = fc
  .tuple(
    fc.string({ maxLength: 200 }),
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.string({ maxLength: 200 }),
  )
  .map(([before, diagram, after]) => `${before}\n\`\`\`plantuml\n${diagram}\n\`\`\`\n${after}`);

const documentWithPlantUMLArb: fc.Arbitrary<Document> = documentArb.chain((doc) =>
  plantumlContentArb.map((content) => ({ ...doc, content })),
);

/** Builds a Document whose content contains image markdown references. */
const imageMarkdownArb = fc
  .tuple(
    fc.string({ maxLength: 100 }),
    fc.string({ maxLength: 50 }).filter((s) => !s.includes(']')),
    fc.webUrl(),
    fc.string({ maxLength: 100 }),
  )
  .map(([before, alt, url, after]) => ({ before, alt, url, after }));

const documentWithImagesArb: fc.Arbitrary<{ doc: Document; imageRefs: Array<{ alt: string; url: string }> }> =
  documentArb.chain((doc) =>
    fc.array(imageMarkdownArb, { minLength: 1, maxLength: 5 }).map((refs) => {
      const content = refs
        .map(({ before, alt, url, after }) => `${before}\n![${alt}](${url})\n${after}`)
        .join('\n');
      return {
        doc: { ...doc, content },
        imageRefs: refs.map(({ alt, url }) => ({ alt, url })),
      };
    }),
  );

// ── Property 10: Markdown Export Preserves Required Fields ───────────────────

describe('Property 10: Markdown Export Preserves Required Fields', () => {
  it('exported markdown contains the document title in front-matter', () => {
    fc.assert(
      fc.property(safeDocumentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        expect(output).toContain(`title: "${doc.title}"`);
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown contains the source URL in front-matter', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        expect(output).toContain(`source: "${doc.url}"`);
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown contains the capture date in front-matter', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        expect(output).toContain(`captured: "${doc.capturedAt}"`);
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown contains all tags in front-matter', () => {
    fc.assert(
      fc.property(safeDocumentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        for (const tag of doc.tags) {
          expect(output).toContain(`"${tag}"`);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown contains the full doc.content', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        expect(output).toContain(doc.content);
      }),
      { numRuns: 100 },
    );
  });

  it('front-matter appears before doc.content in the output', () => {
    fc.assert(
      fc.property(documentArb, (doc) => {
        const output = buildMarkdownExport(doc);
        // Output always starts with '---\n'
        expect(output.startsWith('---\n')).toBe(true);
        // The closing front-matter delimiter must exist
        const closingDelimiter = output.indexOf('\n---\n', 4);
        expect(closingDelimiter).toBeGreaterThan(0);
        // Everything after the closing delimiter is the content section
        const afterFrontmatter = output.slice(closingDelimiter + 5); // skip '\n---\n'
        // doc.content must appear in the section after the front-matter
        expect(afterFrontmatter).toContain(doc.content);
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown preserves mermaid fenced code blocks unchanged', () => {
    fc.assert(
      fc.property(documentWithMermaidArb, (doc) => {
        const output = buildMarkdownExport(doc);
        // The mermaid block from doc.content must appear verbatim in output
        const mermaidBlockRegex = /```mermaid\n[\s\S]*?\n```/g;
        const inputBlocks = doc.content.match(mermaidBlockRegex) ?? [];
        for (const block of inputBlocks) {
          expect(output).toContain(block);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('exported markdown preserves plantuml fenced code blocks unchanged', () => {
    fc.assert(
      fc.property(documentWithPlantUMLArb, (doc) => {
        const output = buildMarkdownExport(doc);
        const plantumlBlockRegex = /```plantuml\n[\s\S]*?\n```/g;
        const inputBlocks = doc.content.match(plantumlBlockRegex) ?? [];
        for (const block of inputBlocks) {
          expect(output).toContain(block);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 11: Image Positions Preserved in Export ─────────────────────────

describe('Property 11: Image Positions Preserved in Export', () => {
  it('each image reference in doc.content appears in the exported markdown', () => {
    fc.assert(
      fc.property(documentWithImagesArb, ({ doc, imageRefs }) => {
        const output = buildMarkdownExport(doc);
        for (const { alt, url } of imageRefs) {
          expect(output).toContain(`![${alt}](${url})`);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('image references appear at the same relative positions as in doc.content', () => {
    fc.assert(
      fc.property(documentWithImagesArb, ({ doc, imageRefs }) => {
        const output = buildMarkdownExport(doc);
        // The content portion of the output starts after the front-matter
        const contentStart = output.indexOf(doc.content);
        expect(contentStart).toBeGreaterThanOrEqual(0);

        // For each image, its position in the output (relative to content start)
        // must equal its position in doc.content
        for (const { alt, url } of imageRefs) {
          const ref = `![${alt}](${url})`;
          const posInContent = doc.content.indexOf(ref);
          const posInOutput = output.indexOf(ref, contentStart);
          if (posInContent >= 0) {
            expect(posInOutput - contentStart).toBe(posInContent);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 13: PDF Export — Fenced Blocks Preserved for Transformation ─────

describe('Property 13: PDF Export — Fenced Code Blocks Preserved with Correct Language Identifiers', () => {
  it('mermaid blocks in doc.content appear in export with the "mermaid" language identifier', () => {
    fc.assert(
      fc.property(documentWithMermaidArb, (doc) => {
        const output = buildMarkdownExport(doc);
        // Every ```mermaid block from content must survive into the export
        const mermaidFenceRegex = /```mermaid/g;
        const inputCount = (doc.content.match(mermaidFenceRegex) ?? []).length;
        const outputCount = (output.match(mermaidFenceRegex) ?? []).length;
        expect(outputCount).toBe(inputCount);
      }),
      { numRuns: 100 },
    );
  });

  it('plantuml blocks in doc.content appear in export with the "plantuml" language identifier', () => {
    fc.assert(
      fc.property(documentWithPlantUMLArb, (doc) => {
        const output = buildMarkdownExport(doc);
        const plantumlFenceRegex = /```plantuml/g;
        const inputCount = (doc.content.match(plantumlFenceRegex) ?? []).length;
        const outputCount = (output.match(plantumlFenceRegex) ?? []).length;
        expect(outputCount).toBe(inputCount);
      }),
      { numRuns: 100 },
    );
  });

  it('no mermaid or plantuml block is stripped or renamed during export', () => {
    fc.assert(
      fc.property(documentWithMermaidArb, (doc) => {
        const output = buildMarkdownExport(doc);
        // The language identifier must not be changed to something else
        const mermaidBlocks = (output.match(/```mermaid/g) ?? []).length;
        const inputMermaidBlocks = (doc.content.match(/```mermaid/g) ?? []).length;
        expect(mermaidBlocks).toBeGreaterThanOrEqual(inputMermaidBlocks);
      }),
      { numRuns: 100 },
    );
  });
});
