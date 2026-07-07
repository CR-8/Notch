/**
 * Prompt style module — editorial style rules
 */

export function buildStylePrompt(): string {
  return `## Writing Style

**Tone:**
- Third person, objective, formal but not academic
- Active voice preferred. Max sentence length: 40 words
- Define acronyms on first use in each major section
- Use "use" not "utilize". Use "build" not "implement" unless specific
- Delete any word that does not add meaning

**Content:**
- Every paragraph must introduce new knowledge. No filler sentences
- Use specific numbers: "17%" not "a significant portion"
- No rhetorical questions without answers
- No "In today's digital landscape", "Let's dive in", "It's important to note"
- Use Oxford comma in lists of three or more

**Typography:**
- Bold (**) for first mention of key terms only
- Italic (*) for Latin terms (et al., in situ) and publication titles
- Inline code (\`) for function names, variables, file paths, CLI commands
- Spell out 0-9, use numerals for 10+
- Use numerals for: versions (v2.0), percentages (17%), measurements (5ms)
- Heading text must be sentence case
- Headings must not end with punctuation or contain backticks`;
}
