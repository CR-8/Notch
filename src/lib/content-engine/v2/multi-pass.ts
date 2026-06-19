// ── Multi-Pass Generation Pipeline ───────────────────────────────────────────

import type { GenerationPass, PassState, PassResult, ContentFrame, DepthConfig } from './types';
import { DEPTH_CONFIGS } from './types';
import type { DepthMode } from './types';

export class MultiPassGenerator {
  private mode: DepthMode;
  private config: DepthConfig;
  private state: PassState;
  private results: Map<GenerationPass, PassResult> = new Map();

  constructor(mode: DepthMode) {
    this.mode = mode;
    this.config = DEPTH_CONFIGS[mode];
    this.state = {
      currentPass: 'structure',
      passIndex: 0,
      totalPasses: this.config.passes.length,
      progress: 0,
      completed: [],
    };
  }

  getState(): PassState {
    return this.state;
  }

  getResults(): Map<GenerationPass, PassResult> {
    return this.results;
  }

  getPassResult(pass: GenerationPass): PassResult | undefined {
    return this.results.get(pass);
  }

  getCurrentPassInstructions(): string {
    const pass = this.state.currentPass;
    const passIndex = this.state.passIndex;
    const totalPasses = this.state.totalPasses;

    const instructions: Record<GenerationPass, string> = {
      structure: `PASS ${passIndex + 1}/${totalPasses}: STRUCTURE GENERATION
Generate the document outline with sections, subsections, and heading hierarchy.
Output ONLY section headings in a numbered markdown outline.
No content, no diagrams, no code — just the skeletal structure.`,

      content: `PASS ${passIndex + 1}/${totalPasses}: CONTENT GENERATION
Using the structure from the previous pass, fill in the detailed content.
Write comprehensive explanations, analysis, and narratives.
Do NOT include diagrams, images, or code yet — just text content.`,

      visuals: `PASS ${passIndex + 1}/${totalPasses}: VISUAL GENERATION
Add diagrams, tables, and visual elements to the content.
Use \`\`\`mermaid for flowcharts, sequence diagrams, class diagrams, ER diagrams, mindmaps, timelines.
Use \`\`\`plantuml for UML diagrams (component, deployment, activity).
Use standard markdown tables for structured data.
Number all figures and tables.`,

      examples: `PASS ${passIndex + 1}/${totalPasses}: EXAMPLE GENERATION
Add code examples, practical demonstrations, and illustrative cases.
Use proper \`\`\`language fences with language identifiers.
Include inline \`code\` references in the surrounding text.
Add "For example:" or "Consider:" contextual introductions.`,

      references: `PASS ${passIndex + 1}/${totalPasses}: REFERENCE GENERATION
Add cross-references, citations, footnotes, and links.
Reference figures, tables, and sections by number.
Add see-also links between related sections.
Include external references where appropriate.`,

      merge: `PASS ${passIndex + 1}/${totalPasses}: MERGE & FINALIZE
Combine all passes into a cohesive document.
Ensure consistent numbering, cross-references, and formatting.
Add the table of contents.
Verify all diagram fences are valid.
Verify all image references are valid.
Remove any duplicates or contradictions.`,
    };

    return instructions[pass];
  }

  advancePass(): GenerationPass | null {
    const currentIndex = this.config.passes.indexOf(this.state.currentPass);
    if (currentIndex < 0) return null;

    this.state.completed.push(this.state.currentPass);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= this.config.passes.length) return null;

    const nextPass = this.config.passes[nextIndex];
    this.state.currentPass = nextPass;
    this.state.passIndex = nextIndex;
    this.state.progress = Math.round((nextIndex / this.config.passes.length) * 100);

    return nextPass;
  }

  recordResult(pass: GenerationPass, result: PassResult): void {
    this.results.set(pass, result);
  }

  isComplete(): boolean {
    return this.state.completed.length >= this.state.totalPasses;
  }

  getPassPrompt(pass: GenerationPass, frame: ContentFrame, previousOutputs: string): string {
    const baseInstructions = this.getCurrentPassInstructions();

    let context = '';
    if (frame) {
      context = `\n\nFRAME CONTEXT:\nTopic: ${frame.topic}\nTitle: ${frame.title}\nSource: ${frame.sourceText.slice(0, 1000)}\n`;
    }

    let previousContext = '';
    if (previousOutputs) {
      previousContext = `\n\nPREVIOUS PASS OUTPUT:\n${previousOutputs.slice(0, 2000)}\n`;
    }

    return `${baseInstructions}${context}${previousContext}\n\nDEPTH MODE: ${this.mode}\n${this.getDepthInstructions()}`;
  }

  private getDepthInstructions(): string {
    switch (this.mode) {
      case 'fast':
        return 'Be concise but complete. Prefer bullet points over paragraphs. Focus on essential information only.';
      case 'standard':
        return 'Provide balanced detail. Include explanations and examples. Structure content logically with subsections.';
      case 'deep':
        return 'Be exhaustive and publication-quality. Include detailed analysis, multiple examples, comprehensive explanations, and rich visual elements. Target whitepaper level.';
    }
  }
}

export function createMultiPassGenerator(mode: DepthMode): MultiPassGenerator {
  return new MultiPassGenerator(mode);
}
