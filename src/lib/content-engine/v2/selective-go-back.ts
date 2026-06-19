// ── Selective Go-Back System ──────────────────────────────────────────────────

import type { ContentFrame, FrameQualityScore } from './types';
import { FRAME_QUALITY_THRESHOLD } from './types';

export class SelectiveGoBack {
  private maxRegenerations: number = 3;
  private thresholds: FrameQualityScore = {
    content: 0.6,
    visual: 0.5,
    educational: 0.5,
    technical: 0.6,
    overall: 0.65,
    issues: [],
  };

  constructor(maxRegenerations: number = 3) {
    this.maxRegenerations = maxRegenerations;
  }

  scoreFrame(frame: ContentFrame, generatedContent: string): FrameQualityScore {
    const contentScore = this.scoreContent(generatedContent, frame);
    const visualScore = this.scoreVisual(generatedContent, frame);
    const educationalScore = this.scoreEducational(generatedContent, frame);
    const technicalScore = this.scoreTechnical(generatedContent, frame);
    const overall = contentScore * 0.35 + visualScore * 0.25 + educationalScore * 0.2 + technicalScore * 0.2;

    const issues = this.collectIssues(generatedContent, {
      content: contentScore,
      visual: visualScore,
      educational: educationalScore,
      technical: technicalScore,
      overall,
      issues: [],
    });

    const qualityScore: FrameQualityScore = {
      content: contentScore,
      visual: visualScore,
      educational: educationalScore,
      technical: technicalScore,
      overall,
      issues,
    };

    frame.qualityScore = qualityScore;
    return qualityScore;
  }

  needsRegeneration(score: FrameQualityScore): boolean {
    return score.overall < FRAME_QUALITY_THRESHOLD;
  }

  canRegenerate(frame: ContentFrame): boolean {
    return frame.regenerateCount < this.maxRegenerations &&
           frame.status !== 'failed';
  }

  shouldRegenerateFrame(frame: ContentFrame, score: FrameQualityScore): boolean {
    return this.needsRegeneration(score) && this.canRegenerate(frame);
  }

  getRegenerationAdvice(score: FrameQualityScore): string[] {
    const advice: string[] = [];
    if (score.content < this.thresholds.content) {
      advice.push('Add more detail and complete explanations');
    }
    if (score.visual < this.thresholds.visual) {
      advice.push('Add diagrams, images, or tables to improve visual understanding');
    }
    if (score.educational < this.thresholds.educational) {
      advice.push('Include examples, analogies, or step-by-step explanations');
    }
    if (score.technical < this.thresholds.technical) {
      advice.push('Improve technical accuracy, add cross-references, verify terminology');
    }
    return advice;
  }

  private scoreContent(content: string, frame: ContentFrame): number {
    let score = 0.5;
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Length adequacy
    if (wordCount >= frame.metadata.wordCount * 1.2) score += 0.15;
    if (wordCount >= frame.metadata.wordCount * 0.5) score += 0.1;

    // Structure
    if (/^#{1,4}\s+/.test(content)) score += 0.1;
    if (content.includes('\n\n')) score += 0.05;

    // Completeness markers
    if (/\b(because|therefore|however|consequently|specifically)\b/i.test(content)) score += 0.05;
    if (/\b(first|second|third|finally|next|then)\b/i.test(content)) score += 0.05;

    return Math.min(1, score);
  }

  private scoreVisual(content: string, frame: ContentFrame): number {
    let score = 0.3;

    if (/```(?:mermaid|plantuml|flowchart|sequenceDiagram)/.test(content)) score += 0.25;
    if (/\|.+\|/.test(content)) score += 0.15;
    if (/!\[.*\]\(.*\)/.test(content)) score += 0.15;
    if (/\[!(?:NOTE|WARNING|TIP|DANGER|INFO)\]/.test(content)) score += 0.1;

    // Check if visuals are justified by content
    if (frame.metadata.importance > 0.7 && score < 0.5) score += 0.1;

    return Math.min(1, score);
  }

  private scoreEducational(content: string, frame: ContentFrame): number {
    let score = 0.4;

    if (/```\w+/.test(content)) score += 0.2;
    if (/\b(for example|for instance|such as|e\.g\.|i\.e\.)\b/i.test(content)) score += 0.15;
    if (/\b(note:|tip:|important:|remember:)\b/i.test(content)) score += 0.1;
    if (/\b(analogy|imagine|think of it as)\b/i.test(content)) score += 0.1;

    return Math.min(1, score);
  }

  private scoreTechnical(content: string, frame: ContentFrame): number {
    let score = 0.5;

    // Cross-references
    if (/see (Figure|Table|Section|Chapter)\b/i.test(content)) score += 0.1;
    if (content.includes('[[') || content.includes('](/')) score += 0.05;

    // Technical terminology
    if (frame.metadata.entities.length > 0) {
      const entityUsage = frame.metadata.entities.filter(e =>
        content.toLowerCase().includes(e.toLowerCase())
      ).length / frame.metadata.entities.length;
      score += entityUsage * 0.15;
    }

    // Code precision
    if (/`[^`]+`/.test(content)) score += 0.1;

    return Math.min(1, score);
  }

  private collectIssues(content: string, score: FrameQualityScore): string[] {
    const issues: string[] = [];

    if (score.content < this.thresholds.content) {
      issues.push('Content needs more detail and explanation');
    }
    if (score.visual < this.thresholds.visual) {
      issues.push('Missing visual elements (diagrams, tables, or images)');
    }
    if (score.educational < this.thresholds.educational) {
      issues.push('Lacks educational examples or analogies');
    }
    if (score.technical < this.thresholds.technical) {
      issues.push('Technical depth is insufficient');
    }

    return issues;
  }
}

export function createSelectiveGoBack(maxRegenerations?: number): SelectiveGoBack {
  return new SelectiveGoBack(maxRegenerations);
}

export function shouldRegenerate(frame: ContentFrame, score: FrameQualityScore): boolean {
  return score.overall < FRAME_QUALITY_THRESHOLD && frame.regenerateCount < 3;
}
