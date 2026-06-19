// ── Diagram generator (Problems 4 & 5 + FEATURE-001/002) ─────────────────────
// Content-specific diagrams, not templates. Knowledge-graph and timeline diagrams
// are built DETERMINISTICALLY from the extracted knowledge (grounded, offline-safe).
// Structural diagrams (architecture/flowchart/sequence/mindmap) are model-generated
// then validated and auto-repaired before they can reach the renderer.

import type { KnowledgeExtraction } from '../extraction/types';
import type { VisualPlan } from '../planner/document-planner';
import { selectMermaidDirection, applyDirection } from '../mermaid/direction';
import { validateMermaidCode } from '../mermaid/validator';
import { autoFixMermaid } from '../mermaid/fixer';
import type { CompleteFn, GeneratedVisual } from './types';
import { extractCodeBlock } from './types';

function sanitizeLabel(s: string): string {
  return s.replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function nodeId(i: number): string {
  // Mermaid-safe node ids: N0, N1, …
  return 'N' + i;
}

/** Knowledge graph straight from extracted relationships — always valid. */
export function buildKnowledgeGraphMermaid(k: KnowledgeExtraction): string {
  if (k.relationships.length === 0 && k.entities.length === 0) return '';
  const ids = new Map<string, string>();
  const ensure = (name: string): string => {
    const key = name.toLowerCase();
    if (!ids.has(key)) ids.set(key, nodeId(ids.size));
    return ids.get(key)!;
  };
  const lines = ['graph LR'];

  if (k.relationships.length) {
    for (const r of k.relationships.slice(0, 18)) {
      const a = ensure(r.source);
      const b = ensure(r.target);
      lines.push(`  ${a}["${sanitizeLabel(r.source)}"] -->|${sanitizeLabel(r.relation)}| ${b}["${sanitizeLabel(r.target)}"]`);
    }
  } else {
    // No relations — radial graph of top entities around the top concept/topic.
    const center = k.topics[0] ?? k.entities[0]?.name ?? 'Topic';
    const c = ensure(center);
    lines[0] = 'graph TD';
    for (const e of k.entities.slice(0, 10)) {
      if (e.name.toLowerCase() === center.toLowerCase()) continue;
      const n = ensure(e.name);
      lines.push(`  ${c}["${sanitizeLabel(center)}"] --> ${n}["${sanitizeLabel(e.name)}"]`);
    }
  }
  return lines.join('\n');
}

/** Timeline diagram straight from extracted events — always valid. */
export function buildTimelineMermaid(k: KnowledgeExtraction, title: string): string {
  if (k.timeline.length === 0) return '';
  const lines = ['timeline', `  title ${sanitizeLabel(title) || 'Timeline'}`];
  for (const ev of k.timeline.slice(0, 12)) {
    lines.push(`  ${ev.year} : ${sanitizeLabel(ev.event)}`);
  }
  return lines.join('\n');
}

/** Prompt for a model-generated structural diagram. Pure. */
export function buildDiagramPrompt(visual: VisualPlan, k: KnowledgeExtraction, sourceText: string): { system: string; user: string } {
  const direction = visual.direction ?? selectMermaidDirection(visual.diagramType ?? 'flowchart');
  const typeHint: Record<string, string> = {
    architecture: `a Mermaid flowchart ${direction} modelling the system architecture (components, services, data stores and their connections)`,
    flowchart: `a Mermaid flowchart ${direction} of the process/workflow`,
    sequence: 'a Mermaid sequenceDiagram of the key interaction (participants + ordered messages)',
    mindmap: 'a Mermaid mindmap breaking down the core concept',
    state: 'a Mermaid stateDiagram-v2 of the lifecycle/states',
    er: 'a Mermaid erDiagram of the data entities and relationships',
    hierarchy: `a Mermaid flowchart TD of the hierarchy`,
    'decision-tree': `a Mermaid flowchart ${direction} of the decision logic`,
    comparison: `a Mermaid flowchart ${direction} comparing the options`,
  };
  const want = typeHint[visual.diagramType ?? 'flowchart'] ?? `a Mermaid flowchart ${direction}`;

  const system = [
    'You generate ONE Mermaid diagram. Output ONLY a single ```mermaid code block, nothing else.',
    `Produce ${want}.`,
    'Use short, quoted node labels. Keep it specific to the content — never a generic Commit→Build→Test→Deploy.',
    'Ensure the syntax is valid Mermaid.',
  ].join('\n');

  const entities = k.entities.slice(0, 12).map((e) => e.name).join(', ');
  const user = [
    `Title: ${visual.title}`,
    entities ? `Key entities: ${entities}` : '',
    'SOURCE:',
    sourceText.slice(0, 6000),
  ].filter(Boolean).join('\n');

  return { system, user };
}

/** Validates + auto-repairs Mermaid. Returns '' if it can't be made valid. */
export function validateAndRepair(code: string): string {
  if (!code.trim()) return '';
  const v1 = validateMermaidCode(code);
  if (v1.valid) return code;
  const { fixed } = autoFixMermaid(code, v1);
  return validateMermaidCode(fixed).valid ? fixed : '';
}

export async function generateVisual(
  visual: VisualPlan,
  knowledge: KnowledgeExtraction,
  sourceText: string,
  title: string,
  complete: CompleteFn,
): Promise<GeneratedVisual> {
  const base: GeneratedVisual = {
    id: visual.id,
    title: visual.title,
    mermaid: '',
    caption: visual.rationale,
    sectionRef: visual.sectionRef,
  };

  // Deterministic, grounded diagrams — no model call, always valid.
  if (visual.diagramType === 'knowledge-graph') {
    return { ...base, mermaid: validateAndRepair(buildKnowledgeGraphMermaid(knowledge)) };
  }
  if (visual.diagramType === 'timeline') {
    return { ...base, mermaid: validateAndRepair(buildTimelineMermaid(knowledge, title)) };
  }
  if (visual.kind === 'table') {
    // Tables are emitted as markdown by the relevant section; no diagram here.
    return base;
  }

  // Model-generated structural diagram → validate → repair.
  try {
    const { system, user } = buildDiagramPrompt(visual, knowledge, sourceText);
    const raw = await complete(system, user);
    let code = extractCodeBlock(raw, 'mermaid');
    if (visual.direction) code = applyDirection(code, visual.direction);
    return { ...base, mermaid: validateAndRepair(code) };
  } catch {
    return base;
  }
}
