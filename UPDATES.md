# NOTCH — Updates & Task Tracker

> Living handoff doc. Carries context across sessions / terminal agents.
> Companion to `NOTCH-PRD.md` (spec) and the master feature list. Feature IDs are stable.
> **Legend:** ✅ done · 🟡 partial · ⬜ not started

**Last updated:** 2026-06-19

**Verify any time:** `npm test` (vitest) · `npx tsc --noEmit` · `npx wxt build`
**Current state:** typecheck clean · **106 tests passing** (17 files) · production build OK.

> 🏗 **Pipeline redesign in progress** — see `PIPELINE-REDESIGN.md` for the staged
> architecture (extraction → planner → generator → render). **Phases 1–3 shipped**:
> structured extraction + DocumentPlanner + per-section generator + content-driven
> diagram generation + rich-table inline markdown + figure numbering + side-panel
> intelligence dashboard. Problems 1–8, 11 done. Next: Phase 4 (PDF figures/TOC) and
> the chat-panel redesign (Problem 10).

---

## Capture pipeline debugging (2026-06-19) — Forensic audit

**Context:** User reported reader showing no content, wordCount=6, entities=0, concepts=0 for captured GeeksforGeeks page despite pipeline completing (19 chunks created).

### Root causes found & fixed

| # | Issue | Root cause | Fix |
|---|---|---|---|
| 1 | `wordCount=6` / `textContent` very short | `content.ts` used `innerText` (CSS-aware, layout-dependent) which returns incomplete text on complex dynamic pages. Readability also returned null → fell back to `innerText` = ~6 words. | Changed to `textContent` (`content.ts:13`). Gets ALL text, no layout dependency. |
| 2 | `entities=0` always | LLM prompts (FAST/BALANCED/DEEP) had **no `## Key Entities` section header**. Regex parser at `pipeline.ts:334` searched for it, always found nothing → `entities` array always `[]`. Fallback `extractKnowledge(textContent)` also returned empty because textContent was 6 words. | Added `## Key Entities` to all three prompts. LLM now explicitly lists entities with type. |
| 3 | `concepts=0`, entities fallback still empty | Even with #1 fixed, newly captured docs would work but **already-captured** docs have no Key Entities section in their stored content. No backfill from the generated content itself. | Added `extractKnowledge(structuredContent)` as tier-2 backfill (`pipeline.ts:370`). Three-tier merge: LLM-parsed → deterministic-from-generated-content → raw-text extraction. |
| 4 | Metadata (documentType, topics, etc.) used raw-text extraction only | `doc.documentType = knowledge.documentType` used only raw page text. If textContent was short, type defaulted to 'general'. | Changed to prefer `knowledgeFromContent` (extraction from generated markdown) when it has entities, fall back to raw-text (`pipeline.ts:411-415`). |
| 5 | `deriveAutoTags` used raw (empty) entities | Called with unmerged `entities`/`concepts` arrays. If both were empty, no auto-tags. | Changed to use `mergedEntities`/`mergedConcepts` (`pipeline.ts:429`). |

### Logging added

Extensive instrumentation at every pipeline stage so the next capture produces a full trace:

**Pipeline (`pipeline.ts`):**
- EXTRACTION INPUT: textContent.length, wordCount, image count, cleanedHtml length
- KNOWLEDGE EXTRACTION: entity/concept/relationship/timeline counts + document type + complexity
- PLAN: depth, section count, target word range, visual count
- GENERATION: orchestrated vs single-pass fallback + structuredContent.length
- STRUCTURED CONTENT: first 200 chars preview
- PARSE RESULTS: LLM-parsed entity/concept/keypoint/timeline counts
- BACKFILL RESULTS: knowledgeFromContent entity/concept/timeline counts
- MERGE RESULTS: final merged entity/concept/timeline counts
- FINAL DOC: all stored field counts and sizes

**Reader (`reader/App.tsx`):**
- Document load: logs all Document fields (content length, entity count, status, textContent length, etc.)
- parseMarkdown: logs total/known/unknown block counts + content length + warnings

### Verification
- `npm run compile` — typecheck clean
- `npm test` — 106 tests pass (17 files)

---

## vNext bug pass (2026-06-19) — `NOTCH vNext` spec

| ID | Status | Fix |
|---|---|---|
| BUG-001 Chromium capture (tabId undefined) | ✅ | Popup now passes `tabId`/`url`; `background.handleCapture` uses a `resolveActiveTab()` fallback chain (`tabs.get` → currentWindow → lastFocusedWindow → any active). Service workers have no "current window", which was the root cause. |
| BUG-002 OpenRouter needs no model | ✅ | OpenRouter preset + save seed `openrouter/free` (OpenRouter's real free auto-router) **only when no model is set** — never overwrite an explicit choice. |
| BUG-003 Remove "Generate Embeddings" button | ✅ | Removed dead button in reader. Capture pipeline already auto-embeds (`pipeline.ts:357`). |
| BUG-004 Duplicate capture detection | ✅ | Already handled — `dedupe.normalizeUrl` (drops hash/trailing-slash/tracking params) + `findDuplicateId` gate in `handleCapture`. |
| BUG-005/006/007/008 PDF overlap, Mermaid/UML as code, tables | ✅ | New `exportViaPrint()` (export.ts) prints the **already-rendered** reader DOM (real Mermaid/UML SVGs, images, tables) through the browser print engine with print CSS (page margins, break-inside avoid, `thead` repetition). Replaces the pdf-lib text-drawer as primary path (kept as fallback). NB: spec's Playwright cannot run inside an extension; native print is the deployable equivalent. |
| BUG-010 Key Takeaways as bullets | ✅ | BALANCED/DEEP capture prompts now require bullet lists, not paragraphs. |
| BUG-002b model-default handling | ✅ | `normalizeModelId()` supplies a default **only for an empty model** and never rewrites an explicit id. (Earlier version wrongly remapped the *valid* `openrouter/free` — corrected.) NB: the original capture 404 returned the OpenRouter **website** 404 HTML, which means the request hit a non-API path — i.e. the Base URL was missing `/api/v1`, not a bad model. |
| FEATURE-016 model picker (searchable combo) | ✅ | New `ModelCombobox` (`src/components/ModelCombobox.tsx`) + `fetchAvailableModels()` (`src/lib/models-api.ts`). Options page now live-fetches the OpenAI-compatible catalogue (`GET {baseUrl}/models`, debounced) when endpoint+key are set, shows a searchable/filterable dropdown with FREE + context-length badges (free models sorted first), preserves free-text for custom ids, and **auto-saves** settings (debounced) so no Save click is needed before capture. 5 unit tests for `parseModelsResponse`. |
| BUG-009/011/012, FEATURE-001+ | ⬜ | See "Remaining vNext" below — larger feature work (AI-derived metadata guarantees, figure numbering, mermaid/uml validation+repair, image verification, deep-mode density, frame/multi-pass generation, model pickers, local AI). |

**Remaining vNext (not yet done):** BUG-009 (force every metadata section to be content-derived — currently AI-generated online, template only when offline), BUG-011/012 (figure/table numbering + captions), FEATURE-001..004 (mermaid/UML validate→repair→render, PlantUML fallback), FEATURE-005/006 (image verification + placement), FEATURE-007/008 (deep-mode density controller), FEATURE-009..011 (frame-based large-context + selective go-back + multi-pass), FEATURE-012..015 (auto diagram/table planning, TOC, cross-refs), FEATURE-016..018 (model pickers, local AI, full intelligence pipeline).

---

## 0. Snapshot

| Area | Status |
|---|---|
| Notion design system applied to all pages | ✅ |
| Core data/AI pipeline made functional (was broken) | ✅ |
| Provider error UX + capture 404 root cause | ✅ |
| Test suite established (was zero) | ✅ — 66 tests |
| Content Intelligence Engine V2 | ✅ — 12 new modules |
| Feature list A–M | in progress (see §3) |

**Rough completion of the master feature list:** ~35 of ~95 items done, ~12 partial.

---

## 1. Foundational fixes (pre-feature work — all ✅)

These were broken/absent and are now fixed + verified:

- ✅ **Design**: every page (popup, newtab/library, options, settings, reader) restyled to `DESIGN.md` (Notion). `ChatPanel` and `toast` converted from a dark/terminal aesthetic; shadcn primitives (`input`, `textarea`, `button`, `card`, `skeleton`) aligned to tokens; diagram blocks reframed.
- ✅ **DB unification**: removed a second raw-IndexedDB opener (`idb.ts`) that conflicted with Dexie on the same db name. `idb.ts` now delegates to Dexie; schema bumped to v3 (added `highlights`, `messages.documentId`).
- ✅ **Chat was dead**: added the missing `RAG_QUERY` background handler (+ `GENERATE_EMBEDDINGS`, `IMPORT_PDF`, `TRANSLATE`).
- ✅ **Reader was blank**: pipeline now persists `doc.content` (structured markdown) and sets `embeddingsGenerated`.
- ✅ **Library was empty**: `getDocIndex()` now derives from Dexie (capture never updated the old browser.storage index).
- ✅ **RAG scoping**: retrieval/history now scoped to the open document.
- ✅ **Folders / tag colors / view mode**: were no-op stubs → now persisted via `browser.storage.local`.
- ✅ **Capture 404 root cause**: presets had lost `/v1`; restored, fixed the misleading "Active endpoint" hint, removed the bogus OpenCode preset.
- ✅ **Provider errors**: `describeHttpError` → human-readable messages instead of raw HTML/JSON dumps (REL-2).
- ✅ **Gemini streaming**: was missing `alt=sse`, emitted nothing → fixed.
- ✅ **Removed all mock code** per user directive (offline = real `nlp-fallback`, never a fake adapter).

---

## 2. Test suite (✅ — `src/lib/__tests__/`)

11 files, 66 tests. Pure-logic coverage:
`errors` · `client` (retry/backoff) · `nlp-fallback` · `chunker` · `retrieval` · `auto-tag` · `dedupe` · `privacy` · `chat-actions` · `onboarding` · `theme`.

**TODO (testing):** component/integration tests (React Testing Library) for popup/reader/chat flows; pipeline integration tests with a fake-IndexedDB; E2E smoke test of capture→reader→chat; V2 engine unit tests.

---

## 3. Master feature list status

### A. AI Model Layer
- ✅ AI-1 decoupled provider layer · ✅ AI-2 OpenAI-compatible adapter · ✅ AI-3 native adapters (Anthropic/Gemini)
- ✅ AI-4 provider CRUD (settings) · ✅ AI-5 test-connection · ✅ AI-6 generation modes · ✅ AI-8 resilience (`client.ts`)
- 🟡 AI-7 embedding pinning (version field exists; **confirmed re-embed migration UI ⬜**)
- ⬜ AI-9 optional chat fallback chain (cloud→local)

### B. Inference Paths
- ✅ PATH-1 cloud via key
- ⬜ PATH-2 tiny extractive on-device (MiniLM/WASM — `@huggingface/transformers` is installed but not wired)
- ⬜ PATH-3 in-browser generative (WebLLM)
- ⬜ PATH-4 local server (see E)

### C. Model Picker — ⬜ all (PICK-1..7)

### D. On-Device Model Management — ⬜ all (MODEL-1..7)

### E. Local Server Connection — ⬜ all (SRV-1..4) — *proposed next*

### F. Onboarding
- ✅ ONB-2 first run · ✅ ONB-3 2-tap key setup (deep-links) · ✅ ONB-4 permission rationale · ✅ ONB-5 skippable
- 🟡 ONB-1 live demo (flow gets users to a working state fast; literal "auto-summary of current page in 5s" ⬜)
- Files: `src/entrypoints/welcome/*`, `src/lib/onboarding.ts`. Opens on install via `onInstalled`.

### G. Capture
- ✅ CAP-1 one-click capture · ✅ CAP-5 duplicate detection (`dedupe.ts`)
- 🟡 CAP-4 (PDF import ✅; YouTube transcript ⬜) · 🟡 CAP-8 resilient pipeline (background + stuck-capture recovery ✅; offscreen ML ⬜)
- ⬜ CAP-2 right-click + keyboard shortcut · ⬜ CAP-3 save selection only · ⬜ CAP-6 save toast with Undo · ⬜ CAP-7 paywall/unreadable detection

### H. Reading & Chat
- ✅ CHAT-2 starter chips · ✅ CHAT-3 one-click actions · ✅ CHAT-4 highlight-to-ask · ✅ CHAT-5 reading-level
- ✅ CHAT-6 translate · ✅ CHAT-7 read-aloud · ✅ CHAT-10 no-hallucination prompt · ✅ CHAT-11 cite-on-hover
- ✅ CHAT-12 citations→stored content · ✅ CHAT-14 follow-up chips
- 🟡 CHAT-1 chat scope (page ✅; whole-library ⬜)
- ⬜ CHAT-8 voice input · ⬜ CHAT-9 tap-a-term glossary · ⬜ CHAT-13 pin answers · ⬜ CHAT-15 page↔all-notes toggle

### I. Library & Organization
- ✅ LIB-1 searchable library · ✅ LIB-2 keyword (Fuse) + vector search · ✅ LIB-4 note view · ✅ LIB-5 auto-tagging (`auto-tag.ts`)
- 🟡 LIB-3 (star/archive/delete ✅; bulk-delete ⬜) · 🟡 LIB-5 clustering ⬜
- ✅ LIB-8 folder zip export · ✅ LIB-9 sidebar nav icons · ✅ LIB-10 empty/error states
- ⬜ LIB-6 related notes · ⬜ LIB-7 read-later queue + read/unread

### J. Trust & Privacy
- ✅ PRIV-1 privacy indicator · ✅ PRIV-3 local-only lock (`privacy.ts`) · ✅ PRIV-6 keys in storage.local
- 🟡 PRIV-7 keys redacted in exports/logs (verify)
- ⬜ PRIV-2 "what will be sent" preview · ⬜ PRIV-4 cost/token meter · ⬜ PRIV-5 free-tier training disclosure

### K. Resilience & UX Safety
- ✅ REL-2 user-facing failure states · ✅ REL-4 storage monitor + `persist()`
- 🟡 REL-3 observability (logger exists; settings event-log panel ⬜)
- ⬜ REL-1 silent cloud→on-device fallback

### L. Developer Features
- ✅ DEV-10 library export/import · 🟡 DEV-8 copy note as markdown (export exists)
- ⬜ DEV-1 Simple/Advanced toggle · ⬜ DEV-2..7, DEV-9 (custom endpoint UI, params, debug panel, curl, templates)

### M. Platform Constraints
- ✅ Cross-browser MV3 + Firefox via WXT
- ⬜ Run ML in offscreen document · ⬜ WebGPU feature-detect/hide · (RAM/threading caveats N/A until B/D land)

---

## 4. "If you build only five" (doc's top picks)
- ✅ CHAT-2 starter chips · ✅ LIB-5 auto-tagging · ✅ CHAT-6 translate · ✅ PRIV-3 local-only lock
- 🟡 ONB-1 live demo on install (partial)

---

## 5. Suggested next order
1. **E — Local-server auto-detect** (Ollama 11434 / LM Studio 1234 / llama.cpp 8080) + populate installed models. Most tractable of B–E.
2. **G polish** — CAP-6 undo toast, CAP-7 paywall detection, CAP-2 shortcut/context-menu.
3. **L — Simple/Advanced toggle (DEV-1)** to gate power-user UI.
4. **B/D — on-device ML** (MiniLM extractive first, then WebLLM) — largest effort; needs offscreen doc + WebGPU detection.
5. **Testing** — add component/integration coverage before store submission.

---

## 6. Key files / architecture notes
- DB: `src/lib/db.ts` (Dexie, single source of truth). Don't reopen `notch_db` raw.
- Pipeline: `src/lib/pipeline.ts` (capture, RAG, translate, embeddings) — runs in `background.ts`.
- Providers: `src/lib/providers/{openai,anthropic,gemini}.ts` + `registry.ts`. OpenAI Base URL must include `/v1`.
- Offline = `src/lib/nlp-fallback.ts` (real, no mock). Local-only lock forces it (`privacy.ts`).
- Pages: `src/entrypoints/{popup,newtab,options,settings,reader,welcome}/`.
- Design tokens: `src/assets/globals.css` (Notion light system per `DESIGN.md`).
- **V2 Content Engine**: `src/lib/content-engine/v2/` — 12 new modules: types, depth-controller, frame-engine, chunking, selective-go-back, diagram-planner, multi-pass, stitching, render-validator, mermaid-validator, uml-validator, image-reliability, export-pipeline. All wired into main barrel export and reader App. Builds cleanly alongside V1.
- **Zip export**: `src/lib/zip-export.ts` — now implemented. Exports folder contents as `.zip` with YAML-frontmatter markdown files. Uses `jszip` (transitive via WXT).
