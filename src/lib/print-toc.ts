// Stack-based TOC numbering for arbitrary heading levels (1–6).

export interface TocEntry {
  level: number;
  text: string;
  id: string;
  number: string;
}

/** Assigns hierarchical section numbers (1, 1.1, 1.1.1, 2, …) to a flat heading list. */
export function numberTocEntries(
  items: Array<{ level: number; text: string; id: string }>,
): TocEntry[] {
  const cnt: number[] = [];
  const out: TocEntry[] = [];
  for (const it of items) {
    const lvl = it.level;
    while (cnt.length > lvl) cnt.pop();
    while (cnt.length < lvl) cnt.push(0);
    cnt[lvl - 1] += 1;
    const firstNonZero = cnt.findIndex((c) => c > 0);
    const number = (firstNonZero >= 0 ? cnt.slice(firstNonZero) : cnt).join('.');
    out.push({ ...it, number });
  }
  return out;
}
