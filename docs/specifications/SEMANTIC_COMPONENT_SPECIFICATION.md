# Semantic Component Specification

**Status:** Draft  
**Date:** 2026-07-06  
**Author:** NDL Engineering Team  
**Version:** 0.1.0

---

## 1. Introduction

The Notch Definition Language (NDL) extends standard Markdown with first-class semantic blocks. While Markdown is an excellent medium for structured prose, it lacks a mechanism for tagging content with domain-specific meaning. A paragraph describing system architecture is syntactically identical to a paragraph describing a security constraint, yet the two serve fundamentally different purposes in documentation workflows.

Semantic components — `SemanticBlock` nodes in the NDL abstract syntax tree — solve this by introducing a typed block construct that carries a `kind` discriminator. These blocks allow tooling to reason about content: a CI pipeline can extract all `security` blocks to generate a threat-model appendix; a renderer can apply distinct visual treatment to `example` blocks; an LLM ingestion pipeline can route `architecture` blocks to a system-design knowledge graph.

This specification defines the set of built-in semantic block kinds, their intended semantics, visual treatment conventions, and the implementation contract for the NDL parser and renderer.

---

## 2. SemanticBlock Types

NDL defines nine built-in semantic block kinds, each identified by a lowercase string literal used as the `kind` discriminator.

| Kind           | Purpose                                      |
| -------------- | -------------------------------------------- |
| `architecture` | System structure, component relationships    |
| `performance`  | Benchmarks, latency, throughput constraints  |
| `security`     | Threat models, AuthN/Z, data protection      |
| `api`          | Endpoint specs, request/response contracts   |
| `example`      | Runnable or illustrative code/output samples |
| `history`      | Changelog, decision log, revision timeline   |
| `future-work`  | Planned but unimplemented features           |
| `timeline`     | Chronological sequences, roadmaps            |
| `definition`   | Glossary terms, concept explanations         |

### 2.1 `architecture`

Describes system structure, component boundaries, data flow, and deployment topology.

**Visual treatment:** A diagram-friendly container (wide, minimal padding). Renderers MAY render with a blueprint-style left border (solid, #2563EB) and an optional icon. Supporting diagrams (Mermaid, PlantUML) inside the block SHOULD be afforded full-width layout.

**Usage rules:**

- SHOULD NOT contain runnable code examples (use `example` instead).
- MAY reference external ADRs or RFCs via NDL cross-reference syntax.

### 2.2 `performance`

Captures quantitative performance characteristics: latency percentiles, throughput ceilings, memory footprints, and benchmark results.

**Visual treatment:** Compact container with monospace-friendly typography. Renderers MAY render with a gauge- or metric-themed accent color (e.g., #059669). Tables of benchmark data SHOULD be styled with right-aligned numeric columns.

**Usage rules:**

- MUST include at least one measurable claim (a number with unit).
- SHOULD specify the measurement methodology (tool, environment, date).

### 2.3 `security`

Documents security-relevant concerns: threat models, trust boundaries, authentication flows, authorization rules, and data sensitivity classifications.

**Visual treatment:** High-visibility container with a prominent left border (#DC2626) or banner. Renderers MAY apply a subtle caution icon or lock icon. Content SHOULD be clearly separated from adjacent non-security blocks.

**Usage rules:**

- MUST NOT contain secrets, keys, or credentials in any form.
- SHOULD follow a consistent structure (e.g., STRIDE category, risk level, mitigation).
- Renderers MAY emit security blocks to a separate security report artifact.

### 2.4 `api`

Describes an API endpoint, event contract, or function signature.

**Visual treatment:** Code-friendly container with a monospace heading for the endpoint path or function name. Renderers MAY apply syntax-highlighted HTTP method badges (GET, POST, etc.). Request/response examples SHOULD use fenced code blocks inside the semantic block.

**Usage rules:**

- SHOULD include at least: path/method (HTTP) or signature (function), request format, response format.
- MAY include error codes, rate limits, and versioning notes.
- Renderers MAY generate OpenAPI fragments from well-structured `api` blocks.

### 2.5 `example`

Provides illustrative content: code snippets, sample outputs, walkthroughs, or usage patterns.

**Visual treatment:** Distinct background color (e.g., #F8FAFC with a dashed border) to visually separate examples from specification prose. Renderers MAY add a "Copy" button for code examples.

**Usage rules:**

- SHOULD specify the language or runtime context in the block heading.
- MAY reference other parts of the document via cross-reference links.
- MUST NOT contain normative specification text (use a regular Markdown section for that).

### 2.6 `history`

Records the evolution of the document or system: change log entries, decision records, and revision notes.

**Visual treatment:** Timeline-like vertical layout. Renderers MAY prepend a date badge or marker. Older entries SHOULD be visually de-emphasized (lower opacity or smaller type).

**Usage rules:**

- Each entry SHOULD include a date and a brief description of the change.
- Entries are ordered chronologically (newest first or oldest first; the document SHOULD declare which).
- Renderers MAY collapse entries older than a configurable threshold.

### 2.7 `future-work`

Describes planned features, known gaps, or intentional omissions deferred to a later version.

**Visual treatment:** Muted or ghost-style container (e.g., dashed border, low-saturation accent). Renderers MAY append a "Planned" or "Deferred" tag.

**Usage rules:**

- MUST be clearly marked as non-normative.
- SHOULD include a target version or milestone when known.
- MUST NOT contain critical security or correctness information (use `security` or normative sections).

### 2.8 `timeline`

Chronological sequence of events, milestones, or phases. Distinct from `history` in that timelines are forward-looking (roadmap) or event-oriented rather than change-oriented.

**Visual treatment:** Horizontal or vertical timeline visualization. Renderers MAY render as a Gantt-like chart or connected node sequence.

**Usage rules:**

- Each entry MUST have a date or ordinal position.
- MAY include duration estimates for roadmap items.
- SHOULD use consistent date formatting (ISO 8601 recommended).

### 2.9 `definition`

A glossary entry or concept definition.

**Visual treatment:** Compact card with the term displayed in bold or as a small heading. Renderers MAY collect all `definition` blocks into a glossary appendix.

**Usage rules:**

- The first line MUST be the term being defined.
- Subsequent lines contain the definition body.
- SHOULD be referenced from other sections via NDL cross-reference syntax.

---

## 3. Implementation

### 3.1 SemanticBlockNode

The NDL AST defines a `SemanticBlockNode` type that carries a `kind` discriminator and a `content` subtree.

```
SemanticBlockNode {
  type: "semantic_block"
  kind: "architecture" | "performance" | "security" | "api" | "example" | "history" | "future-work" | "timeline" | "definition"
  children: InlineNode[]
  position: SourcePosition
  meta: Record<string, string>  // optional key-value attributes
}
```

The `kind` field is the sole discriminator. The `meta` field allows block-level attributes (e.g., `language=typescript` for an `example` block, or `method=POST` for an `api` block).

### 3.2 Source Syntax

Semantic blocks use doubled colon fences in Markdown source:

```ndl
::example language=typescript
const greet = (name: string): string => `Hello, ${name}`;
::
```

The opening fence is two colons (`::`) followed by the `kind`. Optional key-value pairs (`key=value`) may follow on the same line. The closing fence is two colons on a line by themselves.

This syntax was chosen to:

- Avoid ambiguity with standard Markdown fenced code blocks (which use triple backticks or tildes).
- Allow parser implementations to distinguish semantic blocks trivially during the lexing phase.
- Support inline metadata without requiring a separate frontmatter section.

Parser implementations MUST produce a `SemanticBlockNode` when encountering the `::kind` fence sequence. Unknown kinds SHOULD produce a `SemanticBlockNode` with `kind: "unknown"` and a warning, rather than a parse error, to maintain forward compatibility.

### 3.3 Parser Integration

The NDL pipeline processes standard Markdown first (paragraphs, headings, lists, code blocks, tables, images), then lexes for `::` fences as a second pass over the raw line buffer, or as a dedicated lexer state between the heading/paragraph matchers.

```
Raw text
  → Lexer (Markdown + ::fence detection)
    → Parser (Paragraph, Heading, SemanticBlock, ...)
      → AST
```

The lexer transitions to a `FENCE` state when it encounters a line matching `/^::[a-z][a-z0-9_-]*(\\s+.*)?$/`. It collects all subsequent lines until a lone `::` appears. The collected body is then passed through inline parsing (bold, italic, code, links, images) and attached to the `SemanticBlockNode.children`.

### 3.4 Renderer Integration

Renderers SHOULD map `SemanticBlockNode.kind` to a visual component registry. A React renderer, for example, would maintain:

```typescript
const blockComponents: Record<string, React.ComponentType<BlockProps>> = {
  architecture: ArchitectureBlock,
  security: SecurityBlock,
  // ...
};
```

If a renderer encounters an unknown kind, it MUST fall back to a generic `SemanticBlock` component that renders the content with a neutral visual treatment and a small tag indicating the kind.

Renderers SHOULD emit a console warning (development mode) or structured log (production) when rendering an unknown semantic block kind.

---

## 4. Extensibility

### 4.1 Adding New Kinds

The set of built-in kinds is intentionally small and domain-generic. Projects MAY extend the kind set by:

1. Defining a new kind string (e.g., `cost`, `compliance`, `accessibility`).
2. Registering a visual component for the new kind in the renderer configuration.
3. Optionally registering validation rules for the new kind in the NDL validator.

Because the `kind` field is a string literal union at the type-system level, extending the type requires updating the union definition:

```typescript
// Built-in
type SemanticKind = "architecture" | "performance" | ... | "definition";

// Extended in project
type ExtendedSemanticKind = SemanticKind | "cost" | "compliance";
```

Parser implementations MUST NOT reject unknown kinds. This ensures that documents authored with a newer kind set remain parseable by older tools.

### 4.2 Forward Compatibility

To maintain forward compatibility:

- The parser MUST NOT emit errors for unknown kinds. It MUST emit a `SemanticBlockNode` with `kind` set to the unknown string and add a diagnostic warning to the validation result.
- The renderer MUST provide a fallback component for unregistered kinds.
- Documentation authors SHOULD declare the minimum tool version required for any non-built-in kinds.

---

## 5. Future Considerations

1. **Nesting rules:** A future version MAY define which NDL blocks are allowed as children inside a `SemanticBlock`.
2. **Kind hierarchy:** A future version MAY introduce sub-kind or namespaced kinds (e.g., `security.threat-model`).
3. **Semantic block references:** A future version MAY allow cross-document references to specific `SemanticBlock` instances by ID.
