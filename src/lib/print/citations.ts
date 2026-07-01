/**
 * Print-oriented citation detection and bibliography generation.
 *
 * Detects standard academic citation patterns in rendered text
 * and generates a numbered bibliography.
 */

export interface CitationEntry {
  number: number;
  text: string;
}

// Matches: [Author, Year], [Author & Author, Year], [Author et al., Year]
const CITATION_RE =
  /\[([A-Z][a-zA-ZáéíóúàèìòùäëïöüñÁÉÍÓÚÄËÏÖÜ'.\\-]+(?:\s+(?:&|and)\s+[A-Z][a-zA-ZáéíóúàèìòùäëïöüñÁÉÍÓÚÄËÏÖÜ'.\\-]+)?(?:\s+et\s+al\.)?),\s*(\d{4}[a-z]?)\]/g;

/**
 * A simple set-like collection for unique citation strings.
 */
export class CitationCollector {
  private _map = new Map<string, number>();
  private _entries: CitationEntry[] = [];

  /** Register a citation text and return its number. */
  add(text: string): number {
    const existing = this._map.get(text);
    if (existing !== undefined) return existing;
    const num = this._entries.length + 1;
    this._map.set(text, num);
    this._entries.push({ number: num, text });
    return num;
  }

  get entries(): readonly CitationEntry[] {
    return this._entries;
  }

  get size(): number {
    return this._entries.length;
  }

  clear(): void {
    this._map.clear();
    this._entries = [];
  }
}

/**
 * Replace citation markers in rendered HTML with numbered superscript links,
 * registering each unique citation with the collector.
 */
export function renderCitationLinks(html: string, collector: CitationCollector): string {
  return html.replace(CITATION_RE, (_m, authors: string, year: string) => {
    const key = `${authors}, ${year}`;
    const num = collector.add(key);
    return `<sup class="notch-citation-ref"><a href="#bib-${num}">[${num}]</a></sup>`;
  });
}

/**
 * Render the bibliography section HTML from collected citations.
 */
export function renderBibliography(collector: CitationCollector): string {
  if (collector.size === 0) return '';
  const lis = collector.entries
    .map(
      (e) =>
        `<li id="bib-${e.number}">[${e.number}] ${escapeHtml(e.text)} <a href="#bibref-${e.number}" class="notch-bib-back">↩</a></li>`,
    )
    .join('\n');
  return `<div class="notch-bibliography"><h2>References</h2><ol>${lis}</ol></div>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}
