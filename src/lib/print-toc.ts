// Pure TOC numbering for the PDF print path (Problem 9). Kept separate from
// export.ts so it can be unit-tested without pulling in html2canvas/pdf-lib.

export interface TocEntry { level: number; text: string; id: string; number: string; }

/** Assigns section numbers (1, 1.1, 2, …) to a flat heading list. */
export function numberTocEntries(items: Array<{ level: number; text: string; id: string }>): TocEntry[] {
  let h2 = 0;
  let h3 = 0;
  const out: TocEntry[] = [];
  for (const it of items) {
    if (it.level <= 2) { h2 += 1; h3 = 0; out.push({ ...it, number: `${h2}` }); }
    else { h3 += 1; out.push({ ...it, number: `${h2}.${h3}` }); }
  }
  return out;
}
