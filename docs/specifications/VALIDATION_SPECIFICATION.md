# Validation Specification

**Status:** Draft  
**Date:** 2026-07-06  
**Author:** NDL Engineering Team  
**Version:** 0.1.0

---

## 1. Validation Architecture

The NDL pipeline processes documents through four stages: Lexing, Parsing, Validation, and Rendering. Validation occupies the third stage — it runs on the fully constructed AST after parsing completes and before rendering begins.

```
Source → [Lexer] → TokenStream → [Parser] → AST → [Validator] → ValidatedAST → [Renderer]
                                                          │
                                                          └→ ValidationResult
```

This placement is intentional:

- **Post-parse**: The validator operates on a complete AST, giving it full structural and semantic context. It can inspect heading hierarchy, cross-reference validity, and block-level relationships.
- **Pre-render**: Errors and warnings are surfaced before any output is produced, preventing malformed documents from reaching consumers.

The validator is a pure function: `validate(ast: NDLDocument, options?: ValidationOptions): ValidationResult`. It MUST NOT mutate the AST. The pipeline MAY abort rendering when `ValidationResult.valid` is `false`, depending on the consumer's strictness configuration.

### 1.1 Pipeline Integration Points

The pipeline exposes two configurable behaviors:

1. **Reject on error** (`strict: true`): The pipeline halts and returns the validation result to the caller. No render output is produced.
2. **Warn on error** (`strict: false`): The pipeline logs errors and warnings but proceeds to rendering. This mode is intended for development workflows and interactive editors.

The pipeline MAY skip rendering entirely if `ValidationResult.errors` is non-empty and the consumer does not explicitly override the behavior.

### 1.2 Execution Model

Rules execute in a single pass over the AST, in declaration order. Each rule receives the root `NDLDocument` node and returns an array of `Diagnostic` objects. The validator aggregates all diagnostics, deduplicates by position and rule ID, and produces the final `ValidationResult`.

Rules SHOULD be stateless. If a rule requires state (e.g., tracking seen headings), it MUST reset that state at the beginning of each `validate()` call.

---

## 2. ValidationResult Structure

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  infos: Diagnostic[];
}

interface Diagnostic {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  position: SourcePosition | null;
  suggestion?: string;
}
```

### 2.1 Fields

- **valid**: `true` when `errors.length === 0`. Warnings and infos do not affect validity.
- **errors**: Diagnostics that violate structural or semantic rules. The pipeline SHOULD reject documents with errors in strict mode.
- **warnings**: Diagnostics that indicate suboptimal or suspicious patterns. The pipeline SHOULD surface warnings but MUST NOT reject on warnings alone.
- **infos**: Informational diagnostics (statistics, observations). The pipeline SHOULD surface infos in verbose or lint-style output.

### 2.2 SourcePosition

```typescript
interface SourcePosition {
  line: number; // 1-indexed
  column: number; // 1-indexed
  offset: number; // 0-indexed byte offset from start of document
}
```

Positions SHOULD point to the start of the offending construct. When a rule spans multiple lines, `position` SHOULD point to the first line. Multi-line diagnostics MAY include an optional `endPosition` field.

---

## 3. Rule Catalog

All rules are identified by a stable, uppercase, hyphenated string ID. Rules are categorized by severity. The catalog is versioned; a rule MAY be promoted from warning to error in a major version bump.

### 3.1 HEADING-HIERARCHY

**Severity:** error  
**Scope:** Entire document  
**Description:** Heading levels MUST NOT jump by more than one level. For example, an `h2` followed by an `h4` is invalid because level 3 is skipped. An `h4` followed by an `h2` is also invalid because the jump exceeds one level in the upward direction (unless a non-heading block intervenes, which resets the hierarchy expectation).  
**Rationale:** Screen readers, table-of-contents generators, and structural analyzers depend on a gapless hierarchy. Jumps produce an ill-formed outline.  
**Exception:** The first heading in the document may be any level (though the `FIRST-HEADING` rule still applies). After the first heading, jumps > 1 are errors.

### 3.2 FIRST-HEADING

**Severity:** error  
**Scope:** First non-empty node in the document body  
**Description:** The document MUST start with an `h1` heading before any other block-level content.  
**Rationale:** Every NDL document describes a titled artifact. The `h1` serves as the document title and establishes the root of the heading hierarchy.  
**Exception:** YAML frontmatter and blank lines at the beginning of the document are ignored for the purposes of this rule.

### 3.3 DUPLICATE-HEADING

**Severity:** warning  
**Scope:** Per heading level  
**Description:** Two headings at the same level with identical text content SHOULD NOT appear in the same document.  
**Rationale:** Duplicate headings confuse readers and break cross-reference links. Identical text at different levels (e.g., `h2` "API" and `h3` "API") is NOT flagged — only same-level duplicates are warned.  
**Suggestion:** Append a disambiguating suffix (e.g., "API (Public)" vs "API (Internal)"), or promote one to a different level.

### 3.4 EMPTY-SECTION

**Severity:** warning  
**Scope:** Each heading  
**Description:** A heading MUST be followed by at least one block of non-whitespace content before the next heading or end of document.  
**Rationale:** Empty sections indicate incomplete authoring or dead structure. They also render as invisible entries in the table of contents.  
**Suggestion:** Either add content to the section or remove the heading.

### 3.5 DIAGRAM-CONTENT

**Severity:** error  
**Scope:** Each diagram block  
**Description:** A diagram block (Mermaid, PlantUML, etc.) MUST contain at least 10 non-whitespace characters of diagram source.  
**Rationale:** Empty or stub diagram blocks produce useless or broken rendered output. The minimum length ensures the diagram source is substantive enough to render meaningfully.  
**Suggestion:** Provide diagram source or remove the empty diagram block.

### 3.6 CALLOUT-KIND

**Severity:** error  
**Scope:** Each callout block  
**Description:** The `kind` of a callout block MUST be one of the allowed values: `note`, `tip`, `warning`, `danger`, `info`.  
**Rationale:** Callout kinds drive both visual styling and semantic interpretation. Unknown kinds produce fallback rendering that may confuse readers.  
**Configuration:** The set of allowed callout kinds is defined in `ValidationOptions.allowedCalloutKinds`. Consumers MAY extend this list.

### 3.7 CODE-LANGUAGE

**Severity:** warning  
**Scope:** Each fenced code block  
**Description:** The language identifier on a fenced code block SHOULD be a known language identifier from the IANA Language Subtag Registry or from a well-known list (e.g., Linguist languages).  
**Rationale:** Unknown language identifiers disable syntax highlighting and break language-aware tooling (linters, formatters).  
**Configuration:** The set of known languages is defined in `ValidationOptions.knownLanguages`. The default set includes the top 100 languages from GitHub Linguist.  
**Suggestion:** Use a standard language identifier (e.g., `typescript` instead of `tsc` or `TypeScript`).

### 3.8 DIAGRAM-KIND

**Severity:** error  
**Scope:** Each diagram block  
**Description:** The diagram type identifier MUST be one of the allowed values: `mermaid`, `plantuml`, `d2`, `graphviz`.  
**Rationale:** The NDL renderer only supports a finite set of diagram renderers. Unknown diagram types produce rendering errors.  
**Configuration:** The set of allowed diagram kinds is defined in `ValidationOptions.allowedDiagramKinds`.

### 3.9 IMAGE-ALT

**Severity:** error  
**Scope:** Each image node  
**Description:** Every image MUST have non-empty alt text.  
**Rationale:** Alt text is required for accessibility (screen readers), for fallback rendering when images fail to load, and for text-based output formats. Decorative images MUST use an empty alt attribute (`alt=""`), which is represented as a present but empty alt text in NDL.  
**Suggestion:** Add descriptive alt text. If the image is purely decorative, use `![]()` syntax.

### 3.10 TABLE-STRUCTURE

**Severity:** error  
**Scope:** Each table  
**Description:** All rows in a table MUST have the same number of columns. The header row MUST have the same column count as body rows.  
**Rationale:** Uneven column counts produce misaligned or broken rendered tables. The column count is determined by the number of cells in the header row.  
**Suggestion:** Pad rows with empty cells or restructure the table to have consistent column alignment.

### 3.11 METADATA

**Severity:** info  
**Scope:** Document-level metadata (YAML frontmatter)  
**Description:** Computes and reports the following metadata: total word count (excluding code blocks), title presence (from `title` frontmatter field), estimated reading time, and heading count.  
**Rationale:** Provides authors with a quick quality signal about document completeness.  
**Suggestion (if no title):** Add a `title` field to the YAML frontmatter.

---

## 4. Severity Levels

| Severity  | Gate | Description                                           |
| --------- | ---- | ----------------------------------------------------- |
| `error`   | Yes  | Structural or semantic violation. Must be fixed.      |
| `warning` | No   | Suspicious or suboptimal pattern. Should be reviewed. |
| `info`    | No   | Informational observation. No action required.        |

- The pipeline MUST report all diagnostics regardless of severity.
- The `valid` field in `ValidationResult` is `true` if and only if `errors` is empty.
- Consumers MAY promote warnings to errors via `ValidationOptions.warningAsError` for stricter enforcement.
- Consumers MAY demote errors to warnings via `ValidationOptions.errorAsWarning` for development flows (not recommended for CI).

---

## 5. ValidationOptions Interface

```typescript
interface ValidationOptions {
  strict: boolean;
  allowedCalloutKinds: string[];
  knownLanguages: string[];
  allowedDiagramKinds: string[];
  warningAsError: string[]; // rule IDs to promote
  errorAsWarning: string[]; // rule IDs to demote
  maxWarnings: number; // cap on reported warnings (0 = unlimited)
}
```

### 5.1 Default Values

```typescript
const defaultValidationOptions: ValidationOptions = {
  strict: true,
  allowedCalloutKinds: ['note', 'tip', 'warning', 'danger', 'info'],
  knownLanguages: [/* top 100 GitHub Linguist languages */],
  allowedDiagramKinds: ['mermaid', 'plantuml', 'd2', 'graphviz'],
  warningAsError: [],
  errorAsWarning: [],
  maxWarnings: 0,
};
```

### 5.2 Field Semantics

- **strict**: When `true`, the pipeline MUST abort rendering when `valid === false`. When `false`, the pipeline SHOULD proceed.
- **allowedCalloutKinds**: Extended list of valid callout kinds. Custom renderers may register additional kinds here.
- **knownLanguages**: Extended list of valid code language identifiers. Projects may add internal or niche languages.
- **allowedDiagramKinds**: Extended list of valid diagram renderers. Custom render backends may register additional kinds.
- **warningAsError**: Rule IDs listed here have their severity promoted from `warning` to `error` before the `valid` flag is computed.
- **errorAsWarning**: Rule IDs listed here have their severity demoted from `error` to `warning`.
- **maxWarnings**: If non-zero, the validator caps the number of warnings returned. Errors and infos are not affected.

---

## 6. Integration with Pipeline

### 6.1 validate() Function

```typescript
function validate(document: NDLDocument, options?: Partial<ValidationOptions>): ValidationResult;
```

The function:

1. Merges provided options with defaults.
2. Applies severity overrides (`warningAsError`, `errorAsWarning`).
3. Executes each rule against the AST.
4. Aggregates diagnostics, deduplicating by `(ruleId, line, column)`.
5. Computes the `valid` flag.
6. Returns the `ValidationResult`.

### 6.2 Pipeline Abort Behavior

```
function process(source: string, options: PipelineOptions): ProcessResult {
  const ast = parse(source);
  const validation = validate(ast, options.validation);
  if (!validation.valid && options.validation.strict) {
    return { ok: false, validation, output: null };
  }
  const output = render(ast, options.renderer);
  return { ok: true, validation, output };
}
```

When the pipeline aborts:

- The output is `null`.
- The validation result is returned to the caller for inspection.
- The caller MAY choose to log, display, or store the diagnostics.

### 6.3 Streaming Output

For interactive editors and language servers, the validator SHOULD support incremental re-validation on AST updates. The single-pass execution model makes this straightforward: each rule processes the full AST, so caching per-rule results at the node level is a future optimization.
