// ── Content Intelligence and Publishing Engine — Barrel ───────────────────────

// V2 Content Intelligence Engine
export * from './v2/index';

export * from './types';
export { parseToEnrichedAST, buildHierarchy, applyNumberingToBlocks, serializeEnrichedDocument } from './ast';
export { buildTOC, renderTOCText, generateTOCMarkdown } from './hierarchy';
export type { TOCItem } from './hierarchy';
export { enrichContent, mergeEnrichmentData } from './enrich';
export type { EnrichmentResult } from './enrich';
export { planVisuals, generateDiagramContent } from './visual-planner';
export type { VisualSuggestion } from './visual-planner';

export * from './mermaid/index';
export * from './uml/index';
export * from './components/index';
export * from './export/index';

// Pipeline utilities
export {
  parseAnalysisFromMarkdown,
  parseDiagramsFromMarkdown,
  parseImagesFromMarkdown,
  stripNotchMarkers,
  buildVisualPlanFromAnalysis,
  buildEnrichmentPrompt,
} from './pipeline/index';

// Prompts
export {
  CONTENT_ANALYSIS_PROMPT,
  QUALITY_EVALUATION_PROMPT,
  VISUAL_DIAGRAM_PROMPT,
  IMAGE_GENERATION_PROMPT,
  ENRICHMENT_SYSTEM_PROMPT,
  ENRICHMENT_USER_PROMPT,
} from './prompts';
