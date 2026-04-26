// The three supported models
export type GeminiModel =
  | 'gemini-3.1-flash-lite-preview'  
  | 'gemma-3-12b-it'             
  | 'gemma-3-4b-it'             
  | 'gemma-3-1b-it'             
  | 'gemma-3-27b-it';             

export interface ContentFrame {
  index: number;
  total: number;
}

export type GenerationMode = 'FAST' | 'DEEP' | 'BALANCED' | 'LOCAL';
export type LLMProvider = 'gemini' | 'ollama' | 'offline' | 'openai' | 'anthropic';

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

/**
 * Lightweight metadata record — used by the Library page.
 * Derived from Document; never contains content, keyEntities, timeline, concepts, or images.
 * Stored separately so the library never has to deserialise full documents.
 */
export interface DocumentMeta {
  id: string;
  title: string;
  url: string;
  domain: string;
  capturedAt: string;
  wordCount: number;
  summary: string;
  tags: string[];
  isStarred: boolean;
  isArchived: boolean;
  isRead: boolean;
  mode: GenerationMode;
  provider: LLMProvider;
}

/** Full document — only loaded by the Reader. */
export interface Document {
  id: string;
  title: string;
  url: string;
  domain: string;
  capturedAt: string;
  wordCount: number;
  mode: GenerationMode;
  provider: LLMProvider;
  content: string;
  summary: string;
  keyPoints?: string[];
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
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  paragraphIndex: number;
  embedding?: Float32Array;
  source?: 'document' | 'history';
}

export interface Settings {
  apiKeys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
  };
  provider?: LLMProvider;
  ollamaEndpoint: string;
  defaultMode: GenerationMode;
  ollamaModel: string;
}

export interface Citation {
  chunkIndex: number;
  paragraphIndex: number;
}

export interface ChatMessageRecord {
  id: string;
  documentId: string;
  role: 'user' | 'notch';
  text: string;
  citations?: Citation[];
  isError?: boolean;
  createdAt: string;
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
  | { type: 'IMPORT_PDF'; payload: { fileName: string; bytes: number[]; tags: string[] } }
  | { type: 'EXTRACT_DOM'; payload: Record<string, never> }
  | { type: 'DOM_PAYLOAD'; payload: DOMExtraction }
  | { type: 'CAPTURE_COMPLETE'; payload: { documentId: string } }
  | { type: 'CAPTURE_ERROR'; payload: { error: string } }
  | { type: 'RAG_QUERY'; payload: { documentId: string; query: string } }
  | { type: 'RAG_RESPONSE'; payload: { answer: string; citations: Citation[] } }
  | { type: 'RAG_ERROR'; payload: { error: string } }
  | { type: 'STORAGE_QUOTA_WARNING'; payload: { usedBytes: number; quotaBytes: number } };
