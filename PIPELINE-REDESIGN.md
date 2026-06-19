# NOTCH — Content Pipeline Redesign

> Goal: documents that feel **intentionally authored** (whitepaper / analyst report),
> not auto-summarized. Shift from `Content → AI → Sections → Render` to a staged
> pipeline of **structured objects** (no markdown blobs between stages).

**Status legend:** ✅ done · 🟡 partial · ⬜ planned

---

## Target architecture

```
Content
 → Semantic/Knowledge Extraction   (entities · concepts · timeline · relationships)   ✅ Phase 1
 → Document Planner                 (sections · visuals · metadata, per depth)         ✅ Phase 1
 → Section Planner                  (per-section responsibility + targets)             🟡 (encoded in plan + prompts)
 → Visual / Diagram Planner         (type from content, direction from role)           🟡 (planner + rules done; gen ⬜)
 → Content Generator                (per-section generation, structured)               ⬜ Phase 2
 → Metadata Generator               (reading time, complexity, type, graph)            🟡 (extraction done; UI ⬜)
 → Validator                        (mermaid/uml/render validation + repair)           🟡 (modules exist; wire ⬜)
 → Renderer                         (AST → components, figures, rich tables)            🟡 (components exist; wire ⬜)
 → PDF Export                       (rendered SVGs, figures, TOC, page breaks)          🟡 (print path ✅; figures ⬜)
```

Each stage emits typed objects. Giant markdown is only produced at the final render.

---

## Phase 1 — Foundation (shipped)

Real, tested code. 15 new unit tests (86 total). typecheck + build clean.

**New files**
- `src/lib/content-engine/extraction/types.ts` — `KnowledgeExtraction`, `ExtractedEntity/Concept/TimelineEvent/Relationship` schemas (matches the spec's structures).
- `src/lib/content-engine/extraction/extractors.ts` — **deterministic** extractors (entity/concept/timeline/relationship + doc-type + complexity + topics). Real heuristic NLP, no mocks; guarantees population offline. Fixes Problem 3 ("No entities found").
- `src/lib/content-engine/planner/document-planner.ts` — `planDocument(extraction, depth)` → `DocumentPlan { sections, visuals, metadata, targetWords }`. Sections have **unique responsibilities** (Problem 1); visuals pick **diagram type from content** (Problem 4) + **direction from role** (Problem 5).
- `src/lib/content-engine/mermaid/direction.ts` — `selectMermaidDirection()` / `applyDirection()` (Problem 5).
- Tests: `__tests__/extraction.test.ts`, `__tests__/document-planner.test.ts`.

**Edited**
- `src/lib/types.ts` — `Entity.description/mentions`, `TimelineEvent.significance`, `DocumentRelationship`, `Document.{relationships,topics,complexity,documentType,readingTimeMinutes}` (all optional, backward-compat).
- `src/lib/pipeline.ts` — capture now runs `extractKnowledge()` and **backfills** entities/concepts/timeline (never empty) + stores relationships/topics/complexity/type/reading-time. Mode prompts rewritten for **section responsibilities** (Problem 1) + **authorial intent** (Problem 12); shared `DIAGRAM_RULES` for type+direction (Problems 4/5); Key Takeaways/Key Points enforced as bullets.

---

## Phase 2 — Structured generation (shipped)

Single capture call replaced with a planner-driven, per-section generator. 10 new
tests (96 total). typecheck + build clean.

- `generator/types.ts` ✅ — `GeneratedSection/Visual/Document`, `CompleteFn` (injected single-completion fn → generators are provider-agnostic + testable), `extractCodeBlock`.
- `generator/section-generator.ts` ✅ — `generateSection` runs one section in an isolated call that sees ONLY its responsibility + relevant knowledge slice → sections cannot rephrase each other (Problem 1). Deterministic fallback body if a call fails (never empty).
- `generator/diagram-generator.ts` ✅ — knowledge-graph + timeline built **deterministically** from extracted knowledge (grounded, offline-safe, always valid); architecture/flowchart/sequence/mindmap **model-generated** then `applyDirection` → `validateMermaidCode` → `autoFixMermaid` repair (Problem 4 + FEATURE-001/002). Generic templates gone.
- `generator/orchestrator.ts` ✅ — `generateDocument` runs sections in parallel, then visuals, then `assembleDocument` (figure numbering + captions, Problem 7). Resilient per-section/visual.
- `pipeline.ts` ✅ — online capture now: extract knowledge → `planDocument` → `generateDocument`. Legacy single call kept as a fallback; offline path unchanged.

**Deep Mode richness (Problem 8):** planner `DEPTH_TARGETS` drive it — deep runs all 8 sections + examples + up to 15 visuals incl. knowledge graph; fast runs 4 sections + ≤1 visual.

**Still ⬜ (folded into later phases):** LLM JSON extractor to augment the deterministic baseline; concurrency cap on section calls (currently `Promise.all`).

---

## Phase 3 — Rendering, figures, tables (shipped)

7 new tests (103 total). typecheck + build clean.

- **Rich tables (Problem 6):** ✅ `content-engine/inline-md.ts` (pure tokenizer: bold/italic/code/link) + `components/InlineMarkdown.tsx`. `RichTable.tsx` renders cells, headers and caption through it — `**DevOps**` now renders bold instead of leaking. Sort/filter use `inlineToPlainText` so markers don't interfere.
- **Figure numbering + captions (Problem 7):** ✅ `ContentRenderer` computes sequential figure numbers across diagrams+images by document order; `DiagramBlock` renders `Figure N — caption`. (Cross-refs FEATURE-015 still ⬜.)
- **Side-panel dashboard (Problem 11):** ✅ reader `NotesPanel` → document-intelligence dashboard: reading time, complexity (+Low/Med/High), document type, words, entity/diagram/timeline/concept counts, topic chips; entities show description + mention count; timeline shows significance; new Relationships card. All from the Phase 1 `Document` fields.

**Still ⬜:** entity/importance/relevance badges inside tables; image figure-caption parity in `ImageBlock`.

---

## Phase 4 — PDF export (Problem 9)

Native print path (`exportViaPrint`) already renders real Mermaid/UML SVGs + tables with pagination ✅. Remaining ⬜:
- Inject figure/table numbers + captions into the print clone.
- Auto-TOC from headings; `break-before` on H2; cross-reference resolution.
- Confirm no raw mermaid/uml fences survive (renderer renders all fenced diagrams before print).
- (Playwright is not viable inside an extension; native print is the equivalent. A server-side Playwright export would be a separate optional backend.)

---

## Chat panel redesign (Problem 10)

`src/lib/chat-actions.ts` + `ChatPanel.tsx` ⬜ — replace 3 flat actions with grouped actions backed by the extracted knowledge:
- **Understanding:** Summarize · Explain Simply · ELI5 · Key Insights
- **Research:** Generate Quiz · Flashcards · Study Guide · Extract Definitions
- **Analysis:** Critique · Find Weaknesses · Counterarguments · What's Missing?
- **Knowledge Graph:** Show Entities · Relationships · Timeline · Concepts (render from `Document.{entities,relationships,timeline,concepts}` — instant, no model call)
- **Engineering:** Generate UML · Architecture · Sequence · API Flow (→ diagram-generator)
- **Productivity:** To Notes · To Checklist · Action Items · Meeting Notes

Implement as a typed `ChatAction[]` catalogue (group, id, label, promptBuilder) so the panel renders groups generically.

---

## Database changes

- No Dexie schema bump required for Phase 1 (new `Document` fields are optional; Dexie stores full objects, indices unchanged).
- Phase 2/3: optional new index on `documentType`/`topics` for library filtering; bump `db.ts` version + migration only when adding indexed queries.

---

## Problem → status map

| # | Problem | Status | Where |
|---|---|---|---|
| 1 | Repetitive sections | ✅ | per-section generator: each section generated in isolation (Phase 2) |
| 2 | No document planning | ✅ | `document-planner.ts` |
| 3 | Metadata extraction failing | ✅ | `extractors.ts` wired into capture (deterministic backfill) |
| 4 | Low-quality/generic diagrams | ✅ | content-driven `diagram-generator.ts` (deterministic graph/timeline + validated model diagrams); templates removed |
| 5 | Mermaid direction wrong (always TD) | ✅ | `direction.ts` + `DIAGRAM_RULES` |
| 6 | Tables show raw markdown | ✅ | `inline-md.ts` + `InlineMarkdown` in `RichTable` (Phase 3) |
| 7 | Images/diagrams lack context | ✅ | figure numbering in `ContentRenderer` + `DiagramBlock` captions; assembler stamps `Figure N` (Phase 2/3) |
| 8 | Density modes too similar | ✅ | planner `DEPTH_TARGETS` enforced by generator |
| 9 | PDF export quality | 🟡 | print path renders SVGs/tables ✅; figures/TOC Phase 4 |
| 10 | Chat panel shallow | ⬜ | grouped action catalogue (above) |
| 11 | Weak side-panel metadata | ✅ | document-intelligence dashboard in `NotesPanel` (Phase 3) |
| 12 | No authorial intent | 🟡→✅ prompts | prompts demand interpretation; reinforced by Analysis section + generator |

---

## Verify
`npx tsc --noEmit` · `npm test` (86 passing, 14 files) · `npx wxt build`
