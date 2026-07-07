import type { DocumentChunk } from './types';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
  avgCharsPerToken?: number;
}

const DEFAULTS = {
  maxTokens: 384,
  overlapTokens: 50,
  avgCharsPerToken: 4,
};

export function chunkDocument(
  noteId: string,
  textContent: string,
  cleanedHtml?: string,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const { maxTokens, overlapTokens, avgCharsPerToken } = { ...DEFAULTS, ...options };
  const maxChars = maxTokens * avgCharsPerToken;
  const overlapChars = overlapTokens * avgCharsPerToken;

  const paragraphs = splitIntoParagraphs(textContent);
  const chunks: DocumentChunk[] = [];
  let charOffset = 0;

  // Build a map of paragraph indices to headings from HTML if available
  const headingMap = extractHeadings(cleanedHtml ?? textContent);

  let currentGroup: string[] = [];
  let currentLength = 0;
  let groupStartChar = 0;

  for (const para of paragraphs) {
    const paraLen = para.length + 2; // +2 for the double newline

    if (currentLength + paraLen > maxChars && currentGroup.length > 0) {
      const chunkText = currentGroup.join('\n\n');
      const paragraphIndex = findParagraphIndex(textContent, groupStartChar);
      const heading = findNearestHeading(headingMap, paragraphIndex);

      chunks.push({
        id: crypto.randomUUID(),
        noteId,
        text: chunkText,
        paragraphIndex,
        charStart: groupStartChar,
        charEnd: groupStartChar + chunkText.length,
        heading,
      });

      // Determine overlap: keep last N chars worth of paragraphs
      const overlapTexts: string[] = [];
      let overlapLen = 0;
      for (let i = currentGroup.length - 1; i >= 0; i--) {
        const p = currentGroup[i];
        if (overlapLen + p.length > overlapChars) break;
        overlapTexts.unshift(p);
        overlapLen += p.length + 2;
      }

      currentGroup = overlapTexts;
      currentLength = overlapLen;
      groupStartChar = groupStartChar + (chunkText.length - overlapLen);
    }

    if (currentGroup.length === 0) {
      groupStartChar = charOffset;
    }

    currentGroup.push(para);
    currentLength += paraLen;
    charOffset += paraLen;
  }

  // Flush last group
  if (currentGroup.length > 0) {
    const chunkText = currentGroup.join('\n\n');
    const paragraphIndex = findParagraphIndex(textContent, groupStartChar);
    const heading = findNearestHeading(headingMap, paragraphIndex);

    chunks.push({
      id: crypto.randomUUID(),
      noteId,
      text: chunkText,
      paragraphIndex,
      charStart: groupStartChar,
      charEnd: groupStartChar + chunkText.length,
      heading,
    });
  }

  return chunks;
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

function findParagraphIndex(text: string, charOffset: number): number {
  const paragraphs = text.split(/\n\n+/);
  let offset = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const len = paragraphs[i].length + 2;
    if (charOffset >= offset && charOffset < offset + len) return i;
    offset += len;
  }
  return paragraphs.length - 1;
}

function extractHeadings(htmlOrText: string): Map<number, string> {
  const map = new Map<number, string>();

  if (htmlOrText.includes('<h') || htmlOrText.includes('<H')) {
    const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(htmlOrText)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      const pct = match.index / htmlOrText.length;
      const estParagraphIndex = Math.floor(pct * 100);
      map.set(estParagraphIndex, text);
    }
  }

  return map;
}

function findNearestHeading(headingMap: Map<number, string>, paragraphIndex: number): string {
  let nearest = '';
  let nearestDist = Infinity;
  for (const [idx, heading] of headingMap) {
    const dist = Math.abs(idx - paragraphIndex);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = heading;
    }
  }
  return nearest;
}
