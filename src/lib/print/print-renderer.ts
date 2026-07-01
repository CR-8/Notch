import { marked } from 'marked';
import { sanitizeHtml } from '../sanitize';
import { renderMath } from '../markdown/math';
import { numberTocEntries } from '../print-toc';
import { parseToEnrichedAST } from '../content-engine/ast';
import { extractFootnotes, renderFootnoteRefs, renderFootnotesSection } from './footnotes';
import { CitationCollector, renderCitationLinks, renderBibliography } from './citations';
import type { Document } from '../types';
import type {
  EnrichedBlock,
  ContentHierarchy,
  HeadingNode,
  DiagramElement,
  CalloutElement,
  CodeBlockElement,
  RichTableElement,
  ImageElement,
} from '../content-engine/types';

export interface PrintRendererOptions {
  documentClass?: string;
  svgs?: Map<string, string>;
}

/**
 * Render the full print HTML document string from a document.
 *
 * Orchestrates the full pipeline:
 *   1. Extract footnotes from raw markdown
 *   2. Parse cleaned markdown to enriched AST
 *   3. Render blocks to HTML (with image/footnote/citation support)
 *   4. Append footnotes section and bibliography
 *   5. Wrap in print-optimised HTML with cover page, TOC, and CSS
 */
export function renderPrintHtml(
  content: string,
  doc: Document,
  options: PrintRendererOptions = {},
): { html: string; hierarchy: ContentHierarchy } {
  // 1. Extract footnotes from raw markdown.
  const { cleaned, footnotes } = extractFootnotes(content);

  // 2. Parse to enriched AST.
  const { blocks, hierarchy } = parseToEnrichedAST(cleaned);

  // 3. Render blocks with footnote/citation processing.
  const collector = new CitationCollector();
  const renderedBlocks = blocks
    .map((b) => renderBlock(b, options, footnotes, collector))
    .filter(Boolean)
    .join('\n');

  const title = (doc.title || 'document').replace(/[<>&]/g, '');
  const meta = buildMetaLine(doc);
  const cover = buildCover(title, meta);
  const toc = buildTocHtml(hierarchy.toc);
  const fnSection = renderFootnotesSection(footnotes);
  const bibSection = renderBibliography(collector);
  const provenance = buildProvenanceFootnotes(doc);
  const css = printCssForClass(options.documentClass);
  const baseTag = doc.url ? `<base href="${escapeHtml(doc.url)}">` : '';
  const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">`;

  const html = `<!doctype html>
<html data-theme="light">
<head>
<meta charset="utf-8">
<title>${title}</title>
${baseTag}${katexCss}
<style>${css}</style>
</head>
<body>
${cover}
${toc}
<div class="notch-print-root notion-prose">${renderedBlocks}</div>
${fnSection}
${bibSection}
${provenance}
</body>
</html>`;

  return { html, hierarchy };
}

// ── Block renderers ────────────────────────────────────────────────────────────

function renderBlock(
  block: EnrichedBlock,
  options: PrintRendererOptions,
  footnotes: Map<string, string>,
  citations: CitationCollector,
): string {
  switch (block.type) {
    case 'heading':
      return renderHeading(block);
    case 'paragraph':
      return renderParagraph(block, footnotes, citations);
    case 'code':
      return renderCode(block);
    case 'diagram':
      return renderDiagram(block, options);
    case 'callout':
      return renderCallout(block, footnotes, citations);
    case 'rich_table':
      return renderRichTable(block);
    case 'blockquote':
      return renderBlockquote(block, footnotes, citations);
    case 'list':
    case 'reference':
      return renderListOrReference(block, footnotes, citations);
    case 'image':
      return renderImage(block);
    default:
      return `<p>${escapeHtml(block.raw)}</p>`;
  }
}

function renderHeading(block: EnrichedBlock): string {
  const level = Math.min(Math.max(block.level ?? 1, 1), 6);
  const text = block.raw.replace(/^#{1,6}\s*/, '').trim();
  const prefix = block.number ? `${block.number} ` : '';
  const label = escapeHtml(prefix + text);
  const id = block.id ? ` id="${escapeHtml(block.id)}"` : '';
  return `<h${level}${id} class="notion-heading-level-${level}">${label}</h${level}>`;
}

function renderParagraph(
  block: EnrichedBlock,
  footnotes: Map<string, string>,
  citations: CitationCollector,
): string {
  let html = renderMarkdownInline(block.raw);
  html = renderFootnoteRefs(html);
  html = renderCitationLinks(html, citations);
  return `<div class="notion-paragraph">${html}</div>`;
}

function renderCode(block: EnrichedBlock): string {
  const data = block.data as CodeBlockElement | undefined;
  const lang = data?.language || '';
  const code = data?.content || block.raw.replace(/^```[\w+]*\n?/, '').replace(/\n```$/, '');
  const escaped = escapeHtml(code);
  return `<pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>`;
}

function renderDiagram(block: EnrichedBlock, options: PrintRendererOptions): string {
  const svg = block.id && options.svgs?.get(block.id);
  if (!svg) return '';

  const data = block.data as DiagramElement | undefined;
  const caption = data?.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : '';
  return `<figure class="notch-diagram">${svg}${caption}</figure>`;
}

function renderCallout(
  block: EnrichedBlock,
  footnotes: Map<string, string>,
  citations: CitationCollector,
): string {
  const data = block.data as CalloutElement | undefined;
  const kind = data?.kind || 'note';
  const body = data?.content || block.raw.replace(/^\[!\w+\].*?\n/, '').trim();
  let bodyHtml = renderMarkdownInline(body);
  bodyHtml = renderFootnoteRefs(bodyHtml);
  bodyHtml = renderCitationLinks(bodyHtml, citations);
  const titleHtml = data?.title
    ? `<strong class="callout-custom-title">${escapeHtml(data.title)}</strong><br>`
    : '';
  return `<div class="callout-${kind}"><span class="callout-label">${kind.toUpperCase()}</span><div class="callout-body">${titleHtml}${bodyHtml}</div></div>`;
}

function renderRichTable(block: EnrichedBlock): string {
  const data = block.data as RichTableElement | undefined;
  if (!data?.columns) {
    const html = renderMarkdownInline(block.raw);
    return `<div class="notch-table-wrapper">${html}</div>`;
  }
  const header = data.columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const rows = data.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderBlockquote(
  block: EnrichedBlock,
  footnotes: Map<string, string>,
  citations: CitationCollector,
): string {
  let html = renderMarkdownInline(block.raw);
  html = renderFootnoteRefs(html);
  html = renderCitationLinks(html, citations);
  return `<blockquote>${html}</blockquote>`;
}

function renderListOrReference(
  block: EnrichedBlock,
  footnotes: Map<string, string>,
  citations: CitationCollector,
): string {
  let html = renderMarkdownInline(block.raw);
  html = renderFootnoteRefs(html);
  html = renderCitationLinks(html, citations);
  return `<div class="notion-${block.type}">${html}</div>`;
}

function renderImage(block: EnrichedBlock): string {
  const data = block.data as ImageElement | undefined;
  const url = data?.url || '';
  const alt = data?.altText || data?.caption || '';
  const caption = data?.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : '';
  return `<figure class="notch-image-figure"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">${caption}</figure>`;
}

// ── Render markdown with math support ─────────────────────────────────────────

function renderMarkdownInline(md: string): string {
  return sanitizeHtml(marked.parse(renderMath(md), { async: false }));
}

// ── Meta / cover / TOC ────────────────────────────────────────────────────────

function buildMetaLine(doc: Document): string {
  return [
    doc.domain,
    doc.capturedAt?.slice(0, 10),
    `${doc.readingTimeMinutes ?? Math.max(1, Math.round((doc.wordCount ?? 0) / 220))} min read`,
    `${(doc.wordCount ?? 0).toLocaleString()} words`,
  ]
    .filter(Boolean)
    .join('  ·  ');
}

function buildCover(title: string, meta: string): string {
  return `<div class="notch-cover"><h1>${title}</h1><div class="meta">${meta}</div></div>`;
}

function buildTocHtml(tocNodes: HeadingNode[]): string {
  if (tocNodes.length < 2) return '';

  const items = flattenToc(tocNodes);
  const entries = numberTocEntries(items);
  if (entries.length < 2) return '';

  const lis = entries
    .map((e) => {
      const levelClass = e.level === 3 ? 'lvl3' : e.level >= 4 ? 'lvl4' : '';
      return `<li class="${levelClass}">${e.number}&nbsp;&nbsp;${escapeHtml(e.text)}</li>`;
    })
    .join('');

  return `<nav class="notch-toc"><h2>Contents</h2><ol>${lis}</ol></nav>`;
}

interface FlatHeadingItem {
  level: number;
  text: string;
  id: string;
}

function flattenToc(nodes: HeadingNode[]): FlatHeadingItem[] {
  const items: FlatHeadingItem[] = [];
  for (const node of nodes) {
    const text = node.text.replace(/^\d+(\.\d+)*\s+/, '');
    items.push({ level: node.level, text, id: node.id });
    if (node.children.length > 0) {
      items.push(...flattenToc(node.children));
    }
  }
  return items;
}

// ── Provenance ────────────────────────────────────────────────────────────────

function buildProvenanceFootnotes(doc: Document): string {
  const notes: string[] = [];
  if (doc.entities && doc.entities.length > 0) {
    const top = doc.entities.slice(0, 5);
    notes.push('Key entities: ' + top.map((e) => `${e.name} (${e.type})`).join(', '));
  }
  if (doc.timeline && doc.timeline.length > 0) {
    notes.push(
      'Timeline events: ' +
        doc.timeline.map((t) => `${t.date} — ${t.description.slice(0, 60)}`).join('; '),
    );
  }
  if (doc.concepts && doc.concepts.length > 0) {
    notes.push('Core concepts: ' + doc.concepts.map((c) => c.term).join(', '));
  }
  if (notes.length === 0) return '';
  return `<div class="notch-footnotes"><h2>Document Metadata</h2><ul>${notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`;
}

// ── Print CSS ──────────────────────────────────────────────────────────────────

function printCssForClass(documentClass?: string): string {
  const base = `
    @page { size: A4; margin: 16mm; @bottom-center { content: counter(page); font-size: 9px; font-family: 'Georgia', 'Times New Roman', serif; color: #6b7280; } }
    :root { color-scheme: light; }
    html, body { background: #fff !important; }
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #1a1a1a; font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; line-height: 1.6; orphans: 3; widows: 3; }
    code, pre { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 9pt; }
    pre { background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
    .notch-print-root { max-width: 100%; }
    .notch-print-root img, .notch-print-root svg { max-width: 100% !important; height: auto !important; }
    a { color: #2563eb; text-decoration: none; }
    a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 8pt; color: #6b7280; }
    .notch-cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100vh; break-after: page; }
    .notch-cover h1 { font-size: 32pt; margin: 0 0 12px; font-family: 'Inter', 'Helvetica Neue', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
    .notch-cover .meta { color: #6b7280; font-size: 10pt; }
    .notch-toc { break-after: page; }
    .notch-toc h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; font-family: 'Inter', 'Helvetica Neue', sans-serif; }
    .notch-toc ol { list-style: none; padding-left: 0; }
    .notch-toc li { margin: 2px 0; font-size: 10.5pt; }
    .notch-toc .lvl3 { padding-left: 16px; font-size: 10pt; color: #4b5563; }
    .notch-toc .lvl4 { padding-left: 32px; font-size: 9.5pt; color: #6b7280; }
    pre, figure, table, blockquote, [data-diagram-kind], .notion-prose pre {
      break-inside: avoid; page-break-inside: avoid;
    }
    figure svg { display: block; margin: 0 auto; }
    .notch-diagram svg { max-width: 100%; max-height: 80vh; width: auto; height: auto; }
    figcaption { font-size: 9.5pt; color: #6b7280; font-style: italic; margin-top: 4px; }
    h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
    h1 { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 20pt; font-weight: 700; }
    h2 { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 16pt; font-weight: 600; }
    h3 { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 13pt; font-weight: 600; }
    h4 { font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 11pt; font-weight: 600; }
    p { orphans: 3; widows: 3; }
    blockquote { border-left: 3px solid #d1d5db; padding: 4px 12px; margin: 0; color: #4b5563; }
    ul, ol { padding-left: 20px; }
    li { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; font-family: 'Inter', 'Helvetica Neue', sans-serif; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 1.5em 0; }
    .notch-footnotes, .notch-footnotes-section, .notch-bibliography {
      margin-top: 3em; padding-top: 1em; border-top: 1px solid #e5e5e5; font-size: 9.5pt; color: #6b7280;
    }
    .notch-footnotes ul, .notch-footnotes-section ol, .notch-bibliography ol { padding-left: 20px; }
    .notch-footnotes-section li, .notch-bibliography li { margin: 4px 0; }
    .notch-footnote-ref a, .notch-citation-ref a { color: #3b82f6; text-decoration: none; }
    .notch-footnote-back, .notch-bib-back { color: #9ca3af; text-decoration: none; font-size: 8pt; margin-left: 4px; }
    .callout-note, .callout-warning, .callout-tip, .callout-danger, .callout-info {
      border-left: 4px solid; padding: 8px 12px; margin: 12px 0; break-inside: avoid;
      background: transparent !important;
    }
    .callout-note { border-color: #3b82f6; }
    .callout-warning { border-color: #f59e0b; }
    .callout-tip { border-color: #10b981; }
    .callout-danger { border-color: #ef4444; }
    .callout-info { border-color: #6366f1; }
    .callout-note .callout-label, .callout-warning .callout-label, .callout-tip .callout-label, .callout-danger .callout-label, .callout-info .callout-label {
      font-family: 'Inter', 'Helvetica Neue', sans-serif; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
    }
    .notch-image-figure { margin: 12px 0; text-align: center; }
    .notch-image-figure img { max-width: 100%; height: auto; border-radius: 2px; }
  `;
  if (documentClass === 'research-paper') {
    return (
      base + `h2 { break-before: page; } .notch-cover h2, .notch-toc h2 { break-before: avoid; }`
    );
  }
  return base;
}

// ── HTML escaping ──────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}
