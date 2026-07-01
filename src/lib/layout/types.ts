import type { ExtractedImage, ExtractedTable } from '../capture/types';

export interface LayoutInput {
  markdown: string;
  title: string;
  images: ExtractedImage[];
  tables: ExtractedTable[];
  entities: Array<{ name: string; type: string }>;
  relationships: Array<{ source: string; target: string; relation: string }>;
  timeline: Array<{ year: string; event: string }>;
  concepts: Array<{ concept: string; definition: string }>;
  complexity: number;
  isPdf: boolean;
}

export interface LayoutResult {
  enrichedMarkdown: string;
}
