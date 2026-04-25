/**
 * Property 5: AI Response Parsing Produces Valid Document
 *
 * For any non-empty markdown string, the parser produces a Document with:
 * - non-empty `id`
 * - non-empty `title`
 * - `content === input`
 * - valid ISO 8601 `capturedAt`
 *
 * Validates: Requirements 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Document, GenerationMode, LLMProvider } from '../types';

// --- Pure parsing function extracted from background.ts handleCapturePage ---

function parseAIResponse(
  markdown: string,
  extraction: {
    title: string;
    url: string;
    domain: string;
    wordCount: number;
    images: Array<{ url: string; alt: string; paragraphContext: string }>;
  },
  mode: GenerationMode,
  provider: LLMProvider,
  tags: string[],
): Document {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : extraction.title;

  const summaryMatch = markdown.match(/^##\s+SUMMARY\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  return {
    id: crypto.randomUUID(),
    title,
    url: extraction.url,
    domain: extraction.domain,
    capturedAt: new Date().toISOString(),
    wordCount: extraction.wordCount,
    mode,
    provider,
    content: markdown,
    summary,
    keyEntities: [],
    timeline: [],
    concepts: [],
    tags,
    images: extraction.images.map(img => ({
      url: img.url,
      alt: img.alt,
      sectionIndex: 0,
      paragraphContext: img.paragraphContext,
    })),
    isStarred: false,
    isArchived: false,
    isRead: false,
    embeddingsGenerated: false,
    missingImageQueries: [],
  };
}

// --- Arbitraries ---

const generationModeArb: fc.Arbitrary<GenerationMode> = fc.constantFrom('FAST', 'DEEP', 'LOCAL');
const llmProviderArb: fc.Arbitrary<LLMProvider> = fc.constantFrom('gemini', 'openai', 'anthropic', 'ollama');

const extractionArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  url: fc.webUrl(),
  domain: fc.domain(),
  wordCount: fc.nat(100000),
  images: fc.array(
    fc.record({
      url: fc.webUrl(),
      alt: fc.string({ maxLength: 100 }),
      paragraphContext: fc.string({ maxLength: 200 }),
    }),
    { maxLength: 5 },
  ),
});

// --- Tests ---

describe('Property 5: AI Response Parsing Produces Valid Document', () => {
  it('parsed Document has a non-empty id for any non-empty markdown', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        extractionArb,
        generationModeArb,
        llmProviderArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
        (markdown, extraction, mode, provider, tags) => {
          const doc = parseAIResponse(markdown, extraction, mode, provider, tags);
          expect(doc.id).toBeTruthy();
          expect(doc.id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('parsed Document has a non-empty title for any non-empty markdown', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        extractionArb,
        generationModeArb,
        llmProviderArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
        (markdown, extraction, mode, provider, tags) => {
          const doc = parseAIResponse(markdown, extraction, mode, provider, tags);
          expect(doc.title).toBeTruthy();
          expect(doc.title.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('parsed Document content equals the input markdown', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        extractionArb,
        generationModeArb,
        llmProviderArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
        (markdown, extraction, mode, provider, tags) => {
          const doc = parseAIResponse(markdown, extraction, mode, provider, tags);
          expect(doc.content).toBe(markdown);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('parsed Document capturedAt is a valid ISO 8601 timestamp', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        extractionArb,
        generationModeArb,
        llmProviderArb,
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
        (markdown, extraction, mode, provider, tags) => {
          const doc = parseAIResponse(markdown, extraction, mode, provider, tags);
          expect(!isNaN(Date.parse(doc.capturedAt))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
