// ── Pipeline Integration ───────────────────────────────────────────────────────

import type { SemanticAnalysis, QualityEvaluation, DiagramElement, ImageElement, VisualPlan } from '../types';

// Parse structured analysis from AI-enriched markdown
export function parseAnalysisFromMarkdown(markdown: string): SemanticAnalysis | null {
  const match = markdown.match(/<!-- NOTCH-ANALYSIS -->\s*(\{[\s\S]*?\})\s*<!-- \/NOTCH-ANALYSIS -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as SemanticAnalysis;
  } catch {
    return null;
  }
}

// Parse diagram definitions from AI-enriched markdown
export function parseDiagramsFromMarkdown(
  markdown: string,
): { diagrams: DiagramElement[] } | null {
  const match = markdown.match(/<!-- NOTCH-DIAGRAMS -->\s*(\{[\s\S]*?\})\s*<!-- \/NOTCH-DIAGRAMS -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// Parse image definitions from AI-enriched markdown
export function parseImagesFromMarkdown(
  markdown: string,
): { images: ImageElement[] } | null {
  const match = markdown.match(/<!-- NOTCH-IMAGES -->\s*(\{[\s\S]*?\})\s*<!-- \/NOTCH-IMAGES -->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// Strip NOTCH markers from markdown for clean rendering
export function stripNotchMarkers(markdown: string): string {
  return markdown
    .replace(/<!-- NOTCH-ANALYSIS -->[\s\S]*?<!-- \/NOTCH-ANALYSIS -->\n*/g, '')
    .replace(/<!-- NOTCH-DIAGRAMS -->[\s\S]*?<!-- \/NOTCH-DIAGRAMS -->\n*/g, '')
    .replace(/<!-- NOTCH-IMAGES -->[\s\S]*?<!-- \/NOTCH-IMAGES -->\n*/g, '');
}

// Build a visual plan from analysis
export function buildVisualPlanFromAnalysis(analysis: SemanticAnalysis): VisualPlan {
  const diagrams: DiagramElement[] = [];

  // Generate diagrams based on analysis
  let diagramIdx = 0;

  for (const arch of analysis.architectures) {
    diagramIdx++;
    diagrams.push({
      type: 'diagram',
      kind: 'flowchart',
      label: `${arch} Architecture`,
      content: generateArchitectureDiagram(arch, analysis),
      caption: `Figure: ${arch} Architecture`,
      altText: `Architecture diagram of ${arch}`,
      placement: 0,
      id: `gen-diagram-${diagramIdx}`,
    });
  }

  for (const process of analysis.processes) {
    if (process.steps.length >= 3) {
      diagramIdx++;
      diagrams.push({
        type: 'diagram',
        kind: 'flowchart',
        label: `${process.name} Process`,
        content: generateProcessDiagram(process),
        caption: `Figure: ${process.name} Process Flow`,
        altText: `Process flow diagram for ${process.name}`,
        placement: 0,
        id: `gen-diagram-${diagramIdx}`,
      });
    }
  }

  if (analysis.timelines.length >= 3) {
    diagramIdx++;
    diagrams.push({
      type: 'diagram',
      kind: 'timeline',
      label: 'Timeline',
      content: generateTimelineDiagram(analysis.timelines),
      caption: 'Figure: Event Timeline',
      altText: 'Timeline of events',
      placement: 0,
      id: `gen-diagram-${diagramIdx}`,
    });
  }

  if (analysis.relationships.length >= 2) {
    diagramIdx++;
    diagrams.push({
      type: 'diagram',
      kind: 'erDiagram',
      label: 'Entity Relationships',
      content: generateRelationshipDiagram(analysis.relationships),
      caption: 'Figure: Entity Relationship Diagram',
      altText: 'Entity relationship diagram',
      placement: 0,
      id: `gen-diagram-${diagramIdx}`,
    });
  }

  return { diagrams, images: [], videos: [], callouts: [], richTables: [], references: [] };
}

function generateArchitectureDiagram(arch: string, analysis: SemanticAnalysis): string {
  const system = analysis.systems.find(s => arch.includes(s.name));
  const lines: string[] = ['flowchart TB'];

  if (system) {
    lines.push(`  subgraph ${system.name}`);
    for (let i = 0; i < system.components.length; i++) {
      const id = `comp${i}`;
      lines.push(`    ${id}[${system.components[i]}]`);
    }
    for (let i = 0; i < system.components.length - 1; i++) {
      lines.push(`    comp${i} --> comp${i + 1}`);
    }
    lines.push('  end');
  } else {
    lines.push('  System[System]');
    lines.push('  User[User] --> System');
  }

  return lines.join('\n');
}

function generateProcessDiagram(process: SemanticAnalysis['processes'][0]): string {
  const lines: string[] = ['flowchart LR'];

  for (let i = 0; i < process.steps.length; i++) {
    const id = `s${i}`;
    const label = process.steps[i];
    lines.push(`  ${id}[${label}]`);

    if (i < process.steps.length - 1) {
      let nextId = `s${i + 1}`;
      // Check for decision points between steps
      const dp = process.decisionPoints.find(d => d.includes(process.steps[i]));
      if (dp) {
        const dpId = `dp${i}`;
        lines.push(`  ${dpId}{${dp}}`);
        lines.push(`  ${id} --> ${dpId}`);
        lines.push(`  ${dpId} --> ${nextId}`);
      } else {
        lines.push(`  ${id} --> ${nextId}`);
      }
    }
  }

  return lines.join('\n');
}

function generateTimelineDiagram(timelines: string[]): string {
  const lines: string[] = ['timeline'];
  lines.push('    title Timeline');

  for (const tl of timelines.slice(0, 10)) {
    const parts = tl.split(':');
    if (parts.length >= 2) {
      lines.push(`    ${parts[0].trim()} : ${parts.slice(1).join(':').trim()}`);
    } else {
      lines.push(`    : ${tl}`);
    }
  }

  return lines.join('\n');
}

function generateRelationshipDiagram(relationships: SemanticAnalysis['relationships']): string {
  const lines: string[] = ['erDiagram'];
  const seen = new Set<string>();

  for (const rel of relationships) {
    const key = `${rel.source}-${rel.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  ${rel.source} ||--o{ ${rel.target} : "${rel.type}"`);
  }

  return lines.join('\n');
}

// Build the enrichment prompt for the AI
export function buildEnrichmentPrompt(content: string, mode: 'FAST' | 'BALANCED' | 'DEEP'): string {
  const modeInstructions: Record<string, string> = {
    FAST: 'Brief analysis - identify key topics, entities, and 1-2 visual opportunities.',
    BALANCED: 'Moderate analysis - extract full semantic structure, identify all visual opportunities, suggest diagram types.',
    DEEP: 'Thorough analysis - complete semantic extraction, quality evaluation, visual planning with diagram generation, and full enrichment.',
  };

  return `You are the NOTCH Content Intelligence Engine. Analyze and enrich the following content.

MODE: ${mode}
${modeInstructions[mode]}

OUTPUT FORMAT:
Provide:
1. <!-- NOTCH-ANALYSIS --> block with JSON analysis
2. <!-- NOTCH-DIAGRAMS --> block with diagram suggestions (if any)
3. Then the enriched markdown content

CONTENT:
${content}`;
}
