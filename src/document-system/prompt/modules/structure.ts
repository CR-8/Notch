/**
 * Prompt structure builder — document class → structure prompt
 *
 * DocumentClass matches src/lib/capture/types.ts.
 */

export type DocumentClass =
  | 'research-paper'
  | 'tutorial'
  | 'reference'
  | 'documentation'
  | 'analysis'
  | 'news'
  | 'blog-post'
  | 'general';

export function buildStructurePrompt(docClass: DocumentClass): string {
  const structures: Record<DocumentClass, string> = {
    'research-paper': `## Document Structure

Choose sections that best present the research:

Start with:
- ## Overview (broad framing)
- ## Introduction (context and problem statement)

Core sections (pick 2-4, in logical order):
- ## Background or ## Related Work
- ## Methodology or ## Approach
- ## Architecture or ## System Design
- ## Implementation
- ## Evaluation or ## Results
- ## Discussion

End with:
- ## Conclusion
- ## Summary and Future Work

**Rules for this type:**
- Minimum 2 paragraphs of prose between headings at the same level
- Use > [!NOTE] callouts for methodology caveats
- Use > [!IMPORTANT] for key findings
- Include mermaid diagrams for architecture and data flow
- Use tables for comparisons and results`,

    tutorial: `## Document Structure

Build progression from zero to working:

Start with:
- ## Overview (what this tutorial covers)

Core sections (pick 2-4, in logical order):
- ## Prerequisites
- ## Setup or ## Installation
- ## Step-by-Step Guide or ## Implementation
- ## Configuration
- ## Usage or ## How It Works

End with:
- ## Troubleshooting
- ## Next Steps or ## Further Reading
- ## Summary

**Rules for this type:**
- Every code block must have a language identifier
- Use > [!TIP] callouts for shortcuts
- Use > [!WARNING] callouts for common mistakes
- Number steps sequentially
- Include terminal sessions for CLI commands`,

    reference: `## Document Structure

Reference documentation for APIs, libraries, or tools:

Start with:
- ## Overview

Core sections (pick 2-5, in logical order):
- ## API Reference or ## Endpoints
- ## Parameters or ## Configuration
- ## Methods or ## Functions
- ## Types or ## Interfaces
- ## Examples
- ## Error Handling

End with:
- ## Notes or ## See Also

**Rules for this type:**
- Every function/method needs a code example
- Use tables for parameter lists
- Use > [!NOTE] callouts for edge cases
- Use > [!WARNING] callouts for deprecated features
- Include type signatures in code blocks`,

    documentation: `## Document Structure

Comprehensive documentation:

Start with:
- ## Overview or ## Introduction

Core sections (pick 2-5, in logical order):
- ## Architecture
- ## Core Concepts
- ## Getting Started
- ## Configuration
- ## Usage Guide
- ## API Reference
- ## Deployment

End with:
- ## Troubleshooting
- ## FAQ
- ## See Also

**Rules for this type:**
- Start with a high-level architecture diagram (mermaid)
- Each feature needs its own section
- Use > [!INFO] callouts for background context
- Include configuration tables`,

    analysis: `## Document Structure

Analytical document examining a topic:

Start with:
- ## Summary or ## Overview

Core sections (pick 2-4, in logical order):
- ## Context or ## Background
- ## Analysis or ## Key Findings
- ## Implications
- ## Comparison or ## Trade-offs

End with:
- ## Conclusion or ## Recommendations

**Rules for this type:**
- Lead with key findings, then elaborate
- Use tables for comparisons
- Use mermaid diagrams for process flows
- Use > [!IMPORTANT] for critical insights
- Use > [!CAUTION] for potential downsides`,

    news: `## Document Structure

News-style coverage:

Start with:
- ## Summary (key facts upfront)

Core sections (pick 1-3, in logical order):
- ## Context or ## Background
- ## Details or ## Announcement
- ## Impact or ## Analysis
- ## Reactions

End with:
- ## What's Next or ## Outlook

**Rules for this type:**
- One sentence per bullet in key points
- Use quotes from source material where available
- Use > [!NOTE] callouts for additional context
- Keep paragraphs tight (2-3 sentences)
- Prefer lists for specifications`,

    'blog-post': `## Document Structure

Blog-style content:

Start with:
- ## Overview or ## The Problem

Core sections (pick 2-4, in logical order):
- ## Context or ## Background
- ## The Approach or ## How It Works
- ## Key Takeaways
- ## Lessons Learned

End with:
- ## Conclusion or ## Final Thoughts

**Rules for this type:**
- Engaging but professional tone
- Use > [!TIP] callouts for practical advice
- Include code examples where relevant
- Use diagrams for concepts
- Keep sections to 3-5 paragraphs`,

    general: `## Document Structure

Design a clear section structure that best organizes the material.

Start with:
- ## Overview or ## Summary

Core sections: 2-4 descriptive headings that group related content logically.

End with:
- ## Conclusion or ## Key Takeaways

**General rules:**
- Minimum sections: ## Overview and ## Summary/Conclusion
- Each ## section should have 2-6 paragraphs
- Mix prose with visuals: 1 table/diagram/callout per 2-3 prose paragraphs
- End with ## Key Takeaways (bullet points) or ## Conclusion`,
  };

  return structures[docClass] ?? structures.general;
}
