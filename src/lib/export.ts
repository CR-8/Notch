import type { Document } from './types';
import { log } from './logger';
import { renderPrintHtml } from './print/print-renderer';
import { canGeneratePdfDirectly, generateAndDownloadPdf } from './print/pdf-generator';

// ── Markdown Export ───────────────────────────────────────────────────────────

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

// ── PDF Export ────────────────────────────────────────────────────────────────

const MEDIA_WAIT_TIMEOUT_MS = 5000;

/**
 * High-fidelity PDF export with automatic one-click download.
 *
 * Two pathways:
 *   1. **Direct CDP** — Uses `chrome.debugger` + `Page.printToPDF` to
 *      generate a PDF silently and download it. PDF metadata (title,
 *      subject, keywords) is injected via pdf-lib.
 *   2. **Print dialog** — Falls back to the browser's native print dialog
 *      (user selects "Save as PDF") when CDP is unavailable.
 *
 * @param preRenderedSvgs - Optional map of block‑id → SVG string for diagrams
 *                          that have already been rendered in the reader DOM.
 */
export async function exportViaPrint(
  doc: Document,
  documentClass?: string,
  preRenderedSvgs?: Map<string, string>,
): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const content = doc.enrichedContent || doc.content || '';
  const { html } = renderPrintHtml(content, doc, {
    documentClass,
    svgs: preRenderedSvgs,
  });
  const fileName = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'document';

  // Attempt one-click direct PDF via CDP first.
  if (canGeneratePdfDirectly()) {
    const ok = await generateAndDownloadPdf(html, fileName, {
      title: doc.title || 'Document',
      documentClass,
    });
    if (ok) return true;
    log.warn('export', 'Direct PDF path failed; falling back to print dialog');
  }

  // Fallback: open browser print dialog via hidden iframe.
  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    const iwin = iframe.contentWindow;
    if (!idoc || !iwin) {
      iframe.remove();
      return false;
    }

    idoc.open();
    idoc.write(html);
    idoc.close();

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      iframe.addEventListener('load', () => setTimeout(finish, 150), { once: true });
      setTimeout(finish, MEDIA_WAIT_TIMEOUT_MS);
    });
    try {
      await idoc.fonts?.ready;
    } catch {
      /* fonts API optional */
    }

    try {
      iwin.print();
    } catch (printErr) {
      log.warn('export', 'Print dialog could not open from iframe', printErr);
      iframe.remove();
      return false;
    }

    iwin.onafterprint = () => {
      iframe.remove();
    };
    setTimeout(() => {
      if (iframe.parentNode) iframe.remove();
    }, 60000);
    return true;
  } catch (err) {
    log.warn('export', 'Print-to-PDF failed', err);
    return false;
  }
}
