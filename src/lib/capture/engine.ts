import type { DOMExtraction } from '../types';
import { log } from '../logger';
import { classifyDocument } from './classification/classifier';
import { extractKnowledge } from './extraction/extractors';
import type { CaptureResult, ExtractedTable } from './types';

function isRelevantImageUrl(url: string): boolean {
  if (
    !url ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('chrome-extension:') ||
    url.startsWith('about:')
  )
    return false;
  const u = url.toLowerCase();
  if (
    u.includes('favicon') ||
    u.includes('logo') ||
    /icon/i.test(u) ||
    /avatar/i.test(u) ||
    /spacer/i.test(u) ||
    /pixel/i.test(u) ||
    /tracking/i.test(u) ||
    /banner/i.test(u) ||
    /badge/i.test(u)
  )
    return false;
  if (/[0-9]+x[0-9]+/.test(u) && !u.includes('thumbnail') && !u.includes('figure')) return false;
  if (u.endsWith('.svg')) return false;
  return true;
}

function extractionToCaptureInput(extraction: DOMExtraction) {
  return {
    rawContent: extraction.textContent,
    cleanedHtml: extraction.cleanedHtml,
    images: extraction.images
      .filter((i) => isRelevantImageUrl(i.url))
      .map((i) => ({
        url: i.url,
        alt: i.alt,
        paragraphContext: i.paragraphContext,
      })),
    videos: extraction.videos.map((v) => ({
      url: v.url,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
    })),
    isPdf: extraction.isPdf ?? false,
    isPaper: extraction.isPaper ?? false,
    wordCount: extraction.wordCount,
    title: extraction.title,
    url: extraction.url,
    domain: extraction.domain,
    metaDescription: extraction.metaDescription,
  };
}

export function runCaptureEngine(extraction: DOMExtraction): CaptureResult {
  const input = extractionToCaptureInput(extraction);

  const classification = classifyDocument(input.rawContent, {
    isPaper: input.isPaper,
    wordCount: input.wordCount,
  });

  const knowledge = extractKnowledge(input.rawContent);

  const tables: ExtractedTable[] = [];
  if (input.cleanedHtml) {
    tables.push(...extractHtmlTables(input.cleanedHtml));
  }

  const result: CaptureResult = {
    rawContent: input.rawContent,
    cleanedHtml: input.cleanedHtml,
    images: input.images,
    videos: input.videos,
    tables,
    metadata: {
      title: input.title,
      url: input.url,
      domain: input.domain,
      wordCount: input.wordCount,
      capturedAt: new Date().toISOString(),
      metaDescription: input.metaDescription,
      isPdf: input.isPdf,
    },
    documentClass: classification.documentClass,
    classificationConfidence: classification.confidence,
    entities: knowledge.entities,
    concepts: knowledge.concepts,
    timeline: knowledge.timeline,
    relationships: knowledge.relationships,
    topics: knowledge.topics,
    complexity: knowledge.complexity,
  };

  log.info(
    'capture',
    `Engine output: class=${result.documentClass} confidence=${result.classificationConfidence} entities=${result.entities.length} concepts=${result.concepts.length} timeline=${result.timeline.length} images=${result.images.length} tables=${result.tables.length}`,
  );

  return result;
}

function extractHtmlTables(html: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    try {
      const tableHtml = tableMatch[1];

      const headers: string[] = [];
      const headerRegex = /<th[^>]*>(.*?)<\/th>/gi;
      let headerMatch: RegExpExecArray | null;
      while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
        headers.push(headerMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const cells: string[] = [];
        const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gi;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
        }
        if (cells.length > 0) rows.push(cells);
      }

      if (rows.length > 1) {
        tables.push({ headers, rows });
      }
    } catch {
      continue;
    }
  }

  return tables;
}
