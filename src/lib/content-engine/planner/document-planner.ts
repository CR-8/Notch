// ── Document Planner (Problem 2) ──────────────────────────────────────────────
// Decides the full document structure BEFORE any content is generated: which
// sections (each with a single, unique responsibility — Problem 1), which visuals
// and diagram types (Problem 4 — chosen from content, never defaulted), and what
// metadata to compute. Pure and deterministic given the extraction + mode + docType.

import type { KnowledgeExtraction } from '../../capture/extraction/types';
import type { DocumentClass } from '../../capture/classification/classifier';
import { selectMermaidDirection, type MermaidDirection } from '../mermaid/direction';

export type PlanDepth = 'fast' | 'standard' | 'deep';

/** Each section answers exactly ONE question — no overlap between sections. */
export type SectionId =
  | 'summary'
  | 'key-points'
  | 'concepts'
  | 'timeline'
  | 'main-content'
  | 'examples'
  | 'analysis'
  | 'key-takeaways'
  // Phase C: paper-specific sections
  | 'methodology'
  | 'results'
  | 'limitations';

export interface SectionPlan {
  id: SectionId;
  title: string;
  /** The single question this section must answer. */
  responsibility: string;
  format: 'prose' | 'bullets' | 'definitions' | 'timeline';
  targetWords: number;
  required: boolean;
}

export type PlannedDiagramType =
  | 'flowchart'
  | 'sequence'
  | 'architecture'
  | 'mindmap'
  | 'timeline'
  | 'knowledge-graph'
  | 'state'
  | 'er'
  | 'hierarchy'
  | 'comparison'
  | 'decision-tree';

export interface VisualPlan {
  id: string;
  kind: 'diagram' | 'table' | 'image';
  diagramType?: PlannedDiagramType;
  direction?: MermaidDirection;
  title: string;
  rationale: string;
  sectionRef: SectionId;
}

export interface MetadataPlan {
  computeReadingTime: boolean;
  computeComplexity: boolean;
  computeDocumentType: boolean;
  includeEntities: boolean;
  includeConcepts: boolean;
  includeTimeline: boolean;
  includeRelationships: boolean;
}

export interface DocumentPlan {
  depth: PlanDepth;
  sections: SectionPlan[];
  visuals: VisualPlan[];
  metadata: MetadataPlan;
  targetWords: { min: number; max: number };
}

const DEPTH_TARGETS: Record<
  PlanDepth,
  { min: number; max: number; maxVisuals: number; maxDiagrams: number }
> = {
  fast: { min: 300, max: 600, maxVisuals: 1, maxDiagrams: 1 },
  standard: { min: 1000, max: 2500, maxVisuals: 4, maxDiagrams: 3 },
  deep: { min: 3000, max: 7000, maxVisuals: 15, maxDiagrams: 20 },
};

/** Phase C: Template-driven section catalogue — varies by document class. */
function sectionCatalogue(depth: PlanDepth, documentClass?: DocumentClass): SectionPlan[] {
  const core: SectionPlan[] = [
    {
      id: 'summary',
      title: 'Summary',
      responsibility: 'What is this document about?',
      format: 'prose',
      targetWords: depth === 'fast' ? 120 : 300,
      required: true,
    },
    {
      id: 'key-points',
      title: 'Key Points',
      responsibility: 'What are the most important facts?',
      format: 'bullets',
      targetWords: 120,
      required: true,
    },
    {
      id: 'concepts',
      title: 'Concepts',
      responsibility: 'What terminology must the reader understand?',
      format: 'definitions',
      targetWords: 180,
      required: true,
    },
    {
      id: 'timeline',
      title: 'Timeline',
      responsibility: 'How did this evolve over time?',
      format: 'timeline',
      targetWords: 150,
      required: false,
    },
    {
      id: 'key-takeaways',
      title: 'Key Takeaways',
      responsibility: 'What should the reader remember and do?',
      format: 'bullets',
      targetWords: 120,
      required: true,
    },
  ];

  // Paper template: replaces main-content with methodology/results/limitations.
  if (documentClass === 'research-paper') {
    const paperSections: SectionPlan[] = [
      {
        id: 'main-content',
        title: 'Main Contributions',
        responsibility: 'What does this paper contribute?',
        format: 'prose',
        targetWords: depth === 'deep' ? 2000 : 800,
        required: true,
      },
      {
        id: 'methodology',
        title: 'Methodology',
        responsibility: 'How did the authors approach the problem?',
        format: 'prose',
        targetWords: depth === 'deep' ? 1500 : 600,
        required: depth !== 'fast',
      },
      {
        id: 'results',
        title: 'Results',
        responsibility: 'What were the key findings and metrics?',
        format: 'prose',
        targetWords: depth === 'deep' ? 1500 : 500,
        required: depth !== 'fast',
      },
      {
        id: 'analysis',
        title: 'Analysis',
        responsibility: 'Why does this matter? Tradeoffs and implications.',
        format: 'prose',
        targetWords: 400,
        required: depth !== 'fast',
      },
      {
        id: 'limitations',
        title: 'Limitations',
        responsibility: 'What are the acknowledged limitations?',
        format: 'prose',
        targetWords: 300,
        required: depth === 'deep',
      },
    ];
    // Tutorial template: step-by-step focus.
    const all = [...core, ...paperSections];
    if (depth === 'fast')
      return all.filter((s) =>
        ['summary', 'key-points', 'concepts', 'key-takeaways', 'main-content'].includes(s.id),
      );
    return all;
  }

  if (documentClass === 'tutorial') {
    const tutorialSections: SectionPlan[] = [
      {
        id: 'main-content',
        title: 'Steps',
        responsibility: 'What are the step-by-step instructions?',
        format: 'prose',
        targetWords: depth === 'deep' ? 3000 : 1200,
        required: true,
      },
      {
        id: 'examples',
        title: 'Examples',
        responsibility: 'What do the results look like?',
        format: 'prose',
        targetWords: 400,
        required: depth === 'deep',
      },
      {
        id: 'analysis',
        title: 'Tips & Pitfalls',
        responsibility: 'What common mistakes should be avoided?',
        format: 'prose',
        targetWords: 300,
        required: depth !== 'fast',
      },
    ];
    const all = [...core, ...tutorialSections];
    if (depth === 'fast')
      return all.filter((s) =>
        ['summary', 'key-points', 'concepts', 'key-takeaways'].includes(s.id),
      );
    return all;
  }

  if (documentClass === 'news') {
    const newsSections: SectionPlan[] = [
      {
        id: 'main-content',
        title: 'Details',
        responsibility: 'What happened? When and where?',
        format: 'prose',
        targetWords: depth === 'deep' ? 2000 : 800,
        required: true,
      },
      {
        id: 'analysis',
        title: 'Impact',
        responsibility: 'What is the significance and impact?',
        format: 'prose',
        targetWords: 300,
        required: depth !== 'fast',
      },
    ];
    const all = [...core, ...newsSections];
    if (depth === 'fast')
      return all.filter((s) =>
        ['summary', 'key-points', 'concepts', 'key-takeaways'].includes(s.id),
      );
    return all;
  }

  // Default (general, reference, documentation, blog-post, analysis):
  const defaultSections: SectionPlan[] = [
    {
      id: 'main-content',
      title: 'Main Content',
      responsibility: 'What is the actual explanation?',
      format: 'prose',
      targetWords: depth === 'deep' ? 3000 : 1200,
      required: depth !== 'fast',
    },
    {
      id: 'examples',
      title: 'Examples',
      responsibility: 'Where is this used in practice?',
      format: 'prose',
      targetWords: 400,
      required: depth === 'deep',
    },
    {
      id: 'analysis',
      title: 'Analysis',
      responsibility: 'Why does this matter? Tradeoffs and implications.',
      format: 'prose',
      targetWords: 400,
      required: depth !== 'fast',
    },
  ];
  const all = [...core, ...defaultSections];
  if (depth === 'fast')
    return all.filter((s) => ['summary', 'key-points', 'concepts', 'key-takeaways'].includes(s.id));
  if (depth === 'standard') return all.filter((s) => s.id !== 'examples');
  return all;
}

/**
 * Chooses diagram types from the extracted knowledge (Problem 4 — never default to
 * flowcharts). Maps content signals → the most expressive diagram, with an inferred
 * Mermaid direction (Problem 5).
 */
function planVisuals(
  extraction: KnowledgeExtraction,
  depth: PlanDepth,
  sections: SectionPlan[],
): VisualPlan[] {
  const cfg = DEPTH_TARGETS[depth];
  const out: VisualPlan[] = [];
  const has = (id: SectionId) => sections.some((s) => s.id === id);
  const push = (v: Omit<VisualPlan, 'id'>) => {
    if (out.length >= cfg.maxVisuals) return;
    out.push({ ...v, id: `vis-${out.length + 1}` });
  };

  // Timeline → timeline diagram (LR).
  if (extraction.timeline.length >= 2 && has('timeline')) {
    push({
      kind: 'diagram',
      diagramType: 'timeline',
      direction: 'LR',
      title: 'Evolution timeline',
      rationale: 'Chronological events detected',
      sectionRef: 'timeline',
    });
  }

  // Relationships / many entities → knowledge graph.
  if (extraction.relationships.length >= 2 || extraction.entities.length >= 6) {
    push({
      kind: 'diagram',
      diagramType: 'knowledge-graph',
      direction: 'LR',
      title: 'Concept & entity map',
      rationale: 'Multiple related entities detected',
      sectionRef: 'main-content',
    });
  }

  // Architecture/system signal.
  const joined = (
    extraction.topics.join(' ') +
    ' ' +
    extraction.entities.map((e) => e.name).join(' ')
  ).toLowerCase();
  if (/architecture|system|service|infrastructure|platform|microservice|api/.test(joined)) {
    push({
      kind: 'diagram',
      diagramType: 'architecture',
      direction: selectMermaidDirection('architecture', joined),
      title: 'System architecture',
      rationale: 'Architecture/infrastructure terms present',
      sectionRef: 'main-content',
    });
  }

  // Process/pipeline signal → flowchart (LR).
  if (/pipeline|workflow|process|deploy|stage|step|ci\/cd/.test(joined)) {
    push({
      kind: 'diagram',
      diagramType: 'flowchart',
      direction: 'LR',
      title: 'Process flow',
      rationale: 'Process/pipeline language present',
      sectionRef: 'main-content',
    });
  }

  // Interaction/API signal → sequence.
  if (/request|response|api|client|server|call|message|event/.test(joined)) {
    push({
      kind: 'diagram',
      diagramType: 'sequence',
      direction: 'LR',
      title: 'Interaction sequence',
      rationale: 'Request/response interactions present',
      sectionRef: 'main-content',
    });
  }

  // Concept-rich but no strong structural signal → mind map (TD).
  if (out.length === 0 && extraction.concepts.length >= 3) {
    push({
      kind: 'diagram',
      diagramType: 'mindmap',
      direction: 'TD',
      title: 'Concept map',
      rationale: 'Concept-dense content',
      sectionRef: 'concepts',
    });
  }

  // Comparison table when multiple comparable entities/technologies exist.
  if (depth !== 'fast' && extraction.entities.filter((e) => e.type === 'technology').length >= 2) {
    push({
      kind: 'table',
      title: 'Technology comparison',
      rationale: 'Multiple technologies to compare',
      sectionRef: 'analysis',
    });
  }

  return out.slice(0, cfg.maxVisuals);
}

export function planDocument(
  extraction: KnowledgeExtraction,
  depth: PlanDepth,
  documentClass?: DocumentClass,
): DocumentPlan {
  const targets = DEPTH_TARGETS[depth];
  const sections = sectionCatalogue(depth, documentClass).filter((s) => {
    // Drop optional sections with no supporting extracted data.
    if (s.id === 'timeline') return extraction.timeline.length > 0;
    return true;
  });
  const visuals = planVisuals(extraction, depth, sections);
  return {
    depth,
    sections,
    visuals,
    metadata: {
      computeReadingTime: true,
      computeComplexity: true,
      computeDocumentType: true,
      includeEntities: true,
      includeConcepts: true,
      includeTimeline: extraction.timeline.length > 0,
      includeRelationships: extraction.relationships.length > 0,
    },
    targetWords: { min: targets.min, max: targets.max },
  };
}
