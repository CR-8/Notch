export interface GeneratedSection {
  id: string;
  title: string;
  markdown: string;
}

export interface GeneratedVisual {
  id: string;
  title: string;
  mermaid: string;
  caption: string;
  sectionRef: string;
  figureNumber?: number;
}

export interface GeneratedDocument {
  title: string;
  markdown: string;
  sections: GeneratedSection[];
  visuals: GeneratedVisual[];
  wordCount: number;
  diagramCount: number;
}

export type CompleteFn = (system: string, user: string) => Promise<string>;

export function extractCodeBlock(text: string, lang?: string): string {
  const fence = lang
    ? new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'i')
    : /```(?:[\w-]+)?\s*\n([\s\S]*?)```/;
  const m = text.match(fence);
  return (m ? m[1] : text).trim();
}
