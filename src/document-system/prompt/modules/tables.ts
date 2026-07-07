/**
 * Prompt tables module — table rules
 */

export function buildTablePrompt(): string {
  return `## Tables

Use GFM (GitHub Flavored Markdown) pipe tables.

| Header 1 | Header 2 | Header 3 |
|----------|:--------:|---------:|
| Left     | Center   |    Right |
| Cell     | Cell     |      Cell |

**Rules:**
- Always include a header row with alignment row (---, :---, :--:, ---:)
- Every table must be introduced by a prose sentence
- Maximum 8 columns per table. Minimum 2 rows (header + 1 data)
- Prefer tables for: comparisons, API params, configuration options, metrics
- Add a blank line before and after the table
- Do not use multi-line cell content
- Do not put images or lists inside table cells`;
}
