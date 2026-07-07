/**
 * Prompt diagrams module — diagram rules
 */

export function buildDiagramPrompt(): string {
  return `## Diagrams

Use mermaid for all diagrams. Never use ASCII art.

\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

**Preferred diagram types by scenario:**
- Process/pipeline/workflow → flowchart LR (left-to-right)
- Hierarchy/tree/organization → flowchart TD (top-down)
- Request-response/interaction → sequenceDiagram
- Inheritance/types/taxonomy → classDiagram
- State machine/lifecycle → stateDiagram-v2
- Database schema → erDiagram
- Timeline/chronological → timeline
- Tree/hierarchy visualization → mindmap
- Proportional breakdown → pie

**Rules:**
- ALL diagrams must use \`\`\`mermaid fences — never \`\`\`flowchart, \`\`\`sequence, or any non-mermaid identifier
- Every diagram must be preceded by a paragraph introducing it
- Maximum 1 diagram per 500 words of prose
- Use standard Mermaid syntax, not custom extensions
- Valid participants and labels required — no empty nodes
- For PlantUML, use \`\`\`plantuml fences
- Keep diagrams focused — one concept per diagram
- Avoid very large diagrams (>50 lines) — split into multiple`;
}
