// ── Intelligent Visual Planning Engine ────────────────────────────────────────

import type {
  SemanticAnalysis,
  VisualOpportunity,
  DiagramElement,
  ImageElement,
  VisualPlan,
  DiagramKind,
  ImageKind,
} from './types';

export interface VisualSuggestion {
  type: 'diagram' | 'image' | 'table';
  kind: string;
  reason: string;
  sectionIndex: number;
  label: string;
  confidence: number;
}

// Analyze semantic content and suggest visual elements
export function planVisuals(
  analysis: SemanticAnalysis,
  content: string,
): VisualSuggestion[] {
  const suggestions: VisualSuggestion[] = [];

  // ── Architecture Detection ───────────────────────────────────────────────
  for (const arch of analysis.architectures) {
    const sectionIndex = findSectionIndex(content, arch);
    suggestions.push({
      type: 'diagram',
      kind: 'architecture',
      reason: `Architecture description "${arch}" benefits from visual representation`,
      sectionIndex,
      label: `${arch} Architecture`,
      confidence: 0.9,
    });
  }

  // ── System Detection ─────────────────────────────────────────────────────
  for (const system of analysis.systems) {
    if (system.components.length >= 2) {
      const sectionIndex = findSectionIndex(content, system.name);
      suggestions.push({
        type: 'diagram',
        kind: 'flowchart',
        reason: `System "${system.name}" has ${system.components.length} components`,
        sectionIndex,
        label: `${system.name} System Architecture`,
        confidence: 0.85,
      });
    }
  }

  // ── Process Detection ────────────────────────────────────────────────────
  for (const process of analysis.processes) {
    if (process.steps.length >= 3) {
      const sectionIndex = findSectionIndex(content, process.name);
      suggestions.push({
        type: 'diagram',
        kind: 'flowchart',
        reason: `Process "${process.name}" has ${process.steps.length} steps`,
        sectionIndex,
        label: `${process.name} Workflow`,
        confidence: 0.9,
      });
    }
  }

  // ── Relationship Detection ───────────────────────────────────────────────
  if (analysis.relationships.length >= 2) {
    suggestions.push({
      type: 'diagram',
      kind: 'erDiagram',
      reason: `${analysis.relationships.length} relationships detected between entities`,
      sectionIndex: 0,
      label: 'Entity Relationships',
      confidence: 0.75,
    });
  }

  // ── Timeline Detection ───────────────────────────────────────────────────
  if (analysis.timelines.length >= 3) {
    suggestions.push({
      type: 'diagram',
      kind: 'timeline',
      reason: `${analysis.timelines.length} timeline events detected`,
      sectionIndex: 0,
      label: 'Timeline',
      confidence: 0.8,
    });
  }

  // ── Topic / Concept mindmaps ─────────────────────────────────────────────
  if (analysis.topics.length >= 4) {
    suggestions.push({
      type: 'diagram',
      kind: 'mindmap',
      reason: `${analysis.topics.length} topics suggest a knowledge map`,
      sectionIndex: 0,
      label: 'Knowledge Map',
      confidence: 0.7,
    });
  }

  // ── Dependency Detection ─────────────────────────────────────────────────
  if (analysis.dependencies.length >= 2) {
    suggestions.push({
      type: 'diagram',
      kind: 'flowchart',
      reason: `${analysis.dependencies.length} dependencies form a dependency graph`,
      sectionIndex: 0,
      label: 'Dependency Graph',
      confidence: 0.7,
    });
  }

  // ── Comparison / Feature tables ─────────────────────────────────────────
  // Look for comparison language
  const comparisonPatterns = [
    /\b(compare|comparison|versus|vs\.?|alternative|option|approach)\b/i,
    /\b(pros?|cons?|advantages?|disadvantages?|benefits?|drawbacks?)\b/i,
    /\b(feature|capability|supported|unsupported)\b/i,
  ];

  const paragraphs = content.split(/\n\s*\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const matchCount = comparisonPatterns.filter(p => p.test(para)).length;
    if (matchCount >= 2) {
      suggestions.push({
        type: 'table',
        kind: 'comparison_table',
        reason: 'Comparison language detected',
        sectionIndex: i,
        label: 'Feature Comparison',
        confidence: 0.6,
      });
    }
  }

  return suggestions;
}

// Generate diagram content from semantic analysis
export function generateDiagramContent(
  suggestion: VisualSuggestion,
  analysis: SemanticAnalysis,
): string {
  switch (suggestion.kind) {
    case 'flowchart':
      return generateFlowchart(suggestion, analysis);
    case 'sequenceDiagram':
      return generateSequenceDiagram(suggestion, analysis);
    case 'classDiagram':
      return generateClassDiagram(suggestion, analysis);
    case 'erDiagram':
      return generateERDiagram(suggestion, analysis);
    case 'mindmap':
      return generateMindmap(suggestion, analysis);
    case 'timeline':
      return generateTimeline(suggestion, analysis);
    default:
      return '';
  }
}

function generateFlowchart(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const system = analysis.systems.find(s => s.name === suggestion.label.replace(' System Architecture', ''));
  const process = analysis.processes.find(p => p.name === suggestion.label.replace(' Workflow', ''));

  const lines: string[] = ['flowchart TB'];

  if (system) {
    for (let i = 0; i < system.components.length; i++) {
      const name = system.components[i].replace(/[^a-zA-Z0-9]/g, '');
      const label = system.components[i];
      lines.push(`  ${name}[${label}]`);
    }
    for (let i = 0; i < system.components.length - 1; i++) {
      const a = system.components[i].replace(/[^a-zA-Z0-9]/g, '');
      const b = system.components[i + 1].replace(/[^a-zA-Z0-9]/g, '');
      lines.push(`  ${a} --> ${b}`);
    }
  } else if (process) {
    for (let i = 0; i < process.steps.length; i++) {
      const name = `step${i}`;
      const label = process.steps[i];
      lines.push(`  ${name}[${label}]`);
      if (i > 0) {
        const prev = `step${i - 1}`;
        lines.push(`  ${prev} --> ${name}`);
      }
    }
    if (process.decisionPoints.length > 0) {
      for (const dp of process.decisionPoints) {
        lines.push(`  decision{${dp}}`);
      }
    }
  }

  return lines.join('\n');
}

function generateSequenceDiagram(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const process = analysis.processes.find(p => p.name === suggestion.label);
  const lines: string[] = ['sequenceDiagram'];

  if (process) {
    const actors = process.actors.length > 0
      ? process.actors
      : ['Client', 'Server', 'Database'];

    for (const actor of actors) {
      const id = actor.replace(/[^a-zA-Z]/g, '');
      lines.push(`  participant ${id} as ${actor}`);
    }

    for (let i = 0; i < process.steps.length; i++) {
      const from = actors[i % actors.length].replace(/[^a-zA-Z]/g, '');
      const to = actors[(i + 1) % actors.length].replace(/[^a-zA-Z]/g, '');
      lines.push(`  ${from}->>${to}: ${process.steps[i]}`);
    }
  }

  return lines.join('\n');
}

function generateClassDiagram(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const system = analysis.systems.find(s => s.name === suggestion.label);
  const lines: string[] = ['classDiagram'];

  if (system) {
    for (const comp of system.components) {
      const id = comp.replace(/[^a-zA-Z]/g, '');
      lines.push(`  class ${id} {`);
      lines.push(`    +operation()`);
      lines.push(`  }`);
    }
    for (let i = 0; i < system.components.length - 1; i++) {
      const a = system.components[i].replace(/[^a-zA-Z]/g, '');
      const b = system.components[i + 1].replace(/[^a-zA-Z]/g, '');
      lines.push(`  ${a} --> ${b}`);
    }
  }

  return lines.join('\n');
}

function generateERDiagram(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const lines: string[] = ['erDiagram'];

  for (const rel of analysis.relationships) {
    const source = rel.source.replace(/[^a-zA-Z]/g, '');
    const target = rel.target.replace(/[^a-zA-Z]/g, '');
    lines.push(`  ${source} ||--o{ ${target} : "${rel.type}"`);
  }

  return lines.join('\n');
}

function generateMindmap(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const lines: string[] = ['mindmap'];
  lines.push(`  root((${analysis.topics[0]?.name || 'Overview'}))`);

  for (const topic of analysis.topics.slice(0, 8)) {
    const safeName = topic.name.replace(/[()]/g, '');
    lines.push(`    ${safeName}`);
  }

  return lines.join('\n');
}

function generateTimeline(suggestion: VisualSuggestion, analysis: SemanticAnalysis): string {
  const lines: string[] = ['timeline'];
  lines.push('    title Timeline');

  for (const tl of analysis.timelines.slice(0, 10)) {
    const parts = tl.split(':');
    if (parts.length >= 2) {
      lines.push(`    ${parts[0].trim()} : ${parts.slice(1).join(':').trim()}`);
    } else {
      lines.push(`    : ${tl}`);
    }
  }

  return lines.join('\n');
}

function findSectionIndex(content: string, term: string): number {
  const sections = content.split(/\n##\s+/);
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].toLowerCase().includes(term.toLowerCase())) {
      return i;
    }
  }
  return 0;
}
