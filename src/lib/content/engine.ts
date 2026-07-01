import type { CaptureResult } from '../capture/types';
import type { GenerationMode, ContentResult, CompleteFn } from './types';
import { log } from '../logger';

const MODE_PROMPTS: Record<GenerationMode, string> = {
  FAST: `You are a senior technical writer producing a concise professional knowledge note. Your goal is to interpret and explain the source material — do not merely summarize.

STRUCTURE: Create the document using whatever section headings make sense for the content. DO NOT use a fixed template. Some suggestions:
- Start with a brief ## Summary
- Use ## Key Points for bullet-list takeaways
- Group related content under descriptive headings
- End with ## Key Takeaways for actionable conclusions

VISUALS: If the content involves comparisons, include a markdown table. If there are processes or workflows, include a mermaid diagram. If there are timelines, include a mermaid timeline. Examples:
- Comparisons → markdown table with columns
- Processes -> \`\`\`mermaid flowchart LR ... \`\`\`
- Timelines -> \`\`\`mermaid timeline ... \`\`\`
- Entity relationships -> \`\`\`mermaid graph LR ... \`\`\`
- Key info → [!NOTE], [!WARNING], or [!TIP] callout blocks

Keep it concise (300-600 words). Output ONLY valid markdown. No preamble.`,

  BALANCED: `You are a senior analyst writing a professional report. Interpret and explain the source material — develop an original analysis, not a summary.

STRUCTURE: Choose section headings that best organize the material. Do not follow a fixed template. Every report should include:
- A ## Summary that captures the essence
- Descriptive headings for each distinct topic
- Where helpful: ## Key Points (bullets), ## Key Takeaways

VISUALS: Enrich the document naturally:
- **Tables**: When comparing approaches, technologies, or options
- **Mermaid diagrams**: Flowcharts for processes, sequence diagrams for interactions, timelines for chronological content, graph/knowledge diagrams for entity relationships. All diagrams must use \`\`\`mermaid\`\`\` fences.
- **Callouts**: [!NOTE] for additional context, [!WARNING] for caveats, [!TIP] for practical advice

Target 1000-2500 words. Output ONLY valid markdown. No preamble.`,

  DEEP: `You are a senior technical researcher producing a thorough whitepaper. Develop comprehensive original analysis — interpret, connect ideas, and draw conclusions beyond the source.

STRUCTURE: Design the document structure to best serve the material. A thorough paper typically includes:
- ## Summary or ## Abstract
- Multiple substantive sections with descriptive headings
- ## Key Findings or ## Key Takeaways at the end
- Additional sections as needed: Background, Core Concepts, Methodology, Implications, Future Work, etc.

VISUALS: The document should be visually rich:
- \`\`\`mermaid\`\`\` flowcharts for architecture and processes
- \`\`\`mermaid\`\`\` sequence diagrams for interactions and protocols
- \`\`\`mermaid\`\`\` timeline for chronological development
- \`\`\`mermaid\`\`\` graphs (graph LR/TD) for knowledge/entity relationships
- Markdown tables for structured comparisons and data
- [!NOTE], [!WARNING], [!TIP], [!INFO] callout blocks for emphasis
- Every diagram must use valid Mermaid syntax within \`\`\`mermaid\`\`\` fences

Target 3000-7000+ words. Output ONLY valid markdown. No preamble.`,
};

export interface ContentEngineInput {
  capture: CaptureResult;
  mode: GenerationMode;
  complete: CompleteFn;
}

export async function runContentEngine(input: ContentEngineInput): Promise<ContentResult> {
  const { capture, mode, complete } = input;

  const system = MODE_PROMPTS[mode];
  const user = `SOURCE TITLE: ${capture.metadata.title || ''}
SOURCE URL: ${capture.metadata.url || ''}
SOURCE CONTENT:
${capture.rawContent.slice(0, 24000)}`;

  const markdown = await complete(system, user);

  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? capture.metadata.title;
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  log.info('content', `Output: title="${title}" words=${wordCount}`);

  return { title, markdown, wordCount };
}
