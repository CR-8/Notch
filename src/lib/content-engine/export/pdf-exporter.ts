import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { EnrichedDocument, ContentHierarchy, HeadingNode } from '../types';
import { buildTOC, renderTOCText } from '../hierarchy';
import type { TOCItem } from '../hierarchy';

export interface PDFDocumentOptions {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  pageSize?: 'a4' | 'letter';
  dpi?: number;
  theme?: 'light' | 'dark';
  includeToc?: boolean;
  includePageNumbers?: boolean;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  fontSize?: number;
}

const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const MARGIN = 50;
const HEADER_HEIGHT = 30;
const FOOTER_HEIGHT = 25;

export interface PDFPageContent {
  text: string;
  font: 'normal' | 'bold' | 'code';
  size: number;
  indent?: number;
  align?: 'left' | 'center' | 'right';
  color?: { r: number; g: number; b: number };
  pageBreak?: boolean;
}

export async function generatePDFDocument(
  markdownContent: string,
  options: PDFDocumentOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageSize = PAGE_SIZES[options.pageSize ?? 'a4'];
  const { width, height } = pageSize;

  const normalFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const codeFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const fontSize = options.fontSize ?? 10;
  const lineHeight = fontSize * 1.45;
  const maxWidth = width - 2 * MARGIN;

  let currentPage = pdfDoc.addPage([width, height]);
  let cursorY = height - MARGIN - HEADER_HEIGHT;

  const allPages: PDFPage[] = [currentPage];
  let pageNum = 1;

  // ── Helper functions ────────────────────────────────────────────────────

  function addPage(): PDFPage {
    const page = pdfDoc.addPage([width, height]);
    allPages.push(page);
    currentPage = page;
    cursorY = height - MARGIN - HEADER_HEIGHT;
    pageNum++;
    return page;
  }

  function ensureSpace(needed: number): void {
    if (cursorY - needed < MARGIN + FOOTER_HEIGHT) {
      addPage();
    }
  }

  function drawHeader(page: PDFPage): void {
    if (!options.includeHeaders) return;
    page.drawLine({
      start: { x: MARGIN, y: height - MARGIN - HEADER_HEIGHT + 5 },
      end: { x: width - MARGIN, y: height - MARGIN - HEADER_HEIGHT + 5 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    if (options.title) {
      page.drawText(options.title.slice(0, 60), {
        x: MARGIN,
        y: height - MARGIN - HEADER_HEIGHT + 8,
        size: 8,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  function drawFooter(page: PDFPage): void {
    if (!options.includeFooters) return;
    const pageIdx = allPages.indexOf(page) + 1;
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + FOOTER_HEIGHT - 5 },
      end: { x: width - MARGIN, y: MARGIN + FOOTER_HEIGHT - 5 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    if (options.includePageNumbers) {
      const text = `${pageIdx}`;
      const textWidth = normalFont.widthOfTextAtSize(text, 9);
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: MARGIN + 5,
        size: 9,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  function drawWrappedText(
    text: string,
    font: PDFFont,
    size: number,
    lineHeight: number,
    x = MARGIN,
    color = rgb(0, 0, 0),
    indent = 0,
  ): void {
    const availableWidth = maxWidth - indent;
    const words = text.split(/\s+/);
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth <= availableWidth) {
        line = testLine;
      } else {
        ensureSpace(lineHeight);
        currentPage.drawText(line || ' ', {
          x: x + indent,
          y: cursorY,
          size,
          font,
          color,
        });
        cursorY -= lineHeight;
        line = word;
      }
    }

    if (line) {
      ensureSpace(lineHeight);
      currentPage.drawText(line, {
        x: x + indent,
        y: cursorY,
        size,
        font,
        color,
      });
      cursorY -= lineHeight;
    }
  }

  function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // ── Draw existing page headers/footers ──────────────────────────────────
  for (const page of allPages) {
    drawHeader(page);
    drawFooter(page);
  }

  // ── Title Page ──────────────────────────────────────────────────────────
  cursorY = height - MARGIN - 60;

  const titleLines = wrapText(options.title, maxWidth, boldFont, 24);
  for (const line of titleLines) {
    ensureSpace(30);
    currentPage.drawText(line, {
      x: MARGIN,
      y: cursorY,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    cursorY -= 30;
  }

  cursorY -= 10;

  if (options.subtitle) {
    const subLines = wrapText(options.subtitle, maxWidth, normalFont, 14);
    for (const line of subLines) {
      ensureSpace(18);
      currentPage.drawText(line, {
        x: MARGIN,
        y: cursorY,
        size: 14,
        font: normalFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      cursorY -= 18;
    }
    cursorY -= 8;
  }

  if (options.author || options.date) {
    const meta = [options.author, options.date].filter(Boolean).join(' · ');
    ensureSpace(16);
    currentPage.drawText(meta, {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: italicFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    cursorY -= 20;
  }

  cursorY -= 20;

  // ── Table of Contents ───────────────────────────────────────────────────
  if (options.includeToc) {
    addPage();
    cursorY = height - MARGIN - HEADER_HEIGHT;

    currentPage.drawText('Table of Contents', {
      x: MARGIN,
      y: cursorY,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    cursorY -= 28;

    // Parse headings from markdown for TOC
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(markdownContent)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const indent = (level - 1) * 14;
      const size = level <= 2 ? 11 : 10;
      const font = level <= 2 ? boldFont : normalFont;

      ensureSpace(14);
      currentPage.drawText(text, {
        x: MARGIN + indent,
        y: cursorY,
        size,
        font,
        color: level <= 2 ? rgb(0, 0, 0) : rgb(0.2, 0.2, 0.2),
      });
      cursorY -= 14;
    }

    addPage();
    cursorY = height - MARGIN - HEADER_HEIGHT;
  }

  // ── Content ─────────────────────────────────────────────────────────────
  const contentLines = markdownContent.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];

  function flushCode(): void {
    if (codeBuffer.length === 0) return;
    const codeLineHeight = 10;
    ensureSpace(codeLineHeight * (codeBuffer.length + 3));

    if (codeLanguage) {
      currentPage.drawText(`[${codeLanguage}]`, {
        x: MARGIN,
        y: cursorY,
        size: 7,
        font: boldFont,
        color: rgb(0.37, 0.42, 0.82),
      });
      cursorY -= 10;
    }

    // Draw code background box
    const boxHeight = codeBuffer.length * codeLineHeight + 16;
    cursorY -= 6;

    for (const line of codeBuffer) {
      ensureSpace(codeLineHeight);
      currentPage.drawText(line || ' ', {
        x: MARGIN + 8,
        y: cursorY,
        size: 8,
        font: codeFont,
        color: rgb(0.15, 0.15, 0.15),
      });
      cursorY -= codeLineHeight;
    }

    cursorY -= 10;
    codeBuffer = [];
    codeLanguage = '';
  }

  for (const rawLine of contentLines) {
    const line = rawLine.replace(/\s+$/, '');

    if (inCodeBlock) {
      if (/^```/.test(line)) {
        flushCode();
        inCodeBlock = false;
      } else {
        codeBuffer.push(line);
      }
      continue;
    }

    const fenceMatch = line.match(/^```([\w-]*)\s*$/);
    if (fenceMatch) {
      cursorY -= 4;
      inCodeBlock = true;
      codeLanguage = fenceMatch[1] ?? '';
      continue;
    }

    if (/^\s*$/.test(line)) {
      cursorY -= 4;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const hSize = level === 1 ? 18 : level === 2 ? 14 : 12;
      const hLineHeight = level === 1 ? 24 : level === 2 ? 18 : 16;
      const hFont = level <= 2 ? boldFont : normalFont;

      cursorY -= level === 1 ? 4 : 2;
      ensureSpace(hLineHeight);

      // Draw line under H1
      if (level === 1) {
        currentPage.drawLine({
          start: { x: MARGIN, y: cursorY + 2 },
          end: { x: MARGIN + maxWidth, y: cursorY + 2 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      drawWrappedText(text, hFont, hSize, hLineHeight, MARGIN, rgb(0, 0, 0));
      cursorY -= level === 1 ? 2 : 0;
      continue;
    }

    const bulletMatch = line.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)(.*)$/);
    if (bulletMatch) {
      const indent = Math.min(3, Math.floor(bulletMatch[1].length / 2)) * 14;
      const text = bulletMatch[2].trim();
      drawWrappedText(`• ${text}`, normalFont, fontSize, lineHeight, MARGIN, rgb(0, 0, 0), indent);
      continue;
    }

    // Regular paragraph
    if (line.trim()) {
      drawWrappedText(line.trim(), normalFont, fontSize, lineHeight, MARGIN, rgb(0, 0, 0));
    }
  }

  flushCode();

  // ── Finalize ────────────────────────────────────────────────────────────
  // Redraw headers/footers on all pages (in case new pages were added)
  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    // Clear existing content at header/footer areas by redrawing
    drawHeader(page);
    drawFooter(page);
  }

  return await pdfDoc.save();
}

export async function buildEnhancedPDF(
  enrichedDoc: EnrichedDocument,
  content: string,
  options: PDFDocumentOptions,
): Promise<Uint8Array> {
  return generatePDFDocument(content, options);
}
