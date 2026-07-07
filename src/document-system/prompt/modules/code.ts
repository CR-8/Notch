/**
 * Prompt code module — code block rules
 */

export function buildCodePrompt(): string {
  return `## Code Blocks

Always use fenced code blocks with explicit language identifiers.

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

**Allowed language identifiers (use the full form):**
typescript, tsx, javascript, jsx, python, rust, go, ruby, java,
kotlin, swift, c, cpp, csharp, php, html, css, scss, sql,
json, yaml, toml, xml, markdown, bash, dockerfile, graphql, diff,
mermaid, plantuml, text

**Rules:**
- Every code block must have a language identifier — never use bare triple backticks
- Use full identifiers: \`\`\`javascript not js, \`\`\`typescript not ts, \`\`\`python not py, \`\`\`bash not sh/shell
- Code examples must be syntactically valid for the declared language
- Use 2-space indentation for JS/TS, 4-space for Python
- Maximum line length in code: 100 characters
- Use descriptive variable names — never foo, bar, baz
- Maximum 3 consecutive code blocks (intersperse with explanation)
- Code blocks longer than 40 lines should be preceded by a summary
- For non-code terminal output, use \`\`\`text`;
}
