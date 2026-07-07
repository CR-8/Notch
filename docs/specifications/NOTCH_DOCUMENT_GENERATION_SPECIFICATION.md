# Notch Document Generation Specification (NDGS)

**Version:** 1.0.0  
**Status:** Draft  
**Last Updated:** 2026-07-06  
**Author:** Notch Architectural Committee  
**Applies To:** All AI providers integrated into the Notch platform

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Goals](#3-goals)
4. [Non-Goals](#4-non-goals)
5. [Supported AI Models](#5-supported-ai-models)
6. [Generation Pipeline](#6-generation-pipeline)
7. [Content Extraction Rules](#7-content-extraction-rules)
8. [Content Quality Rules](#8-content-quality-rules)
9. [Writing Style Guide](#9-writing-style-guide)
10. [Markdown Specification](#10-markdown-specification)
11. [Semantic Block Specification](#11-semantic-block-specification)
12. [Diagram Specification](#12-diagram-specification)
13. [Code Block Specification](#13-code-block-specification)
14. [Table Specification](#14-table-specification)
15. [Image Specification](#15-image-specification)
16. [Video Specification](#16-video-specification)
17. [Callout Specification](#17-callout-specification)
18. [Reference Specification](#18-reference-specification)
19. [Citation Rules](#19-citation-rules)
20. [Heading Rules](#20-heading-rules)
21. [Typography Rules](#21-typography-rules)
22. [Rendering Rules](#22-rendering-rules)
23. [Reader Compatibility Rules](#23-reader-compatibility-rules)
24. [PDF Export Rules](#24-pdf-export-rules)
25. [Accessibility Rules](#25-accessibility-rules)
26. [Performance Rules](#26-performance-rules)
27. [Validation Rules](#27-validation-rules)
28. [Consistency Rules](#28-consistency-rules)
29. [Output Contract](#29-output-contract)
30. [Future Extension Points](#30-future-extension-points)
31. [Appendix A: Example Documents](#appendix-a-example-documents)
32. [Appendix B: Recommended Libraries](#appendix-b-recommended-libraries)

---

## 1. Purpose

This specification defines the Notch Document Generation Specification (NDGS), a model-agnostic standard for generating, formatting, rendering, and validating technical documents within the Notch platform.

The primary purpose is to ensure that any AI model—regardless of architecture, training data, or provider—produces structurally identical, semantically equivalent, and visually consistent documents when processing the same source content.

This specification serves as:

- **The single source of truth** for all document generation pipelines
- **A contractual interface** between the AI provider layer and the rendering layer
- **A validation target** against which all generated documents are measured
- **A migration path** for adding new AI providers without document quality regression

---

## 2. Scope

### 2.1 In Scope

- Document generation from arbitrary web content (HTML, text, PDF, structured data)
- Document formatting and semantic structuring
- Markdown output with semantic extensions
- Diagram generation (Mermaid, PlantUML, ASCII, architecture)
- Code block formatting and syntax metadata
- Media embedding and referencing
- Callout and alert block generation
- Table generation and formatting
- Reference and citation management
- Heading hierarchy and structure
- Output validation and quality assurance
- Reader rendering compatibility
- PDF and print export compatibility

### 2.2 Out of Scope

- UI/UX design of the Reader application itself
- Specific CSS styling or visual theming (handled by Reader)
- Storage, indexing, or retrieval of documents
- Chat/assistant interaction patterns (separate pipeline)
- Embedding generation or vector search
- The capture/classification/extraction pipeline (upstream)
- The TipTap editor and its toolbar UI
- Network transport or API protocol between Notch and AI providers

---

## 3. Goals

1. **Model Agnosticism**: Any supported AI model must produce a document that passes all validation rules defined herein, given identical source content and identical generation mode.

2. **Structural Consistency**: The heading hierarchy, section ordering, block type distribution, and semantic structure must be identical across all models for the same input.

3. **Visual Fidelity**: Documents rendered in the Notch Reader must be visually indistinguishable regardless of which model generated them.

4. **Information Density**: Every paragraph must introduce new knowledge. No filler, no repetition, no motivational language.

5. **Production Reliability**: The output must be parseable by the Notch content engine without errors 99.9% of the time.

6. **Extensibility**: New block types, diagram formats, and AI providers must be addable without revising the core specification.

---

## 4. Non-Goals

1. **Enforcing factual accuracy**: The specification governs structure and format, not truth. Factual validation is a separate concern.

2. **Prescribing model internals**: How a model produces its output (architecture, training, inference) is irrelevant to this specification.

3. **Defining capture logic**: How content is extracted from web pages is specified in the Capture Pipeline document.

4. **Defining the Reader UI**: The Reader application is a consumer of this specification's output, not a subject of it.

5. **Defining the editing experience**: The TipTap editor and its toolbar are separate from document generation.

6. **Defining storage schemas**: IndexedDB schemas and document metadata are defined in the Data Layer specification.

---

## 5. Supported AI Models

### 5.1 Tier 1 (Full Compliance)

Models that can consistently produce NDGS-compliant output with standard prompting:

| Provider  | Models                                     | Notes                                  |
| --------- | ------------------------------------------ | -------------------------------------- |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus, Claude 4 | Native tool use, long context          |
| OpenAI    | GPT-4o, GPT-4.1, o3                        | Structured output mode recommended     |
| Google    | Gemini 2.5 Pro, Gemini 2.0 Flash           | Function calling for structured output |
| Meta      | Llama 4, Llama 3.3 70B                     | Requires detailed system prompt        |

### 5.2 Tier 2 (Conditional Compliance)

Models requiring additional prompting, post-processing, or validation passes:

| Provider | Models                       | Notes                                |
| -------- | ---------------------------- | ------------------------------------ |
| DeepSeek | DeepSeek-V3, DeepSeek-R1     | May need structural enforcement      |
| Mistral  | Mistral Large, Mixtral 8x22B | Sometimes deviates on heading levels |
| xAI      | Grok-2, Grok-3               | Inconsistent with callout formatting |
| Qwen     | Qwen2.5 72B, QwQ-32B         | May produce non-standard markdown    |

### 5.3 Tier 3 (Experimental)

Models that MAY produce compliant output but require significant post-processing:

| Provider      | Models                  | Notes                         |
| ------------- | ----------------------- | ----------------------------- |
| Nemotron      | Nemotron-4 340B         | Testing phase                 |
| Ollama-hosted | Any model via local API | Quality depends on model size |

### 5.4 Adding New Models

To add a new model to the supported list, it must pass all validation rules in [§27](#27-validation-rules) on a test corpus of 100 documents with ≥95% pass rate.

---

## 6. Generation Pipeline

### 6.1 Pipeline Stages

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│   Capture   │────→│   Extract    │────→│   Generate     │────→│   Validate   │
│  (upstream) │     │  (upstream)  │     │  (this spec)   │     │  (this spec) │
└─────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
                                                    │                    │
                                                    ▼                    ▼
                                            ┌──────────────────────────────────┐
                                            │         Post-Process            │
                                            │  (fix, normalize, enrich AST)   │
                                            └──────────────────────────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────────────────────────┐
                                            │         Render (Reader)          │
                                            └──────────────────────────────────┘
```

### 6.2 Stage 1: Capture (Upstream)

Handled by the Capture Pipeline. Produces `DOMExtraction` with:

- `title`: Page title
- `url`: Source URL
- `domain`: Source domain
- `textContent`: Full cleaned text
- `cleanedHtml`: Sanitized HTML
- `images`: Extracted image references
- `wordCount`: Total word count

### 6.3 Stage 2: Extract (Upstream)

Handled by the Extraction Pipeline. Produces:

- `entities`: Named entities with types and salience
- `concepts`: Defined concepts with confidence scores
- `topics`: Extracted topic labels
- `timeline`: Temporal events with significance
- `relationships`: Subject-verb-object triples
- `complexity`: Readability score (1–10)
- `documentClass`: Guessed document type (research-paper, tutorial, news, general)

### 6.4 Stage 3: Generate (This Specification)

The AI model receives:

1. The source content (textContent + extracted metadata)
2. A generation mode (FAST | BALANCED | DEEP)
3. A structured system prompt conforming to this specification
4. Optional: user-specified tags or instructions

The model produces:

1. A markdown document conforming to this specification
2. Structural metadata (heading count, block distribution)

### 6.5 Stage 4: Validate (This Specification)

The generated document is validated against all rules in [§27](#27-validation-rules). If validation fails:

- **Minor violations** (style issues, minor formatting): Log warning, proceed
- **Major violations** (broken structure, invalid blocks): Reject, regenerate with error feedback
- **Critical violations** (unparseable, empty, wrong language): Hard reject

### 6.6 Stage 5: Post-Process

- Parse markdown to EnrichedBlock AST via `parseToEnrichedAST()`
- Fix any model-specific formatting issues
- Normalize language identifiers
- Generate heading IDs
- Build TOC hierarchy
- Assign section numbers
- Cache diagram SVGs
- Strip Notch markers

### 6.7 Stage 6: Render

The Reader application renders the EnrichedBlock AST using the rendering rules in [§22](#22-rendering-rules).

---

## 7. Content Extraction Rules

### 7.1 Source Content Handling

| Source Type        | Processing                                  | Notes                           |
| ------------------ | ------------------------------------------- | ------------------------------- |
| Clean HTML         | Strip tags, preserve structure hints        | Use Mozilla Readability first   |
| Raw text           | Use as-is, attempt structure detection      | May need heading inference      |
| PDF text           | Use extracted text, preserve section breaks | May need OCR cleanup            |
| YouTube transcript | Preserve timestamps as paragraph markers    | Speaker labels become headings  |
| Selection text     | Use verbatim, minimal processing            | Preserve user's exact selection |

### 7.2 Content Truncation

| Mode     | Max Input Tokens | Max Output Tokens |
| -------- | ---------------- | ----------------- |
| FAST     | 8,000            | 4,000             |
| BALANCED | 32,000           | 16,000            |
| DEEP     | Full context     | 64,000            |

When input exceeds the token limit:

1. Prioritize main content body over headers/footers
2. Preserve the first and last 25% of content
3. Truncate from the middle
4. Include a `[truncated]` marker when truncation occurs

---

## 8. Content Quality Rules

### 8.1 Information Density

- **Rule Q1**: Every paragraph must contain at least one substantive claim, definition, or observation not present in the preceding paragraph.
- **Rule Q2**: No paragraph may consist entirely of transition, filler, or motivational text.
- **Rule Q3**: No sentence may begin with "It is important to note that", "It is worth mentioning", or similar padding.
- **Rule Q4**: Every section must contain at least one paragraph that is not a heading, callout, or list.

### 8.2 Forbidden Patterns

The following patterns MUST NOT appear in generated documents:

- "In today's digital landscape"
- "In this article, we will explore"
- "Let's dive in"
- "As we've seen"
- "It's crucial to understand"
- "The world of [topic] is vast"
- "Without further ado"
- "Stay tuned"
- Rhetorical questions without answers
- Second-person address to the reader about the article itself
- Thanking the reader for their time
- Encouraging readers to "share" or "like"

### 8.3 Sentence Construction

- Prefer subject-verb-object order
- Prefer active voice over passive voice
- Maximum sentence length: 40 words (prefer splitting)
- Minimum sentence variety: avoid three consecutive sentences with the same structure
- Technical terms must be defined on first use within each major section

### 8.4 Paragraph Construction

- Paragraphs must be 2–6 sentences (3–5 preferred)
- Single-sentence paragraphs are permitted only for emphasis or transition
- Each paragraph must have a clear topic sentence (first or second sentence)

---

## 9. Writing Style Guide

### 9.1 Voice and Tone

| Attribute       | Requirement                                               |
| --------------- | --------------------------------------------------------- |
| Voice           | Third person, objective                                   |
| Formality       | Formal but not academic                                   |
| Technical level | Assumes proficient reader                                 |
| Perspective     | Neutral, informational                                    |
| Tense           | Present tense for facts, past tense for historical events |

### 9.2 Style Rules

1. **Be precise**: Prefer specific numbers over qualitative terms ("17%" not "a significant portion").
2. **Be concise**: Delete any word that does not add meaning.
3. **Be structured**: Use lists, tables, and callouts to break dense concepts.
4. **Be consistent**: Use the same term for the same concept throughout the document.
5. **Be technical**: Use domain terminology. Define acronyms on first use.
6. **Be neutral**: No marketing language, no hyperbole, no opinion.

### 9.3 Terminology Standardization

| Do Not Use    | Use Instead                                       |
| ------------- | ------------------------------------------------- |
| Utilize       | Use                                               |
| Leverage      | Use                                               |
| Implement     | Build, create, or deploy (context-dependent)      |
| Robust        | Reliable, fault-tolerant, or resilient (specific) |
| Solution      | System, tool, framework, or approach (specific)   |
| Ecosystem     | Platform, environment, or stack (specific)        |
| Best-in-class | Omit or use specific metric                       |
| Cutting-edge  | Omit or use specific version/technique            |
| Game-changing | Omit entirely                                     |

### 9.4 Abbreviation Rules

- On first use in a section, spell out the abbreviation followed by the acronym in parentheses
- Example: "Representational State Transfer (REST)"
- Use the acronym thereafter within the same section
- Re-spell out in each major section (§20 heading boundary)
- Do not abbreviate terms used fewer than three times

---

## 10. Markdown Specification

### 10.1 Standard Markdown Support

The generation output MUST use standard GitHub-Flavored Markdown (GFM) extended with semantic blocks. The following standard constructs are REQUIRED:

| Construct       | Syntax                       | Example                            |
| --------------- | ---------------------------- | ---------------------------------- |
| Heading         | `#` through `######`         | `## Architecture`                  |
| Paragraph       | Text separated by blank line |                                    |
| Bold            | `**text**`                   | `**critical**`                     |
| Italic          | `*text*`                     | `*et al.*`                         |
| Inline code     | `` `code` ``                 | `` `O(n)` ``                       |
| Code fence      | ` ```lang `                  | ` ```python `                      |
| Link            | `[text](url)`                | `[React](https://react.dev)`       |
| Image           | `![alt](url)`                | `![Architecture](diagram.png)`     |
| Unordered list  | `- item`                     | `- First item`                     |
| Ordered list    | `1. item`                    | `1. Initialize`                    |
| Task list       | `- [ ] task`                 | `- [x] Completed`                  |
| Blockquote      | `> text`                     | `> Note that...`                   |
| Table           | `\| col \| col \|`           | See [§14](#14-table-specification) |
| Horizontal rule | `---`                        | Use sparingly for major breaks     |
| Footnote        | `[^1]`                       | `[^1]: Definition`                 |

### 10.2 Extended Markdown (Semantic Blocks)

See [§11](#11-semantic-block-specification) for the full semantic block specification. These use the `:::` fenced container syntax:

```markdown
:::info title="Optional Title"
Content here...
:::
```

### 10.3 Markdown Formatting Rules

| Rule | Description                                                               |
| ---- | ------------------------------------------------------------------------- |
| M1   | Use ATX headings (`##`), not Setext headings (`===`)                      |
| M2   | One blank line before each heading, zero blank lines after                |
| M3   | Lists must have a blank line before and after                             |
| M4   | Code fences must have a language identifier (use `text` only as fallback) |
| M5   | Tables must have a header row and alignment row (`\| --- \|`)             |
| M6   | Links must use inline format `[text](url)`, not reference format          |
| M7   | Images must use inline format `![alt](url)` with alt text                 |
| M8   | Do not use raw HTML in markdown output (except KaTeX)                     |
| M9   | Do not use indented code blocks (use fenced blocks)                       |
| M10  | All horizontal rules must use `---` with blank lines before and after     |

### 10.4 KaTeX / Math

Math expressions MUST be rendered using LaTeX syntax for KaTeX processing:

- Inline: `$E = mc^2$`
- Block: `$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$`

**Rules:**

| Rule | Description                                                   |
| ---- | ------------------------------------------------------------- |
| K1   | Inline math must use single `$` delimiters                    |
| K2   | Block math must use double `$$` delimiters on their own lines |
| K3   | Use standard LaTeX notation (KaTeX-compatible subset)         |
| K4   | Do not use raw HTML or images for math expressions            |
| K5   | Complex equations should use block math, not inline           |

---

## 11. Semantic Block Specification

### 11.1 Definition

Semantic blocks are fenced container elements that extend standard markdown to represent structured, typed content. They use the `:::` fence syntax, inspired by MyST Markdown and Vitepress.

### 11.2 Syntax

```markdown
:::block-type key="value" key2="value2"
Content...
:::
```

- Block type is a lowercase alphanumeric identifier (no spaces)
- Attributes are optional, space-separated, in `key="value"` format
- Content is standard markdown (parsed and rendered)
- Block must be closed with `:::`
- Nesting is NOT permitted (with one exception for `:::code`)

### 11.3 Supported Semantic Blocks

#### `:::note`

| Property      | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Purpose       | Neutral supplementary information                      |
| Visual intent | Blue sidebar, subtle background                        |
| Rendering     | Info icon, blue accent border                          |
| Example       | `:::note\nThis protocol uses TCP port 443.\n:::`       |
| Invalid       | Using note for warnings, tips, or critical information |

#### `:::tip`

| Property      | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Purpose       | Best practice, recommendation, optimization hint                  |
| Visual intent | Green sidebar, subtle background                                  |
| Rendering     | Lightbulb icon, green accent border                               |
| Example       | `:::tip\nUse connection pooling for production deployments.\n:::` |
| Invalid       | Using tip for critical security warnings                          |

#### `:::warning`

| Property      | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Purpose       | Potential issue, common mistake, degraded behavior      |
| Visual intent | Orange/yellow sidebar, subtle background                |
| Rendering     | Alert-triangle icon, amber accent border                |
| Example       | `:::warning\nThis API will be deprecated in v3.0.\n:::` |
| Invalid       | Using warning for informational content                 |

#### `:::danger`

| Property      | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Purpose       | Critical security issue, data loss risk, breaking change              |
| Visual intent | Red sidebar, subtle red background                                    |
| Rendering     | Ban/stop icon, red accent border                                      |
| Example       | `:::danger\nDo not expose this endpoint to the public internet.\n:::` |
| Invalid       | Using danger for non-critical issues                                  |

#### `:::error`

| Property      | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Purpose       | Error condition, known bug, incorrect assumption                        |
| Visual intent | Red background, error icon                                              |
| Rendering     | X-circle icon, red accent border                                        |
| Example       | `:::error\nThe legacy v1 API returns HTTP 500 for empty payloads.\n:::` |
| Invalid       | Using error for warnings or notes                                       |

#### `:::success`

| Property      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Purpose       | Successful outcome, completed task, positive confirmation  |
| Visual intent | Green background, checkmark icon                           |
| Rendering     | Check-circle icon, green accent border                     |
| Example       | `:::success\nMigration completed with zero downtime.\n:::` |
| Invalid       | Using success for neutral or negative information          |

#### `:::important`

| Property      | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Purpose       | Critical information the reader must know              |
| Visual intent | Red/pink background, bell icon                         |
| Rendering     | Bell icon, red accent border                           |
| Example       | `:::important\nAll tokens expire after 24 hours.\n:::` |
| Invalid       | Using important for optional information               |

#### `:::question`

| Property      | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Purpose       | Open question, consideration, discussion point                           |
| Visual intent | Purple background, question-mark icon                                    |
| Rendering     | Help-circle icon, purple accent border                                   |
| Example       | `:::question\nShould this live in the core library or as a plugin?\n:::` |
| Invalid       | Using question for rhetorical questions without discussion               |

#### `:::example`

| Property      | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Purpose       | Concrete example illustrating a concept                     |
| Visual intent | Neutral card with code or text                              |
| Rendering     | Generic card with example label                             |
| Example       | `:::example\nInput: "hello" → Output: "olleh"\n:::`         |
| Invalid       | Using example for production code samples (use code blocks) |

#### `:::info`

Alias for `:::note`. Both are valid and render identically.

#### `:::caution`

Alias for `:::warning`. Both are valid and render identically.

#### Technical Semantic Blocks

These are specialized blocks for technical documentation, rendered with distinct visual treatment.

#### `:::architecture`

| Property            | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Purpose             | Architectural decisions, system design context             |
| Visual intent       | Blue card with architectural icon                          |
| Rendering           | Blue accent, "Architecture Decision" label                 |
| Content constraints | Must include at least one of: context, decision, tradeoffs |

#### `:::performance`

| Property            | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| Purpose             | Performance characteristics, benchmarks, optimization notes |
| Visual intent       | Speed/clock icon, neutral card                              |
| Rendering           | Yellow accent, "Performance" label                          |
| Content constraints | Should include numeric metrics where possible               |

#### `:::security`

| Property            | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| Purpose             | Security considerations, threat models, mitigations              |
| Visual intent       | Shield icon, red-tinted card                                     |
| Rendering           | Red accent, "Security" label                                     |
| Content constraints | Must reference specific CVE, OWASP category, or security pattern |

#### `:::api`

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| Purpose             | API endpoint reference, method signature, usage    |
| Visual intent       | Code-bracket icon, neutral dark card               |
| Rendering           | Blue accent, "API Reference" label                 |
| Content constraints | Must include method, path, request/response format |

#### `:::definition`

| Property            | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Purpose             | Term definition, glossary entry                                           |
| Visual intent       | Book icon, muted card                                                     |
| Rendering           | No accent, "Definition" label in muted text                               |
| Content constraints | Must include the term as a `term` attribute and its definition in content |

#### `:::history`

| Property            | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Purpose             | Historical context, evolution of a concept, changelog |
| Visual intent       | Clock icon, muted card                                |
| Rendering           | No accent, "History" label                            |
| Content constraints | Should be chronological if listing events             |

#### `:::future-work`

| Property            | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| Purpose             | Planned improvements, roadmap items, open problems            |
| Visual intent       | Lightbulb/sparkle icon, muted card                            |
| Rendering           | Purple accent, "Future Work" label                            |
| Content constraints | Must be tagged with expected timeline or priority where known |

#### `:::references`

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| Purpose             | External references, further reading, bibliography |
| Visual intent       | Bookmark icon, neutral card                        |
| Rendering           | No accent, "References" label                      |
| Content constraints | Should use standard citation format within         |

### 11.4 Invalid Semantic Block Patterns

The following patterns are FORBIDDEN:

| Pattern                                                             | Reason                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Nested semantic blocks                                              | Parser limitation; flatten into adjacent blocks                              |
| Empty semantic blocks                                               | No informational value                                                       |
| Block type longer than 32 characters                                | Exceeds identifier limit                                                     |
| Block without content (except `:::references`)                      | Redundant                                                                    |
| `:::` used for non-block purposes                                   | Ambiguous parsing                                                            |
| More than 3 consecutive semantic blocks                             | Reduces readability; intersperse prose                                       |
| Semantic block immediately after a heading without intervening text | Must have at least one sentence of prose separating heading from first block |

---

## 12. Diagram Specification

### 12.1 Supported Diagram Types

| Type              | Syntax                                            | Renderer            | Priority |
| ----------------- | ------------------------------------------------- | ------------------- | -------- |
| Mermaid flowchart | ` ```mermaid ` followed by flowchart syntax       | Mermaid             | Highest  |
| Mermaid sequence  | ` ```mermaid ` followed by sequenceDiagram syntax | Mermaid             | High     |
| Mermaid class     | ` ```mermaid ` followed by classDiagram syntax    | Mermaid             | High     |
| Mermaid state     | ` ```mermaid ` followed by stateDiagram syntax    | Mermaid             | High     |
| Mermaid ER        | ` ```mermaid ` followed by erDiagram syntax       | Mermaid             | High     |
| Mermaid journey   | ` ```mermaid ` followed by journey syntax         | Mermaid             | Medium   |
| Mermaid gantt     | ` ```mermaid ` followed by gantt syntax           | Mermaid             | Medium   |
| Mermaid pie       | ` ```mermaid ` followed by pie syntax             | Mermaid             | Low      |
| Mermaid mindmap   | ` ```mermaid ` followed by mindmap syntax         | Mermaid             | Medium   |
| Mermaid timeline  | ` ```mermaid ` followed by timeline syntax        | Mermaid             | Medium   |
| Mermaid gitgraph  | ` ```mermaid ` followed by gitGraph syntax        | Mermaid             | Low      |
| Mermaid quadrant  | ` ```mermaid ` followed by quadrantChart syntax   | Mermaid             | Low      |
| Mermaid zenuml    | ` ```mermaid ` followed by zenuml syntax          | Mermaid             | Low      |
| PlantUML          | ` ```plantuml ` followed by PlantUML syntax       | PlantUML encoder    | Medium   |
| ASCII diagram     | ` ```ascii ` followed by ASCII art                | Monospace rendering | Low      |

### 12.2 Diagram Generation Rules

| Rule | Description                                                                       |
| ---- | --------------------------------------------------------------------------------- |
| D1   | Every diagram must be in a fenced code block with the correct language identifier |
| D2   | Diagrams must use standard Mermaid syntax, not custom extensions                  |
| D3   | Every diagram must have a preceding paragraph introducing it                      |
| D4   | Diagrams must be placed AFTER the paragraph that references them                  |
| D5   | Diagram labels should be concise (≤60 characters)                                 |
| D6   | Diagram captions are OPTIONAL and placed after the code block as `*Caption text*` |
| D7   | Do not use HTML entities or raw HTML inside diagram code                          |
| D8   | Maximum one diagram per 500 words of prose (prevents diagram overload)            |

### 12.3 Preferred Diagram Types by Content

| Content Pattern                            | Preferred Diagram Type           |
| ------------------------------------------ | -------------------------------- |
| Process, pipeline, or workflow             | `flowchart LR` or `flowchart TD` |
| Request-response, protocol, or interaction | `sequenceDiagram`                |
| Inheritance, types, or taxonomy            | `classDiagram`                   |
| State machine or lifecycle                 | `stateDiagram-v2`                |
| Database schema or relationships           | `erDiagram`                      |
| Timeline or chronological events           | `timeline`                       |
| Hierarchical or tree structure             | `mindmap`                        |
| Task scheduling or project plan            | `gantt`                          |
| Proportional breakdown                     | `pie`                            |
| Git branches and commits                   | `gitGraph`                       |

### 12.4 Mermaid Diagram Direction Selection

| Use Case                                 | Direction                 | Syntax                       |
| ---------------------------------------- | ------------------------- | ---------------------------- |
| Timeline / pipeline / sequential process | Left-to-Right             | `flowchart LR`               |
| Hierarchy / tree / organization          | Top-Down                  | `flowchart TD`               |
| Dependency graph / data flow             | Left-to-Right             | `flowchart LR`               |
| Network / system architecture            | Top-Down or Left-to-Right | Evaluate based on node count |

### 12.5 Mermaid Validation Rules

| Rule | Description                                            |
| ---- | ------------------------------------------------------ |
| MD1  | All nodes must have labels (no empty `[]` or `()`)     |
| MD2  | All edges must have a defined target node              |
| MD3  | Subgraphs must have labels                             |
| MD4  | Sequence diagrams must declare participants            |
| MD5  | Class diagrams must define at least one relationship   |
| MD6  | State diagrams must have at least one state transition |

### 12.6 Fallback Behavior

| Condition                               | Fallback                                           |
| --------------------------------------- | -------------------------------------------------- |
| Mermaid syntax invalid                  | Attempt auto-fix using `autoFixMermaid()`          |
| Auto-fix fails                          | Render as plain text code block                    |
| PlantUML rendering disabled (localOnly) | Render as plain text code block with enable prompt |
| ASCII diagram                           | Always render as monospace preformatted text       |
| Unknown diagram language                | Render as plain text code block                    |

### 12.7 ASCII Diagram Rules

- Use box-drawing characters: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
- Keep within 80 character width
- Prefer simple 2D layouts over 3D perspective
- Annotate with text labels adjacent to elements

---

## 13. Code Block Specification

### 13.1 Standard Code Blocks

All code blocks must use fenced format with a language identifier:

````markdown
```python
def hello():
    print("world")
```
````

### 13.2 Required Language Identifiers

| Language         | Identifier   |
| ---------------- | ------------ |
| TypeScript       | `typescript` |
| TypeScript React | `tsx`        |
| JavaScript       | `javascript` |
| JavaScript React | `jsx`        |
| Python           | `python`     |
| Rust             | `rust`       |
| Go               | `go`         |
| Ruby             | `ruby`       |
| Java             | `java`       |
| Kotlin           | `kotlin`     |
| Swift            | `swift`      |
| C                | `c`          |
| C++              | `cpp`        |
| C#               | `csharp`     |
| PHP              | `php`        |
| HTML             | `html`       |
| CSS              | `css`        |
| SCSS             | `scss`       |
| SQL              | `sql`        |
| JSON             | `json`       |
| YAML             | `yaml`       |
| TOML             | `toml`       |
| XML              | `xml`        |
| Markdown         | `markdown`   |
| Shell            | `bash`       |
| Dockerfile       | `dockerfile` |
| GraphQL          | `graphql`    |
| Diff             | `diff`       |
| Plain text       | `text`       |

**Rules:**

| Rule | Description                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| C1   | Never omit the language identifier (use `text` as last resort)                                                     |
| C2   | Use full identifiers from the table above, not abbreviations (prefer `javascript` over `js`)                       |
| C3   | Code blocks must be preceded by a prose explanation                                                                |
| C4   | Code blocks longer than 40 lines should be preceded by a summary of what they demonstrate                          |
| C5   | Inline code should NOT be used for multi-word expressions (use backticks only for single symbols or short phrases) |

### 13.3 Code Block Annotations

Code blocks can include a filename annotation using a special comment syntax on the first line:

```typescript
// filename: src/utils/helpers.ts
export function helper() {}
```

Or using the YAML frontmatter-style code meta:

```typescript
/* ---
filename: src/utils/helpers.ts
highlight: [3, 5-7]
--- */
```

### 13.4 Language-Normalized Identifiers

For consistency across models, the following language aliases MUST be normalized:

| Alias                | Normalized To |
| -------------------- | ------------- |
| `js`                 | `javascript`  |
| `ts`                 | `typescript`  |
| `py`                 | `python`      |
| `rb`                 | `ruby`        |
| `sh`, `shell`, `zsh` | `bash`        |
| `yml`                | `yaml`        |
| `md`                 | `markdown`    |
| `kt`                 | `kotlin`      |
| `rs`                 | `rust`        |
| `cpp`, `c++`, `cxx`  | `cpp`         |
| `cs`, `c#`           | `csharp`      |
| `jsx`                | keep as `jsx` |
| `tsx`                | keep as `tsx` |

### 13.5 Terminal / Shell Blocks

For command-line examples:

```bash
$ npm run build
$ npm start
```

- Use `$` prefix for commands the user types
- Use no prefix for command output
- Include exit codes where relevant

### 13.6 Diff Blocks

For showing code changes:

```diff
- const old = deprecated();
+ const updated = replacement();
```

- Lines starting with `-` are removals (red)
- Lines starting with `+` are additions (green)
- Include line numbers in the surrounding prose context

### 13.7 Code Block Generation Rules

| Rule | Description                                                                    |
| ---- | ------------------------------------------------------------------------------ |
| CB1  | Code examples must be syntactically valid for the declared language            |
| CB2  | Code examples must be self-contained (no undefined external dependencies)      |
| CB3  | Code must use consistent indentation (2 spaces for JS/TS, 4 spaces for Python) |
| CB4  | Maximum line length: 100 characters                                            |
| CB5  | Include comments only to explain non-obvious logic                             |
| CB6  | Prefer complete functions/classes over fragments (where reasonable)            |
| CB7  | Never use placeholder names like `foo`, `bar`, `baz` in code examples          |
| CB8  | Use descriptive variable names in all code examples                            |
| CB9  | Maximum 3 consecutive code blocks (intersperse with explanation)               |

### 13.8 Line Highlighting

When specific lines need emphasis, annotate with:

```typescript
// highlight-next-line
const important = value;
```

Or for multi-line:

```typescript
// highlight-start
function critical() {
  return true;
}
// highlight-end
```

---

## 14. Table Specification

### 14.1 Standard Table Format

```markdown
| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### 14.2 Alignment

```markdown
| Left | Center | Right |
| :--- | :----: | ----: |
| Text |  Text  |  Text |
```

### 14.3 Table Generation Rules

| Rule | Description                                                        |
| ---- | ------------------------------------------------------------------ |
| T1   | Every table must have a header row separated by an alignment row   |
| T2   | Tables must have a blank line before and after                     |
| T3   | Every table must be introduced by a prose sentence                 |
| T4   | Maximum 8 columns per table (wider tables break readability)       |
| T5   | Column content should be concise (max 200 characters per cell)     |
| T6   | Use `---` alignment row, not `:---` for left-aligned default       |
| T7   | Tables must NOT contain block elements (lists, code, etc.)         |
| T8   | Tables must NOT contain semantic blocks                            |
| T9   | Use inline code formatting in cells where referencing code symbols |

### 14.4 Recommended Table Types

| Type          | Columns                               | Usage                       |
| ------------- | ------------------------------------- | --------------------------- |
| Comparison    | Feature, A, B, C                      | Compare tools or approaches |
| API           | Method, Endpoint, Description, Auth   | API reference               |
| Specification | Parameter, Type, Default, Description | Configuration reference     |
| Status        | Component, Status, Notes              | System status               |
| Metric        | Metric, Value, Baseline, Change       | Performance data            |
| Chronology    | Date, Event, Impact                   | Timeline                    |

### 14.5 Wide Table Handling

Tables wider than 8 columns should be:

1. Split into multiple focused tables
2. Or transposed (rows become columns)
3. Never rendered as raw markdown with 12+ columns

---

## 15. Image Specification

### 15.1 Standard Image Format

```markdown
![Alt text describing the image](https://example.com/image.png)
```

With optional caption:

```markdown
![Architecture diagram showing request flow](https://example.com/arch.png)
_Figure 1: System architecture showing the request flow from client to database_
```

### 15.2 Image Generation Rules

| Rule | Description                                                                    |
| ---- | ------------------------------------------------------------------------------ |
| I1   | Every image must have alt text (descriptive, not generic)                      |
| I2   | Image URLs must be absolute URLs from the source content                       |
| I3   | Do not generate placeholder URLs or relative paths                             |
| I4   | Images must be placed after the paragraph that references them                 |
| I5   | Maximum one image per 300 words of prose                                       |
| I6   | Alt text must describe what the image shows (not just "image" or "screenshot") |
| I7   | Captions are OPTIONAL but recommended for figures and diagrams                 |

### 15.3 Image Types

| Type          | Description                             | Rendering                       |
| ------------- | --------------------------------------- | ------------------------------- |
| Content image | Image from the original source          | Lazy-loaded, clickable for zoom |
| Diagram image | Figure generated by the AI or extracted | Lazy-loaded, caption required   |
| Screenshot    | UI screenshot from source               | Lazy-loaded, zoomable           |
| Icon/Logo     | Small decorative image                  | Inline, no border               |

### 15.4 Caption Rules

- Captions are markdown italic text placed immediately after the image
- Captions for figures should include sequential numbering: `*Figure N: ...*`
- Captions for tables should include sequential numbering: `*Table N: ...*`
- Figure numbering is assigned by the renderer, NOT by the language model

---

## 16. Video Specification

### 16.1 Video Embed Format

```markdown
@[youtube](https://youtube.com/watch?v=VIDEO_ID)
@[vimeo](https://vimeo.com/VIDEO_ID)
@[video](https://example.com/video.mp4)
```

### 16.2 Video Rules

| Rule | Description                                                     |
| ---- | --------------------------------------------------------------- |
| V1   | Videos must use the `@[provider](url)` syntax for embeds        |
| V2   | Video URLs must be absolute URLs from the source content        |
| V3   | Every video embed must be preceded by a description             |
| V4   | Do not generate video URLs—only use URLs from extracted content |
| V5   | Audio embeds use same syntax: `@[audio](url)`                   |

### 16.3 Video Fallback

When a video cannot be embedded (unknown provider):

```markdown
Video: [Title](https://example.com/video.mp4)
_Description of video content_
```

---

## 17. Callout Specification

### 17.1 Purpose

Callouts (also called alerts, admonitions, or notices) highlight information that is structurally separate from the main prose flow. They draw attention without disrupting reading continuity.

### 17.2 Standard Format

Callouts in the generated markdown use the `[!TYPE]` GFM-alert syntax, discovered and parsed by the content engine:

```markdown
> [!NOTE]
> This is a neutral note.
```

The content engine detects these during parsing in `parseToEnrichedAST()` and converts them to typed `CalloutBlock` components. The Reader then renders them as styled callout cards with icons, borders, and background colors.

### 17.3 Supported Callout Types

| Type      | Syntax         | Visual                  | Use Case                          |
| --------- | -------------- | ----------------------- | --------------------------------- |
| Note      | `[!NOTE]`      | Blue                    | Neutral supplementary information |
| Tip       | `[!TIP]`       | Green                   | Best practices, recommendations   |
| Warning   | `[!WARNING]`   | Orange/Amber            | Potential issues, cautions        |
| Danger    | `[!DANGER]`    | Red                     | Critical warnings, security       |
| Info      | `[!INFO]`      | Blue (same as Note)     | General information               |
| Important | `[!IMPORTANT]` | Red-pink                | Must-read information             |
| Caution   | `[!CAUTION]`   | Amber (same as Warning) | Be careful                        |
| Success   | `[!SUCCESS]`   | Green                   | Positive outcomes                 |
| Question  | `[!QUESTION]`  | Purple                  | Open questions                    |

### 17.4 Callout Generation Rules

| Rule | Description                                                                           |
| ---- | ------------------------------------------------------------------------------------- |
| CA1  | Callouts must use `[!TYPE]` GFM alert syntax (not `:::` fenced syntax for generation) |
| CA2  | Callouts must be separated from surrounding content by blank lines                    |
| CA3  | Callout content must be 1–4 paragraphs (short and focused)                            |
| CA4  | Maximum 1 callout per 3 prose paragraphs                                              |
| CA5  | Callouts must NOT contain code blocks, diagrams, or nested callouts                   |
| CA6  | Callouts must NOT contain headings                                                    |
| CA7  | Callout type must be one of the 9 defined types (not custom)                          |
| CA8  | Do not overuse callouts—reserve for information that genuinely needs separation       |

### 17.5 Callout Content Rules

- Content should be concise (≤150 words per callout)
- Use `> [!TYPE] Title` to add a title (optional)
- Content can contain inline formatting (bold, code, links)
- Content cannot contain block elements (lists, tables, code fences)

**Example with title:**

```markdown
> [!WARNING] Deprecation Notice
> The v1 API will be removed in Q3 2026. Migrate to v2 before July 1.
```

---

## 18. Reference Specification

### 18.1 Internal References

Internal references link to sections, figures, or tables within the same document:

```markdown
See [§12.3](#123-preferred-diagram-types-by-content) for diagram selection.
See [Figure 1](#fig-system-architecture) for the system overview.
See [Table 3](#table-config-params) for all configuration parameters.
```

**Rules:**

| Rule | Description                                                         |
| ---- | ------------------------------------------------------------------- |
| R1   | Internal references must use the target's heading ID or element ID  |
| R2   | Reference text must be descriptive (not just "click here")          |
| R3   | Back-references (references that point forward) should be minimized |
| R4   | Self-references (a section referencing itself) are forbidden        |

### 18.2 External References

External references link to external resources:

```markdown
[React Documentation](https://react.dev)
[RFC 7231 - HTTP/1.1](https://datatracker.ietf.org/doc/html/rfc7231)
```

**Rules:**

| Rule | Description                                                   |
| ---- | ------------------------------------------------------------- |
| R5   | External links must use inline format with descriptive text   |
| R6   | Link text must describe the target (not "link" or "here")     |
| R7   | Prefer official documentation over third-party sources        |
| R8   | Archive.org links should be used for pages that may disappear |

### 18.3 Section Reference Format

References to other sections should use the format: `[§N](#section-id)` for section references, or `[§N.M](#section-id)` for subsections.

---

## 19. Citation Rules

### 19.1 Inline Citations

Inline citations for external sources:

```markdown
The Transformer architecture [Vaswani et al., 2017] introduced self-attention.
```

### 19.2 Footnotes

For extended citations or annotations:

```markdown
The system uses eventual consistency.[^1]

[^1]:
    Defined by the CAP theorem: a distributed system can provide at most
    two of consistency, availability, and partition tolerance.
```

**Rules:**

| Rule | Description                                                      |
| ---- | ---------------------------------------------------------------- |
| CT1  | Citations should use the `[Author, Year]` format                 |
| CT2  | Footnotes must be at the bottom of the section, not the document |
| CT3  | Footnote identifiers use `[^n]` format with sequential numbering |
| CT4  | Each footnote must be referenced at least once in the text       |

---

## 20. Heading Rules

### 20.1 Heading Hierarchy

The maximum heading depth is 6 levels (H1–H6). In practice:

| Level | Usage                                              | Frequency           |
| ----- | -------------------------------------------------- | ------------------- |
| H1    | Document title (reserved, generated by the system) | Exactly once        |
| H2    | Major sections                                     | Every 300–800 words |
| H3    | Subsections                                        | As needed           |
| H4    | Sub-subsections                                    | Rarely              |
| H5+   | Deep hierarchy                                     | Avoid if possible   |

### 20.2 Heading Hierarchy Rules

| Rule   | Description                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| H1     | The document MUST have exactly one H1 (the document title). The model should NOT generate an H1. The system prepends it. |
| H2     | Use H2 for top-level sections. Never skip from H1 to H3.                                                                 |
| H3     | Use H3 for subsections. Must be under an H2.                                                                             |
| H4     | Use H4 only when H3 needs further subdivision. Avoid H4 if possible.                                                     |
| H5, H6 | Use only for deeply nested technical specifications. Rare.                                                               |
| HH1    | The hierarchy must never skip a level (H1 → H3 is invalid)                                                               |
| HH2    | Each heading level must increase by at most 1 from the previous heading                                                  |
| HH3    | Heading text must be sentence case (capitalize first word and proper nouns only)                                         |
| HH4    | Headings must not end with punctuation (periods, colons, semicolons)                                                     |
| HH5    | Headings must not contain code formatting (backticks)                                                                    |
| HH6    | Headings must not contain links                                                                                          |
| HH7    | Headings must be unique within the document (no duplicate IDs)                                                           |
| HH8    | Minimum 2 paragraphs of prose between headings at the same level                                                         |

### 20.3 Heading IDs

Heading IDs are generated by the parser, not the language model. The model must NOT include custom `{#id}` attributes.

The parser generates IDs by:

1. Lowercasing the heading text
2. Replacing non-alphanumeric characters with hyphens
3. Removing leading/trailing hyphens
4. Truncating to 48 characters
5. Appending a hash suffix for uniqueness if needed

### 20.4 Section Numbering

Section numbers (1, 1.1, 1.1.1) are assigned by the parser's `assignNumbers()` function. The model must NOT include numbers in heading text.

---

## 21. Typography Rules

### 21.1 Text Formatting

| Element       | Syntax       | Usage                                          |
| ------------- | ------------ | ---------------------------------------------- |
| Bold          | `**text**`   | Key terms, important concepts (first use only) |
| Italic        | `*text*`     | Foreign terms, titles, emphasis (sparingly)    |
| Inline code   | `` `text` `` | Code symbols, filenames, commands, paths       |
| Strikethrough | `~~text~~`   | Deprecated or removed items                    |

### 21.2 Typography Rules

| Rule | Description                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------- |
| TP1  | Use bold for the FIRST mention of a key term only (not subsequent mentions)                        |
| TP2  | Use italic for Latin terms (_et al._, _in situ_, _ad hoc_) and publication titles                  |
| TP3  | Use inline code for all code identifiers: variable names, function names, file paths, CLI commands |
| TP4  | Do not use ALL CAPS for emphasis (use bold instead)                                                |
| TP5  | Do not use `_` for italic (use `*`)                                                                |
| TP6  | Do not mix bold and italic on the same text segment                                                |
| TP7  | Avoid nested inline formatting (bold inside code, etc.)                                            |

### 21.3 Punctuation Rules

| Rule | Description                                                                  |
| ---- | ---------------------------------------------------------------------------- |
| P1   | Use Oxford comma in lists of three or more items                             |
| P2   | Use em-dashes (—) with spaces on both sides for parenthetical phrases        |
| P3   | Use en-dashes (–) for ranges (2020–2024, pp. 15–20)                          |
| P4   | Use straight quotes in markdown (the renderer will convert to smart quotes)  |
| P5   | Use periods inside parentheses when the parenthetical is a complete sentence |
| P6   | Do not use semicolons where a period would suffice                           |
| P7   | Prefer bullet lists over comma-separated inline lists                        |

### 21.4 Numerals

| Rule | Description                                                                                  |
| ---- | -------------------------------------------------------------------------------------------- |
| N1   | Spell out numbers zero through nine, use numerals for 10+                                    |
| N2   | Always use numerals for: versions (v2.0), percentages (17%), measurements (5ms), money ($30) |
| N3   | Use commas in numbers with 4+ digits (1,234)                                                 |
| N4   | Use decimal notation for precise values (3.14, not 3)                                        |
| N5   | Units should have a space between number and unit (16 GB, 100 ms)                            |

---

## 22. Rendering Rules

### 22.1 Reader Rendering Pipeline

```
Generated Markdown
       │
       ▼
parseToEnrichedAST()
       │
       ▼
EnrichedBlock[]
       │
       ▼
Build Hierarchy (TOC, figures, tables, diagrams, code blocks)
       │
       ▼
Assign Numbering
       │
       ▼
Render each block type:
  heading → HeadingRenderer (anchor, section number)
  paragraph → marked.parse() → sanitized HTML
  diagram → DiagramBlock (Mermaid/PlantUML async render)
  code → CodeBlock (syntax, copy, collapse, etc.)
  callout → CalloutRenderer (icon, color, border)
  rich_table → RichTable (sortable, responsive)
  image → ImageBlock (lazy load, caption, zoom)
  blockquote → styled blockquote
  list → styled list
```

### 22.2 Layout Rules

| Rule | Description                                                         |
| ---- | ------------------------------------------------------------------- |
| L1   | Content is rendered in a centered column with max-width 760px       |
| L2   | Navigation Rail is rendered on the right side (desktop)             |
| L3   | Navigation Rail collapses to dot indicators on tablet (<1024px)     |
| L4   | Navigation Rail becomes a bottom sheet on mobile (<768px)           |
| L5   | All content blocks flow linearly in document order                  |
| L6   | No sticky, floating, or fixed content within the reading column     |
| L7   | Images and diagrams break out to full column width (not text width) |

### 22.3 Block Spacing

| Adjacent Blocks        | Vertical Space  |
| ---------------------- | --------------- |
| Heading → Paragraph    | 0.5em           |
| Paragraph → Paragraph  | 0.875em         |
| Heading → Heading      | 1.0em (minimum) |
| Code Block → Paragraph | 1.5em           |
| Callout → Paragraph    | 1.5em           |
| Image → Paragraph      | 1.5em           |
| Table → Paragraph      | 1.5em           |
| List → Paragraph       | 0.875em         |

### 22.4 Heading Rendering

| Level | Size | Weight | Margin Top | Margin Bottom |
| ----- | ---- | ------ | ---------- | ------------- |
| H1    | 28px | 700    | 2.5rem     | 1rem          |
| H2    | 22px | 700    | 2rem       | 0.75rem       |
| H3    | 18px | 700    | 1.5rem     | 0.5rem        |
| H4    | 16px | 600    | 1.25rem    | 0.5rem        |
| H5    | 15px | 600    | 1rem       | 0.375rem      |
| H6    | 14px | 600    | 1rem       | 0.25rem       |

---

## 23. Reader Compatibility Rules

### 23.1 Required Compatibility

The generated document MUST be compatible with the Notch Reader rendering engine. The following features must render correctly:

| Feature                           | Compatibility Requirement               |
| --------------------------------- | --------------------------------------- |
| All heading levels (H1–H6)        | Must render with correct hierarchy      |
| Paragraphs with inline formatting | Must render bold, italic, code, links   |
| Ordered and unordered lists       | Must render nested up to 3 levels       |
| Task lists                        | Must render checkboxes                  |
| Standard tables                   | Must render with borders and alignment  |
| Fenced code blocks                | Must render with syntax highlighting    |
| GFM callouts `[!NOTE]`            | Must parse and render as callout blocks |
| KaTeX math `$` and `$$`           | Must render as math expressions         |
| Mermaid code blocks               | Must render as diagrams                 |
| PlantUML code blocks              | Must render as diagrams (if enabled)    |
| `*Caption*` after images          | Must render as figcaption               |
| Horizontal rules `---`            | Must render as thematic break           |
| Blockquotes `>`                   | Must render with left border            |

### 23.2 Known Incompatibilities

The following constructs are NOT supported by the Reader:

| Construct                      | Fallback                                 |
| ------------------------------ | ---------------------------------------- |
| HTML `<div>` or `<span>` tags  | Stripped by sanitizer                    |
| HTML `<table>` tags (raw HTML) | Stripped; use markdown tables            |
| JavaScript in markdown         | Stripped by sanitizer                    |
| Custom CSS in markdown         | Stripped                                 |
| Base64-encoded images          | Stripped (too large for browser storage) |
| Data URIs for images           | Stripped                                 |
| Relative image paths           | Broken; use absolute URLs                |
| Image URLs to localhost        | Broken                                   |

---

## 24. PDF Export Rules

### 24.1 Print Requirements

The generated document must support print-quality PDF export. The following elements must survive PDF conversion:

| Element             | PDF Requirement                                   |
| ------------------- | ------------------------------------------------- |
| All headings        | Convert to PDF bookmarks                          |
| Table of contents   | Generate as clickable PDF TOC                     |
| Syntax highlighting | Preserve in code blocks (using preformatted text) |
| Diagrams            | Rasterize Mermaid SVGs to inline PNG              |
| Images              | Preserve at original resolution (max 300 DPI)     |
| Callouts            | Render as colored boxes (no icons)                |
| Tables              | Paginate with header row repetition               |
| Inline code         | Preserve with monospace font                      |
| Math (KaTeX)        | Rasterize to inline SVG                           |
| Internal links      | Convert to PDF internal links                     |
| External links      | Convert to clickable PDF external links           |

### 24.2 PDF Layout Rules

| Rule | Description                                                       |
| ---- | ----------------------------------------------------------------- |
| PDF1 | Page size: A4 (210mm × 297mm)                                     |
| PDF2 | Margins: 20mm all sides                                           |
| PDF3 | Font: embed Inter and IBM Plex Mono                               |
| PDF4 | Page numbers: bottom center                                       |
| PDF5 | Headers: section title on even pages, document title on odd pages |
| PDF6 | Widow/orphan control: minimum 2 lines at page breaks              |
| PDF7 | Code blocks should have a light gray background                   |
| PDF8 | Callouts should have a left border (2pt) with muted background    |

### 24.3 PDF Generation Pipeline

```
Document content
       │
       ▼
Render to HTML (Reader styles)
       │
       ▼
Convert to PDF via CDP (chrome.debugger API)
       │
       ▼
Inject PDF metadata (title, author, subject)
       │
       ▼
Generate PDF bookmarks from TOC
```

---

## 25. Accessibility Rules

### 25.1 Semantic HTML Requirements

When rendered by the Reader, the following accessibility properties are applied (these are Reader-side, not model-side):

| Element         | ARIA / Semantic                                       |
| --------------- | ----------------------------------------------------- |
| Article content | `role="main"`, `aria-label="Document content"`        |
| Navigation      | `role="navigation"`, `aria-label="Document sections"` |
| Headings        | Proper `h1`–`h6` hierarchy                            |
| Images          | `alt` text from markdown                              |
| Code blocks     | `aria-label` with language                            |
| Tables          | `<th>` elements for headers                           |
| Callouts        | `role="alert"`                                        |
| Links           | Descriptive text (never "click here")                 |
| Skip link       | Skip to content link at top                           |

### 25.2 Color and Contrast

All renders must respect the theme system defined in `tokens.css`:

- Light mode: ink (#1d1d1f) on canvas (#ffffff)
- Dark mode: ink (#f5f5f7) on canvas (#272729)
- All callout colors must meet WCAG AA contrast ratios
- Link colors: #0075de (light), #2997ff (dark)

### 25.3 Reduced Motion

When `prefers-reduced-motion: reduce` is set:

- All animations must be disabled
- Spring animations fall back to instant transitions
- Scroll animations fall back to instant scroll
- Page transitions fall back to instant display

### 25.4 Screen Reader Support

| Feature          | Implementation                           |
| ---------------- | ---------------------------------------- |
| Navigation Rail  | `aria-label="Document sections"`         |
| Current section  | `aria-current="true"` on active TOC item |
| Scroll progress  | `role="scrollbar"`, `aria-valuenow`      |
| Code copy button | `aria-label="Copy code"`                 |
| Images           | `alt` text from markdown `![alt]`        |
| Callouts         | `role="alert"`                           |

---

## 26. Performance Rules

### 26.1 Document Size Limits

| Metric            | Maximum | Action                                |
| ----------------- | ------- | ------------------------------------- |
| Total paragraphs  | 5,000   | Virtualize rendering                  |
| Total headings    | 1,000   | Truncate TOC at 4 levels              |
| Total code blocks | 500     | Lazy render below-fold                |
| Total images      | 200     | Lazy load with IntersectionObserver   |
| Total diagrams    | 100     | Lazy render with IntersectionObserver |
| Total tables      | 100     | Render on demand                      |
| Total words       | 500,000 | Chunk rendering                       |
| Markdown size     | 10 MB   | Warn user                             |

### 26.2 Rendering Performance Targets

| Metric              | Target                     |
| ------------------- | -------------------------- |
| Initial render      | < 500ms                    |
| Scroll response     | < 16ms (60fps)             |
| Heading detection   | < 50ms                     |
| TOC build           | < 200ms                    |
| Code highlighting   | < 100ms per block          |
| Mermaid render      | < 2000ms per diagram       |
| Full document parse | < 3000ms for 100,000 words |

### 26.3 Optimization Strategies

| Strategy                         | Applied To                                             |
| -------------------------------- | ------------------------------------------------------ |
| React.memo()                     | All block renderers (CodeBlock, HeadingRenderer, etc.) |
| useMemo()                        | Markdown parsing, TOC building, figure numbering       |
| IntersectionObserver             | Active section detection, lazy image loading           |
| requestAnimationFrame throttling | Scroll progress tracking                               |
| SVG caching                      | Mermaid diagram output                                 |
| Lazy import                      | Mermaid library (dynamic import)                       |
| Virtualization                   | Document lists (not document content)                  |

---

## 27. Validation Rules

### 27.1 Structural Validation

A generated document MUST pass the following structural checks:

| ID  | Check                                                     | Severity |
| --- | --------------------------------------------------------- | -------- |
| S1  | Document is not empty                                     | Critical |
| S2  | Document is valid markdown (parseable by marked)          | Critical |
| S3  | Document contains at least one H2 heading                 | Major    |
| S4  | No duplicate heading IDs                                  | Major    |
| S5  | Heading hierarchy does not skip levels                    | Major    |
| S6  | No orphaned list items (list must start with `-` or `1.`) | Major    |
| S7  | All code fences are closed (matching count of ```)        | Critical |
| S8  | All semantic blocks are closed (matching count of `:::`)  | Major    |
| S9  | All tables have the same column count in header and body  | Major    |
| S10 | No raw HTML tags (except KaTeX output)                    | Minor    |

### 27.2 Semantic Validation

| ID  | Check                                                        | Severity |
| --- | ------------------------------------------------------------ | -------- |
| SM1 | Callout types are from the approved list                     | Major    |
| SM2 | No nested callouts                                           | Major    |
| SM3 | Diagram language identifiers are valid                       | Minor    |
| SM4 | Code block language identifiers are from the normalized list | Minor    |
| SM5 | Callout content does not contain headings                    | Major    |
| SM6 | No forbidden patterns (see §8.2)                             | Minor    |

### 27.3 Content Validation

| ID  | Check                                                           | Severity |
| --- | --------------------------------------------------------------- | -------- |
| C1  | Document word count is within expected range (min 50, max 500k) | Major    |
| C2  | Average paragraph length is 30–120 words                        | Minor    |
| C3  | Number of callouts does not exceed paragraphs/3                 | Minor    |
| C4  | No empty sections (heading with no content)                     | Major    |
| C5  | All images have alt text                                        | Minor    |
| C6  | All links resolve (syntax check, not HTTP check)                | Minor    |

### 27.4 Validation Pipeline

```
Generated Markdown String
       │
       ▼
┌────────────────────────────────────────────┐
│  Step 1: Parse Validity                     │
│  - Can marked.lexer() parse without error?  │
│  - Are all fences closed?                   │
│  - Is the document non-empty?               │
└────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│  Step 2: Structural Validation             │
│  - Heading hierarchy check                 │
│  - Duplicate heading check                 │
│  - Block completeness check                │
│  - Table structure check                   │
└────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│  Step 3: Semantic Validation               │
│  - Callout type validation                 │
│  - Language identifier normalization       │
│  - Forbidden pattern detection             │
└────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│  Step 4: Content Quality Validation        │
│  - Word count range                        │
│  - Empty sections                          │
│  - Image alt text                          │
└────────────────────────────────────────────┘
       │
       ▼
       Pass/Fail with detailed report
```

### 27.5 Validation Response Format

```json
{
  "valid": true,
  "warnings": [],
  "errors": [],
  "stats": {
    "headings": 12,
    "paragraphs": 47,
    "codeBlocks": 5,
    "diagrams": 2,
    "callouts": 3,
    "tables": 1,
    "images": 2,
    "wordCount": 3840
  }
}
```

---

## 28. Consistency Rules

### 28.1 Model-Agnostic Output Consistency

The following aspects of the document MUST be identical across all supported models for the same input:

| Aspect                  | Target                                        | Enforcement                   |
| ----------------------- | --------------------------------------------- | ----------------------------- |
| Heading hierarchy       | Same H2/H3/H4 distribution                    | Post-processing normalization |
| Section ordering        | Same top-level section order                  | Prompt structure enforcement  |
| Block type distribution | Same count of diagrams, callouts, tables      | Validation                    |
| Callout type usage      | Same callout types for same semantic triggers | Prompt enforcement            |
| Language identifiers    | Normalized to canonical form                  | Post-processing               |
| Paragraph structure     | Same number of paragraphs per section         | Validation range              |
| Tone and voice          | Consistently technical, third-person          | System prompt                 |

### 28.2 Normalization Pipeline

To ensure cross-model consistency, the following normalizations are applied during post-processing:

1. Language identifiers mapped to canonical form (§13.4)
2. Semantic block syntax normalized (both `:::` and `[!TYPE]` converted to internal AST)
3. Heading IDs regenerated by the parser (model-generated IDs discarded)
4. Section numbers reassigned (model-generated numbers discarded)
5. Callout types validated against approved list (§17.3)
6. Forbidden patterns removed (§8.2)

### 28.3 Model-Specific Prompt Variations

While the system prompt template is standardized, different models may require:

| Model    | Adjustment                                                            |
| -------- | --------------------------------------------------------------------- |
| Claude   | Minimal prompting needed; strong structural adherence                 |
| GPT-4o   | Explicit output structure examples required                           |
| Gemini   | Function-calling wrapper for structured output                        |
| Llama    | More explicit formatting instructions, chain-of-thought for structure |
| DeepSeek | Reinforcement of heading hierarchy rules                              |

All adjustments must be documented in the provider-specific prompt template, not in this specification.

---

## 29. Output Contract

### 29.1 Document Structure Contract

The generated document MUST conform to this structure:

```
┌──────────────────────────────────────────┐
│ H1: Document Title (system-provided)     │  ← System prepends this
├──────────────────────────────────────────┤
│ Metadata block (domain, word count, etc) │  ← Reader adds this
├──────────────────────────────────────────┤
│ §1: Introduction / Overview (H2)         │  ← Model begins here
│   Paragraph 1: Context                   │
│   Paragraph 2: Problem statement         │
│   [Optional diagram]                     │
│   Paragraph 3: Solution overview         │
├──────────────────────────────────────────┤
│ §2: [Major Section] (H2)                │
│   Paragraph 1: Topic introduction        │
│   §2.1: [Subsection] (H3)               │
│     Paragraphs 2-3                       │
│     [Optional code block]                │
│   §2.2: [Subsection] (H3)               │
│     Paragraphs 4-5                       │
│     [Optional table]                     │
│   [Optional callout]                     │
├──────────────────────────────────────────┤
│ §3: [Major Section] (H2)                │
│   ...                                    │
├──────────────────────────────────────────┤
│ §N: Conclusion (H2, optional)            │
│   1-3 summary paragraphs                 │
├──────────────────────────────────────────┤
│ References / Footnotes                   │
└──────────────────────────────────────────┘
```

### 29.2 Required Top-Level Sections

Every document MUST include at minimum:

| Section      | H2 Title                           | Required?   |
| ------------ | ---------------------------------- | ----------- |
| Introduction | `## Introduction` or `## Overview` | Always      |
| Body         | Document-type dependent            | Always      |
| Conclusion   | `## Conclusion`                    | Recommended |

### 29.3 Optional Sections by Document Class

| Document Class | Suggested Sections                                                   |
| -------------- | -------------------------------------------------------------------- |
| research-paper | Abstract, Methodology, Results, Discussion, Related Work, Conclusion |
| tutorial       | Prerequisites, Step-by-Step, Troubleshooting, Next Steps             |
| news           | Summary, Context, Details, Analysis, Impact                          |
| general        | Introduction, [topic sections], Conclusion                           |

### 29.4 Output Format Contract

The model MUST return a plain text string containing the generated markdown. The return format is:

```
Content-Type: text/markdown
Encoding: UTF-8

[Generated markdown content]
```

No JSON wrapping, no code fences around the output, no additional metadata.

### 29.5 Output Size Contract

| Mode     | Target Size        | Maximum      |
| -------- | ------------------ | ------------ |
| FAST     | 500–1,500 words    | 4,000 words  |
| BALANCED | 1,500–5,000 words  | 16,000 words |
| DEEP     | 5,000–20,000 words | 64,000 words |

---

## 30. Future Extension Points

### 30.1 Versioning

This specification uses semantic versioning: MAJOR.MINOR.PATCH

- **MAJOR**: Breaking changes to the block schema, rendering requirements, or validation rules
- **MINOR**: New block types, diagram formats, or optional features
- **PATCH**: Clarifications, corrections, or non-substantive changes

### 30.2 Extension Mechanisms

| Extension Point            | Mechanism        | Version Impact |
| -------------------------- | ---------------- | -------------- |
| New semantic block types   | Add to §11       | Minor          |
| New diagram types          | Add to §12       | Minor          |
| New language identifiers   | Add to §13.2     | Patch          |
| New callout types          | Add to §17.3     | Minor          |
| New validation rules       | Add to §27       | Minor          |
| Breaking parser changes    | Revise AST types | Major          |
| New output contract fields | Add to §29       | Minor          |

### 30.3 Planned Extensions

| Feature                               | Target Section | Description                             |
| ------------------------------------- | -------------- | --------------------------------------- |
| Interactive diagrams                  | §12            | Clickable, zoomable SVG diagrams        |
| Document diffing                      | §27            | Compare two document versions           |
| AI-generated glossaries               | §11            | Auto-extracted term definitions         |
| Hierarchical TOC with expand/collapse | §22            | TOC with collapsible sub-sections       |
| Multi-language code blocks            | §13            | Side-by-side language comparison        |
| Automated document scoring            | §27            | Quality score based on spec compliance  |
| Custom semantic block types           | §11            | User-defined block types via plugin API |
| Mermaid accessibility                 | §12            | ARIA labels on diagram SVGs             |

### 30.4 Deprecation Policy

- Features are deprecated with MINOR version bump
- Deprecated features are removed with the next MAJOR version
- Deprecation notice must include migration path
- Minimum deprecation period: 6 months

---

## Appendix A: Example Documents

### A.1 Minimal Valid Document

````markdown
## Introduction

REST (Representational State Transfer) is an architectural style for distributed
hypermedia systems. Defined by Roy Fielding in 2000, it provides a set of
constraints for designing scalable web services.

### Core Principles

REST APIs are stateless. Each request from a client contains all information
needed for the server to process it. This enables horizontal scaling without
session synchronization overhead.

```http
GET /api/users/42 HTTP/1.1
Accept: application/json
```
````

> REST is not a protocol. It is an architectural style.

### Resource Orientation

Resources are the key abstraction in REST. Each resource is identified by a
URI and manipulated through standard HTTP methods.

| Method | Action   | Idempotent |
| ------ | -------- | ---------- |
| GET    | Retrieve | Yes        |
| POST   | Create   | No         |
| PUT    | Replace  | Yes        |
| DELETE | Remove   | Yes        |

## Conclusion

REST remains the dominant API architecture for web services due to its
simplicity, scalability, and alignment with HTTP semantics.

```

### A.2 Valid Document with All Block Types

See `docs/examples/complete-document.md` for a full example.

---

## Appendix B: Recommended Libraries

### B.1 Parser and Transformation

| Library | Version | Usage |
|---------|---------|-------|
| `marked` | ≥15.x | Markdown lexer and parser |
| `dompurify` | ≥3.x | HTML sanitization |
| `katex` | ≥0.16.x | Math rendering |
| `lowlight` | ≥3.x | Code syntax highlighting |
| `rehype-*` | ecosystem | HTML transformation (future) |
| `unified` | ecosystem | Content pipeline orchestration (future) |

### B.2 Diagram Rendering

| Library | Version | Usage |
|---------|---------|-------|
| `mermaid` | ≥11.x | Diagram rendering |
| `plantuml-encoder` | ≥1.4.x | PlantUML URL encoding |
| `d2` (CLI) | latest | Future D2 support |

### B.3 Validation

| Library | Version | Usage |
|---------|---------|-------|
| Custom validator | — | Structure, hierarchy, block validation |
| `marked` lexer | ≥15.x | Parse validity check |

### B.4 Testing

| Library | Version | Usage |
|---------|---------|-------|
| `vitest` | ≥4.x | Test runner |
| `fast-check` | ≥4.x | Property-based testing |
| Custom test fixtures | — | Document corpus for regression |

### B.5 Rendering

| Library | Version | Usage |
|---------|---------|-------|
| `react` | ≥19.x | Component rendering |
| `motion` | ≥12.x | Animations and transitions |
| `tailwindcss` | ≥4.x | Styling |
| `@tailwindcss/typography` | ≥0.5.x | Prose styling |

---

*End of Notch Document Generation Specification v1.0.0*
```
