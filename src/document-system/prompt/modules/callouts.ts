/**
 * Prompt callouts module — callout usage rules
 */

export function buildCalloutPrompt(): string {
  return `## Callout Blocks

Use GitHub Flavored Markdown callouts for emphasis and structure.

Supported types: NOTE, TIP, WARNING, DANGER, INFO, IMPORTANT, CAUTION, SUCCESS, QUESTION

Format:
> [!NOTE] Optional Title
> Content line 1.
> Content line 2.

**Type guidance:**
- [!NOTE] — Neutral supplementary information
- [!TIP] — Best practices, shortcuts, recommendations
- [!WARNING] — Potential issues, common mistakes
- [!DANGER] — Critical security or data-loss warnings
- [!INFO] — Additional context or background
- [!IMPORTANT] — Must-read information, key decisions
- [!CAUTION] — Potential negative consequences
- [!SUCCESS] — Positive outcomes, verification steps
- [!QUESTION] — Open questions or points for discussion

**Rules:**
- Callouts must be separated from surrounding content by blank lines
- Keep callout content to 1-4 short paragraphs
- Maximum 1 callout per 3 prose paragraphs
- Callouts must NOT contain code blocks, diagrams, headings, or nested callouts
- Use callout types exactly as listed (no custom types)
- Do not nest callouts inside callouts`;
}
