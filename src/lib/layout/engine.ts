import type { LayoutInput, LayoutResult } from './types';
import { injectMediaIntoContent } from './image-placer';
import { detectAndGenerateTables } from './table-generator';
import { detectAndGenerateDiagrams } from './diagram-generator';
import { detectAndInsertCallouts } from './callout-placer';
import { buildKnowledgeGraph } from './knowledge-graph';
import { log } from '../logger';

export function runLayoutEngine(input: LayoutInput): LayoutResult {
  let md = input.markdown;

  md = injectMediaIntoContent(md, input.images);

  md = detectAndGenerateTables(md, input);

  md = detectAndGenerateDiagrams(md, input);

  if (input.entities.length > 3 && input.relationships.length > 0) {
    md = buildKnowledgeGraph(md, input);
  }

  md = detectAndInsertCallouts(md, input);

  log.info(
    'layout',
    `Enriched: ${(md.match(/```mermaid/g) ?? []).length} diagrams, ${(md.match(/\[!(NOTE|TIP|WARNING|INFO)\]/g) ?? []).length} callouts`,
  );

  return { enrichedMarkdown: md };
}
