// ── Generation orchestrator ───────────────────────────────────────────────────
// Runs the planner-driven pipeline: generate each section in isolation, generate
// each planned visual, then assemble final markdown with figure numbering/captions.
// Resilient: a failed section/visual degrades gracefully instead of failing capture.

import type { KnowledgeExtraction } from '../extraction/types';
import type { DocumentPlan } from '../planner/document-planner';
import type { CompleteFn, GeneratedDocument, GeneratedSection, GeneratedVisual } from './types';
import { generateSection } from './section-generator';
import { generateVisual } from './diagram-generator';

export interface OrchestratorOptions {
  onProgress?: (step: string, pct: number) => void;
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Assembles sections + visuals into final markdown with Figure N captions. */
export function assembleDocument(
  title: string,
  sections: GeneratedSection[],
  visuals: GeneratedVisual[],
): { markdown: string; figureCount: number } {
  const bySection = new Map<string, GeneratedVisual[]>();
  for (const v of visuals) {
    if (!v.mermaid.trim()) continue;
    const list = bySection.get(v.sectionRef) ?? [];
    list.push(v);
    bySection.set(v.sectionRef, list);
  }

  const out: string[] = [`# ${title}`, ''];
  let figure = 0;

  for (const section of sections) {
    out.push(`## ${section.title}`, '', section.markdown.trim(), '');
    for (const v of bySection.get(section.id) ?? []) {
      figure += 1;
      out.push('```mermaid', v.mermaid.trim(), '```', '');
      // Problem 7: every visual gets number + title + caption (significance).
      out.push(`*Figure ${figure} — ${v.title}.* ${v.caption}`.trim(), '');
    }
  }

  return { markdown: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), figureCount: figure };
}

export async function generateDocument(
  title: string,
  plan: DocumentPlan,
  knowledge: KnowledgeExtraction,
  sourceText: string,
  complete: CompleteFn,
  opts: OrchestratorOptions = {},
): Promise<GeneratedDocument> {
  const { onProgress } = opts;

  onProgress?.('Writing sections...', 35);
  const sections = await Promise.all(
    plan.sections.map((section) =>
      generateSection({ section, knowledge, sourceText, title, depth: plan.depth }, complete),
    ),
  );

  onProgress?.('Generating diagrams...', 60);
  const visuals = await Promise.all(
    plan.visuals.map((visual) => generateVisual(visual, knowledge, sourceText, title, complete)),
  );

  onProgress?.('Assembling document...', 75);
  const { markdown, figureCount } = assembleDocument(title, sections, visuals);

  return {
    title,
    markdown,
    sections,
    visuals: visuals.filter((v) => v.mermaid.trim()).map((v, i) => ({ ...v, figureNumber: i + 1 })),
    wordCount: countWords(markdown),
    diagramCount: figureCount,
  };
}
