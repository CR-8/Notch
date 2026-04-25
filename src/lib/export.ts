import type { Document } from './types';
// @ts-ignore
import plantumlEncoder from 'plantuml-encoder';
import mermaid from 'mermaid';

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

async function mermaidToDataUri(code: string, index: number): Promise<string | null> {
  try {
    const id = `pdf-mermaid-${index}-${Date.now()}`;
    const { svg } = await mermaid.render(id, code);
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch {
    return null;
  }
}

async function plantumlToDataUri(code: string): Promise<string | null> {
  try {
    const encoded = plantumlEncoder.encode(code);
    const url = `https://www.plantuml.com/plantuml/svg/${encoded}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const svg = await res.text();
    const encodedSvg = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encodedSvg}`;
  } catch {
    return null;
  }
}

export async function exportPDF(leftPaneEl: HTMLElement): Promise<void> {
  const clone = leftPaneEl.cloneNode(true) as HTMLElement;

  // Replace mermaid blocks
  const mermaidCodes = Array.from(clone.querySelectorAll<HTMLElement>('code.language-mermaid'));
  for (let i = 0; i < mermaidCodes.length; i++) {
    const codeEl = mermaidCodes[i];
    const container = codeEl.closest('pre') ?? codeEl;
    const dataUri = await mermaidToDataUri(codeEl.textContent ?? '', i);
    if (dataUri) {
      const img = document.createElement('img');
      img.src = dataUri;
      img.style.maxWidth = '100%';
      container.replaceWith(img);
    }
  }

  // Replace plantuml blocks
  const plantumlCodes = Array.from(clone.querySelectorAll<HTMLElement>('code.language-plantuml'));
  for (const codeEl of plantumlCodes) {
    const container = codeEl.closest('pre') ?? codeEl;
    const dataUri = await plantumlToDataUri(codeEl.textContent ?? '');
    if (dataUri) {
      const img = document.createElement('img');
      img.src = dataUri;
      img.style.maxWidth = '100%';
      container.replaceWith(img);
    }
  }

  const printContainer = document.createElement('div');
  printContainer.id = 'notch-print-container';
  printContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:99999;background:white;';
  printContainer.appendChild(clone);

  const style = document.createElement('style');
  style.textContent = `
    @media print {
      body > *:not(#notch-print-container) { display: none !important; }
      #notch-print-container { position:static!important; width:100%!important; background:white!important; color:black!important; }
      #notch-print-container * { color:black!important; background:white!important; border-color:#ccc!important; }
      #notch-print-container img { max-width:100%!important; page-break-inside:avoid; }
      #notch-print-container pre, #notch-print-container code { white-space:pre-wrap!important; font-family:monospace!important; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(printContainer);
  window.print();

  const cleanup = () => {
    document.body.removeChild(printContainer);
    document.head.removeChild(style);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}
