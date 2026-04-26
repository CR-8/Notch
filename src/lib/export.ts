import html2canvas from 'html2canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Document } from './types';
import { getChunksByDocument, getEmbeddingsByDocument } from './idb';
import { log } from './logger';

export interface PDFExportOptions {
  sourceElement?: HTMLElement | null;
  theme?: 'dark' | 'light';
}

const PDF_PAGE_WIDTH = 595.28; // A4 portrait width in points
const PDF_PAGE_HEIGHT = 841.89; // A4 portrait height in points
const PDF_PAGE_MARGIN = 28;
const MEDIA_WAIT_TIMEOUT_MS = 5000;
const MEDIA_WAIT_POLL_MS = 120;

// ── Markdown Export ───────────────────────────────────────────────────────────

// ... (existing buildMarkdownExport and downloadMarkdown remain the same)
export function buildMarkdownExport(doc: Document): string {
  const frontmatter = [
    '---',
    `title: "${doc.title}"`,
    `source: "${doc.url}"`,
    `captured: "${doc.capturedAt}"`,
    `tags: [${doc.tags.map((t) => `"${t}"`).join(', ')}]`,
    '---',
    '',
  ].join('\n');
  return frontmatter + doc.content;
}

export function downloadMarkdown(doc: Document): void {
  const markdown = buildMarkdownExport(doc);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'document';
  a.href = url;
  a.download = `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF Export (RAG Enabled) ──────────────────────────────────────────────────

// ── WinAnsi sanitiser ────────────────────────────────────────────────────────
// pdf-lib's StandardFonts (Times Roman, Helvetica, etc.) only support WinAnsi
// (code points 0x20–0xFF). Any character outside that range throws at
// widthOfTextAtSize / drawText time. Strip them out rather than crash.
function toWinAnsi(text: string): string {
  return text
    .replace(/[\u0100-\uFFFF]/g, '') // remove non-WinAnsi
    .replace(/[\u0000-\u001F]/g, ''); // remove control chars
}

// ── Text wrapping ─────────────────────────────────────────────────────────────

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const safe = toWinAnsi(text);
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function hasPendingVisualElements(sourceElement: HTMLElement): boolean {
  const hasPendingDiagram = sourceElement.querySelector('[data-diagram-status="loading"]') !== null;
  if (hasPendingDiagram) return true;

  const images = sourceElement.querySelectorAll<HTMLImageElement>('img');
  for (const image of images) {
    const src = image.getAttribute('src')?.trim();
    if (!src) continue;
    if (!image.complete) return true;
  }

  return false;
}

async function waitForVisualElements(sourceElement: HTMLElement): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < MEDIA_WAIT_TIMEOUT_MS) {
    if (!hasPendingVisualElements(sourceElement)) break;
    await new Promise((resolve) => setTimeout(resolve, MEDIA_WAIT_POLL_MS));
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function captureSnapshotCanvas(
  sourceElement: HTMLElement,
  captureWidth: number,
  captureHeight: number,
  theme: 'dark' | 'light',
  scale: number,
): Promise<HTMLCanvasElement> {
  const baseOptions = {
    backgroundColor: theme === 'light' ? '#efe6d8' : '#120e0b',
    scale,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 15000,
    logging: false,
    width: captureWidth,
    height: captureHeight,
    windowWidth: Math.max(document.documentElement.clientWidth, captureWidth),
    windowHeight: Math.max(document.documentElement.clientHeight, captureHeight),
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc: globalThis.Document) => {
      const clonedImages = clonedDoc.querySelectorAll<HTMLImageElement>('img');
      clonedImages.forEach((img) => {
        img.setAttribute('crossorigin', 'anonymous');
        img.setAttribute('loading', 'eager');
        img.decoding = 'sync';
      });

      const clonedSvgs = clonedDoc.querySelectorAll<SVGElement>('svg');
      clonedSvgs.forEach((svg) => {
        if (!svg.getAttribute('preserveAspectRatio')) {
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
      });
    },
  };

  try {
    return await html2canvas(sourceElement, {
      ...baseOptions,
      foreignObjectRendering: true,
    });
  } catch (firstErr) {
    log.warn('storage', 'Snapshot capture with foreignObjectRendering failed; retrying standard capture', firstErr);
    return await html2canvas(sourceElement, {
      ...baseOptions,
      foreignObjectRendering: false,
    });
  }
}

async function renderReaderSnapshotToPdf(
  pdfDoc: PDFDocument,
  sourceElement: HTMLElement,
  theme: 'dark' | 'light',
): Promise<boolean> {
  try {
    await waitForVisualElements(sourceElement);

    const rect = sourceElement.getBoundingClientRect();
    const captureWidth = Math.max(sourceElement.scrollWidth, Math.ceil(rect.width));
    const captureHeight = Math.max(sourceElement.scrollHeight, Math.ceil(rect.height));
    if (captureWidth <= 0 || captureHeight <= 0) return false;

    const scale = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
    const canvas = await captureSnapshotCanvas(sourceElement, captureWidth, captureHeight, theme, scale);

    if (canvas.width <= 0 || canvas.height <= 0) return false;

    const targetWidth = PDF_PAGE_WIDTH - (PDF_PAGE_MARGIN * 2);
    const targetHeight = PDF_PAGE_HEIGHT - (PDF_PAGE_MARGIN * 2);
    const pixelsPerPoint = canvas.width / targetWidth;
    const sliceHeightPx = Math.max(1, Math.floor(targetHeight * pixelsPerPoint));
    const pageBackground = theme === 'light' ? rgb(0.937, 0.902, 0.847) : rgb(0.071, 0.055, 0.043);

    for (let offsetPx = 0; offsetPx < canvas.height; offsetPx += sliceHeightPx) {
      const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - offsetPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeightPx;

      const sliceCtx = sliceCanvas.getContext('2d');
      if (!sliceCtx) return false;

      sliceCtx.drawImage(
        canvas,
        0,
        offsetPx,
        canvas.width,
        currentSliceHeightPx,
        0,
        0,
        canvas.width,
        currentSliceHeightPx,
      );

      const page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PDF_PAGE_WIDTH,
        height: PDF_PAGE_HEIGHT,
        color: pageBackground,
      });

      const image = await pdfDoc.embedPng(sliceCanvas.toDataURL('image/png'));
      const drawnHeight = currentSliceHeightPx / pixelsPerPoint;

      page.drawImage(image, {
        x: PDF_PAGE_MARGIN,
        y: PDF_PAGE_HEIGHT - PDF_PAGE_MARGIN - drawnHeight,
        width: targetWidth,
        height: drawnHeight,
      });
    }

    return true;
  } catch (err) {
    log.warn('storage', 'Reader snapshot export failed; falling back to markdown layout', err);
    return false;
  }
}

export async function exportPDF(doc: Document, options: PDFExportOptions = {}): Promise<void> {
  log.info('storage', `Exporting RAG PDF for: ${doc.title}`);
  
  try {
    const pdfDoc = await PDFDocument.create();
    const renderedFromSnapshot = options.sourceElement
      ? await renderReaderSnapshotToPdf(pdfDoc, options.sourceElement, options.theme ?? 'dark')
      : false;

    if (!renderedFromSnapshot) {
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const codeFont = await pdfDoc.embedFont(StandardFonts.Courier);

    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 50;
    const maxWidth = width - (2 * margin);
    let cursorY = height - margin;

    function ensureSpace(neededHeight: number): void {
      if (cursorY - neededHeight < margin) {
        page = pdfDoc.addPage();
        cursorY = height - margin;
      }
    }

    function drawWrappedText(
      text: string,
      font: any,
      size: number,
      lineHeight: number,
      x = margin,
      color = rgb(0, 0, 0),
    ): void {
      const availableWidth = maxWidth - (x - margin);
      const lines = wrapText(text, availableWidth, font, size);

      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line, { x, y: cursorY, size, font, color });
        cursorY -= lineHeight;
      }
    }

    function flushParagraph(buffer: string[]): void {
      const text = buffer.join(' ').trim();
      if (!text) return;
      drawWrappedText(text, timesRomanFont, 10, 13);
      cursorY -= 4;
      buffer.length = 0;
    }

    function flushCodeBlock(buffer: string[], language: string): void {
      if (buffer.length === 0) return;

      const codeLineHeight = 11;
      const label = language ? `[${language}]` : '[CODE]';
      ensureSpace(codeLineHeight * (buffer.length + 2));
      page.drawText(label, {
        x: margin,
        y: cursorY,
        size: 8,
        font: boldFont,
        color: rgb(0.37, 0.42, 0.82),
      });
      cursorY -= 10;

      for (const line of buffer) {
        ensureSpace(codeLineHeight);
        page.drawText(line || ' ', {
          x: margin,
          y: cursorY,
          size: 9,
          font: codeFont,
          color: rgb(0.15, 0.15, 0.15),
        });
        cursorY -= codeLineHeight;
      }

      cursorY -= 8;
      buffer.length = 0;
    }

    // 1. Draw Content (Simplistic Layout)
    
    // Title
    const titleLines = wrapText(doc.title, maxWidth, boldFont, 18);
    for (const line of titleLines) {
      page.drawText(line, { x: margin, y: cursorY, size: 18, font: boldFont, color: rgb(0, 0, 0) });
      cursorY -= 22;
    }
    cursorY -= 5;

    // Meta Row
    page.drawText(toWinAnsi(`${doc.domain} • ${doc.capturedAt.slice(0, 10)} • ${doc.wordCount} words`), {
      x: margin,
      y: cursorY,
      size: 9,
      font: timesRomanFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    cursorY -= 20;

    // Content Section — render the stored markdown structure instead of flattening it.
    page.drawText('DOC CONTENT', { x: margin, y: cursorY, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    cursorY -= 14;

    const markdownLines = doc.content.split(/\r?\n/);
    const paragraphBuffer: string[] = [];
    const codeBuffer: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';

    for (const rawLine of markdownLines) {
      const line = rawLine.replace(/\s+$/, '');

      if (inCodeBlock) {
        if (/^```/.test(line)) {
          flushCodeBlock(codeBuffer, codeLanguage);
          inCodeBlock = false;
          codeLanguage = '';
        } else {
          codeBuffer.push(rawLine);
        }
        continue;
      }

      const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
      if (fenceMatch) {
        flushParagraph(paragraphBuffer);
        inCodeBlock = true;
        codeLanguage = fenceMatch[1] ?? '';
        continue;
      }

      if (/^\s*$/.test(line)) {
        flushParagraph(paragraphBuffer);
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph(paragraphBuffer);
        const headingLevel = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        cursorY -= headingLevel === 1 ? 2 : 1;
        drawWrappedText(
          headingText,
          headingLevel <= 2 ? boldFont : timesRomanFont,
          headingLevel === 1 ? 16 : headingLevel === 2 ? 13 : 11,
          headingLevel === 1 ? 19 : headingLevel === 2 ? 15 : 13,
          margin,
          rgb(0, 0, 0),
        );
        cursorY -= 4;
        continue;
      }

      const bulletMatch = line.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)(.*)$/);
      if (bulletMatch) {
        flushParagraph(paragraphBuffer);
        const indentLevel = Math.min(3, Math.floor(bulletMatch[1].length / 2));
        const bulletText = `• ${bulletMatch[2].trim()}`;
        drawWrappedText(bulletText, timesRomanFont, 10, 13, margin + (indentLevel * 14));
        continue;
      }

      paragraphBuffer.push(line.trim());
    }

    flushParagraph(paragraphBuffer);
    flushCodeBlock(codeBuffer, codeLanguage);
    } else {
      log.info('storage', 'PDF content rendered from Reader page snapshot');
    }


    // 2. Fetch and Attach RAG Bundle (optional — failure does not abort the PDF)
    try {
      const chunks = await getChunksByDocument(doc.id);
      const embeddings = await getEmbeddingsByDocument(doc.id);
      
      const bundle = {
        document: doc,
        // Only store chunk text + indices, not the raw embedding vectors —
        // vectors are re-computed from the model at import time.
        chunks: chunks.map(c => ({ id: c.id, documentId: c.documentId, chunkIndex: c.chunkIndex, text: c.text, paragraphIndex: c.paragraphIndex })),
        embeddings: embeddings.map(e => ({ id: e.id, vector: Array.from(e.vector) }))
      };

      const attachmentData = JSON.stringify(bundle);
      const attachmentBytes = new TextEncoder().encode(attachmentData);
      
      await pdfDoc.attach(attachmentBytes, 'notch_data.json', {
        mimeType: 'application/json',
        description: 'Notch RAG Context and Embeddings',
        creationDate: new Date(),
        modificationDate: new Date(),
      });
      log.success('storage', `RAG bundle attached (${chunks.length} chunks, ${embeddings.length} embeddings)`);
    } catch (attachErr) {
      // Non-fatal: the PDF content is still useful without the RAG bundle.
      log.warn('storage', 'Could not attach RAG bundle to PDF (PDF will still download without it)', attachErr);
    }

    // 3. Save and Download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'document';
    a.href = url;
    a.download = `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log.success('storage', `Exported RAG PDF: ${filename}.pdf`);
  } catch (err) {
    log.error('storage', 'Failed to export PDF', err);
    throw err;
  }
}


