// ── Knowledge Extraction — structured schemas ────────────────────────────────
// Stage outputs for the redesigned pipeline. Every extractor returns typed objects
// (never a markdown blob), so downstream planners/renderers consume structure.

export type EntityType =
  | 'technology'
  | 'organization'
  | 'person'
  | 'product'
  | 'standard'
  | 'concept'
  | 'place'
  | 'other';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  description: string;
  /** Occurrence count in the source — used for importance ranking. */
  mentions: number;
}

export interface ExtractedConcept {
  concept: string;
  definition: string;
}

export interface ExtractedTimelineEvent {
  /** Year or ISO-ish date string, e.g. "2013" or "2014-06". */
  year: string;
  event: string;
  significance: string;
}

export type RelationKind =
  | 'uses'
  | 'part-of'
  | 'depends-on'
  | 'integrates-with'
  | 'manages'
  | 'enables'
  | 'related-to';

export interface ExtractedRelationship {
  source: string;
  target: string;
  relation: RelationKind;
}

/** Aggregated output of the extraction stage. */
export interface KnowledgeExtraction {
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  timeline: ExtractedTimelineEvent[];
  relationships: ExtractedRelationship[];
  topics: string[];
  /** "tutorial" | "reference" | "news" | "analysis" | "documentation" | "general". */
  documentType: string;
  /** 0–100 readability/technical-density heuristic. */
  complexity: number;
}

export function emptyExtraction(): KnowledgeExtraction {
  return {
    entities: [],
    concepts: [],
    timeline: [],
    relationships: [],
    topics: [],
    documentType: 'general',
    complexity: 0,
  };
}
