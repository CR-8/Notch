// ─── Supported Providers ──────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai-compatible' | 'offline';
export type GenerationMode = 'FAST' | 'DEEP' | 'BALANCED' | 'LOCAL';
export type ViewMode = 'compact' | 'comfortable' | 'detailed';

// ─── Model Definitions ────────────────────────────────────────────────────────

export interface ContentFrame {
  index: number;
  total: number;
}

export interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
}

export const SUPPORTED_MODELS: AIModel[] = [
  // Claude family
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000 },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', contextWindow: 200000 },
  // OpenRouter / OpenCode compatible models
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', contextWindow: 128000 },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)', contextWindow: 200000 },
  { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (OpenRouter)', contextWindow: 1000000 },
  { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3 (OpenRouter)', contextWindow: 64000 },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (OpenRouter)', contextWindow: 32000 },
  // MiniMax models
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', contextWindow: 1000000 },
  { id: 'MiniMax-M2', name: 'MiniMax M2', contextWindow: 1000000 },
  // Local / custom
  { id: 'local/custom', name: 'Custom Endpoint', contextWindow: 0 },
];

// ─── Simple Types ──────────────────────────────────────────────────────────────

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

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface DocumentMeta {
  id: string;
  title: string;
  url: string;
  domain: string;
  capturedAt: string;
  wordCount: number;
  summary: string;
  tags: string[];
  folder?: string;
  isStarred: boolean;
  isArchived: boolean;
  isRead: boolean;
  mode: GenerationMode;
  provider: LLMProvider;
}

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
  folder?: string;
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
  source?: 'document' | 'history';
}

export interface TagColorMap {
  [tag: string]: string;
}

export interface Settings {
  apiKey: string;
  provider: LLMProvider;
  baseUrl: string;
  modelId: string;
  defaultMode: GenerationMode;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  fontFamily: 'mono' | 'serif' | 'sans';
  fontSize: 'sm' | 'md' | 'lg';
  accentColor: string;
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

export interface DocumentHighlight {
  id: string;
  documentId: string;
  text: string;
  paragraphIndex: number;
  paragraphId?: string;
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

// ─── Message Types ─────────────────────────────────────────────────────────────

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