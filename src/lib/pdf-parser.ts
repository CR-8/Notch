import { log } from './logger';
import { ensureRuntimePolyfills } from './runtime-polyfills';

export interface ParsedPdf {
  title: string;
  content: string;
  wordCount: number;
}

function deriveTitle(fileName: string, metaTitle?: string): string {
  const cleanedMeta = (metaTitle ?? '').trim();
  if (cleanedMeta.length > 0) return cleanedMeta;

  const base = fileName.replace(/\.pdf$/i, '').trim();
  return base.length > 0 ? base : 'Imported PDF';
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractTextFromPdfBytesFallback(bytes: number[]): string {
  const raw = new TextDecoder('latin1').decode(new Uint8Array(bytes));
  const collected: string[] = [];

  for (const match of raw.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)) {
    const decoded = decodePdfString(match[1]).trim();
    if (decoded) collected.push(decoded);
  }

  for (const match of raw.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const inner = match[1];
    for (const str of inner.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)) {
      const decoded = decodePdfString(str[1]).trim();
      if (decoded) collected.push(decoded);
    }
  }

  return collected
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function parsePdfBytes(bytes: number[], fileName: string): Promise<ParsedPdf> {
  if (!bytes || bytes.length === 0) {
    throw new Error('PDF bytes are empty.');
  }

  ensureRuntimePolyfills();

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '';
    }

    const data = new Uint8Array(bytes);
    const loadingTask = pdfjs.getDocument({
      data,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    });

    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const text = await page.getTextContent();
      const lines = text.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (lines.length > 0) {
        pages.push(lines);
      }

      page.cleanup();
    }

    const meta = await pdf.getMetadata().catch(() => null);
    const title = deriveTitle(fileName, meta?.info?.Title);
    const content = pages.join('\n\n').trim();

    if (content.length === 0) {
      throw new Error('No readable text was found in this PDF.');
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    log.success('pdf-parser', `Parsed PDF "${title}" (${pdf.numPages} pages, ${wordCount} words)`);
    return { title, content, wordCount };
  } catch (err) {
    log.warn('pdf-parser', 'pdfjs parser failed, attempting fallback extraction', err);

    const fallbackContent = extractTextFromPdfBytesFallback(bytes);
    if (!fallbackContent) {
      throw new Error(`PDF import failed: ${(err as Error).message}`);
    }

    const title = deriveTitle(fileName);
    const wordCount = fallbackContent.split(/\s+/).filter(Boolean).length;
    log.warn('pdf-parser', `Parsed PDF with fallback extractor "${title}" (${wordCount} words)`);
    return { title, content: fallbackContent, wordCount };
  }
}
