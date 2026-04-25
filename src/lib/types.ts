// The three supported Gemini-family models
export type GeminiModel =
  | 'gemini-3.1-flash-lite-preview'  // FAST — highest free RPD (500/day)
  | 'gemma-3-27b-it'                 // DEEP — best quality open model
  | 'gemma-3-12b-it';                // BALANCED — good quality, higher free quota

export type GenerationMode = 'FAST' | 'DEEP' | 'BALANCED';

// Keep LLMProvider for document metadata (which model was used)
export type LLMProvider = 'gemini' | 'ollama';

export interface Entity {
  name: string;
  type: string;
  paragraphIndex: number;
}

export interface TimelineEvent {
  date: string;
  description: string;
  paragraphIndex: number;
}

export interface Concept {
  term: string;
  definition: string;
  paragraphIndex: number;
}

export interface ImageRef {
  url: string;
  alt: string;
  sectionIndex: number;
  paragraphContext: string;
}

export interface Document {
  id: string;                      // UUID v4
  title: string;
  url: string;
  domain: string;
  capturedAt: string;              // ISO 8601
  wordCount: number;
  mode: GenerationMode;
  provider: LLMProvider;
  content: string;
  summary: string;
  keyEntities: Entity[];
  timeline: TimelineEvent[];
  concepts: Concept[];
  tags: string[];
  images: ImageRef[];
  isStarred: boolean;
  isArchived: boolean;
  isRead: boolean;
  embeddingsGenerated: boolean;
  missingImageQueries: string[];
}

export interface DocumentChunk {
  id: string;                      // `${documentId}_${chunkIndex}`
  documentId: string;
  chunkIndex: number;
  text: string;
  paragraphIndex: number;
  embedding: Float32Array;
}

export interface Settings {
  apiKeys: {
    gemini?: string;
  };
  ollamaEndpoint: string;
  defaultMode: GenerationMode;
  ollamaModel: string;
}

export interface Citation {
  chunkIndex: number;
  paragraphIndex: number;
}

export interface DOMExtraction {
  title: string;
  url: string;
  domain: string;
  textContent: string;
  structuredHTML: string;
  images: Array<{
    url: string;
    alt: string;
    paragraphContext: string;
  }>;
  wordCount: number;
  metaDescription: string;
}

export type NotchMessage =
  | { type: 'CAPTURE_PAGE'; payload: { tabId: number; mode: GenerationMode; tags: string[] } }
  | { type: 'EXTRACT_DOM'; payload: Record<string, never> }
  | { type: 'DOM_PAYLOAD'; payload: DOMExtraction }
  | { type: 'CAPTURE_COMPLETE'; payload: { documentId: string } }
  | { type: 'CAPTURE_ERROR'; payload: { error: string } }
  | { type: 'RAG_QUERY'; payload: { documentId: string; query: string } }
  | { type: 'RAG_RESPONSE'; payload: { answer: string; citations: Citation[] } }
  | { type: 'RAG_ERROR'; payload: { error: string } }
  | { type: 'STORAGE_QUOTA_WARNING'; payload: { usedBytes: number; quotaBytes: number } };
