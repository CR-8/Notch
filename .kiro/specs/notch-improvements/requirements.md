# Requirements Document

## Introduction

Notch is a personal knowledge capture and reading application. This document covers 12 improvements
spanning stability, UX, prompt quality, and reader polish — organized by priority (P0 → P1 → P2).
The improvements address markdown rendering reliability, build health, folder organization, color
coding, library density controls, error states, prompt quality and acceleration, query rewriting,
reader modes, annotations, and export quality.

---

## Glossary

- **Notch**: The application being improved.
- **Reader**: The in-app view that renders captured documents as formatted content.
- **Markdown_Parser**: The component responsible for converting raw markdown text into an internal document model.
- **Renderer**: The component responsible for converting the internal document model into a visual representation (TipTap or fallback).
- **Fallback_Renderer**: A simplified renderer activated when the primary Renderer fails to process a block.
- **Library**: The main document browsing view listing all captured documents.
- **Folder**: A named container that groups one or more documents within the Library.
- **Document**: A single captured item stored in Notch, consisting of content, metadata, and optional annotations.
- **Tag**: A user-defined label attached to one or more Documents.
- **Color_Label**: A user-selectable color accent associated with a Folder or Tag.
- **View_Mode**: A Library display density setting (compact, comfortable, or detailed).
- **Prompt_Template**: A versioned, structured instruction sent to the language model for a specific capture mode (FAST, BALANCED, DEEP).
- **Schema_Validator**: The component that checks model output against the expected output contract.
- **Cache**: The content-addressed store that maps a hash of input content to previously computed model output.
- **Query_Rewriter**: The component that expands and enriches a user's retrieval query before it is sent to the vector store.
- **Annotation**: A highlight or note saved by the user, anchored to a specific paragraph ID within a Document.
- **Paragraph_ID**: A stable identifier assigned to each paragraph in a Document, used to anchor Annotations.
- **Export_Package**: A zip archive containing one or more Documents in a specified format (markdown or PDF).
- **CI**: Continuous integration pipeline that runs compile, build, and test checks on every pull request.
- **Capture**: The process of ingesting a source (URL, file, paste) and generating structured output (summary, entities, concepts).

---

## Requirements

<!-- ============================================================ -->
<!-- P0 — STABILITY & CORE EXPERIENCE                            -->
<!-- ============================================================ -->

### Requirement 1: Markdown Rendering Reliability

**User Story:** As a reader, I want captured documents to render consistently and correctly, so that
I can trust the reading experience regardless of the complexity of the source content.

#### Acceptance Criteria

1. WHEN the Markdown_Parser receives a valid markdown string, THE Markdown_Parser SHALL produce an
   internal document model without throwing an exception.

2. WHEN the Markdown_Parser receives a malformed markdown string (e.g., unclosed fences, broken
   table rows, deeply nested lists), THE Markdown_Parser SHALL produce a best-effort internal
   document model and attach a structured parse-warning list to the result.

3. WHEN the Renderer encounters a block type it cannot render, THE Renderer SHALL delegate that
   block to the Fallback_Renderer and continue rendering the remaining blocks.

4. WHEN the Fallback_Renderer is activated for a block, THE Fallback_Renderer SHALL render the
   block as pre-formatted plain text, preserving the raw content.

5. THE Renderer SHALL render nested lists up to 6 levels of nesting without visual corruption.

6. THE Renderer SHALL render fenced code blocks with the language identifier preserved in the
   output DOM.

7. THE Renderer SHALL render markdown tables with correct column alignment (left, center, right)
   as specified in the source markdown.

8. FOR ALL valid markdown strings M, parsing M and then serializing the resulting document model
   back to markdown and parsing again SHALL produce a document model structurally equivalent to
   the first parse result (round-trip property).

9. THE Notch application SHALL include a regression fixture suite covering: long documents
   (>10,000 characters), nested lists (>3 levels), tables with merged alignment, mixed code
   fences, and malformed markdown inputs.

---

### Requirement 2: End-to-End Compile and Build Health

**User Story:** As a developer, I want the compile, build, and test pipeline to be consistently
green, so that I can iterate quickly and release with confidence.

#### Acceptance Criteria

1. THE CI SHALL execute compile, build, and test checks on every pull request targeting the main
   branch.

2. WHEN a pull request introduces a TypeScript type error, THE CI SHALL fail the compile check and
   block the merge.

3. WHEN a pull request introduces a failing test, THE CI SHALL fail the test check and block the
   merge.

4. WHEN all CI checks pass, THE CI SHALL report a green status on the pull request within 10
   minutes of the last commit.

5. THE Notch repository SHALL contain a RELEASE_CHECKLIST.md file that lists all pass criteria
   required before a production release, including: compile clean, build successful, all tests
   passing, and no unresolved P0 issues.

---

<!-- ============================================================ -->
<!-- P1 — PRODUCT UX IMPROVEMENTS                                -->
<!-- ============================================================ -->

### Requirement 3: Folder Structure for Document Organization

**User Story:** As a power user, I want to organize my documents into folders, so that I can
manage a large library without it becoming noisy and hard to navigate.

#### Acceptance Criteria

1. WHEN a user submits a valid folder name, THE Library SHALL create a new Folder with that name
   and make it immediately visible in the folder list.

2. WHEN a user renames a Folder, THE Library SHALL update the Folder name across all views within
   500ms of confirmation.

3. WHEN a user deletes a Folder that contains Documents, THE Library SHALL prompt the user to
   confirm the action and specify a destination for the contained Documents before deletion
   proceeds.

4. WHEN a user deletes an empty Folder, THE Library SHALL remove the Folder immediately without
   a confirmation prompt.

5. WHEN a user moves a Document to a Folder (via drag-and-drop or move-to-folder action), THE
   Library SHALL update the Document's folder association and reflect the change in both the
   source and destination folder views within 500ms.

6. WHEN a user selects a Folder in the Library filter, THE Library SHALL display only Documents
   belonging to that Folder.

7. WHEN a user initiates a folder export, THE Library SHALL produce an Export_Package containing
   all Documents in the selected Folder in the user's chosen format (markdown zip or PDF zip).

8. FOR ALL sequences of create-folder, move-document, and delete-folder operations, THE total
   Document count across all Folders and the unorganized root SHALL equal the total Document
   count before the sequence began (document count invariant).

9. FOR ALL valid Folder names F, creating a Folder with name F and then deleting it SHALL leave
   the Library in a state identical to before the Folder was created (round-trip property).

---

### Requirement 4: Color Coding System

**User Story:** As a user, I want to assign color labels to folders and tags, so that I can
visually parse and retrieve related content faster when scanning the Library.

#### Acceptance Criteria

1. WHEN a user selects a color from the color palette for a Folder, THE Library SHALL persist the
   Color_Label association and display the color accent on that Folder in all Library views.

2. WHEN a user selects a color from the color palette for a Tag, THE Library SHALL persist the
   Color_Label association and display the color accent on that Tag wherever it appears.

3. THE color palette SHALL offer at least 8 distinct, accessible colors (meeting WCAG 3:1
   contrast ratio against both light and dark backgrounds).

4. THE Library SHALL display a color legend that maps each active Color_Label to its associated
   Folder or Tag name.

5. WHERE the Reader breadcrumb feature is enabled, THE Reader SHALL display the Color_Label
   accent of the Document's parent Folder in the breadcrumb trail.

6. WHERE the chat context pill feature is enabled, THE Chat SHALL display the Color_Label accent
   of the source Document's Folder on the context pill.

7. WHEN a user removes a Color_Label from a Folder or Tag, THE Library SHALL revert all
   associated UI accents to the default neutral color within 500ms.

---

### Requirement 5: Library Information Density Controls

**User Story:** As a user, I want to switch between compact, comfortable, and detailed view modes
in the Library, so that I can optimize my browsing experience for my current task and screen size.

#### Acceptance Criteria

1. THE Library SHALL provide three View_Modes: compact, comfortable, and detailed.

2. WHEN a user selects a View_Mode, THE Library SHALL re-render the document list in the selected
   mode within 300ms.

3. WHILE the compact View_Mode is active, THE Library SHALL display each Document as a single
   line showing only the title and capture date.

4. WHILE the comfortable View_Mode is active, THE Library SHALL display each Document with title,
   capture date, and a summary preview of up to 2 lines.

5. WHILE the detailed View_Mode is active, THE Library SHALL display each Document with title,
   capture date, full summary preview, tags, folder, and word count.

6. THE Library SHALL persist the user's selected View_Mode across sessions.

7. FOR ALL View_Modes, THE Library SHALL display the same set of Documents (document set
   invariant — only presentation changes, not content).

---

### Requirement 6: Better Empty and Error States

**User Story:** As a user, I want clear, actionable messages when something is missing or broken,
so that I can recover quickly without dropping off or feeling confused.

#### Acceptance Criteria

1. WHEN the Library contains no Documents and no API key is configured, THE Library SHALL display
   the message "No API key set" with a direct link to the Settings screen.

2. WHEN a Document has no embeddings generated, THE Reader SHALL display the message "No
   embeddings yet" with a button that triggers embedding generation for that Document.

3. WHEN the Markdown_Parser fails to produce a renderable document model for a Document, THE
   Reader SHALL display the message "Reader parse failed" with a button that opens the raw
   markdown view for that Document.

4. WHEN the Library is filtered by a Folder that contains no Documents, THE Library SHALL display
   the message "This folder is empty" with a button to add a Document to that Folder.

5. WHEN a network request fails during Capture, THE Notch application SHALL display a specific
   error message identifying the failed operation and offer a retry action.

6. IF an error state message is displayed, THEN THE Notch application SHALL provide at least one
   actionable next step (link, button, or inline action) alongside the message.

---

<!-- ============================================================ -->
<!-- P1 — PROMPT QUALITY & ACCELERATION                          -->
<!-- ============================================================ -->

### Requirement 7: Prompt Quality and Capture Consistency

**User Story:** As a user, I want capture outputs (summaries, entities, concepts) to be
consistently structured and predictable, so that I can rely on the output format across all
documents.

#### Acceptance Criteria

1. THE Notch application SHALL maintain versioned Prompt_Templates for each capture mode: FAST,
   BALANCED, and DEEP.

2. WHEN a Prompt_Template is updated, THE Notch application SHALL assign a new version identifier
   to the updated template and retain the previous version for rollback.

3. WHEN the language model returns output for a Capture, THE Schema_Validator SHALL validate the
   output against the expected schema for the active Prompt_Template version.

4. WHEN the Schema_Validator detects a schema violation, THE Notch application SHALL retry the
   Capture with a correction prompt that includes the violation details, up to 2 retry attempts.

5. WHEN all retry attempts are exhausted and the output still fails schema validation, THE Notch
   application SHALL store the raw model output and mark the Document with a "schema-invalid"
   status visible to the user.

6. FOR ALL valid Document inputs D and a given Prompt_Template version V, THE Schema_Validator
   SHALL return the same validation result when applied to the same model output O (determinism
   invariant).

7. FOR ALL model outputs that conform to the schema, THE Schema_Validator SHALL return a passing
   result (no false negatives).

---

### Requirement 8: Prompt Acceleration — Latency and Cost Reduction

**User Story:** As a user, I want capture and chat responses to feel fast and not incur
unnecessary token costs, so that I can work efficiently even with large documents.

#### Acceptance Criteria

1. WHEN a Capture is initiated, THE Notch application SHALL execute Stage 1 (fast draft summary)
   first and display the draft result to the user before Stage 2 enrichment begins.

2. WHEN Stage 1 completes, THE Notch application SHALL enrich only the sections selected or
   flagged for deep processing in Stage 2.

3. WHEN a Document's content has not changed since the last Capture, THE Cache SHALL return the
   previously computed output without invoking the language model.

4. THE Cache SHALL use a deterministic hash of the Document's content as the cache key.

5. FOR ALL Document content strings C, hash(C) SHALL return the same value on every invocation
   (hash stability property).

6. FOR ALL Document content strings C where a cached result exists, THE Cache SHALL return the
   cached result on the second lookup without invoking the language model (idempotence of cache
   lookup).

7. WHEN constructing a chat prompt, THE Notch application SHALL limit the retrieval context to a
   configurable token budget (default: 4,000 tokens) and truncate lower-relevance chunks first.

---

### Requirement 9: Query Rewriting for Better RAG Answers

**User Story:** As a user, I want my retrieval queries to be automatically improved before
searching, so that I get better answers and citations without needing to craft precise queries
myself.

#### Acceptance Criteria

1. WHEN a user submits a chat query, THE Query_Rewriter SHALL expand abbreviations and implied
   terms in the query before passing it to the vector store.

2. WHEN a user submits a chat query, THE Query_Rewriter SHALL attach an intent hint (one of:
   definition, timeline, comparison, action) to the rewritten query.

3. WHEN the Query_Rewriter produces a rewritten query, THE Notch application SHALL use the
   rewritten query — not the original — for vector store retrieval.

4. FOR ALL user queries Q, the set of documents retrieved using the rewritten form of Q SHALL be
   a superset of or equal to the set retrieved using Q directly (metamorphic retrieval property).

5. FOR ALL user queries Q that contain no abbreviations or implied terms, THE Query_Rewriter
   SHALL return a query semantically equivalent to Q (stability under no-op rewrite).

6. WHEN the Query_Rewriter fails to produce a rewritten query within 2 seconds, THE Notch
   application SHALL fall back to using the original query for retrieval and log the timeout.

---

<!-- ============================================================ -->
<!-- P2 — READER & INTERACTION POLISH                            -->
<!-- ============================================================ -->

### Requirement 10: Reader Modes

**User Story:** As a reader, I want to switch between reading mode, focus mode, and compare mode,
so that I can adapt the reading experience to different tasks such as casual reading, deep focus,
or side-by-side comparison.

#### Acceptance Criteria

1. THE Reader SHALL provide three modes: reading mode, focus mode, and compare mode.

2. WHEN a user activates focus mode, THE Reader SHALL hide all navigation chrome, sidebars, and
   metadata panels, displaying only the document content.

3. WHEN a user activates compare mode and selects two Documents, THE Reader SHALL display both
   Documents side-by-side in a split view.

4. WHEN a user switches between Reader modes, THE Reader SHALL preserve the user's scroll
   position within the active Document.

5. FOR ALL Reader mode switches, THE Document content displayed SHALL be identical to the content
   displayed in the default reading mode (content invariant — only chrome changes, not content).

6. THE Reader SHALL persist the user's last-used Reader mode across sessions.

---

### Requirement 11: Annotation Layer

**User Story:** As a reader, I want to save highlights and notes anchored to specific paragraphs,
so that I can accumulate personal knowledge beyond what the chat output provides.

#### Acceptance Criteria

1. WHEN a user selects a text range within a Document and chooses "Highlight", THE Annotation
   layer SHALL save an Annotation anchored to the Paragraph_ID of the containing paragraph,
   storing the selected text range offsets.

2. WHEN a user adds a note to an Annotation, THE Annotation layer SHALL persist the note text
   alongside the Annotation.

3. WHEN a Document is re-rendered, THE Reader SHALL restore all Annotations at their correct
   paragraph positions using the stored Paragraph_ID values.

4. WHEN a paragraph is deleted from a Document, THE Notch application SHALL mark any Annotations
   anchored to that Paragraph_ID as orphaned and display them in a separate "Orphaned Annotations"
   panel.

5. FOR ALL Annotations A saved by the user, retrieving A by its identifier SHALL return the
   original text range, note text, and Paragraph_ID without data loss (round-trip save/retrieve
   property).

6. FOR ALL Documents D with N annotations, re-rendering D SHALL result in exactly N annotations
   being restored (annotation count invariant, excluding orphaned annotations).

---

### Requirement 12: Export Quality Upgrade

**User Story:** As a user, I want to export documents as clean, high-fidelity markdown or PDF
files, so that I can share and archive my captured knowledge in a professional format.

#### Acceptance Criteria

1. WHEN a user exports a Document as markdown, THE Notch application SHALL produce a markdown
   file that preserves all headings, lists, code blocks, tables, and inline formatting from the
   Document.

2. WHEN a user exports a Document as PDF, THE Notch application SHALL apply a clean printable
   theme with consistent typography, page margins, and syntax-highlighted code blocks.

3. WHEN a user exports a Folder as an Export_Package, THE Notch application SHALL produce a zip
   archive containing one file per Document in the selected format, with filenames derived from
   Document titles.

4. FOR ALL Documents D exported to markdown and re-imported into Notch, THE resulting Document
   SHALL have the same heading structure, list structure, and code block content as D (markdown
   round-trip property).

5. WHEN a Document contains Annotations, THE Notch application SHALL include the Annotations as
   inline comments in the markdown export and as margin notes in the PDF export.

6. THE PDF export SHALL produce a file where all text content is selectable and searchable
   (no image-only rendering).
