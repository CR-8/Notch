# Implementation Plan: Notch Improvements

## Overview

Implement 12 improvements to Notch in priority order: P0 stability fixes first (markdown parser,
CI), then P1 UX and prompt-quality work (folders, color coding, density, error states, prompt
templates, capture cache, query rewriter), then P2 reader polish (reader modes, annotations,
export quality). Each group builds on the previous; the final task wires everything together.

---

## Tasks

<!-- ================================================================ -->
<!-- P0 — STABILITY                                                    -->
<!-- ================================================================ -->

- [x] 1. Implement `markdown-parser.ts` — safe block-level markdown parser
  - Create `src/lib/markdown-parser.ts` with `ParseWarning`, `DocBlock`, and `ParseResult` types
  - Implement `parseMarkdown(md: string): ParseResult` wrapping `marked` with per-block try/catch;
    emit `type: 'unknown'` blocks on failure and append a `ParseWarning`
  - Implement `serializeToMarkdown(result: ParseResult): string` for round-trip support
  - Assign stable `data-paragraph-id` attributes (hash of first 64 chars of paragraph text) in
    the serializer output for use by the annotation layer
  - _Requirements: 1.1, 1.2, 1.8_

  - [x] 1.1 Write property tests for markdown parser (Properties 1–5)
    - **Property 1: Markdown parse never throws** — `fc.string()` → `parseMarkdown` never throws
    - **Property 2: Fallback renderer produces `<pre>` output** — any `DocBlock` with
      `type === 'unknown'` renders as `<pre>` with `block.raw` as text content
    - **Property 3: Nested list depth is preserved** — depth D (1–6) round-trips correctly
    - **Property 4: Code block language ID is preserved** — fenced block language survives parse
    - **Property 5: Markdown round-trip structural equivalence** — `serializeToMarkdown(parseMarkdown(M))` re-parsed equals first parse
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8**
    - File: `src/lib/__tests__/markdown-parser.property.test.ts`

  - [x] 1.2 Write unit tests for markdown parser
    - Fixture suite: long docs (>10 000 chars), nested lists (>3 levels), tables with alignment,
      mixed code fences, malformed inputs (unclosed fences, broken table rows)
    - _Requirements: 1.5, 1.6, 1.7, 1.9_
    - File: `src/lib/__tests__/markdown-parser.test.ts`

- [x] 2. Wire `markdown-parser.ts` into the Reader and add `Fallback_Renderer`
  - Update `DocumentRenderer` in `src/entrypoints/reader/` to call `parseMarkdown` and iterate
    over `ParseResult.blocks`
  - Add `FallbackRenderer` component that renders `<pre>{block.raw}</pre>` for
    `type === 'unknown'` blocks
  - Assign `data-paragraph-id` to each `<p>` element using the hash from the parser
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 3. Set up CI pipeline and release checklist
  - Create `.github/workflows/ci.yml` with three jobs: `compile` (`tsc --noEmit`), `build`
    (`wxt build`), `test` (`vitest --run`)
  - Configure jobs to run on every pull request targeting `main`
  - Create `RELEASE_CHECKLIST.md` listing: compile clean, build successful, all tests passing,
    no unresolved P0 issues
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Checkpoint — P0 complete
  - Ensure all tests pass, ask the user if questions arise.

<!-- ================================================================ -->
<!-- P1 — PRODUCT UX                                                   -->
<!-- ================================================================ -->

- [x] 5. Implement folder CRUD additions in `storage.ts`
  - Add `renameFolder(id: string, newName: string): Promise<void>` to `src/lib/storage.ts`
  - Add `moveFolderDocuments(fromFolderId: string, toFolderId: string | undefined): Promise<void>`
  - Update `deleteFolder` to call `moveFolderDocuments` after user confirms destination
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.1 Write property tests for folder operations (Properties 6–8)
    - **Property 6: Document count invariant across folder operations** — any sequence of
      create/move/delete leaves total doc count unchanged
    - **Property 7: Folder create-then-delete round-trip** — `getFolders()` identical before/after
    - **Property 8: Folder filter returns only matching documents** — filter by folder ID returns
      only docs with matching `folder` field
    - **Validates: Requirements 3.6, 3.8, 3.9**
    - File: `src/lib/__tests__/folder-operations.property.test.ts`

- [x] 6. Add drag-and-drop and folder export to Library UI
  - Add HTML5 drag events to `DocumentCard` in `src/entrypoints/newtab/` for move-to-folder
  - Add "Export folder" button that calls `exportFolderAsZip` (implemented in task 18)
  - Add folder filter selector that calls `getFolders()` and filters document list
  - _Requirements: 3.5, 3.6, 3.7_

- [x] 7. Implement color coding — `color-palette.ts` and tag color storage
  - Extract `FOLDER_COLORS` palette from `newtab/App.tsx` into `src/lib/color-palette.ts`
  - Add `TagColorMap` type and `getTagColors` / `setTagColor` functions to `src/lib/storage.ts`
    (stored under `notch:tag-colors`)
  - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.1 Write property tests for color label persistence (Property 9)
    - **Property 9: Color label persistence round-trip** — set color then read back returns same value
    - **Validates: Requirements 4.1, 4.2**
    - File: `src/lib/__tests__/color-label.property.test.ts`

- [x] 8. Wire color accents into Library and Reader UI
  - Display folder color accent on `FolderBadge` component in Library
  - Display tag color accent on `TagChip` component wherever tags appear
  - Add color legend component mapping active Color_Labels to folder/tag names
  - Display folder Color_Label in Reader breadcrumb and chat context pill
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7_

- [-] 9. Implement view mode persistence in `storage.ts`
  - Add `getViewMode(): Promise<ViewMode>` and `saveViewMode(mode: ViewMode): Promise<void>` to
    `src/lib/storage.ts` (stored under `notch:view-mode`)
  - Update Library `App.tsx` to load persisted view mode on mount and save on change
  - Extend `detailed` mode card to show tags, folder badge, and word count from `DocumentMeta`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [~] 9.1 Write property tests for view mode (Properties 10–11)
    - **Property 10: View mode document set invariant** — same doc IDs rendered across all three modes
    - **Property 11: View mode persistence round-trip** — save then read returns same `ViewMode`
    - **Validates: Requirements 5.6, 5.7**
    - File: `src/lib/__tests__/view-mode.property.test.ts`

- [-] 10. Implement `EmptyState` component and wire all error states
  - Create `src/components/EmptyState.tsx` with `message` and optional `action` props
  - Wire five error states:
    - No docs + no API key → "No API key set" + link to Settings
    - Doc with no embeddings → "No embeddings yet" + generate button
    - Parse failed → "Reader parse failed" + view raw markdown button
    - Empty folder filter → "This folder is empty" + add document button
    - Network failure during capture → "Capture failed: {operation}" + retry button
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [~] 10.1 Write property test for error states (Property 12)
    - **Property 12: Every error state has at least one actionable element** — for each of the
      five error conditions, rendered UI contains an element with `onClick` or `href`
    - **Validates: Requirements 6.6**
    - File: `src/lib/__tests__/error-states.property.test.ts`

- [ ] 11. Checkpoint — P1 UX complete
  - Ensure all tests pass, ask the user if questions arise.

<!-- ================================================================ -->
<!-- P1 — PROMPT QUALITY & ACCELERATION                               -->
<!-- ================================================================ -->

- [ ] 12. Implement `prompt-templates.ts` and `schema-validator.ts`
  - Create `src/lib/prompt-templates.ts` with `CaptureMode`, `PromptTemplate` types and
    `PROMPT_TEMPLATES` record for FAST, BALANCED, DEEP modes, each with a semver `version` field
    and `previousVersions` array
  - Create `src/lib/schema-validator.ts` with `CaptureSchema`, `ValidationResult` types and
    `validateCaptureOutput` / `buildCorrectionPrompt` functions
  - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7_

  - [~] 12.1 Write property tests for schema validator (Properties 13–15)
    - **Property 13: Schema validator determinism** — same output + schema always returns same result
    - **Property 14: Schema validator no false negatives** — conforming output always returns `valid: true`
    - **Property 15: Retry count never exceeds 2** — capture pipeline calls LLM at most 3 times total
    - **Validates: Requirements 7.4, 7.6, 7.7**
    - File: `src/lib/__tests__/schema-validator.property.test.ts`

  - [~] 12.2 Write unit tests for schema validator
    - Valid outputs pass, invalid outputs fail, correction prompt is well-formed
    - _Requirements: 7.3, 7.4, 7.5_
    - File: `src/lib/__tests__/schema-validator.test.ts`

- [~] 13. Wire schema validation and retry logic into `background.ts` capture pipeline
  - After receiving model output, call `validateCaptureOutput`
  - On violation, call `buildCorrectionPrompt` and retry (max 2 retries)
  - On exhausted retries, save raw output and set `schemaStatus: 'schema-invalid'` on the document
  - Add `schemaStatus` and `rawModelOutput` fields to `Document` type in `src/lib/types.ts`
  - _Requirements: 7.3, 7.4, 7.5_

- [~] 14. Implement `capture-cache.ts` and two-stage capture pipeline
  - Create `src/lib/capture-cache.ts` with `hashContent` (SHA-256 via SubtleCrypto),
    `CacheEntry` type, `getCachedCapture` / `setCachedCapture` using IDB `captureCache` store
  - Add `captureCache` object store to IDB schema (DB_VERSION 4) in `src/lib/idb.ts`
  - Update `background.ts` capture handler to check cache before calling LLM; on miss, store result
  - Implement two-stage pipeline: emit `CAPTURE_STAGE1_COMPLETE` with FAST draft before Stage 2
    enrichment; Stage 2 processes only `[DEEP]`-flagged sections
  - Update `buildRAGPrompt` in `background.ts` to accept `tokenBudget` (default 4000) and drop
    lower-score chunks until estimated token count fits
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7_

  - [~] 14.1 Write property tests for capture cache (Properties 16–18)
    - **Property 16: Content hash stability** — `hashContent(C)` returns same hex on every call
    - **Property 17: Cache lookup idempotence** — two lookups for same content return same entry
      without calling LLM
    - **Property 18: Chat prompt respects token budget** — constructed RAG prompt never exceeds budget B
    - **Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7**
    - File: `src/lib/__tests__/capture-cache.property.test.ts`

  - [~] 14.2 Write unit tests for capture cache
    - Cache miss, cache hit, hash collision resistance, two-stage message ordering
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
    - File: `src/lib/__tests__/capture-cache.test.ts`

- [~] 15. Implement `query-rewriter.ts` and wire into RAG handler
  - Create `src/lib/query-rewriter.ts` with `IntentHint`, `RewrittenQuery` types and
    `rewriteQuery(query, settings, timeoutMs?)` using a 2-second `AbortController` timeout;
    on timeout or error, return original query with `intent: 'definition'`
  - Update `handleRagQuery` in `background.ts` to call `rewriteQuery` before `embedQuery`
  - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [~] 15.1 Write property tests for query rewriter (Properties 19–21)
    - **Property 19: Query rewriter always attaches an intent hint** — `intent` is always one of
      the four valid values
    - **Property 20: Metamorphic retrieval — rewritten query is at least as good** — retrieved
      doc set using rewritten query is superset of set using original
    - **Property 21: Query rewriter stability under no-op** — key terms in Q all present in
      rewritten form when no abbreviations exist
    - **Validates: Requirements 9.2, 9.4, 9.5**
    - File: `src/lib/__tests__/query-rewriter.property.test.ts`

  - [~] 15.2 Write unit tests for query rewriter
    - Timeout fallback, intent classification examples, term expansion
    - _Requirements: 9.1, 9.2, 9.6_
    - File: `src/lib/__tests__/query-rewriter.test.ts`

- [ ] 16. Checkpoint — P1 prompt quality complete
  - Ensure all tests pass, ask the user if questions arise.

<!-- ================================================================ -->
<!-- P2 — READER & INTERACTION POLISH                                 -->
<!-- ================================================================ -->

- [~] 17. Implement reader modes — `ReaderMode` type, persistence, and layout
  - Add `ReaderMode` type and `getReaderMode` / `saveReaderMode` to `src/lib/storage.ts`
    (stored under `notch:reader-mode`)
  - Add `ReaderMode` and `ViewMode` to `Settings` interface in `src/lib/types.ts`
  - Update Reader SPA layout:
    - `reading` — existing 70/30 split
    - `focus` — full-width, hide nav chrome and sidebars; ESC to exit
    - `compare` — two `DocumentRenderer` instances at 50% each with a document picker dropdown
  - Preserve scroll position across mode switches using `useLayoutEffect` +
    `leftPaneRef.current.scrollTop`
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [~] 17.1 Write property tests for reader modes (Properties 22–23)
    - **Property 22: Reader mode content invariant** — text content in document pane is identical
      across all three modes
    - **Property 23: Reader mode persistence round-trip** — save then read returns same `ReaderMode`
    - **Validates: Requirements 10.5, 10.6**
    - File: `src/lib/__tests__/reader-modes.property.test.ts`

- [~] 18. Implement `annotation-store.ts` and IDB schema v4
  - Add `Annotation` type to `src/lib/types.ts`
  - Create `src/lib/annotation-store.ts` with `saveAnnotation`, `getAnnotationsByDocument`,
    `updateAnnotation`, `deleteAnnotation`, `markOrphaned`
  - Add `annotations` object store (keyPath: `id`, indexes: `documentId`, `paragraphId`) and
    `captureCache` store to IDB in `src/lib/idb.ts`, bumping `DB_VERSION` to 4
  - _Requirements: 11.1, 11.2, 11.4_

  - [~] 18.1 Write property tests for annotation store (Properties 24–26)
    - **Property 24: Annotation round-trip save/retrieve** — save then retrieve by ID returns
      identical field values
    - **Property 25: Annotation count invariant on re-render** — re-rendering doc with N
      non-orphaned annotations applies exactly N highlights
    - **Property 26: Orphaned annotation marking** — removing paragraph P marks its annotations
      as `isOrphaned: true`
    - **Validates: Requirements 11.4, 11.5, 11.6**
    - File: `src/lib/__tests__/annotation-store.property.test.ts`

  - [~] 18.2 Write unit tests for annotation store
    - CRUD operations, orphan marking, IDB transaction error handling
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
    - File: `src/lib/__tests__/annotation-store.test.ts`

- [~] 19. Wire annotation layer into `DocumentRenderer`
  - Add "HIGHLIGHT" button to the selection tooltip in `DocumentRenderer`; on click, call
    `saveAnnotation` with the current selection's paragraph ID and character offsets
  - On render, call `getAnnotationsByDocument(doc.id)` and apply highlight marks to matching
    paragraph elements using `data-paragraph-id`
  - Display orphaned annotations in a separate "Orphaned Annotations" panel in the Reader sidebar
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6_

- [~] 20. Implement export quality upgrades — markdown, PDF, and zip
  - Update `buildMarkdownExport` in `src/lib/export.ts` to append annotation inline comments
    (`<!-- ANNOTATION: {text} | NOTE: {note} -->`) after annotated text spans
  - Update `exportPDF` in `src/lib/export.ts`:
    - Use `@pdf-lib/fontkit` to embed Noto Sans for full text selectability
    - Add 72pt page margins, consistent line heights, and a cover page with title/meta
    - Render code blocks with monospace font and light gray background rect
    - Add annotation margin notes at corresponding page Y positions
  - Create `src/lib/zip-export.ts` with `exportFolderAsZip(folderId, format)` using `jszip`
  - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

  - [~] 20.1 Write property tests for export (Properties 27–30)
    - **Property 27: Markdown export preserves structure** — all headings, list items, code
      fences, and table rows from `D.content` appear in the export
    - **Property 28: Folder zip contains one file per document** — zip from N-doc folder has N files
    - **Property 29: Markdown export round-trip preserves structure** — re-imported doc has same
      heading/list/code structure
    - **Property 30: Annotations appear in exports** — N annotations → N comment markers in
      markdown, N margin note entries in PDF
    - **Validates: Requirements 12.1, 12.3, 12.4, 12.5**
    - File: `src/lib/__tests__/export.property.test.ts`

  - [~] 20.2 Write unit tests for export
    - Markdown frontmatter, annotation comments, zip file count, PDF text layer
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_
    - File: `src/lib/__tests__/export.test.ts`

- [ ] 21. Final checkpoint — all features complete
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Priority order: P0 (tasks 1–4) → P1 UX (tasks 5–11) → P1 prompt quality (tasks 12–16) → P2 (tasks 17–21)
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in devDependencies); run with `vitest --run`
- IDB schema bump to v4 happens in task 18; tasks 14 and 18 must not be reordered
- The `color-palette.ts` extraction (task 7) must precede the UI wiring in task 8
