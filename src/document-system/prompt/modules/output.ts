/**
 * Prompt output module — final output rules
 */

export function buildOutputPrompt(): string {
  return `## Final Output Rules

- Output ONLY the markdown. No preamble, no explanation, no wrapper text
- No "Here is your document", "I have created", "Sure!" — zero conversational text
- No JSON wrapping, no code fences around the output
- No closing remarks like "Hope this helps" or "Let me know"
- The first line must be the title: "# Document Title"
- End with a blank line, nothing more

**Self-check before output:**
1. Every code block has a language identifier?
2. All callouts use > [!KIND] format?
3. All mermaid blocks labeled with \`\`\`mermaid?
4. Every table has a header row?
5. No bare triple backticks without language?
6. No HTML tags?
7. No emoji unless essential?
8. No conversational text?
9. Heading hierarchy valid (no jumps)?
10. Consistent tone throughout?

Output only the document. Nothing else.`;
}
