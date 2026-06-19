// ── Frame Engine ──────────────────────────────────────────────────────────────

import type { ContentFrame, FrameMetadata, FrameQualityScore, DepthMode } from './types';
import { FRAME_QUALITY_THRESHOLD } from './types';

const SECTION_PATTERN = /^#{2,4}\s+(.+)$/gm;

export class FrameEngine {
  private frames: ContentFrame[] = [];
  private mode: DepthMode;

  constructor(mode: DepthMode) {
    this.mode = mode;
  }

  splitIntoFrames(sourceText: string): ContentFrame[] {
    const sections = this.extractSections(sourceText);
    this.frames = sections.map((sec, i) => this.createFrame(sec, i));
    this.detectRelationships();
    return this.frames;
  }

  private extractSections(text: string): Section[] {
    const sections: Section[] = [];
    const lines = text.split('\n');
    let currentHeading = 'Preamble';
    let currentContent: string[] = [];
    let sectionIndex = 0;

    for (const line of lines) {
      const match = line.match(SECTION_PATTERN);
      if (match) {
        if (currentContent.length > 0 || sections.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentContent.join('\n').trim(),
            index: sectionIndex++,
          });
        }
        currentHeading = match[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n').trim(),
        index: sectionIndex,
      });
    }

    return sections;
  }

  private createFrame(section: Section, index: number): ContentFrame {
    const wordCount = section.content.split(/\s+/).filter(Boolean).length;
    const entities = this.extractEntities(section.content);
    const keyTerms = this.extractKeyTerms(section.content);

    const metadata: FrameMetadata = {
      wordCount,
      sectionIndex: index,
      hasCode: /```[\s\S]*?```/.test(section.content),
      hasDiagrams: /```(?:mermaid|plantuml)/.test(section.content),
      hasTables: /\|.+\|/.test(section.content),
      hasLists: /^\s*[-*+]\s/.test(section.content),
      entities,
      keyTerms,
      importance: this.calculateImportance(section, wordCount, index),
    };

    return {
      id: `frame-${index}-${section.heading.slice(0, 32).toLowerCase().replace(/\s+/g, '-')}`,
      index,
      title: section.heading,
      topic: this.determineTopic(section),
      context: this.extractContext(section, index),
      sourceText: section.content,
      relationships: [],
      metadata,
      status: 'pending',
      regenerateCount: 0,
      subFrames: [],
    };
  }

  getFrames(): ContentFrame[] {
    return this.frames;
  }

  getFrame(index: number): ContentFrame | undefined {
    return this.frames[index];
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  updateFrame(index: number, updates: Partial<ContentFrame>): void {
    if (this.frames[index]) {
      this.frames[index] = { ...this.frames[index], ...updates };
    }
  }

  markFrameComplete(index: number): void {
    this.updateFrame(index, { status: 'complete' });
  }

  markFrameFailed(index: number): void {
    this.updateFrame(index, { status: 'failed' });
  }

  markFrameRegenerating(index: number): void {
    const frame = this.frames[index];
    if (frame) {
      this.updateFrame(index, {
        status: 'regenerating',
        regenerateCount: frame.regenerateCount + 1,
      });
    }
  }

  setFrameQualityScore(index: number, score: FrameQualityScore): void {
    this.updateFrame(index, { qualityScore: score });
  }

  getRegenerateCandidates(threshold: number = FRAME_QUALITY_THRESHOLD): ContentFrame[] {
    return this.frames.filter(f =>
      f.status === 'complete' &&
      f.qualityScore &&
      f.qualityScore.overall < threshold &&
      f.regenerateCount < 3
    );
  }

  hasIncompleteFrames(): boolean {
    return this.frames.some(f => f.status === 'pending' || f.status === 'processing' || f.status === 'failed');
  }

  getCompleteFrames(): ContentFrame[] {
    return this.frames.filter(f => f.status === 'complete');
  }

  getFailedFrames(): ContentFrame[] {
    return this.frames.filter(f => f.status === 'failed');
  }

  getTotalWordCount(): number {
    return this.frames.reduce((sum, f) => sum + f.metadata.wordCount, 0);
  }

  // ── Sub-frame splitting for large frames ────────────────────────────────

  splitLargeFrame(frameIndex: number, maxWords: number = 500): void {
    const frame = this.frames[frameIndex];
    if (!frame || frame.metadata.wordCount <= maxWords) return;

    const paragraphs = frame.sourceText.split(/\n\s*\n/);
    const subFrames: ContentFrame[] = [];
    let subIndex = 0;
    let buffer: string[] = [];
    let bufferWords = 0;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean).length;
      if (bufferWords + paraWords > maxWords && buffer.length > 0) {
        subFrames.push(this.createSubFrame(buffer.join('\n\n'), subIndex++, frame, `Part ${subIndex}`));
        buffer = [para];
        bufferWords = paraWords;
      } else {
        buffer.push(para);
        bufferWords += paraWords;
      }
    }

    if (buffer.length > 0) {
      subFrames.push(this.createSubFrame(buffer.join('\n\n'), subIndex++, frame, `Part ${subIndex}`));
    }

    this.frames[frameIndex].subFrames = subFrames;
  }

  private createSubFrame(content: string, index: number, parent: ContentFrame, suffix: string): ContentFrame {
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return {
      id: `${parent.id}-sub-${index}`,
      index: parent.index * 100 + index,
      title: `${parent.title} ${suffix}`,
      topic: parent.topic,
      context: parent.context,
      sourceText: content,
      relationships: parent.relationships,
      metadata: {
        ...parent.metadata,
        wordCount,
        sectionIndex: index,
      },
      status: 'pending',
      regenerateCount: 0,
      subFrames: [],
    };
  }

  // ── Analysis helpers ────────────────────────────────────────────────────

  private detectRelationships(): void {
    const allEntities = this.frames.map(f => f.metadata.entities);
    for (let i = 0; i < this.frames.length; i++) {
      for (let j = i + 1; j < this.frames.length; j++) {
        const shared = allEntities[i].filter(e => allEntities[j].includes(e));
        if (shared.length > 0) {
          this.frames[i].relationships.push(`relates-to:frame-${j} (shared: ${shared.join(', ')})`);
          this.frames[j].relationships.push(`relates-to:frame-${i} (shared: ${shared.join(', ')})`);
        }
      }
    }
  }

  private extractEntities(text: string): string[] {
    const entities = new Set<string>();
    const patterns = [
      /(?:\*\*|__)([A-Z][a-zA-Z0-9\s]{2,48}?)(?:\*\*|__)/g,
      /`([A-Z][a-zA-Z0-9_\s]{2,48})`/g,
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        entities.add(match[1].trim());
      }
    }
    return Array.from(entities).slice(0, 20);
  }

  private extractKeyTerms(text: string): string[] {
    const terms = new Set<string>();
    const termPattern = /\*\*([^*]+)\*\*/g;
    let match: RegExpExecArray | null;
    while ((match = termPattern.exec(text)) !== null) {
      terms.add(match[1].trim());
    }
    return Array.from(terms).slice(0, 15);
  }

  private calculateImportance(section: Section, wordCount: number, index: number): number {
    let score = 0.5;
    if (wordCount > 200) score += 0.2;
    if (section.heading.toLowerCase().includes('introduction')) score -= 0.1;
    if (section.heading.toLowerCase().includes('conclusion')) score -= 0.1;
    if (section.heading.toLowerCase().includes('architecture') || section.heading.toLowerCase().includes('design')) score += 0.2;
    if (section.heading.toLowerCase().includes('implementation') || section.heading.toLowerCase().includes('method')) score += 0.15;
    if (section.heading.toLowerCase().includes('result') || section.heading.toLowerCase().includes('evaluation')) score += 0.15;
    return Math.min(1, Math.max(0.1, score));
  }

  private determineTopic(section: Section): string {
    const lower = section.heading.toLowerCase();
    const heading = section.heading;

    if (/\b(architecture|design|system|infrastructure|topology)\b/i.test(lower)) return 'Architecture';
    if (/\b(implement|code|develop|build|program)\b/i.test(lower)) return 'Implementation';
    if (/\b(test|debug|verify|validate|qa)\b/i.test(lower)) return 'Testing';
    if (/\b(deploy|release|ci|cd|pipeline|delivery)\b/i.test(lower)) return 'Deployment';
    if (/\b(database|schema|model|entity|storage|persistence)\b/i.test(lower)) return 'Data';
    if (/\b(api|endpoint|service|interface|protocol|http)\b/i.test(lower)) return 'API';
    if (/\b(security|auth|access|permission|encrypt)\b/i.test(lower)) return 'Security';
    if (/\b(performance|scale|optim|benchmark|load)\b/i.test(lower)) return 'Performance';
    if (/\b(ui|ux|frontend|client|web|app|interface)\b/i.test(lower)) return 'Frontend';
    if (/\b(backend|server|middleware|logic|service)\b/i.test(lower)) return 'Backend';
    if (/\b(doc|guide|tutorial|manual|readme|help)\b/i.test(lower)) return 'Documentation';
    if (/\b(requirement|spec|feature|story|backlog)\b/i.test(lower)) return 'Requirements';
    if (/\b(config|env|setting|paramet|option|flag)\b/i.test(lower)) return 'Configuration';

    return 'General';
  }

  private extractContext(section: Section, index: number): string {
    return `Section ${index + 1}: "${section.heading}" — ${section.content.slice(0, 100)}...`;
  }
}

export function createFrameEngine(mode: DepthMode): FrameEngine {
  return new FrameEngine(mode);
}

interface Section {
  heading: string;
  content: string;
  index: number;
}
