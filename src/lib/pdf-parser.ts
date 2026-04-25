import { log } from './logger';
import { ensureRuntimePolyfills } from './runtime-polyfills';

export interface ParsedPdf {
  title: string;
  content: string;
  wordCount: number;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err ?? 'Unknown PDF parser error');
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

function decodeUtf16Bytes(bytes: Uint8Array, littleEndian: boolean): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = littleEndian
      ? (bytes[i] | (bytes[i + 1] << 8))
      : ((bytes[i] << 8) | bytes[i + 1]);
    out += String.fromCharCode(code);
  }
  return out;
}

function decodePdfHexString(value: string): string {
  const clean = value.replace(/[^0-9a-fA-F]/g, '');
  if (!clean) return '';

  const evenHex = clean.length % 2 === 0 ? clean : `${clean}0`;
  const pairs = evenHex.match(/.{2}/g);
  if (!pairs) return '';

  const bytes = new Uint8Array(pairs.map(pair => parseInt(pair, 16)));

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Bytes(bytes.subarray(2), false);
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeUtf16Bytes(bytes.subarray(2), true);
  }

  return new TextDecoder('latin1').decode(bytes);
}

function pushIfText(collected: string[], value: string): void {
  const text = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) collected.push(text);
}

function isLikelyReadableText(text: string): boolean {
  const sample = text.slice(0, 12000);
  const compact = sample.replace(/\s+/g, '');
  if (compact.length < 40) return false;

  const wordishTokens = sample
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => /\p{L}{2,}/u.test(token));

  const letters = (sample.match(/\p{L}/gu) ?? []).length;
  const visible = (sample.match(/\S/gu) ?? []).length;
  const controls = (sample.match(/[\u0000-\u001F\u007F]/g) ?? []).length;

  return wordishTokens.length >= 5
    && letters >= 40
    && visible > 0
    && (letters / sample.length) >= 0.12
    && (controls / sample.length) <= 0.02;
}

function collectTextOperators(raw: string, collected: string[]): void {
  const textBlocks = [...raw.matchAll(/BT([\s\S]*?)ET/g)].map(match => match[1]);
  const sources = textBlocks.length > 0 ? textBlocks : [raw];

  for (const source of sources) {
    for (const match of source.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)) {
      pushIfText(collected, decodePdfString(match[1]));
    }

    for (const match of source.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)) {
      pushIfText(collected, decodePdfHexString(match[1]));
    }

    for (const match of source.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*['"]/g)) {
      pushIfText(collected, decodePdfString(match[1]));
    }

    for (const match of source.matchAll(/<([0-9a-fA-F\s]+)>\s*['"]/g)) {
      pushIfText(collected, decodePdfHexString(match[1]));
    }

    for (const match of source.matchAll(/\[(.*?)\]\s*TJ/gs)) {
      const inner = match[1];

      for (const str of inner.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)) {
        pushIfText(collected, decodePdfString(str[1]));
      }

      for (const str of inner.matchAll(/<([0-9a-fA-F\s]+)>/g)) {
        pushIfText(collected, decodePdfHexString(str[1]));
      }
    }
  }
}

function findEndStreamIndex(raw: string, streamStart: number): number {
  const markers = ['\r\nendstream', '\nendstream', '\rendstream', 'endstream'];
  let best = -1;

  for (const marker of markers) {
    const idx = raw.indexOf(marker, streamStart);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
    }
  }

  return best;
}

async function inflateFlateStream(streamBytes: Uint8Array): Promise<string | null> {
  const Ctor = (globalThis as {
    DecompressionStream?: new (format: string) => TransformStream;
  }).DecompressionStream;

  if (!Ctor) return null;

  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const inflated = new Blob([streamBytes]).stream().pipeThrough(new Ctor(format));
      const buffer = await new Response(inflated).arrayBuffer();
      return new TextDecoder('latin1').decode(new Uint8Array(buffer));
    } catch {
      // Try the next compression format.
    }
  }

  return null;
}

async function extractTextFromPdfBytesFallback(bytes: number[]): Promise<string> {
  const rawBytes = new Uint8Array(bytes);
  const raw = new TextDecoder('latin1').decode(rawBytes);
  const collected: string[] = [];

  collectTextOperators(raw, collected);

  const flateStreamPattern = /<<[\s\S]*?>>\s*stream\r?\n/g;
  let inspected = 0;
  let match: RegExpExecArray | null = null;

  while ((match = flateStreamPattern.exec(raw)) && inspected < 200) {
    inspected += 1;

    const dictionary = match[0];
    if (!/\/FlateDecode\b/.test(dictionary)) {
      continue;
    }

    const streamStart = flateStreamPattern.lastIndex;
    let streamEnd = -1;

    const lengthMatch = dictionary.match(/\/Length\s+(\d+)/);
    if (lengthMatch) {
      const byteLength = Number.parseInt(lengthMatch[1], 10);
      if (Number.isFinite(byteLength) && byteLength > 0 && streamStart + byteLength <= rawBytes.length) {
        streamEnd = streamStart + byteLength;
      }
    }

    if (streamEnd <= streamStart) {
      streamEnd = findEndStreamIndex(raw, streamStart);
    }

    if (streamEnd <= streamStart || streamEnd > rawBytes.length) {
      continue;
    }

    const inflated = await inflateFlateStream(rawBytes.slice(streamStart, streamEnd));
    if (inflated) {
      collectTextOperators(inflated, collected);
    }

    flateStreamPattern.lastIndex = streamEnd;
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

    if (!isLikelyReadableText(content)) {
      throw new Error('No readable text was found in this PDF.');
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    log.success('pdf-parser', `Parsed PDF "${title}" (${pdf.numPages} pages, ${wordCount} words)`);
    return { title, content, wordCount };
  } catch (err) {
    log.warn('pdf-parser', 'pdfjs parser failed, attempting fallback extraction', err);

    const fallbackContent = await extractTextFromPdfBytesFallback(bytes);
    if (!isLikelyReadableText(fallbackContent)) {
      throw new Error(
        `PDF import failed: could not extract readable text. ` +
        `The PDF may be image-only/scanned or use unsupported encoding. (pdfjs: ${errorMessage(err)})`,
      );
    }

    const title = deriveTitle(fileName);
    const wordCount = fallbackContent.split(/\s+/).filter(Boolean).length;
    log.warn('pdf-parser', `Parsed PDF with fallback extractor "${title}" (${wordCount} words)`);
    return { title, content: fallbackContent, wordCount };
  }
}
