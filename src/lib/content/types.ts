export type GenerationMode = 'FAST' | 'BALANCED' | 'DEEP';

export interface ContentResult {
  title: string;
  markdown: string;
  wordCount: number;
}

export type CompleteFn = (system: string, user: string) => Promise<string>;
