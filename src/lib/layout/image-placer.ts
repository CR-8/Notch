import type { ExtractedImage } from '../capture/types';

function isValidImageUrl(url: string): boolean {
  if (
    !url ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('chrome-extension:') ||
    url.startsWith('about:')
  )
    return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function injectMediaIntoContent(content: string, images: ExtractedImage[]): string {
  let result = content;

  const existingUrls = new Set<string>();
  const imgPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgPattern.exec(result)) !== null) {
    existingUrls.add(m[2].split('?')[0].split('#')[0]);
  }

  const validImages = images.filter((i) => isValidImageUrl(i.url));
  const missingImages = validImages.filter((i) => {
    const norm = i.url.split('?')[0].split('#')[0];
    return !existingUrls.has(norm) && !result.includes(norm);
  });

  if (missingImages.length === 0) return result;

  const sections: Array<{ heading: string; start: number; end: number }> = [];
  const secPattern = /^(#{1,6}\s+.*)$/gm;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = secPattern.exec(result)) !== null) {
    const start = secMatch.index;
    const _end = secPattern.lastIndex;
    if (sections.length > 0) sections[sections.length - 1].end = start;
    sections.push({ heading: secMatch[1], start, end: result.length });
  }

  function scoreSection(ctx: string, sectionIdx: number): number {
    if (!ctx) return 0;
    const ctxWords = ctx
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (ctxWords.length < 2) return 0;
    const sectionText = result
      .slice(sections[sectionIdx].start, sections[sectionIdx].end)
      .toLowerCase();
    return ctxWords.reduce((sum, w) => sum + (sectionText.includes(w) ? 1 : 0), 0);
  }

  for (const img of missingImages) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < sections.length; i++) {
      const score = scoreSection(img.paragraphContext, i);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore >= 2) {
      const sec = sections[bestIdx];
      const insert = `\n\n![${img.alt || 'Image'}](${img.url})\n`;
      const insertPoint = sec.start + sec.heading.length;
      result = result.slice(0, insertPoint) + insert + result.slice(insertPoint);
      for (let j = bestIdx; j < sections.length; j++) {
        sections[j].start += insert.length;
        sections[j].end += insert.length;
      }
    }
  }

  return result;
}
