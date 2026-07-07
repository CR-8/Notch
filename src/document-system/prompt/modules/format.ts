/**
 * Prompt format module — document format rules
 */

export function buildFormatPrompt(): string {
  return `## Output Format

Always generate valid markdown with no extra formatting.

**Required syntax:**
- Use \`\`\`language code blocks with explicit language identifiers
- Use > [!KIND] callout blocks for emphasis boxes
- Use GFM pipe tables (|--|) with header row and alignment row
- Use \`\`\`mermaid for diagrams — never ASCII art
- Use $$ for block equations, $ for inline math (rare)
- Use ATX headings (##, ###). Never use Setext headings (underlined)

**Forbidden:**
- No HTML tags (use only markdown)
- No inline styles, divs, or span elements
- No raw JSON blocks
- No YAML frontmatter
- No numbered list prefixes like "(1)" — use markdown ordered lists
- No emoji unless essential to meaning
- No section numbers in heading text (system adds them)
- No bold/italic for headings`;
}
