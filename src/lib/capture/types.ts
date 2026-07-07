import type {
  ExtractedEntity,
  ExtractedConcept,
  ExtractedTimelineEvent,
  ExtractedRelationship,
} from './extraction/types';

export type DocumentClass =
  | 'research-paper'
  | 'tutorial'
  | 'reference'
  | 'documentation'
  | 'analysis'
  | 'news'
  | 'blog-post'
  | 'general';

export interface CaptureMetadata {
  title: string;
  url: string;
  domain: string;
  wordCount: number;
  capturedAt: string;
  metaDescription: string;
  isPdf: boolean;
}

export interface ExtractedImage {
  url: string;
  alt: string;
  paragraphContext: string;
  /** PDF-specific: page number, caption, figure index */
  pdfPage?: number;
  pdfCaption?: string;
  pdfFigureIndex?: number;
}

export interface ExtractedVideo {
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface ExtractedTable {
  /** For PDF tables: extracted cell data */
  headers: string[];
  rows: string[][];
  caption?: string;
  pageNumber?: number;
}

export interface CaptureResult {
  rawContent: string;
  cleanedHtml: string;
  images: ExtractedImage[];
  videos: ExtractedVideo[];
  tables: ExtractedTable[];
  metadata: CaptureMetadata;
  documentClass: DocumentClass;
  classificationConfidence: number;
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  timeline: ExtractedTimelineEvent[];
  relationships: ExtractedRelationship[];
  topics: string[];
  complexity: number;
}
