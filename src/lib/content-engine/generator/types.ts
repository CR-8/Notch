// ── Structured generation — shared types ─────────────────────────────────────
// Stages pass typed objects, never markdown blobs. Markdown is assembled only at
// the very end by the orchestrator.

export interface GeneratedSection {
  id: string;
  title: string;
  /** Body markdown WITHOUT the `## Heading` line — the orchestrator adds it. */
  markdown: string;
}

export interface GeneratedVisual {
  id: string;
  title: string;
  /** Validated Mermaid code (no fences). Empty if generation/validation failed. */
  mermaid: string;
  caption: string;
  sectionRef: string;
  /** Assigned during assembly: "Figure 1", "Figure 2", … */
  figureNumber?: number;
}

export interface GeneratedDocument {
  title: string;
  /** Fully assembled markdown ready to persist/render. */
  markdown: string;
  sections: GeneratedSection[];
  visuals: GeneratedVisual[];
  wordCount: number;
  diagramCount: number;
}

/**
 * Single-completion function injected into generators. Returns the full text of one
 * model response. Decouples generators from the provider layer (and makes them
 * unit-testable with a fake in tests — never a production mock).
 */
export type CompleteFn = (system: string, user: string) => Promise<string>;

/** Strips a fenced code block, returning its inner code (or the input trimmed). */
export function extractCodeBlock(text: string, lang?: string): string {
  const fence = lang
    ? new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)```', 'i')
    : /```(?:[\w-]+)?\s*\n([\s\S]*?)```/;
  const m = text.match(fence);
  return (m ? m[1] : text).trim();
}
