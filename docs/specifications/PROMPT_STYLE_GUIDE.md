# Prompt Style Guide

**Version:** 1.0.0  
**Status:** RFC (Request for Comments)  
**Last Updated:** 2026-07-06  
**Author:** Notch Architectural Committee  
**Applies To:** Prompt engineering for NDL document generation across all supported AI models

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prompt Architecture](#2-prompt-architecture)
3. [Module Reference](#3-module-reference)
4. [Generation Modes](#4-generation-modes)
5. [Document Classes](#5-document-classes)
6. [Cross-Model Normalization](#6-cross-model-normalization)
7. [Integration with NDGS](#7-integration-with-ndgs)
8. [Implementation](#8-implementation)

---

## 1. Introduction

### 1.1 Purpose

This specification defines the Prompt Style Guide (PSG), a modular prompt framework for the Notch Document Language (NDL) generation system. The PSG replaces monolithic static prompts with a composable architecture of independent prompt modules that can be assembled based on generation mode, document class, and target AI model.

### 1.2 Motivation

The original NDL generation system relied on a single static system prompt spanning hundreds of lines. This approach had several drawbacks:

- **Model sensitivity:** Different AI models responded differently to the same prompt text, requiring bespoke prompt variants.
- **Maintenance burden:** Any change to a single rule required rewriting the entire prompt and retesting across all models.
- **Mode inflexibility:** The static prompt could not adapt its level of detail between fast, balanced, and deep generation modes.
- **Class rigidity:** All documents followed the same structural template regardless of their intended document class.

The PSG addresses these issues by decomposing the prompt into independent modules that are dynamically assembled at generation time.

### 1.3 Scope

**In scope:** Module definitions, assembly rules, generation mode specifications, document class templates, normalization rules, and the TypeScript implementation interface.

**Out of scope:** AI model-specific prompt formatting (handled by provider adapters), validation of generated output (see [Validation Specification](./VALIDATION_SPECIFICATION.md)), rendering behavior (see [Renderer Specification](./RENDERER_SPECIFICATION.md)).

---

## 2. Prompt Architecture

### 2.1 Module System

The prompt is decomposed into the following modules, each responsible for a specific aspect of generation behavior:

| Module ID       | Name                      | Purpose                                                                 |
| --------------- | ------------------------- | ----------------------------------------------------------------------- |
| `role`          | Role Definition           | Sets the AI model's persona and behavioral constraints                  |
| `structure`     | Document Structure        | Defines heading hierarchy, section ordering, and layout rules           |
| `format`        | Format Rules              | Specifies markdown syntax requirements and block type usage             |
| `style`         | Writing Style             | Governs voice, tone, sentence construction, and terminology             |
| `callouts`      | Callout Rules             | Defines callout type selection, placement, and content constraints      |
| `code`          | Code Block Rules          | Specifies code formatting, language identifiers, and annotation syntax  |
| `diagrams`      | Diagram Rules             | Controls diagram type selection, syntax, placement, and density         |
| `tables`        | Table Rules               | Governs table structure, alignment, column limits, and type selection   |
| `output`        | Output Contract           | Defines the expected output format, metadata, and structural guarantees |
| `normalization` | Cross-Model Normalization | Model-agnostic formatting rules that override model-specific defaults   |
| `source`        | Source Content Handling   | Rules for processing, truncating, and referencing source content        |

### 2.2 Assembly Order

Modules are assembled in the following order within the final prompt:

```
1. role           — establishes behavioral context
2. source         — provides source content with handling instructions
3. structure      — defines the document skeleton
4. format         — sets markdown syntax requirements
5. style          — governs writing voice and tone
6. diagrams       — diagram type selection and placement rules
7. callouts       — callout usage rules
8. code           — code block formatting and annotation rules
9. tables         — table structure and alignment rules
10. output        — output contract and structural guarantees
11. normalization — final cross-model normalization overrides
```

### 2.3 Module Composition Rules

1. Every assembled prompt MUST include the `role`, `output`, and `normalization` modules — these are mandatory.
2. The `source` module is mandatory when source content is provided; it is omitted for blank-document generation.
3. The `diagrams`, `callouts`, `code`, and `tables` modules are OPTIONAL. They are included when their respective block types are relevant to the generation mode and document class.
4. Module content is filtered based on the generation mode — deep mode includes full detail, fast mode includes only the critical rules.

---

## 3. Module Reference

### 3.1 Role Module (`role`)

**Purpose:** Establishes the AI model's persona, expertise level, and behavioral guardrails.

**Contents:**

- Expert designation (e.g., "You are a senior technical writer specializing in system architecture documentation.")
- Behavioral constraints (e.g., "Do not add meta-commentary about the document itself.")
- Content boundaries (e.g., "Do not include opinions, speculation, or unsourced claims.")
- Output posture (e.g., "Write with authority. Assume the reader is a proficient engineer.")

**Mandatory:** Yes.

### 3.2 Document Structure Module (`structure`)

**Purpose:** Defines the required and optional sections for the document based on its class.

**Contents:**

- Section ordering template
- Heading level constraints
- Minimum and maximum section counts
- Required sections for the selected document class

**Mandatory:** Yes.

### 3.3 Format Rules Module (`format`)

**Purpose:** Specifies the markdown syntax requirements and allowed block types.

**Contents:**

- Allowed block types (headings, paragraphs, lists, code blocks, diagrams, callouts, tables, equations, semantic blocks)
- Syntax formatting rules (ATX headings, fenced code blocks, inline formatting)
- Block type density constraints (maximum diagrams per word count, maximum consecutive code blocks)
- Block type sequencing rules (prose before diagrams, prose before code)

**Mandatory:** Yes.

### 3.4 Writing Style Module (`style`)

**Purpose:** Governs voice, tone, sentence structure, and terminology.

**Contents:**

- Voice and tone specification (third person, objective, formal but not academic)
- Sentence construction rules (subject-verb-object order, active voice, maximum 40 words)
- Paragraph construction rules (2-6 sentences, clear topic sentence, information density)
- Terminology standardization table (e.g., "use" not "utilize")
- Abbreviation handling rules

**Mandatory:** Yes.

### 3.5 Callout Rules Module (`callouts`)

**Purpose:** Controls callout type selection, placement, and content constraints.

**Contents:**

- Supported callout types (NOTE, TIP, WARNING, DANGER, INFO, IMPORTANT, CAUTION, SUCCESS, QUESTION)
- Callout type selection guidelines (which type for which situation)
- Placement rules (maximum one callout per three prose paragraphs)
- Content constraints (no code blocks, no diagrams, no headings inside callouts)
- Formatting rules (GFM alert syntax, optional title, concise content)

**Mandatory:** No.

### 3.6 Code Block Rules Module (`code`)

**Purpose:** Specifies code formatting, language identifiers, and annotation syntax.

**Contents:**

- Required language identifier table
- Language normalization aliases (e.g., `js` maps to `javascript`)
- Code annotation syntax (filename comments, line highlighting)
- Code quality rules (syntactic validity, self-contained examples, descriptive naming)
- Maximum code block density rules

**Mandatory:** No.

### 3.7 Diagram Rules Module (`diagrams`)

**Purpose:** Controls diagram type selection, syntax, placement, and density.

**Contents:**

- Supported diagram types and engines (Mermaid, PlantUML)
- Preferred diagram type by content pattern (e.g., sequenceDiagram for protocols, flowchart for pipelines)
- Diagram direction selection (LR vs TD based on use case)
- Placement rules (one diagram per 500 words, always preceded by prose)
- Syntax validation rules

**Mandatory:** No.

### 3.8 Table Rules Module (`tables`)

**Purpose:** Governs table structure, alignment, column limits, and type selection.

**Contents:**

- Standard table format with alignment row
- Maximum column count (8) and cell width (200 characters)
- Recommended table types by content pattern (comparison, API, specification, metric)
- Table placement and prose introduction rules

**Mandatory:** No.

### 3.9 Output Contract Module (`output`)

**Purpose:** Defines the expected output format, metadata, and structural guarantees.

**Contents:**

- Output format requirement (standard GFM markdown)
- Structural metadata requirements (heading hierarchy, section count, block distribution)
- Post-processing instructions (no custom `{#id}` attributes, no HTML beyond KaTeX)
- Failure conditions (what constitutes unacceptable output)

**Mandatory:** Yes.

### 3.10 Cross-Model Normalization Module (`normalization`)

**Purpose:** Model-agnostic formatting rules that override model-specific defaults.

**Contents:**

- Language identifier normalization table
- Heading case and punctuation rules
- List formatting consistency rules
- Callout case normalization rules
- Reference format normalization rules

**Mandatory:** Yes.

### 3.11 Source Content Handling Module (`source`)

**Purpose:** Rules for processing, truncating, and referencing source content.

**Contents:**

- Source content inclusion format
- Truncation strategy (preserve first and last 25%, truncate middle)
- Content priority ordering (main content before headers/footers)
- Truncation marker inclusion rules

**Mandatory:** Conditional — included when source content is provided.

---

## 4. Generation Modes

### 4.1 Mode Overview

The PSG defines three generation modes that control the depth, length, and structural complexity of generated documents.

| Mode     | Output Length   | Sections | Diagrams | Callouts | Code Blocks | Use Case                                                   |
| -------- | --------------- | -------- | -------- | -------- | ----------- | ---------------------------------------------------------- |
| Fast     | 300-600 words   | 3-5      | 0-1      | 0-1      | 0-2         | Quick summaries, reference lookups, mobile capture         |
| Balanced | 600-1500 words  | 5-8      | 1-3      | 1-3      | 2-4         | Standard document generation, default mode                 |
| Deep     | 1500-4000 words | 8-12     | 3-6      | 3-6      | 4-8         | Comprehensive analysis, research papers, architecture docs |

### 4.2 Fast Mode

**Characteristics:**

- Concise, single-pass generation with minimal structural overhead.
- Maximum one diagram, placed in the most semantically relevant section.
- Maximum one callout, used only if critical information requires separation.
- Maximum two code blocks, each under 15 lines.
- Section headings limited to H2 level (no subsections).
- Sections: Introduction, Core Content (2-3 subsections), Key Takeaways.

**Module assembly:** Includes all mandatory modules plus `diagrams`, `callouts`, and `code` in condensed form — only the most critical three rules per module.

### 4.3 Balanced Mode

**Characteristics:**

- Moderate depth with reasonable structural variety.
- Up to three diagrams distributed across relevant sections.
- Up to three callouts for notes, warnings, and tips.
- Standard code examples with annotations.
- H2 and H3 headings permitted.
- Sections: Introduction, Context, Core Content (3-5 subsections), Discussion, Conclusion.

**Module assembly:** All eleven modules included at standard detail level. Each optional module includes its full rule set.

### 4.4 Deep Mode

**Characteristics:**

- Comprehensive, high-detail generation suitable for reference material.
- Up to six diagrams including sequence diagrams, flowcharts, and class diagrams.
- Up to six callouts covering notes, warnings, tips, and important alerts.
- Full code examples with filename annotations and line highlighting.
- H2, H3, and H4 headings permitted.
- Sections: Abstract, Introduction, Background, Architecture/Approach, Implementation, Analysis, Discussion, Future Work, Conclusion, References.

**Module assembly:** All eleven modules included at maximum detail. Each optional module includes all rules, examples, and edge case guidance.

---

## 5. Document Classes

### 5.1 Class Overview

Each document class defines a structural template that determines which sections are required, which are optional, and how content is organized within the document.

| Class          | Purpose                                              | Required Sections                                                            |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `technical`    | API docs, SDK guides, configuration references       | Introduction, Setup, Reference, Examples, Troubleshooting                    |
| `explainer`    | Concept explanations, deep dives, background context | Introduction, Core Concept, How It Works, Implications, Summary              |
| `compare`      | Tool/framework comparisons, decision guides          | Introduction, Options Overview, Head-to-Head Comparison, Recommendation      |
| `how_to`       | Task-oriented guides, problem-solving                | Introduction, Prerequisites, Steps (numbered), Verification, Troubleshooting |
| `tutorial`     | Step-by-step learning paths with setup               | Introduction, Prerequisites, Setup, Implementation (multi-step), Summary     |
| `architecture` | System design docs, architecture decisions           | Context, Constraints, Architecture Overview, Component Breakdown, Decisions  |
| `migration`    | Version upgrades, platform migrations                | Context, Current State, Target State, Migration Plan, Rollback Strategy      |
| `general`      | Default class, no specific template                  | Introduction, Content Sections, Conclusion                                   |

### 5.2 Technical Class Template

```
1. Introduction — what this document covers, system scope
2. Prerequisites — required knowledge, tools, versions
3. Core Reference — structured technical content
   - Configuration options (table)
   - API endpoints (if applicable)
   - Key concepts with diagrams
4. Examples — practical usage examples with code
5. Troubleshooting — common issues and resolutions
6. References — external documentation links
```

### 5.3 Explainer Class Template

```
1. Introduction — the concept and its significance
2. Core Concept — definition, formal description
3. How It Works — mechanism breakdown with diagram
4. Key Properties — characteristics, trade-offs, edge cases
5. Practical Implications — how it affects system design
6. Summary — key takeaways
```

### 5.4 Compare Class Template

```
1. Introduction — what is being compared and why
2. Options Overview — brief introduction to each option
3. Head-to-Head Comparison — table of attributes
4. Detailed Analysis — per-criterion breakdown
5. Recommendation — guidance with justification
6. References — comparison sources, benchmarks
```

### 5.5 How-To Class Template

```
1. Introduction — what the reader will accomplish
2. Prerequisites — required conditions
3. Step-by-Step — numbered steps with code/terminal blocks
4. Verification — how to confirm success
5. Troubleshooting — common failure modes
```

### 5.6 Tutorial Class Template

```
1. Introduction — what the reader will learn
2. Prerequisites — required knowledge and tools
3. Setup — environment preparation
4. Implementation Steps — progressive build with diagrams
5. Understanding — architecture/design insights
6. Summary — what was learned, next steps
```

### 5.7 Architecture Class Template

```
1. Context — business/technical drivers
2. Constraints — non-negotiable requirements
3. Architecture Overview — high-level diagram
4. Component Breakdown — per-service/module detail
5. Data Flow — request/event flow with sequence diagram
6. Key Decisions — architectural decision records
7. References — related ADRs, RFCs
```

### 5.8 Migration Class Template

```
1. Context — why migration is needed
2. Current State — existing architecture inventory
3. Target State — desired architecture
4. Migration Plan — phased approach with diagram
5. Risk Mitigation — rollback strategy, safe guards
6. Timeline — milestones and dependencies
```

### 5.9 General Class Template

```
1. Introduction
2. Content Sections (dynamically determined)
3. Conclusion
```

---

## 6. Cross-Model Normalization

### 6.1 Normalization Principles

Cross-model normalization ensures that documents generated by different AI models are structurally and stylistically indistinguishable. The normalization module contains overrides that correct model-specific tendencies.

### 6.2 Language Identifier Normalization

| Model Tendency                         | Normalization Rule                                |
| -------------------------------------- | ------------------------------------------------- |
| Claude uses `js`, `ts`, `py`           | Normalize to `javascript`, `typescript`, `python` |
| GPT-4o uses `javascript`, `typescript` | Accept as-is                                      |
| Gemini uses `js`, `ts`                 | Normalize to `javascript`, `typescript`           |
| Llama uses inconsistent aliases        | Normalize all to canonical form                   |

### 6.3 Heading Normalization

| Model Tendency                                    | Normalization Rule                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Claude omits period after heading numbers         | Strip all trailing punctuation from headings                       |
| GPT-4o capitalizes every word in headings         | Convert to sentence case                                           |
| Gemini uses numbered headings (`1. Introduction`) | Strip leading numbers — section numbers are assigned by the parser |
| Llama occasionally skips heading levels           | Enforce no-skip rule via prompt                                    |

### 6.4 Callout Normalization

| Model Tendency                     | Normalization Rule                      |
| ---------------------------------- | --------------------------------------- |
| Claude uses `[!Note]` (title case) | Normalize to `[!NOTE]` (uppercase kind) |
| GPT-4o uses `[!NOTE]` correctly    | Accept as-is                            |
| Gemini uses `[!note]` (lowercase)  | Normalize to `[!NOTE]`                  |
| Llama omits the space after `]`    | Ensure `]` followed by space or newline |

### 6.5 List Normalization

| Model Tendency                      | Normalization Rule   |
| ----------------------------------- | -------------------- |
| Claude uses `-` for unordered lists | Accept as-is         |
| GPT-4o uses `*` for unordered lists | Normalize `*` to `-` |
| Gemini mixes `-` and `*`            | Normalize all to `-` |

### 6.6 Code Block Normalization

| Model Tendency                                   | Normalization Rule                                |
| ------------------------------------------------ | ------------------------------------------------- |
| Claude provides filename in comment              | Accept as-is, preserve in output                  |
| GPT-4o uses `**example.ts**` above block         | Convert to inline filename comment                |
| Gemini omits language identifier on short blocks | Ensure every code fence has a language identifier |

---

## 7. Integration with NDGS

### 7.1 Relationship to NDGS

The Prompt Style Guide serves as the implementation layer for the structural and content rules defined in the [Notch Document Generation Specification](./NOTCH_DOCUMENT_GENERATION_SPECIFICATION.md). While the NDGS defines what correct output looks like, the PSG defines how to produce it.

### 7.2 Prompt Builder Pipeline

```
Input: GenerationRequest
  - source content
  - generation mode (fast | balanced | deep)
  - document class (technical | explainer | compare | how_to | tutorial | architecture | migration | general)
  - target model
       │
       ▼
PromptBuilder
  1. Select mandatory modules (role, structure, format, style, output, normalization)
  2. Select optional modules based on mode and class
  3. Filter module content by mode detail level
  4. Apply model-specific formatting (adapter layer)
  5. Assemble in canonical order
  6. Inject source content
       │
       ▼
Output: AssembledPrompt
  - final prompt string
  - token count estimate
  - module manifest (which modules were included)
```

### 7.3 Replacing the Static Prompt

The PSG replaces the single static system prompt used in the original NDGS implementation. The `PromptBuilder` is invoked at generation time and produces a prompt tailored to the specific request. This change provides:

- **Targeted instruction:** Each prompt contains only the rules relevant to the current generation task.
- **Model-specific formatting:** The adapter layer can adjust separator syntax, role framing, and instruction formatting per model.
- **Reduced token waste:** Fast mode prompts are approximately 60% shorter than the full static prompt.
- **A/B testing capability:** Module variants can be tested independently without affecting the entire prompt.

### 7.4 Mapping to NDGS Sections

Each PSG module corresponds to one or more sections in the NDGS:

| PSG Module      | NDGS Sections                                                 |
| --------------- | ------------------------------------------------------------- |
| `role`          | — (new)                                                       |
| `structure`     | 20 (Heading Rules)                                            |
| `format`        | 10 (Markdown Specification), 11 (Semantic Blocks)             |
| `style`         | 8 (Content Quality), 9 (Writing Style Guide), 21 (Typography) |
| `callouts`      | 17 (Callout Specification)                                    |
| `code`          | 13 (Code Block Specification)                                 |
| `diagrams`      | 12 (Diagram Specification)                                    |
| `tables`        | 14 (Table Specification)                                      |
| `output`        | 29 (Output Contract)                                          |
| `normalization` | — (new)                                                       |
| `source`        | 7 (Content Extraction Rules)                                  |

---

## 8. Implementation

### 8.1 PromptBuilderOptions Interface

```typescript
interface PromptBuilderOptions {
  mode: 'fast' | 'balanced' | 'deep';
  documentClass:
    | 'technical'
    | 'explainer'
    | 'compare'
    | 'how_to'
    | 'tutorial'
    | 'architecture'
    | 'migration'
    | 'general';
  sourceContent?: string;
  sourceMetadata?: {
    title?: string;
    url?: string;
    domain?: string;
    wordCount?: number;
  };
  modules?: {
    include?: string[];
    exclude?: string[];
  };
  model?: 'claude' | 'gpt4' | 'gemini' | 'llama' | 'default';
  options?: {
    includeFrontmatter?: boolean;
    tokenBudget?: number;
    strictMode?: boolean;
    customRules?: string[];
  };
}
```

### 8.2 buildPrompt() Function

```typescript
function buildPrompt(options: PromptBuilderOptions): {
  prompt: string;
  tokenEstimate: number;
  manifest: {
    modules: string[];
    detailLevel: 'full' | 'condensed' | 'minimal';
    modelAdapter: string;
  };
};
```

### 8.3 Module File Organization

```
src/prompt-builder/
  index.ts                    — re-exports, buildPrompt() entry point
  types.ts                    — PromptBuilderOptions, ModuleManifest
  builder.ts                  — buildPrompt() implementation, assembly logic
  modules/
    role.ts                   — role module
    structure.ts              — structure module
    format.ts                 — format rules module
    style.ts                  — writing style module
    callouts.ts               — callout rules module
    code.ts                   — code block rules module
    diagrams.ts               — diagram rules module
    tables.ts                 — table rules module
    output.ts                 — output contract module
    normalization.ts          — cross-model normalization module
    source.ts                 — source content handling module
  adapters/
    claude.ts                 — model-specific formatting for Claude
    gpt4.ts                   — model-specific formatting for GPT-4o
    gemini.ts                 — model-specific formatting for Gemini
    llama.ts                  — model-specific formatting for Llama
    default.ts                — default formatting (model-agnostic)
  templates/
    technical.ts              — technical class template
    explainer.ts              — explainer class template
    compare.ts                — compare class template
    how_to.ts                 — how-to class template
    tutorial.ts               — tutorial class template
    architecture.ts           — architecture class template
    migration.ts              — migration class template
    general.ts                — general class template
```

### 8.4 Module File Contract

Each module file exports a function that accepts mode and returns filtered content:

```typescript
// src/prompt-builder/modules/callouts.ts
import { GenerationMode } from '../types';

export function buildCalloutsModule(mode: GenerationMode): string {
  const rules: Record<GenerationMode, string[]> = {
    fast: [
      'Use `[!NOTE]`, `[!WARNING]`, or `[!TIP]` for callouts.',
      'Maximum one callout per document.',
      'Callouts must not contain code blocks, diagrams, or headings.',
    ],
    balanced: [
      'Use GFM alert syntax: `> [!TYPE]`',
      'Supported types: NOTE, TIP, WARNING, DANGER, INFO, IMPORTANT, CAUTION, SUCCESS, QUESTION.',
      'Maximum one callout per three prose paragraphs.',
      'Callout content must be 1-4 paragraphs.',
      'No code blocks, diagrams, or headings inside callouts.',
    ],
    deep: [
      // Full rule set with examples and edge case guidance
      'Use GFM alert syntax: `> [!TYPE]` with optional title: `> [!WARNING] Title`',
      // ... extended rules
    ],
  };

  return rules[mode].join('\n');
}
```

### 8.5 Adapter Contract

Each adapter exports a function that wraps the assembled prompt text with model-specific formatting:

```typescript
// src/prompt-builder/adapters/claude.ts
export function formatForClaude(assembledPrompt: string): string {
  return `<instructions>\n${assembledPrompt}\n</instructions>`;
}

// src/prompt-builder/adapters/gpt4.ts
export function formatForGpt4(assembledPrompt: string): string {
  return `System: ${assembledPrompt}`;
}
```

---

## Appendix A: Migration Path

Existing static prompts will be migrated to the modular system in three phases:

### Phase 1: Module Extraction

Decompose the existing static prompt into module files without changing content. Verify that assembled output matches the original prompt character-for-character.

### Phase 2: Content Refinement

Refine each module's content independently — add examples, clarify rules, remove redundancy. Test each module change against the full validation suite.

### Phase 3: Mode and Class Tuning

Introduce mode-specific filtering and class templates. Tune the detail levels for each mode based on output quality scores across all supported models.
