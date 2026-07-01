/**
 * Print-oriented footnote extraction and rendering.
 *
 * Footnotes use standard markdown syntax:
 *   Definition:  [^label]: content
 *   Reference:   [^label]
 *
 * Definitions are extracted from the raw markdown before AST parsing,
 * and references are replaced with superscript links during block rendering.
 */

export interface FootnoteDef {
  label: string;
  content: string;
}

const FN_DEF = /^\[(\^[^\]]+)\]:\s*(.*)$/m;
const FN_REF = /\[\^([^\]]+)\]/g;

/**
 * Extract all footnote definitions from raw markdown and return the
 * cleaned content (with definitions removed) plus the footnote map.
 */
export function extractFootnotes(md: string): { cleaned: string; footnotes: Map<string, string> } {
  const footnotes = new Map<string, string>();
  const lines = md.split('\n');
  const kept: string[] = [];

  let pendingLabel = '';
  const pendingLines: string[] = [];

  function flushPending() {
    if (pendingLabel && pendingLines.length > 0) {
      const content = pendingLines.join('\n').trim();
      if (content) footnotes.set(pendingLabel, content);
    }
    pendingLabel = '';
    pendingLines.length = 0;
  }

  for (const line of lines) {
    const defMatch = line.match(FN_DEF);
    if (defMatch) {
      flushPending();
      pendingLabel = defMatch[1];
      const rest = defMatch[2].trim();
      if (rest) pendingLines.push(rest);
    } else if (pendingLabel) {
      if (line.trim() === '') {
        flushPending();
        kept.push(line);
      } else {
        pendingLines.push(line);
      }
    } else {
      kept.push(line);
    }
  }
  flushPending();

  return { cleaned: kept.join('\n'), footnotes };
}

/**
 * Replace footnote references with superscript anchor tags in rendered HTML.
 */
export function renderFootnoteRefs(text: string): string {
  return text.replace(FN_REF, (_m, label: string) => {
    const id = escapeHtml(label);
    return `<sup class="notch-footnote-ref"><a id="fnref-${id}" href="#fn-${id}">${escapeHtml(label)}</a></sup>`;
  });
}

/**
 * Render the footnotes section HTML from the footnote map.
 */
export function renderFootnotesSection(footnotes: Map<string, string>): string {
  if (footnotes.size === 0) return '';
  const lis: string[] = [];
  for (const [label, content] of footnotes) {
    const id = escapeHtml(label);
    lis.push(
      `<li id="fn-${id}">${escapeHtml(label)} — ${escapeHtml(content)} <a href="#fnref-${id}" class="notch-footnote-back">↩</a></li>`,
    );
  }
  return `<div class="notch-footnotes-section"><h2>Footnotes</h2><ol>${lis.join('\n')}</ol></div>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}
