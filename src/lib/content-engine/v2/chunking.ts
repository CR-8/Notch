// ── Adaptive Chunking Strategies ──────────────────────────────────────────────

import type { ChunkStrategy, ChunkResult, TextChunk, DepthMode } from './types';
import { DEPTH_CONFIGS } from './types';

export class AdaptiveChunker {
  private mode: DepthMode;

  constructor(mode: DepthMode) {
    this.mode = mode;
  }

  getStrategy(): ChunkStrategy {
    switch (this.mode) {
      case 'fast': return 'query';
      case 'standard': return 'semantic';
      case 'deep': return 'full';
    }
  }

  chunk(text: string, query?: string): ChunkResult {
    const config = DEPTH_CONFIGS[this.mode];
    const strategy = this.getStrategy();

    switch (strategy) {
      case 'query':
        return this.queryDrivenChunking(text, query);
      case 'semantic':
        return this.semanticChunking(text, config.chunkSize, config.chunkOverlap);
      case 'full':
        return this.fullFrameChunking(text, config.chunkSize, config.chunkOverlap);
    }
  }

  private queryDrivenChunking(text: string, query?: string): ChunkResult {
    if (!query) return this.semanticChunking(text, 1024, 64);

    // Split by headings first
    const sections = this.splitByHeadings(text);
    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // Score sections by query relevance
    type SectionWithScore = ReturnType<typeof this.splitByHeadings>[number] & { score: number; wordCount: number };
    const scored: SectionWithScore[] = sections.map(section => {
      const lower = section.text.toLowerCase();
      const wc = section.text.split(/\s+/).filter(Boolean).length;
      const score = queryTerms.reduce((sum, term) => {
        const count = (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return sum + count;
      }, 0) / Math.max(wc, 1);

      return { ...section, score, wordCount: wc };
    });

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, 5);

    const totalTokens = topChunks.reduce((sum, c) => sum + c.wordCount, 0);

    return {
      chunks: topChunks.map(c => ({
        id: `qchunk-${c.index}`,
        text: c.text,
        index: c.index,
        heading: c.heading,
        wordCount: c.wordCount,
        score: c.score,
      })),
      strategy: 'query',
      totalTokens,
    };
  }

  private semanticChunking(text: string, chunkSize: number, overlap: number): ChunkResult {
    const sections = this.splitByHeadings(text);
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const words = section.text.split(/\s+/);
      if (words.length <= chunkSize) {
        chunks.push({
          id: `schunk-${chunkIndex}`,
          text: section.text,
          index: chunkIndex,
          heading: section.heading,
          wordCount: words.length,
        });
        chunkIndex++;
      } else {
        // Split large sections into overlapping chunks
        for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
          const chunkWords = words.slice(i, i + chunkSize);
          chunks.push({
            id: `schunk-${chunkIndex}`,
            text: chunkWords.join(' '),
            index: i,
            heading: `${section.heading} (cont.)`,
            wordCount: chunkWords.length,
          });
          chunkIndex++;
        }
      }
    }

    const totalTokens = chunks.reduce((sum, c) => sum + c.wordCount, 0);

    return { chunks, strategy: 'semantic', totalTokens };
  }

  private fullFrameChunking(text: string, chunkSize: number, overlap: number): ChunkResult {
    const sections = this.splitByHeadings(text);
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const paragraphs = section.text.split(/\n\s*\n/);
      let currentChunk: string[] = [];
      let currentCount = 0;
      let currentHeading = section.heading;

      for (const para of paragraphs) {
        const paraWords = para.split(/\s+/).filter(Boolean).length;
        if (currentCount + paraWords > chunkSize && currentChunk.length > 0) {
          chunks.push({
            id: `fchunk-${chunkIndex}`,
            text: currentChunk.join('\n\n'),
            index: chunkIndex,
            heading: currentHeading,
            wordCount: currentCount,
          });
          chunkIndex++;
          currentChunk = [];
          currentCount = 0;
          currentHeading = `${section.heading} (continued)`;
        }
        currentChunk.push(para);
        currentCount += paraWords;
      }

      if (currentChunk.length > 0) {
        chunks.push({
          id: `fchunk-${chunkIndex}`,
          text: currentChunk.join('\n\n'),
          index: chunkIndex,
          heading: currentHeading,
          wordCount: currentCount,
        });
        chunkIndex++;
      }
    }

    const totalTokens = chunks.reduce((sum, c) => sum + c.wordCount, 0);

    return { chunks, strategy: 'full', totalTokens };
  }

  private splitByHeadings(text: string): Array<{ text: string; heading: string; index: number }> {
    const sections: Array<{ text: string; heading: string; index: number }> = [];
    const lines = text.split('\n');
    let currentHeading = 'Document';
    let currentContent: string[] = [];
    let sectionIndex = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
      if (headingMatch) {
        if (currentContent.length > 0 || sectionIndex > 0) {
          sections.push({
            text: currentHeading === 'Document' ? currentContent.join('\n') : `${currentHeading}\n\n${currentContent.join('\n')}`,
            heading: currentHeading,
            index: sectionIndex++,
          });
        }
        currentHeading = headingMatch[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        text: currentContent.join('\n'),
        heading: currentHeading,
        index: sectionIndex,
      });
    }

    return sections;
  }
}

export function createChunker(mode: DepthMode): AdaptiveChunker {
  return new AdaptiveChunker(mode);
}
