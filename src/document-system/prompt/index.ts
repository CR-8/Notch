/**
 * Prompt Builder — modular prompt assembly
 *
 * Assembles a full document generation prompt from modular parts.
 * All rules are model-agnostic and produce consistent output
 * across Claude, GPT, Gemini, Llama, DeepSeek, and others.
 */

import { buildRolePrompt } from './modules/role';
import { buildStructurePrompt, type DocumentClass } from './modules/structure';
import { buildFormatPrompt } from './modules/format';
import { buildStylePrompt } from './modules/style';
import { buildCalloutPrompt } from './modules/callouts';
import { buildCodePrompt } from './modules/code';
import { buildDiagramPrompt } from './modules/diagrams';
import { buildTablePrompt } from './modules/tables';
import { buildOutputPrompt } from './modules/output';
import { buildNormalizationPrompt } from './modules/normalization';

/* ── Generation Mode (matches lib types but lowercase) ───────────────── */

export type GenerationMode = 'FAST' | 'BALANCED' | 'DEEP';

const MODE_PROMPTS: Record<GenerationMode, string> = {
  FAST: `Mode: FAST — 300-600 words, concise professional note.
- 1-2 core sections + overview + key takeaways
- At most 1 diagram OR 1 table OR 1 callout
- Focus on key facts and essential context`,

  BALANCED: `Mode: BALANCED — 1000-2500 words, comprehensive report.
- 3-5 core sections with subsections as needed
- 1-3 diagrams or tables distributed across sections
- 1-3 callouts for emphasis and context
- Each section should have 2-4 paragraphs of substantive content`,

  DEEP: `Mode: DEEP — 3000-7000+ words, thorough analysis.
- 5-8 core sections with appropriate subsections
- 3-6 diagrams/tables distributed across sections
- 2-5 callouts for context and emphasis
- Include background, core concepts, implications, future directions
- Every section visually enriched with at least one supporting element`,
};

/* ── Builder ──────────────────────────────────────────────────────────── */

export interface PromptBuilderOptions {
  mode: GenerationMode;
  docClass: DocumentClass;
  sourceContent?: string;
}

export function buildPrompt(options: PromptBuilderOptions): string {
  const { mode, docClass } = options;

  return [
    buildRolePrompt(),
    '',
    MODE_PROMPTS[mode],
    '',
    buildStructurePrompt(docClass),
    '',
    buildFormatPrompt(),
    '',
    buildStylePrompt(),
    '',
    buildCalloutPrompt(),
    '',
    buildCodePrompt(),
    '',
    buildDiagramPrompt(),
    '',
    buildTablePrompt(),
    '',
    buildNormalizationPrompt(),
    '',
    buildOutputPrompt(),
    '',
    `## Source Content\n\n${options.sourceContent ?? ''}`,
    '',
    '---',
    'Generate the document now (no preamble, no postamble).',
  ]
    .join('\n')
    .trim();
}

/* ── Convenience builders ────────────────────────────────────────────── */

export function buildFastPrompt(docClass: DocumentClass, content: string): string {
  return buildPrompt({ mode: 'FAST', docClass, sourceContent: content });
}

export function buildBalancedPrompt(docClass: DocumentClass, content: string): string {
  return buildPrompt({ mode: 'BALANCED', docClass, sourceContent: content });
}

export function buildDeepPrompt(docClass: DocumentClass, content: string): string {
  return buildPrompt({ mode: 'DEEP', docClass, sourceContent: content });
}
