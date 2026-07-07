/**
 * PDF Exporter — generates print-ready HTML for PDF conversion
 *
 * Produces an HTML document with embedded CSS that is optimized
 * for print conversion (via browser print-to-PDF or Puppeteer).
 * Includes proper page breaks, running headers, TOC, bookmarks,
 * and numbering.
 */

import type { DocumentAST } from '../schemas';
import { exportToMarkdown } from './markdown';

/* ── PDF Export Options ──────────────────────────────────────────────── */

export interface PDFExportOptions {
  title: string;
  author?: string;
  date?: string;
  fontSize?: number;
  pageSize?: 'A4' | 'Letter';
  includeTOC: boolean;
  includePageNumbers: boolean;
  includeBookmarks: boolean;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

const DEFAULT_OPTIONS: PDFExportOptions = {
  title: 'Document',
  author: 'Notch',
  fontSize: 11,
  pageSize: 'A4',
  includeTOC: true,
  includePageNumbers: true,
  includeBookmarks: true,
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
};

/* ── Generate Print HTML ─────────────────────────────────────────────── */

export function exportToPrintHTML(
  doc: DocumentAST,
  options: Partial<PDFExportOptions> = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const markdown = exportToMarkdown(doc, { numberedHeadings: true });
  const tocHTML = generateTOCHTML(doc);
  const bodyHTML = markdownToBasicHTML(markdown);

  return generateHTMLPage(opts, tocHTML, bodyHTML);
}

/* ── TOC HTML ────────────────────────────────────────────────────────── */

function generateTOCHTML(doc: DocumentAST): string {
  const toc = doc.hierarchy.toc;
  if (toc.length === 0) return '';

  function renderItems(items: typeof toc, depth = 0): string {
    if (items.length === 0) return '';
    const indent = depth * 20;
    return items
      .map((item) => {
        const children = item.children?.length ? renderItems(item.children, depth + 1) : '';
        return `<li style="margin-left:${indent}px">
        <a href="#${item.id ?? ''}">
          ${item.number ? `<span class="toc-number">${item.number}. </span>` : ''}
          ${escapeHTML(item.text)}
        </a>
        ${children ? `<ul>${children}</ul>` : ''}
      </li>`;
      })
      .join('\n');
  }

  return `
    <div class="pdf-toc-page">
      <h1 class="pdf-toc-title">Contents</h1>
      <ul class="pdf-toc">
        ${renderItems(toc)}
      </ul>
    </div>
  `;
}

/* ── Markdown → Basic HTML Converter (standalone, no marked dep) ─────── */

function markdownToBasicHTML(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```') && !inCodeBlock) {
      inCodeBlock = true;
      codeLang = line.slice(3).trim();
      codeContent = [];
      continue;
    }
    if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      html.push(
        `<pre><code class="language-${escapeHTML(codeLang)}">${escapeHTML(codeContent.join('\n'))}</code></pre>`,
      );
      continue;
    }
    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      const text = line.slice(2).trim();
      const id = slugify(text);
      html.push(`<h1 id="${id}" class="pdf-h1" data-bookmark="true">${escapeHTML(text)}</h1>`);
    } else if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      const id = slugify(text);
      html.push(`<h2 id="${id}" class="pdf-h2" data-bookmark="true">${escapeHTML(text)}</h2>`);
    } else if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      const id = slugify(text);
      html.push(`<h3 id="${id}" class="pdf-h3" data-bookmark="true">${escapeHTML(text)}</h3>`);
    } else if (line.startsWith('| ')) {
      const cells = line
        .split('|')
        .filter(Boolean)
        .map((c) => c.trim());
      if (line.includes('---')) continue;
      html.push(`<p>${escapeHTML(line)}</p>`);
    } else if (line.startsWith('> ')) {
      html.push(`<blockquote>${escapeHTML(line.slice(2).trim())}</blockquote>`);
    } else if (line.startsWith('- ')) {
      html.push(`<li>${escapeHTML(line.slice(2).trim())}</li>`);
    } else if (/^\d+\. /.test(line)) {
      html.push(`<li>${escapeHTML(line.replace(/^\d+\. /, '').trim())}</li>`);
    } else if (line.startsWith('---')) {
      html.push('<hr />');
    } else if (line.trim() === '') {
      if (html.length > 0 && !html[html.length - 1].startsWith('<')) {
        html.push('');
      }
    } else {
      html.push(`<p>${escapeHTML(line)}</p>`);
    }
  }

  return html.join('\n');
}

/* ── Full HTML Page ──────────────────────────────────────────────────── */

function generateHTMLPage(opts: PDFExportOptions, tocHTML: string, bodyHTML: string): string {
  const pageWidth = opts.pageSize === 'Letter' ? '216mm' : '210mm';
  const pageHeight = opts.pageSize === 'Letter' ? '279mm' : '297mm';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHTML(opts.title)}</title>
<style>
  @page {
    size: ${pageWidth} ${pageHeight};
    margin: ${opts.marginTop}mm ${opts.marginRight}mm ${opts.marginBottom}mm ${opts.marginLeft}mm;
    @top-center {
      content: "${escapeHTML(opts.title)}";
      font-family: "Times New Roman", serif;
      font-size: 9pt;
      color: #666;
    }
    @bottom-center {
      content: "${opts.includePageNumbers ? 'Page ' + 'counter(page)' : ''}";
      font-family: "Times New Roman", serif;
      font-size: 9pt;
      color: #666;
    }
  }
  @page :first {
    @top-center { content: none; }
    @bottom-center { content: none; }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", "Georgia", serif;
    font-size: ${opts.fontSize}pt;
    line-height: 1.6;
    color: #1a1a1a;
    orphans: 3;
    widows: 3;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "Helvetica Neue", "Arial", sans-serif;
    page-break-after: avoid;
    break-after: avoid;
  }

  h1 { font-size: 24pt; margin-top: 0; margin-bottom: 12pt; padding-bottom: 6pt; border-bottom: 1px solid #ccc; }
  h2 { font-size: 18pt; margin-top: 18pt; margin-bottom: 8pt; }
  h3 { font-size: 14pt; margin-top: 14pt; margin-bottom: 6pt; }
  h4 { font-size: 12pt; margin-top: 12pt; margin-bottom: 4pt; }

  p { margin-bottom: 6pt; text-align: justify; }

  pre, code {
    font-family: "Courier New", "Consolas", monospace;
    font-size: 9pt;
    background: #f5f5f5;
  }
  pre {
    padding: 8pt;
    border: 1px solid #ddd;
    border-radius: 2pt;
    page-break-inside: avoid;
    white-space: pre-wrap;
    word-break: break-all;
  }
  code { padding: 1pt 3pt; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #999;
    padding: 4pt 6pt;
    text-align: left;
  }
  th { background: #f0f0f0; font-weight: bold; }

  blockquote {
    margin: 8pt 0;
    padding: 6pt 12pt;
    border-left: 3pt solid #999;
    background: #f9f9f9;
    font-style: italic;
  }

  hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
  img { max-width: 100%; height: auto; page-break-inside: avoid; }

  li { margin-bottom: 2pt; }

  /* TOC Page */
  .pdf-toc-page {
    page-break-after: always;
  }
  .pdf-toc-title {
    font-size: 20pt;
    margin-bottom: 16pt;
  }
  .pdf-toc { list-style: none; padding: 0; }
  .pdf-toc li { margin-bottom: 4pt; }
  .pdf-toc a {
    text-decoration: none;
    color: #1a1a1a;
  }
  .toc-number { font-weight: bold; }

  /* Bookmarks via PDF outline (data-bookmark handling) */
  [data-bookmark="true"] {
    bookmark-label: attr(id);
    bookmark-level: 1;
  }
  h2[data-bookmark="true"] { bookmark-level: 2; }
  h3[data-bookmark="true"] { bookmark-level: 3; }

  /* Page break helpers */
  .page-break { page-break-before: always; }

  /* Avoid breaks inside these */
  figure, .equation-block, .diagram-block, .callout {
    page-break-inside: avoid;
  }
</style>
</head>
<body>
${opts.includeTOC ? tocHTML : ''}
<article class="pdf-content">
  ${bodyHTML}
</article>
</body>
</html>`;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/* ── Export convenience ──────────────────────────────────────────────── */

export function exportToMarkdownOnly(doc: DocumentAST): string {
  return exportToMarkdown(doc, { numberedHeadings: true });
}

export function exportToHTML(doc: DocumentAST, title: string): string {
  return exportToPrintHTML(doc, { title, includeTOC: true, includePageNumbers: true });
}
