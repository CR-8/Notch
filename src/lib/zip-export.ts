import JSZip from 'jszip';
import { db } from './db';
import type { Document } from './types';

export async function exportFolderAsZip(
  folderId: string,
  format: 'markdown' | 'pdf',
): Promise<Blob> {
  const allDocs = await db.notes.where('folder').equals(folderId).toArray();
  if (allDocs.length === 0) throw new Error('No documents in this folder');

  const zip = new JSZip();

  if (format === 'markdown') {
    for (const doc of allDocs) {
      const slug = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'untitled';
      zip.file(`${slug}.md`, buildMarkdownExport(doc));
    }
  } else {
    for (const doc of allDocs) {
      const slug = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'untitled';
      zip.file(`${slug}.html`, buildHtmlExport(doc));
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

function buildMarkdownExport(doc: Document): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
  lines.push(`url: ${doc.url}`);
  lines.push(`domain: ${doc.domain}`);
  lines.push(`captured: ${doc.capturedAt}`);
  lines.push(`words: ${doc.wordCount}`);
  if (doc.tags.length > 0) lines.push(`tags: [${doc.tags.map((t) => `"${t}"`).join(', ')}]`);
  if (doc.summary) lines.push(`summary: "${doc.summary.replace(/"/g, '\\"')}"`);
  lines.push('---');
  lines.push('');

  if (doc.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(doc.summary);
    lines.push('');
  }

  if (doc.keyPoints.length > 0) {
    lines.push('## Key Points');
    lines.push('');
    for (const point of doc.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  const content = doc.content ?? '';
  if (content) {
    lines.push(content);
  }

  return lines.join('\n');
}

const PRINT_CSS = `
  @page { size: A4; margin: 16mm; @bottom-center { content: counter(page); font-size: 9px; font-family: Georgia, 'Times New Roman', serif; color: #6b7280; } }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
  img, svg { max-width: 100%; height: auto; }
  h1, h2, h3, h4 { font-family: Inter, 'Helvetica Neue', sans-serif; break-after: avoid; }
  h1 { font-size: 28pt; font-weight: 700; margin: 0 0 6px; }
  h2 { font-size: 20pt; font-weight: 600; margin-top: 1.2em; }
  h3 { font-size: 16pt; font-weight: 600; }
  h4 { font-size: 13pt; font-weight: 600; }
  code, pre { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 9pt; }
  pre { background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 12px; overflow-x: auto; }
  blockquote { border-left: 3px solid #d1d5db; padding: 4px 12px; margin: 0; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  .meta { color: #6b7280; font-size: 10pt; margin-bottom: 1.5em; }
  .footnotes { margin-top: 3em; padding-top: 1em; border-top: 1px solid #e5e5e5; font-size: 9.5pt; color: #6b7280; }
  .callout-note, .callout-warning, .callout-tip, .callout-danger, .callout-info { border-left: 4px solid; padding: 8px 12px; margin: 12px 0; }
  .callout-note { border-color: #3b82f6; }
  .callout-warning { border-color: #f59e0b; }
  .callout-tip { border-color: #10b981; }
  .callout-danger { border-color: #ef4444; }
  .callout-info { border-color: #6366f1; }
  @media print { body { padding: 0; } }
`;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/** Render a Document as a standalone print-optimised HTML page. */
function buildHtmlExport(doc: Document): string {
  const title = escapeHtml(doc.title || 'Untitled');
  const meta = [
    doc.domain,
    doc.capturedAt?.slice(0, 10),
    `${doc.wordCount?.toLocaleString() ?? 0} words`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const content = escapeHtml(doc.content ?? doc.summary ?? '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">${meta}</p>
<hr>
<pre style="white-space:pre-wrap;word-break:break-word;background:none;border:none;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.6;">
${content}
</pre>
</body>
</html>`;
}
