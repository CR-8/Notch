// ── Content Enrichment Pipeline ───────────────────────────────────────────────

import type {
  SemanticAnalysis,
  QualityEvaluation,
  VisualOpportunity,
  DiagramElement,
  ImageElement,
  VisualPlan,
  EnrichedBlock,
  ContentHierarchy,
  EnrichedDocument,
  DiagramKind,
} from './types';
import { parseToEnrichedAST, buildHierarchy, applyNumberingToBlocks } from './ast';
import { planVisuals, generateDiagramContent } from './visual-planner';
import { parseAnalysisFromMarkdown, parseDiagramsFromMarkdown, parseImagesFromMarkdown } from './pipeline/index';

export interface EnrichmentResult {
  enriched: EnrichedDocument;
  visualPlan: VisualPlan;
  warnings: string[];
}

export function enrichContent(
  originalMarkdown: string,
  analysis?: SemanticAnalysis,
  evaluation?: QualityEvaluation,
  visualSuggestions?: VisualOpportunity[],
): EnrichmentResult {
  const warnings: string[] = [];

  // Step 1: Parse to AST
  const { blocks, hierarchy } = parseToEnrichedAST(originalMarkdown);
  warnings.push(...[]);

  // Step 2: Apply numbering
  const numberedBlocks = applyNumberingToBlocks(blocks, hierarchy);

  // Step 3: Build semantic analysis if not provided
  const semanticAnalysis: SemanticAnalysis = analysis ?? extractBasicSemantics(originalMarkdown);

  // Step 4: Generate visual suggestions
  const rawSuggestions = planVisuals(semanticAnalysis, originalMarkdown);
  const suggestions: VisualOpportunity[] = visualSuggestions ?? rawSuggestions.map(s => ({
    type: s.type as 'diagram' | 'image' | 'chart' | 'table',
    reason: s.reason,
    sectionIndex: s.sectionIndex,
    context: s.reason,
    recommendedKind: s.kind as any,
    label: s.label,
  }));

  // Step 5: Build visual plan from suggestions
  const visualPlan = buildVisualPlan(suggestions, semanticAnalysis);

  // Step 6: Insert diagram markers into blocks
  const enrichedBlocks = insertVisualElements(numberedBlocks, visualPlan);

  // Step 7: Rebuild hierarchy
  const enrichedHierarchy = buildHierarchy(enrichedBlocks);

  const enriched: EnrichedDocument = {
    original: originalMarkdown,
    blocks: enrichedBlocks,
    hierarchy: enrichedHierarchy,
    semanticAnalysis,
    qualityEvaluation: evaluation ?? {
      score: 50,
      issues: [],
      visualOpportunities: suggestions as VisualOpportunity[],
      educationGaps: [],
      completenessScore: 50,
      readabilityScore: 50,
      structuralScore: 50,
      visualScore: 30,
    } as QualityEvaluation,
  };

  return { enriched, visualPlan, warnings };
}

function extractBasicSemantics(content: string): SemanticAnalysis {
  const topics: SemanticAnalysis['topics'] = [];
  const concepts: string[] = [];
  const entities: string[] = [];
  const relationships: SemanticAnalysis['relationships'] = [];
  const systems: SemanticAnalysis['systems'] = [];
  const processes: SemanticAnalysis['processes'] = [];
  const architectures: string[] = [];
  const timelines: string[] = [];
  const dependencies: string[] = [];

  // Extract headings as topics
  const headingRegex = /^#{2,4}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  let sectionIndex = 0;
  while ((match = headingRegex.exec(content)) !== null) {
    topics.push({
      name: match[1].trim(),
      importance: 5,
      sections: [sectionIndex++],
    });
  }

  // Detect architecture language
  if (/\b(architecture|system design|infrastructure|deployment|topology)\b/i.test(content)) {
    architectures.push('System Architecture');
  }

  // Detect timeline events
  const timelineRegex = /^\s*[-*]\s+\*\*(\d{4}[\d\/\-]*)\*\*:?\s+(.+)$/gm;
  while ((match = timelineRegex.exec(content)) !== null) {
    timelines.push(`${match[1]}: ${match[2].trim()}`);
  }

  // Detect dependencies
  const depRegex = /\b(depends on|requires|prerequisite|dependency|built on|runs on)\b.*$/gim;
  let depMatch: RegExpExecArray | null;
  while ((depMatch = depRegex.exec(content)) !== null) {
    dependencies.push(depMatch[0].trim());
  }

  return {
    topics,
    concepts,
    entities,
    relationships,
    systems,
    processes,
    architectures,
    timelines,
    dependencies,
  };
}

function buildVisualPlan(
  suggestions: VisualOpportunity[],
  analysis: SemanticAnalysis,
): VisualPlan {
  const diagrams: DiagramElement[] = [];
  const images: ImageElement[] = [];
  const callouts: any[] = [];
  const richTables: any[] = [];
  const references: any[] = [];
  const videos: any[] = [];

  let diagramIndex = 0;

  for (const suggestion of suggestions) {
    if (suggestion.type === 'diagram') {
      diagramIndex++;
      const content = generateDiagramContent(
        {
          type: 'diagram' as const,
          kind: suggestion.recommendedKind as string,
          reason: suggestion.reason,
          sectionIndex: suggestion.sectionIndex,
          label: suggestion.label,
          confidence: 0.8,
        },
        analysis,
      );
      diagrams.push({
        type: 'diagram',
        kind: suggestion.recommendedKind as DiagramKind,
        label: suggestion.label,
        content,
        caption: `Figure: ${suggestion.label}`,
        altText: `Diagram showing ${suggestion.label}`,
        placement: suggestion.sectionIndex,
        id: `auto-diagram-${diagramIndex}`,
      });
    }
  }

  return { diagrams, images, videos, callouts, richTables, references };
}

function insertVisualElements(
  blocks: EnrichedBlock[],
  plan: VisualPlan,
): EnrichedBlock[] {
  const result: EnrichedBlock[] = [...blocks];

  // Insert diagrams after their target sections
  for (const diagram of plan.diagrams) {
    if (diagram.placement >= 0 && diagram.placement < result.length) {
      result.splice(diagram.placement + 1, 0, {
        type: 'diagram',
        raw: `\`\`\`mermaid\n${diagram.content}\n\`\`\``,
        id: diagram.id,
        data: diagram,
      });
    }
  }

  return result;
}

export function mergeEnrichmentData(
  markdown: string,
  analysisJson?: string,
  diagramsJson?: string,
  imagesJson?: string,
): string {
  let result = markdown;

  if (analysisJson) {
    result = `<!-- NOTCH-ANALYSIS -->\n${analysisJson}\n<!-- /NOTCH-ANALYSIS -->\n\n${result}`;
  }

  if (diagramsJson) {
    try {
      const parsed = JSON.parse(diagramsJson);
      if (parsed.diagrams) {
        let diagramSection = '\n\n## Diagrams\n\n';
        for (const d of parsed.diagrams) {
          diagramSection += `\`\`\`mermaid\n${d.content}\n\`\`\`\n\n`;
        }
        result += diagramSection;
      }
    } catch {}
  }

  return result;
}
