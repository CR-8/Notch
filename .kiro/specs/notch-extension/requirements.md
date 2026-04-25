# Requirements Document

## Introduction

Notch is a browser extension that captures, structures, and interrogates web content using a Bring-Your-Own-Key (BYOK) AI architecture. It transforms ephemeral articles, documentation, and AI chat threads into permanent, structured knowledge stored entirely on the client — no backend, no authentication, no sign-up. The extension targets developers, students, and researchers who value data ownership and high-information-density interfaces.

The system is built on WXT + React + Tailwind v4 + shadcn, targeting Chrome (and compatible Chromium browsers). Storage uses Chrome `storage.local` and IndexedDB. AI processing uses user-supplied API keys (initially Google Gemini, expandable to OpenAI and Anthropic).

---

## Glossary

- **Extension**: The Notch browser extension as a whole.
- **Popup**: The 320×480px capture interface rendered when the user clicks the extension icon.
- **Library**: The full-tab dashboard listing all captured documents.
- **Reader**: The full-tab dual-pane view for reading a captured document alongside its AI-generated notes.
- **RAG_Chat**: The conversational pane that replaces the notes sidebar in the Reader, allowing the user to query a document using retrieval-augmented generation.
- **Capture_Engine**: The subsystem responsible for scraping the active tab's DOM and sending it to the AI model.
- **AI_Client**: The subsystem that communicates with external LLM APIs (Gemini, OpenAI, Anthropic) using user-supplied keys.
- **Document**: A structured markdown artifact produced by the Capture_Engine from a web page.
- **Embedding_Engine**: The subsystem that generates local vector embeddings for document chunks and stores them in IndexedDB.
- **Storage_Layer**: The abstraction over Chrome `storage.local` and IndexedDB used to persist Documents, embeddings, and settings.
- **Settings**: The full-tab configuration screen for API keys and generation mode preferences.
- **Generation_Mode**: One of three capture strategies — FAST, DEEP, or LOCAL — that determines which model and prompt depth is used.
- **BYOK**: Bring Your Own Key — the user supplies their own LLM API key; no key is bundled with the Extension.
- **Mermaid_Renderer**: The subsystem that converts ASCII art or described flowcharts into Mermaid.js syntax and renders them in the Reader.
- **UML_Renderer**: The subsystem that converts software architecture descriptions into PlantUML diagrams and renders them in the Reader.
- **Fuzzy_Search**: The client-side full-text search subsystem that matches queries against document titles, tags, and body content.
- **Tag**: A user-defined label attached to a Document at capture time or edited later.
- **Citation**: A numbered reference in a RAG_Chat response that links back to a source paragraph in the original document.

---

## Requirements

### Requirement 1: API Key Configuration

**User Story:** As a developer, I want to paste my own LLM API key into the Extension, so that I can use AI features without sharing credentials with any third party.

#### Acceptance Criteria

1. THE Settings SHALL provide a password-type input field for each supported provider (Gemini, OpenAI, Anthropic).
2. WHEN the user pastes a key into a provider input, THE Settings SHALL validate the key format against the provider's known pattern within 500ms.
3. WHEN a key passes format validation, THE Settings SHALL display a `[VERIFIED]` indicator in the primary violet color (`#5E6AD2`).
4. WHEN a key fails format validation, THE Settings SHALL display an `[INVALID]` indicator in the danger color (`#FF3366`).
5. WHEN the user clicks `[SAVE SETTINGS]`, THE Storage_Layer SHALL persist all API keys to Chrome `storage.local` using the browser's encrypted storage.
6. THE Settings SHALL never transmit API keys to any server other than the respective LLM provider's official API endpoint.
7. WHEN the Extension is opened on a new device or after storage is cleared, THE Settings SHALL display all key inputs as empty with no pre-filled values.
8. THE Popup SHALL display a status indicator for each configured provider, showing violet (`#5E6AD2`) when a key is present and danger red (`#FF3366`) when absent.

---

### Requirement 2: Page Capture

**User Story:** As a user, I want to capture the current browser tab's content with one click, so that I can convert it into a structured document without leaving my workflow.

#### Acceptance Criteria

1. WHEN the user clicks `[CAPTURE PAGE]` in the Popup, THE Capture_Engine SHALL extract the full DOM text content, images, and structural metadata from the active tab.
2. WHEN the Capture_Engine completes DOM extraction, THE AI_Client SHALL send the extracted content to the selected provider's API using the stored key and the active Generation_Mode prompt template.
3. WHILE the AI_Client is awaiting a response, THE Popup SHALL display a `[PARSING...]` loading state with a pulsing opacity animation on the capture button.
4. WHEN the AI_Client receives a successful response, THE Capture_Engine SHALL parse the response into a Document with structured markdown.
5. WHEN a Document is successfully created, THE Storage_Layer SHALL persist the Document to Chrome `storage.local` and IndexedDB.
6. WHEN a Document is successfully persisted, THE Popup SHALL change the button label to `[OPEN IN READER →]` and update the button background to the surface color (`#0F0F0F`).
7. IF the AI_Client receives an error response from the provider API, THEN THE Popup SHALL display `[ERROR — RETRY]` with a danger red (`#FF3366`) border on the button.
8. IF no API key is configured for the selected provider, THEN THE Popup SHALL display an inline error message prompting the user to configure a key in Settings before capturing.
9. THE Popup SHALL display the active tab's page title and domain in the page context zone before capture is initiated.
10. WHEN the user clicks `[OPEN IN READER →]`, THE Extension SHALL open the Reader in a new browser tab.

---

### Requirement 3: Generation Modes

**User Story:** As a user, I want to choose between fast and deep capture modes, so that I can balance speed against output quality based on my current need.

#### Acceptance Criteria

1. THE Popup SHALL present three generation mode options: `FAST`, `DEEP`, and `LOCAL`.
2. WHEN the user selects a mode, THE Popup SHALL highlight the selected mode box with a `2px #5E6AD2` border and update the button label text color to violet.
3. WHILE `FAST` mode is active, THE AI_Client SHALL use a lighter model (Gemini Flash or equivalent) with a concise summarization prompt template.
4. WHILE `DEEP` mode is active, THE AI_Client SHALL use a stronger model (Gemini Pro or equivalent) with a detailed structured-notes prompt template.
5. WHILE `LOCAL` mode is active, THE AI_Client SHALL route requests to a locally running Ollama instance at `http://localhost:11434` instead of a remote API.
6. THE Storage_Layer SHALL persist the user's last selected Generation_Mode and restore it on next Popup open.
7. WHERE `LOCAL` mode is selected, THE Popup SHALL not require any provider API key to be configured.

---

### Requirement 4: Document Library

**User Story:** As a user, I want to browse all my captured documents in a searchable grid, so that I can quickly find and revisit past captures.

#### Acceptance Criteria

1. THE Library SHALL display all persisted Documents as cards in a responsive grid layout.
2. THE Library SHALL render each card with the document title, source domain, word count, capture date, and associated tags.
3. WHEN the user types in the search input, THE Fuzzy_Search SHALL match the query against document titles, tag names, and body content and update the displayed card grid within 150ms.
4. WHEN the user clicks a document card, THE Extension SHALL open the Reader for that Document in the current tab.
5. WHEN the Library contains no Documents, THE Library SHALL display the empty state message `NO DOCUMENTS FOUND. CAPTURE SOMETHING.` centered in the grid area.
6. THE Library SHALL provide a sort control allowing the user to order documents by capture date (newest first, oldest first) and by title (A–Z).
7. WHEN the user activates the star action on a document card, THE Storage_Layer SHALL mark the Document as starred and THE Library SHALL reflect the updated state immediately.
8. THE Library SHALL provide a `[FAVORITES]` filter that shows only starred Documents.
9. WHEN the user activates the archive action on a document card, THE Storage_Layer SHALL mark the Document as archived and THE Library SHALL remove it from the default view.
10. THE Library SHALL provide an `[ARCHIVE]` filter that shows only archived Documents.

---

### Requirement 5: Document Export

**User Story:** As a developer or student, I want to export a captured document as markdown or PDF, so that I can share structured notes with teammates or save them outside the Extension.

#### Acceptance Criteria

1. WHEN the user clicks `[EXPORT .MD]` in the Reader action bar, THE Reader SHALL trigger a browser file download of the Document's markdown content with a `.md` extension.
2. THE exported markdown file SHALL include the document title, source URL, capture date, and all structured sections produced by the AI.
3. WHEN the user selects PDF export from the Library card context menu, THE Reader SHALL render the Document to a print-optimized layout and trigger the browser's native print-to-PDF dialog.
4. THE exported markdown SHALL preserve all Mermaid.js code blocks and UML diagram code blocks as fenced code blocks with the appropriate language identifier.
5. THE exported markdown SHALL include all image references at their semantically correct positions within the document sections, not appended at the end of the file.
6. WHEN the Reader renders a Document for PDF export, THE Reader SHALL embed all Mermaid.js diagrams as inline SVG images in the PDF output rather than raw fenced code blocks.
7. WHEN the Reader renders a Document for PDF export, THE Reader SHALL embed all UML diagrams as inline SVG images in the PDF output rather than raw fenced code blocks.
8. WHEN the Reader renders a Document for PDF export, THE Reader SHALL embed all images inline at their correct positions in the document flow rather than appended at the end.

---

### Requirement 6: Reader View

**User Story:** As a user, I want to read a captured document alongside its AI-generated structured notes in a split-pane view, so that I can compare the original content with the structured output.

#### Acceptance Criteria

1. THE Reader SHALL render in a 70/30 horizontal split with the original content in the left pane and AI-generated notes in the right pane.
2. THE Reader SHALL display the document title in `Space Grotesk` 700 32px and body text in `Inter Tight` 400 16px with a line-height of 1.6.
3. WHILE the user scrolls the left pane, THE Reader SHALL keep the right pane notes sidebar fixed (sticky).
4. THE Reader SHALL render the AI notes in labeled sections: `SUMMARY`, `KEY ENTITIES`, `TIMELINE`, and `CONCEPTS`, each in a bordered container.
5. WHEN the user selects text in the left pane, THE Reader SHALL display a floating tooltip with `[HIGHLIGHT]` and `[ASK AI]` actions.
6. WHEN the user clicks `[ASK AI]` from the selection tooltip, THE Reader SHALL open the RAG_Chat pane with the selected text pre-filled as the query context.
7. WHEN the user clicks a note entity in the right pane, THE Reader SHALL scroll the left pane to the linked source paragraph and apply a `#5E6AD2` at 20% opacity background highlight to that paragraph.
8. WHEN the user clicks the `[CHAT]` tab in the Reader action bar, THE Reader SHALL replace the right pane with the RAG_Chat pane.
9. WHEN the user clicks the `[NOTES]` tab in the Reader action bar, THE Reader SHALL restore the AI notes in the right pane.
10. THE Reader SHALL display a breadcrumb in the top bar formatted as `LIBRARY / [DOCUMENT TITLE]` in `JetBrains Mono` 12px, where clicking `LIBRARY` navigates back to the Library.

---

### Requirement 7: Mermaid.js Diagram Rendering

**User Story:** As a developer, I want ASCII art diagrams and flowcharts in captured content to be converted to rendered Mermaid.js diagrams, so that I can read structured visual representations instead of raw text art.

#### Acceptance Criteria

1. WHEN the AI_Client processes a page containing ASCII art diagrams or described flowcharts, THE AI_Client SHALL include a fenced Mermaid.js code block in the Document markdown for each identified diagram.
2. WHEN the Reader renders a Document containing a fenced `mermaid` code block, THE Mermaid_Renderer SHALL render it as an SVG diagram inline in the document.
3. IF the Mermaid_Renderer encounters a syntax error in a mermaid code block, THEN THE Mermaid_Renderer SHALL display the raw code block with an error label rather than a broken diagram.
4. THE Mermaid_Renderer SHALL support at minimum: flowcharts (`graph`), sequence diagrams (`sequenceDiagram`), and state diagrams (`stateDiagram`).
5. THE exported markdown SHALL preserve Mermaid.js fenced code blocks with the `mermaid` language identifier so they render correctly in tools like GitHub and Obsidian.
6. WHEN the Reader renders a Document for PDF export, THE Mermaid_Renderer SHALL convert each Mermaid.js code block to an SVG image and embed it inline in the PDF output rather than emitting raw code.

---

### Requirement 8: UML Diagram Rendering

**User Story:** As a developer capturing software documentation, I want use case and sequence diagrams to be rendered as proper UML diagrams, so that I can understand system architecture at a glance.

#### Acceptance Criteria

1. WHEN the AI_Client processes a page containing software architecture descriptions, use case descriptions, or sequence descriptions, THE AI_Client SHALL include a fenced PlantUML code block in the Document markdown for each identified diagram.
2. WHEN the Reader renders a Document containing a fenced `plantuml` code block, THE UML_Renderer SHALL render it as an SVG diagram inline in the document using the PlantUML server or a client-side rendering library.
3. IF the UML_Renderer encounters a syntax error in a plantuml code block, THEN THE UML_Renderer SHALL display the raw code block with an error label rather than a broken diagram.
4. THE UML_Renderer SHALL support at minimum: use case diagrams, sequence diagrams, and class diagrams.
5. THE exported markdown SHALL preserve PlantUML fenced code blocks with the `plantuml` language identifier so they render correctly in tools that support PlantUML.
6. WHEN the Reader renders a Document for PDF export, THE UML_Renderer SHALL convert each PlantUML code block to an SVG image and embed it inline in the PDF output rather than emitting raw code.

---

### Requirement 9: Smart Image Placement

**User Story:** As a user, I want images from the captured page to appear near the relevant content in the structured document, so that visual context is preserved rather than dumped at the end.

#### Acceptance Criteria

1. WHEN the Capture_Engine extracts a page, THE Capture_Engine SHALL collect all `<img>` elements along with their surrounding paragraph context and alt text.
2. WHEN the AI_Client structures the Document, THE AI_Client SHALL place each image reference adjacent to the section of the document most semantically related to the image's surrounding context.
3. IF an image URL from the captured page returns a 4xx or 5xx HTTP status when the Reader attempts to load it, THEN THE Reader SHALL display a placeholder with the image's alt text.
4. WHERE an image is missing or broken and the Document section contains sufficient descriptive text, THE AI_Client SHALL include a web search query suggestion in the Document metadata so the Reader can surface a replacement image search link.
5. THE exported markdown SHALL include all image references at their semantically correct positions within the document sections rather than appended at the end of the file.
6. WHEN the Reader renders a Document for PDF export, THE Reader SHALL embed all images inline at their correct positions in the document flow rather than appended at the end of the PDF.

---

### Requirement 10: RAG Chat

**User Story:** As a user, I want to ask natural language questions about a captured document and receive answers with citations, so that I can interrogate knowledge without re-reading the full document.

#### Acceptance Criteria

1. WHEN a Document is persisted, THE Embedding_Engine SHALL split the Document into chunks of no more than 512 tokens, generate a vector embedding for each chunk using a local embedding model, and store the embeddings in IndexedDB keyed by Document ID and chunk index.
2. WHEN the user submits a query in the RAG_Chat pane, THE Embedding_Engine SHALL generate an embedding for the query and retrieve the top-5 most semantically similar chunks from the active Document's stored embeddings.
3. WHEN the top-5 chunks are retrieved, THE AI_Client SHALL construct a prompt containing the query and the retrieved chunks and send it to the configured LLM provider.
4. WHILE the AI_Client is awaiting a RAG response, THE RAG_Chat SHALL display `[NOTCH IS THINKING █]` with a blinking cursor in the primary violet color.
5. WHEN the AI_Client returns a RAG response, THE RAG_Chat SHALL render the response as a message bubble with inline citation chips `[1]`, `[2]`, etc., each linked to the source chunk's paragraph in the left pane.
6. WHEN the user clicks a citation chip, THE Reader SHALL scroll the left pane to the source paragraph and apply a `#222222` background highlight to that paragraph.
7. WHEN the user hovers over a citation chip, THE Reader SHALL apply a `#222222` background highlight to the linked paragraph without scrolling.
8. IF the AI_Client returns an error during a RAG query, THEN THE RAG_Chat SHALL display `[CONNECTION FAILED]` in the danger color (`#FF3366`).
9. THE RAG_Chat SHALL display the active document title in a context pill at the top of the pane labeled `CHATTING WITH:`.
10. WHEN the user presses `Enter` in the RAG_Chat input, THE RAG_Chat SHALL append the user's message as a right-aligned bubble and clear the input field.
11. THE RAG_Chat input SHALL support multiline input via `Shift+Enter` without submitting the query.

---

### Requirement 11: Tagging

**User Story:** As a user, I want to add tags to captured documents, so that I can organize and filter my library by topic.

#### Acceptance Criteria

1. THE Popup SHALL provide a tag input field where the user can type a tag name and press `Enter` to add it before capturing.
2. WHEN the user presses `Enter` in the tag input, THE Popup SHALL render the tag as a square chip with a `1px #222222` border and add it to the pending tag list.
3. WHEN a Document is captured, THE Storage_Layer SHALL persist all tags entered in the Popup as part of the Document metadata.
4. WHEN the user activates the remove action on a tag chip in the Popup, THE Popup SHALL remove that tag from the pending tag list.
5. THE Library SHALL display each Document's tags as chips on the document card.
6. WHEN the user clicks a tag chip in the Library, THE Library SHALL filter the document grid to show only Documents with that tag.

---

### Requirement 12: Onboarding and Settings Screen

**User Story:** As a first-time user, I want a clear setup screen that guides me through adding my API key and choosing a generation mode, so that I can start capturing immediately without confusion.

#### Acceptance Criteria

1. WHEN the Extension is installed and no API key is configured, THE Extension SHALL open the Settings screen in a new tab automatically.
2. THE Settings SHALL display a `GETTING STARTED` section with a link to an external quickstart resource.
3. THE Settings SHALL display three provider blocks (Gemini, OpenAI, Anthropic), each with a labeled password input and a `GET API KEY ↗` link to the provider's API key page.
4. THE Settings SHALL display a `GENERATION MODE` section with three selectable options: `FAST`, `DEEP`, and `LOCAL`, each with a short description of the model and use case.
5. WHEN the user clicks `[SAVE SETTINGS]`, THE Storage_Layer SHALL persist all key and mode values and THE Settings SHALL display `[SETTINGS SAVED ✓]` on the button for 2 seconds before reverting to the default label.
6. WHEN the user navigates to Settings from the Library sidebar, THE Settings SHALL pre-populate all inputs with the currently stored values (keys shown as masked dots).

---

### Requirement 13: Design System Compliance

**User Story:** As a developer maintaining the Extension, I want all UI components to follow the defined brutalist design system, so that the product has a consistent, recognizable visual identity.

#### Acceptance Criteria

1. THE Extension SHALL apply `0px` border radius to all interactive and container elements.
2. THE Extension SHALL use `#000000` as the base background color and `#0F0F0F` as the surface color for cards, panels, and inputs.
3. THE Extension SHALL use `1px solid #222222` as the universal structural border and `2px solid #5E6AD2` for active/selected states.
4. THE Extension SHALL use `Space Grotesk` 700 for all headings, `Inter Tight` 400 for all body prose, and `JetBrains Mono` for all UI labels, buttons, and metadata.
5. THE Extension SHALL render all button labels in `JetBrains Mono` 600 uppercase with `0.05em` letter spacing.
6. THE Extension SHALL apply a `box-shadow: 0 0 0 1px #5E6AD2` focus ring to all focused interactive elements.
7. THE Extension SHALL use `#5E6AD2` exclusively for primary actions, active states, and focus indicators.
8. THE Extension SHALL use `#FF3366` exclusively for error states and destructive actions.
9. THE Extension SHALL not use any drop shadows on any element.
10. THE Extension SHALL implement skeleton loading states using a `linear-gradient(#0F0F0F, #1A1A1A)` pulsing animation for all async content areas.

---

### Requirement 14: Storage and Data Persistence

**User Story:** As a user, I want my captured documents and settings to persist across browser sessions, so that I never lose my knowledge base.

#### Acceptance Criteria

1. THE Storage_Layer SHALL persist Document content and metadata to Chrome `storage.local`.
2. THE Storage_Layer SHALL persist vector embeddings and chunk data to IndexedDB under a versioned database schema.
3. WHEN Chrome `storage.local` approaches its quota limit (within 10% of the 10MB limit), THE Extension SHALL display a warning in the Library prompting the user to archive or delete documents.
4. THE Storage_Layer SHALL provide a document deletion operation that removes the Document from Chrome `storage.local` and all associated embeddings from IndexedDB atomically.
5. WHEN the user deletes a Document, THE Library SHALL remove the corresponding card from the grid immediately without requiring a page refresh.
6. THE Storage_Layer SHALL store all data exclusively in the user's local browser storage and SHALL NOT transmit document content to any server other than the configured LLM provider API during capture and RAG operations.

---

### Requirement 15: Keyboard Navigation

**User Story:** As a power user, I want to navigate the Extension primarily via keyboard, so that I can stay in flow without reaching for the mouse.

#### Acceptance Criteria

1. WHEN the user presses `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) while in the Reader, THE Reader SHALL open the RAG_Chat pane and focus the chat input.
2. WHEN the user presses `Escape` while the RAG_Chat pane is open, THE Reader SHALL close the RAG_Chat pane and restore the notes sidebar.
3. WHEN the user presses `Enter` in the RAG_Chat input with a non-empty query, THE RAG_Chat SHALL submit the query.
4. WHEN the user presses `Shift+Enter` in the RAG_Chat input, THE RAG_Chat SHALL insert a newline without submitting.
5. THE Library search input SHALL receive focus when the user presses `/` while the Library is active and no other input is focused.
