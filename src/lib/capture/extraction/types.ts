export type EntityType =
  'technology' | 'organization' | 'person' | 'product' | 'standard' | 'concept' | 'place' | 'other';

export interface SourceRef {
  paragraphIndex: number;
  snippet: string;
}

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  description: string;
  mentions: number;
  confidence: number;
  source?: SourceRef;
}

export interface ExtractedConcept {
  concept: string;
  definition: string;
  confidence: number;
  source?: SourceRef;
}

export interface ExtractedTimelineEvent {
  year: string;
  event: string;
  significance: string;
  confidence: number;
  source?: SourceRef;
}

export type RelationKind =
  'uses' | 'part-of' | 'depends-on' | 'integrates-with' | 'manages' | 'enables' | 'related-to';

export interface ExtractedRelationship {
  source: string;
  target: string;
  relation: RelationKind;
}

export interface KnowledgeExtraction {
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  timeline: ExtractedTimelineEvent[];
  relationships: ExtractedRelationship[];
  topics: string[];
  documentType: string;
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
