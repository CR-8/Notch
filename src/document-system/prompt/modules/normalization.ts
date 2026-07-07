/**
 * Prompt normalization module — cross-model consistency rules
 */

export function buildNormalizationPrompt(): string {
  return `## Model-Agnostic Rules

This prompt must produce identical output quality across all major AI models.
Follow these rules to ensure consistency:

1. **No model-specific syntax** — avoid XML tags, special tokens, or format that only certain models support
2. **No system role assumptions** — output as if the model has no system prompt knowledge
3. **Standard markdown only** — use the most widely supported markdown syntax
4. **Explicit formats** — always show the exact syntax inline rather than referring to it
5. **No numbered section references** — this model will not generate "Section 3.1" labels; headings are sufficient
6. **Mermaid consistency** — always use the same mermaid keywords (flowchart TD, sequenceDiagram) regardless of model
7. **Callout uniformity** — always use > [!KIND] format, never alternative callout syntax
8. **Language identifiers** — always use the long form (typescript, javascript) not aliases (ts, js)
9. **Paragraph length** — keep paragraphs between 3-5 sentences regardless of model verbosity bias
10. **No trailing commentary** — never add "I hope this was helpful" or similar model-specific artifacts`;
}
