// ── Adaptive Depth Controller ──────────────────────────────────────────────────

import { DEPTH_CONFIGS } from './types';
import type { DepthMode, DepthConfig } from './types';

export class DepthController {
  private config: DepthConfig;
  private mode: DepthMode;
  private sourceWordCount: number;
  private currentWordCount: number = 0;

  constructor(mode: DepthMode, sourceWordCount: number) {
    this.mode = mode;
    this.sourceWordCount = sourceWordCount;
    this.config = DEPTH_CONFIGS[mode];
  }

  getConfig(): DepthConfig {
    return this.config;
  }

  getMode(): DepthMode {
    return this.mode;
  }

  shouldContinueGenerating(): boolean {
    if (this.currentWordCount >= this.config.maxWords) return false;
    if (this.currentWordCount >= this.config.minWords && this.hasAdequateVisuals()) return false;
    return true;
  }

  private hasAdequateVisuals(): boolean {
    return false; // Determined externally
  }

  getRemainingWords(): number {
    return Math.max(0, this.config.maxWords - this.currentWordCount);
  }

  addWordCount(count: number): void {
    this.currentWordCount += count;
  }

  getExpansionFactor(): number {
    return Math.min(
      this.config.maxWords / Math.max(this.sourceWordCount, 1),
      10,
    );
  }

  getDiagramBudget(): number {
    return this.config.maxDiagrams;
  }

  getImageBudget(): number {
    return this.config.maxImages;
  }

  getTableBudget(): number {
    return this.config.maxTables;
  }

  shouldIncludeUML(): boolean {
    return this.config.includeUML;
  }

  shouldIncludeCodeExamples(): boolean {
    return this.config.includeCodeExamples;
  }

  shouldIncludeCaseStudies(): boolean {
    return this.config.includeCaseStudies;
  }

  shouldIncludeReferences(): boolean {
    return this.config.includeReferences;
  }

  getPasses() {
    return this.config.passes;
  }

  getMultiplier(type: 'diagram' | 'image'): number {
    return type === 'diagram' ? this.config.diagramMultiplier : this.config.imageMultiplier;
  }

  scoreContentDensity(wordCount: number, diagramCount: number, imageCount: number, tableCount: number): number {
    const wordScore = Math.min(wordCount / this.config.maxWords, 1) * 0.4;
    const diagramScore = Math.min(diagramCount / this.config.maxDiagrams, 1) * 0.25;
    const imageScore = Math.min(imageCount / this.config.maxImages, 1) * 0.2;
    const tableScore = Math.min(tableCount / this.config.maxTables, 1) * 0.15;
    return wordScore + diagramScore + imageScore + tableScore;
  }

  getTargetWordCount(): number {
    return Math.min(this.config.maxWords, Math.max(this.config.minWords, Math.floor(this.sourceWordCount * 1.5)));
  }

  generateDepthPrompt(): string {
    const c = this.config;
    const lines: string[] = [
      `You are generating at "${this.mode}" depth. Follow these constraints:`,
      '',
      `- Target ${c.minWords}-${c.maxWords} words`,
      `- Include ${c.maxDiagrams} max diagrams (flowchart, sequenceDiagram, classDiagram, erDiagram, etc.)`,
      `- Include ${c.maxImages} max image placeholders`,
      `- Include ${c.maxTables} max tables`,
      `- Include ${c.maxCallouts} max callouts (note, warning, tip, danger, info)`,
    ];

    if (c.includeCodeExamples) lines.push('- Include code examples with syntax highlighting');
    if (c.includeCaseStudies) lines.push('- Include case studies or real-world examples where relevant');
    if (c.includeUML) lines.push('- Include UML diagrams via plantuml where appropriate');
    if (c.includeReferences) lines.push('- Include references and citations');

    lines.push('', 'Output well-structured markdown with Mermaid/PlantUML fences for diagrams.');

    return lines.join('\n');
  }
}

export function createDepthController(mode: DepthMode, sourceWordCount: number): DepthController {
  return new DepthController(mode, sourceWordCount);
}
