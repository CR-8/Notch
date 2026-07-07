# Document Renderer Specification

**Version:** 1.0.0
**Status:** RFC (Request for Comments)
**Last Updated:** 2026-07-06
**Author:** Notch Architectural Committee
**Applies To:** Document rendering subsystem, Reader application, content-engine components

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Component Tree](#3-component-tree)
4. [Node Renderers](#4-node-renderers)
5. [Table of Contents Rendering](#5-table-of-contents-rendering)
6. [Theming](#6-theming)
7. [Styling Approach](#7-styling-approach)
8. [Performance](#8-performance)
9. [Error Handling](#9-error-handling)
10. [Integration with ReaderDocument](#10-integration-with-readerdocument)
11. [TypeScript Interfaces](#11-typescript-interfaces)
12. [Implementation Plan](#12-implementation-plan)

---

## 1. Introduction

The Document Renderer is the terminal stage of the Notch Document Language (NDL) pipeline. It consumes the typed `DocumentAST` produced by the parser and validated by the transformer pipeline, then produces React 19 JSX for display in the Notch Reader application.

This specification defines the architecture, component tree, rendering contracts, theming system, performance characteristics, and integration surface for the `DocumentRenderer` component and its subtree.

### 1.1 Scope

- **In scope:** The `DocumentRenderer` React component, its child node renderers, the Table of Contents renderer, theming integration, error boundaries, and performance optimizations.
- **Out of scope:** The parser, validator, AST data model, PDF export, editor integration, markdown generation, and storage layers.

### 1.2 Document Pipeline Position

```
Markdown (from AI model)
    |
    v
NDL Parser (marked lexer -> typed AST nodes)
    |
    v
NDL Validator (heading hierarchy, structure, content rules)
    |
    v
NDL Transformers (language normalization, ID generation, metadata enrichment)
    |
    v
Document Renderer (React components per node type)  <-- THIS SPECIFICATION
    |
    v
Reader / PDF Export
```

---

## 2. Architecture Overview

### 2.1 Design Goals

1. **Declarative:** Render output is a pure function of the `DocumentAST` input. No side effects in the render path.
2. **Exhaustive:** Every `ASTNode` union member has exactly one renderer. The TypeScript compiler enforces this via discriminated union narrowing.
3. **Composable:** Node renderers delegate to existing content-engine components where those exist.
4. **Performant:** Per-node `React.memo` wrappers, stable `key` attributes via `node.id`, and lazy imports for heavy dependencies.
5. **Themable:** Light and dark themes via a CSS class on the root wrapper. All child components read theme from a React context.
6. **Resilient:** Unknown node types produce a `null` render with a collected warning. A warning banner appears at the bottom of the document listing unhandled nodes.

### 2.2 Input / Output Contract

```
Input:  DocumentAST  (title, metadata, nodes[], hierarchy, warnings[])
Output: React.ReactNode  (a JSX tree ready for mounting into ReaderDocument)
```

The renderer does not mutate the AST. It produces a new React element tree on each render. Parent components may wrap the output in scroll containers, apply layout utilities, or compose with navigation rails.

### 2.3 Decomposition Principle

The renderer is decomposed into:

1. **DocumentRenderer** — root orchestrator. Receives `DocumentAST`, prepares theme context, delegates to TOC renderer and content renderer.
2. **TableOfContents** — recursive renderer for the heading hierarchy tree.
3. **NodeRenderer** — a per-node-type dispatcher implemented as a switch over `node.type`. Each branch is a separate component wrapped in `React.memo`.
4. **Specialized renderers** — heading renderer, paragraph renderer, code renderer, etc. These may delegate to content-engine components (`DiagramBlock`, `RichCodeBlock`, `CalloutBlock`, `RichTable`, `ImageBlock`).

---

## 3. Component Tree

### 3.1 Tree Structure

```
<DocumentRenderer>
  <ThemeProvider>
    <div className="ndl-document ndl-document--{theme}">

      <DocumentHeader />              // Title, metadata, tags

      <TableOfContents                // Conditional, recursive
        items={hierarchy.toc}
        onNavigate={scrollToHeading}
      />

      <section className="ndl-content">
        {nodes.map((node) => (
          <MemoNodeRenderer
            key={node.id}
            node={node}
            theme={theme}
          />
        ))}
      </section>

      <WarningBanner                  // Conditional, bottom of document
        warnings={unknownTypes}
      />

    </div>
  </ThemeProvider>
</DocumentRenderer>
```

### 3.2 NodeRenderer Dispatcher

```
function NodeRenderer({ node, theme }: NodeRendererProps) {
  switch (node.type) {
    case 'heading':        return <HeadingRenderer node={node} />;
    case 'paragraph':      return <ParagraphRenderer node={node} />;
    case 'list':           return <ListRenderer node={node} />;
    case 'code':           return <CodeRenderer node={node} />;
    case 'diagram':        return <DiagramRenderer node={node} theme={theme} />;
    case 'callout':        return <CalloutRenderer node={node} />;
    case 'table':          return <TableRenderer node={node} />;
    case 'image':          return <ImageRenderer node={node} />;
    case 'video':          return <VideoRenderer node={node} />;
    case 'equation':       return <EquationRenderer node={node} />;
    case 'blockquote':     return <BlockquoteRenderer node={node} />;
    case 'reference':      return <ReferenceRenderer node={node} />;
    case 'definition':     return <DefinitionRenderer node={node} />;
    case 'thematic_break': return <ThematicBreakRenderer />;
    case 'semantic':       return <SemanticRenderer node={node} />;
    case 'terminal':       return <TerminalRenderer node={node} />;
    case 'file_tree':      return <FileTreeRenderer node={node} />;
    case 'accordion':      return <AccordionRenderer node={node} />;
    case 'api':            return <ApiRenderer node={node} />;
    default:               return null;  // Unknown type, warning collected
  }
}
```

---

## 4. Node Renderers

### 4.1 HeadingRenderer

Renders an HTML heading tag (`h1` through `h6`) determined by `node.level`. The heading carries an `id` attribute for anchor linking and TOC scroll-to behavior.

- Tag selection: `node.level` maps directly to `h1`..`h6`.
- Content: `node.text` rendered as plain text. Section number (`node.number`) is prepended with a space.
- Anchor link: A `#` permalink appears on hover (CSS `group-hover` pattern).
- Attributes: `id={node.id}`, `data-section-number={node.number}`.

### 4.2 ParagraphRenderer

Renders a prose paragraph using `dangerouslySetInnerHTML`.

- The `node.html` field (HTML rendered by the parser via `marked` + `renderMath`) is sanitized via `sanitizeHtml()` before injection.
- Wrapper: `<div className="ndl-paragraph">`.

### 4.3 ListRenderer

Renders ordered (`<ol>`) and unordered (`<ul>`) lists, including nested lists and task list items.

- `node.ordered` determines `<ol>` vs `<ul>`.
- `node.items` are iterated; each `ListItem` becomes an `<li>`.
- Task items (`item.checked !== undefined`) render with an `<input type="checkbox">` inside the `<li>`, using `checked` state and `readOnly`.
- Nested content in `item.children` is rendered recursively via `NodeRenderer`.
- Wrapper classes: `ndl-list ndl-list--ordered` or `ndl-list ndl-list--unordered`.

### 4.4 CodeRenderer

Renders a fenced code block with syntax metadata, line numbers, copy button, and collapse toggle.

- Delegates to `<RichCodeBlock data={...} number={...} />` from `src/lib/content-engine/components/RichCodeBlock`.
- Props constructed from `CodeNode`: `language`, `content`, `showLineNumbers`, `caption`, `filename`.
- Wrapper: provided by `RichCodeBlock` itself.

### 4.5 DiagramRenderer

Renders a typed diagram (Mermaid or PlantUML) with lazy loading, validation, auto-fix, and fallback to plain text.

- Delegates to `<DiagramBlock data={...} theme={theme} number={...} />` from `src/lib/content-engine/components/DiagramBlock`.
- Props constructed from `DiagramNode`: `engine`, `kind`, `content`, `caption`, `label`.
- `theme` is passed through for Mermaid theme configuration.
- Wrapper: provided by `DiagramBlock`.

### 4.6 CalloutRenderer

Renders an alert/admonition block with semantic color coding.

- Delegates to `<CalloutBlock data={...} />` from `src/lib/content-engine/components/CalloutBlock`.
- Props constructed from `CalloutNode`: `kind`, `title`, `html`.
- Wrapper: provided by `CalloutBlock`.

### 4.7 TableRenderer

Renders a structured table with sortable headers, optional filtering, and column alignment.

- Delegates to `<RichTable data={...} number={...} />` from `src/lib/content-engine/components/RichTable`.
- Props constructed from `TableNode`: `columns`, `rows`, `caption`, `sortable`.
- Wrapper: provided by `RichTable`.

### 4.8 ImageRenderer

Renders an embedded image with lazy loading, timeout fallback, and caption.

- Delegates to `<ImageBlock data={...} />` from `src/lib/content-engine/components/ImageBlock`.
- Props constructed from `ImageNode`: `url`, `alt`, `caption`.
- Wrapper: provided by `ImageBlock`.

### 4.9 VideoRenderer

Renders video, audio, and PDF embeds with provider-specific strategies.

- Provider detection: `node.provider` selects the rendering strategy.
- **YouTube/Vimeo:** renders an `<iframe>` with the provider's embed URL. Sandbox attributes applied: `sandbox="allow-scripts allow-same-origin allow-presentation"`.
- **HTML5 video:** renders a `<video>` element with `controls`, `preload="metadata"`, and `poster={node.posterUrl}`. Source set from `node.url`.
- **Audio:** renders an `<audio>` element with `controls`.
- **PDF:** renders an `<iframe>` with `type="application/pdf"`.
- **Fallback:** renders a text link to `node.url`.
- Title and caption rendered as `<figcaption>` within a `<figure>` wrapper.
- Wrapper classes: `ndl-video ndl-video--{provider}`.

### 4.10 EquationRenderer

Renders a KaTeX mathematical expression.

- Uses `katex.renderToString(node.content, { displayMode: node.displayMode })` invoked at render time.
- The resulting HTML string is injected via `dangerouslySetInnerHTML` after sanitization.
- Inline equations (`displayMode: false`) render inside a `<span className="ndl-equation ndl-equation--inline">`.
- Block equations (`displayMode: true`) render inside a `<div className="ndl-equation ndl-equation--block">`.
- The KaTeX CSS is loaded once at the application level (not per-equation).

### 4.11 BlockquoteRenderer

Renders a standard blockquote with optional citation.

- Content from `node.html` sanitized and rendered via `dangerouslySetInnerHTML`.
- If `node.citation` is present, renders `<footer className="ndl-blockquote__citation">` after the content.
- Wrapper: `<blockquote className="ndl-blockquote">`.

### 4.12 ReferenceRenderer

Renders a numbered list of external reference links.

- `node.items` iterated as an ordered list (`<ol>`).
- Each `ReferenceItem` renders as `<li>` with link text and URL.
- If no URL, renders as plain text.
- Wrapper: `<section className="ndl-reference">` with heading "References".

### 4.13 DefinitionRenderer

Renders a glossary-style term-definition pair.

- Rendered as a `<dl>` element.
- `node.term` becomes `<dt className="ndl-definition__term">`.
- `node.definition` becomes `<dd className="ndl-definition__def">`.
- Wrapper: `<div className="ndl-definition">`.

### 4.14 ThematicBreakRenderer

Renders a horizontal rule.

- Output: `<hr className="ndl-thematic-break" />`.
- No additional fields.

### 4.15 SemanticRenderer

Renders a typed semantic annotation block with color-coded header and background.

- A colored `<div>` wrapper using `ndl-semantic ndl-semantic--{kind}`.
- Header with semantic kind label and optional title.
- Content from `node.html` sanitized and injected.
- Color mapping determined by `SemanticBlockKind`:
  - `architecture` — blue accent
  - `performance` — amber accent
  - `security` — red accent
  - `api` — indigo accent
  - `example` — green accent
  - `history` — violet accent
  - `future-work` — purple accent
  - `timeline` — cyan accent
  - `definition` — gray accent

### 4.16 TerminalRenderer

Renders a terminal session recording as a styled `<pre>` block.

- Wrapper: `<div className="ndl-terminal">` with a dark background (`bg-ink` in dark theme, `bg-[#1e1e1e]` in light theme).
- Optional session name rendered as a header bar.
- Each `TerminalLine` rendered as a row with optional prompt prefix, input text in green, and output text in default terminal color.
- Prompt styling: `$` in dim text. Input: `text-green-400`. Output: `text-gray-200`.
- Uses monospace font (IBM Plex Mono).

### 4.17 FileTreeRenderer

Renders a file system tree as nested unordered lists.

- Root wrapper: `<div className="ndl-file-tree">`.
- Optional root label rendered as the first line with a folder icon.
- Recursive `<ul>` / `<li>` structure mirroring `FileTreeEntry` nesting.
- Files rendered with a document icon, directories with a folder icon.
- Indentation increases per nesting level.
- Wrapper classes: `ndl-file-tree__entry ndl-file-tree__entry--file` / `ndl-file-tree__entry--directory`.

### 4.18 AccordionRenderer

Renders collapsible panels using the native `<details>` / `<summary>` HTML elements.

- Wrapper: `<div className="ndl-accordion">`.
- Each panel in `node.panels` becomes a `<details>` element.
- `<summary>` contains the panel title.
- `<div className="ndl-accordion__content">` contains the HTML body (sanitized).
- Multiple panels are stacked vertically.
- CSS `::details-content` polyfill considered for older browser support.

### 4.19 ApiRenderer

Renders API endpoint references with method badges and request/response schemas.

- Wrapper: `<div className="ndl-api">`.
- Each `ApiEndpoint` in `node.endpoints` rendered as a card.
- Method rendered as a colored badge: `GET` (green), `POST` (blue), `PUT` (orange), `PATCH` (yellow), `DELETE` (red), `HEAD` (gray), `OPTIONS` (gray).
- Path rendered in monospace after the badge.
- Description rendered as prose below the path.
- Optional `requestBody` and `responseBody` rendered in collapsible `<details>` panels with labels "Request Body" and "Response Body".
- Wrapper classes: `ndl-api__endpoint ndl-api__method--{method}`.

---

## 5. Table of Contents Rendering

### 5.1 Component: TableOfContents

The TOC renderer is a recursive component that consumes the `toc: HeadingNode[]` array from `ContentHierarchy` and produces a navigable nested list.

```
interface TableOfContentsProps {
  items: HeadingNode[];
  onNavigate?: (id: string) => void;
  maxDepth?: number;          // default 4
  showNumbers?: boolean;      // default true
}
```

### 5.2 Rendering Logic

- Each `HeadingNode` becomes an `<li>` with an anchor `<a>` linking to `#node.id`.
- The `node.number` is displayed as a prefix in muted monospace text.
- The `node.text` is displayed as the label.
- Child headings are rendered recursively as a nested `<ul>`.
- Depth is limited to `maxDepth` (default 4). Nodes beyond this depth are omitted from the TOC.
- Active section detection: an `IntersectionObserver` on the content headings updates an `aria-current="true"` attribute on the corresponding TOC item.
- Scroll behavior: clicking a TOC item calls `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })` or the provided `onNavigate` callback.

### 5.3 Styling

- Top-level container: `<nav className="ndl-toc" aria-label="Table of Contents">`.
- Ordered list (`<ol>`) for hierarchical numbering semantics.
- Each item: `<li className="ndl-toc__item ndl-toc__item--depth-{depth}">`.
- Anchor: `<a className="ndl-toc__link" href="#{id}">`.
- Number span: `<span className="ndl-toc__number">`.
- Active state: `ndl-toc__item--active` with `aria-current="true"`.
- Indentation: `padding-left: {depth * 16}px`.

### 5.4 Integration with DocumentRenderer

The `DocumentRenderer` conditionally renders the TOC based on a `showToc` prop. When enabled, the TOC appears either:

- As an inline section at the top of the document content (mobile-first), or
- As a sidebar to the left of the content column (desktop, >= 1024px).

Both modes use the same `TableOfContents` component. Layout responsiveness is handled by CSS utilities.

---

## 6. Theming

### 6.1 Theme Context

A `ThemeContext` provides the current theme string to all descendant renderers:

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light' });
```

### 6.2 Theme Application

The `DocumentRenderer` computes the theme from either:

1. A `theme` prop (explicit), or
2. The parent `ThemeContext` (inherited), or
3. The application-level theme preference (via `getSettings()` or `matchMedia`).

The root wrapper applies a CSS class: `ndl-document--light` or `ndl-document--dark`.

### 6.3 CSS Variable Consumption

All renderers consume CSS custom properties (design tokens) from the application's token system. The theme class toggles the token values:

- `--color-ink`: text color (#1d1d1f light, #f5f5f7 dark)
- `--color-canvas`: background (#ffffff light, #272729 dark)
- `--color-ink-muted`, `--color-ink-faint`, `--color-hairline`, `--color-surface`, `--color-surface-hover`, `--color-primary`, `--color-success`, `--color-sale`, `--color-info`

Node renderers that require direct color values (e.g., Mermaid theme, terminal background) receive the theme string and apply it internally.

---

## 7. Styling Approach

### 7.1 TailwindCSS v4

All components use TailwindCSS v4 utility classes for layout, spacing, typography, and color. The v4 `@theme` directive is used for design token overrides where needed.

### 7.2 BEM-Inspired Component Classes

In addition to Tailwind utilities, each renderer applies a BEM-like component class for test targeting and debugging:

| Renderer              | Component Class              |
| --------------------- | ---------------------------- |
| DocumentRenderer      | `ndl-document`               |
| TableOfContents       | `ndl-toc`                    |
| HeadingRenderer       | `ndl-heading`                |
| ParagraphRenderer     | `ndl-paragraph`              |
| ListRenderer          | `ndl-list`                   |
| CodeRenderer          | (delegates to RichCodeBlock) |
| DiagramRenderer       | (delegates to DiagramBlock)  |
| CalloutRenderer       | (delegates to CalloutBlock)  |
| TableRenderer         | (delegates to RichTable)     |
| ImageRenderer         | (delegates to ImageBlock)    |
| VideoRenderer         | `ndl-video`                  |
| EquationRenderer      | `ndl-equation`               |
| BlockquoteRenderer    | `ndl-blockquote`             |
| ReferenceRenderer     | `ndl-reference`              |
| DefinitionRenderer    | `ndl-definition`             |
| ThematicBreakRenderer | `ndl-thematic-break`         |
| SemanticRenderer      | `ndl-semantic`               |
| TerminalRenderer      | `ndl-terminal`               |
| FileTreeRenderer      | `ndl-file-tree`              |
| AccordionRenderer     | `ndl-accordion`              |
| ApiRenderer           | `ndl-api`                    |

These classes are purely for identification and scoping. All visual styling uses Tailwind utilities. No CSS file targets `.ndl-*` classes for layout or appearance.

### 7.3 Spacing Convention

Block-level spacing follows a consistent rhythm:

| Adjacency                       | Gap                                        |
| ------------------------------- | ------------------------------------------ |
| Between any two block renderers | `my-4` or `my-6` (depending on block type) |
| Heading to next block           | `mb-2` on heading                          |
| Last child in document          | No bottom margin                           |

### 7.4 Responsive Behavior

- Content column: `max-w-[760px] mx-auto`.
- TOC sidebar: `hidden xl:block` (visible on extra-large screens and above).
- Tables: `overflow-x-auto` wrapper for horizontal scroll on narrow viewports.
- Code blocks: `overflow-x-auto` for long lines.
- Images: `max-w-full h-auto` to prevent overflow.

---

## 8. Performance

### 8.1 React.memo on Node Renderers

Every per-type renderer component is wrapped with `React.memo`:

```typescript
const HeadingRenderer = React.memo(function HeadingRenderer({ node }: { node: HeadingNode }) {
  // ...
});
```

The `NodeRenderer` dispatcher itself is also memoized. A custom comparator checks `node.id` and `node.type` for identity-based skipping.

### 8.2 Key Strategy

Every rendered element is keyed by `node.id`. The `DocumentRenderer` maps over `document.nodes` using:

```typescript
nodes.map((node) => <MemoNodeRenderer key={node.id} node={node} theme={theme} />)
```

This ensures stable identity across re-renders when the AST reference changes but node identities remain stable.

### 8.3 Lazy Imports

Components with heavy dependencies are lazy-loaded:

- `DiagramRenderer` lazily imports the Mermaid module via its delegate `DiagramBlock` (already implemented).
- `EquationRenderer` lazily imports `katex` via a `useEffect` + dynamic `import()` pattern.
- Syntax highlighting (if added later) would be lazy-loaded per language.

### 8.4 useMemo for Derived Data

Derived computations use `useMemo`:

- Heading tag computation in `HeadingRenderer`.
- HTML sanitization in `ParagraphRenderer`.
- Line split in `CodeRenderer` (delegated to `RichCodeBlock`).
- Row/column processing in `TableRenderer` (delegated to `RichTable`).

### 8.5 Rendering Targets

| Metric                                   | Target  |
| ---------------------------------------- | ------- |
| Initial full-document render (100 nodes) | < 300ms |
| Re-render on theme toggle                | < 100ms |
| Per-node render cost (avg)               | < 0.5ms |
| TOC render (500 headings)                | < 50ms  |
| Memory per 1000 nodes                    | < 2MB   |

---

## 9. Error Handling

### 9.1 Unknown Node Types

The `NodeRenderer` dispatcher's `default` branch returns `null` and collects a warning:

```typescript
default:
  reportUnknownType(node);
  return null;
```

The `reportUnknownType` function appends to a `Set<string>` of unknown type strings, maintained via `useRef` in `DocumentRenderer`.

### 9.2 Warning Banner

At the bottom of the document, if any unknown types were encountered, a `WarningBanner` component renders:

```typescript
interface WarningBannerProps {
  unknownTypes: string[];
}
```

Content: "The following block types were not recognized and could not be rendered: [type1, type2, ...]."

The banner uses `role="alert"` for screen reader notification and appears as a muted callout.

### 9.3 Missing Data Fields

Individual renderers guard against missing optional fields:

- If `DiagramNode.content` is empty, renders a "Diagram content unavailable" placeholder.
- If `ImageNode.url` is missing or empty, renders nothing.
- If `VideoNode.url` is missing, renders a text fallback.
- If `CodeNode.content` is empty, renders an empty code block frame.

### 9.4 KaTeX Render Failure

If `katex.renderToString` throws (malformed LaTeX), the `EquationRenderer` catches the error and renders the raw `node.content` in a monospace inline code span with a red border, preserving the content for user inspection.

### 9.5 Graceful Degradation

- **Mermaid diagrams:** If the Mermaid module fails to load, the `DiagramRenderer` (via `DiagramBlock`) renders the raw diagram source in a `<pre>` block.
- **Images:** If an image fails to load (timeout or HTTP error), `ImageBlock` renders nothing (no broken image icon).
- **Videos:** If an unsupported provider is encountered, renders a plain link to the URL.

---

## 10. Integration with ReaderDocument

### 10.1 Composition Pattern

`DocumentRenderer` is designed to be used as a child of `ReaderDocument`:

```typescript
import { ReaderDocument } from '@/components/reader/ReaderDocument';
import { DocumentRenderer } from '@/lib/content-engine/renderer/DocumentRenderer';
import type { Document } from '@/lib/types';
import type { DocumentAST } from '@/lib/content-engine/types';

interface ReaderPageProps {
  doc: Document;
  ast: DocumentAST;
  theme: 'light' | 'dark';
}

export function ReaderPage({ doc, ast, theme }: ReaderPageProps) {
  return (
    <ReaderDocument doc={doc}>
      <DocumentRenderer
        document={ast}
        theme={theme}
        showToc={true}
        tocPosition="sidebar"
      />
    </ReaderDocument>
  );
}
```

### 10.2 Data Flow

```
ReaderPage
  |
  |-- reads doc from data layer (Document type)
  |-- reads ast from data layer or computes via parser
  |
  v
ReaderDocument
  |  (provides: layout, scroll container, metadata header)
  |
  v
DocumentRenderer
  |  (provides: theme context, TOC, block rendering)
  |
  v
NodeRenderer dispatcher -> per-type memoized renderers
```

### 10.3 Optional Features

The `DocumentRenderer` exposes optional features via props:

| Prop                 | Type                    | Default     | Description                                    |
| -------------------- | ----------------------- | ----------- | ---------------------------------------------- |
| `document`           | `DocumentAST`           | required    | The parsed document to render                  |
| `theme`              | `'light' \| 'dark'`     | `'light'`   | Active theme                                   |
| `showToc`            | `boolean`               | `true`      | Whether to render the table of contents        |
| `tocPosition`        | `'inline' \| 'sidebar'` | `'inline'`  | TOC layout position                            |
| `showSectionNumbers` | `boolean`               | `true`      | Whether to display section numbers in headings |
| `maxTocDepth`        | `number`                | `4`         | Maximum heading depth in TOC                   |
| `onNavigate`         | `(id: string) => void`  | `undefined` | Override for scroll behavior                   |

---

## 11. TypeScript Interfaces

### 11.1 DocumentRenderer Props

```typescript
interface DocumentRendererProps {
  document: DocumentAST;
  theme?: 'light' | 'dark';
  showToc?: boolean;
  tocPosition?: 'inline' | 'sidebar';
  showSectionNumbers?: boolean;
  maxTocDepth?: number;
  onNavigate?: (id: string) => void;
}
```

### 11.2 NodeRenderer Component Interface

```typescript
interface NodeRendererProps {
  node: ASTNode;
  theme: 'light' | 'dark';
}
```

### 11.3 Renderer Component Signatures

```typescript
interface HeadingRendererProps {
  node: HeadingNode;
}
interface ParagraphRendererProps {
  node: ParagraphNode;
}
interface ListRendererProps {
  node: ListNode;
}
interface CodeRendererProps {
  node: CodeNode;
}
interface DiagramRendererProps {
  node: DiagramNode;
  theme: 'light' | 'dark';
}
interface CalloutRendererProps {
  node: CalloutNode;
}
interface TableRendererProps {
  node: TableNode;
}
interface ImageRendererProps {
  node: ImageNode;
}
interface VideoRendererProps {
  node: VideoNode;
}
interface EquationRendererProps {
  node: EquationNode;
}
interface BlockquoteRendererProps {
  node: BlockquoteNode;
}
interface ReferenceRendererProps {
  node: ReferenceNode;
}
interface DefinitionRendererProps {
  node: DefinitionNode;
}
interface ThematicBreakRendererProps {}
interface SemanticRendererProps {
  node: SemanticBlockNode;
}
interface TerminalRendererProps {
  node: TerminalNode;
}
interface FileTreeRendererProps {
  node: FileTreeNode;
}
interface AccordionRendererProps {
  node: AccordionNode;
}
interface ApiRendererProps {
  node: ApiNode;
}
```

### 11.4 Export Surface

```typescript
// Core
export { DocumentRenderer } from './DocumentRenderer';
export type { DocumentRendererProps } from './DocumentRenderer';

// Per-type component exports (for direct use or testing)
export { HeadingRenderer } from './renderers/HeadingRenderer';
export { ParagraphRenderer } from './renderers/ParagraphRenderer';
export { ListRenderer } from './renderers/ListRenderer';
export { CodeRenderer } from './renderers/CodeRenderer';
export { DiagramRenderer } from './renderers/DiagramRenderer';
export { CalloutRenderer } from './renderers/CalloutRenderer';
export { TableRenderer } from './renderers/TableRenderer';
export { ImageRenderer } from './renderers/ImageRenderer';
export { VideoRenderer } from './renderers/VideoRenderer';
export { EquationRenderer } from './renderers/EquationRenderer';
export { BlockquoteRenderer } from './renderers/BlockquoteRenderer';
export { ReferenceRenderer } from './renderers/ReferenceRenderer';
export { DefinitionRenderer } from './renderers/DefinitionRenderer';
export { ThematicBreakRenderer } from './renderers/ThematicBreakRenderer';
export { SemanticRenderer } from './renderers/SemanticRenderer';
export { TerminalRenderer } from './renderers/TerminalRenderer';
export { FileTreeRenderer } from './renderers/FileTreeRenderer';
export { AccordionRenderer } from './renderers/AccordionRenderer';
export { ApiRenderer } from './renderers/ApiRenderer';

// Supporting
export { TableOfContents } from './TableOfContents';
export type { TableOfContentsProps } from './TableOfContents';
export { ThemeContext } from './ThemeContext';
```

---

## 12. Implementation Plan

### 12.1 Phase 1 — Core Infrastructure

1. Create `src/lib/content-engine/renderer/` directory.
2. Implement `ThemeContext` and `DocumentRenderer` shell.
3. Implement `NodeRenderer` dispatcher with all 19 branches (initially returning null stubs).
4. Implement `TableOfContents` component.
5. Implement `WarningBanner`.

### 12.2 Phase 2 — Primary Node Renderers

6. `HeadingRenderer` — full implementation with anchor links.
7. `ParagraphRenderer` — `dangerouslySetInnerHTML` with sanitization.
8. `ListRenderer` — ordered, unordered, task items, nesting.
9. `BlockquoteRenderer` — citation support.
10. `ThematicBreakRenderer` — simple `<hr>`.
11. `DefinitionRenderer` — `<dl>` / `<dt>` / `<dd>`.

### 12.3 Phase 3 — Content-Engine Delegation

12. `CodeRenderer` — delegate to `RichCodeBlock`.
13. `DiagramRenderer` — delegate to `DiagramBlock`, pass theme.
14. `CalloutRenderer` — delegate to `CalloutBlock`.
15. `TableRenderer` — delegate to `RichTable`.
16. `ImageRenderer` — delegate to `ImageBlock`.

### 12.4 Phase 4 — Advanced Renderers

17. `VideoRenderer` — provider-specific embed strategies.
18. `EquationRenderer` — lazy KaTeX import and rendering.
19. `ReferenceRenderer` — numbered reference list.
20. `SemanticRenderer` — color-coded semantic blocks.
21. `TerminalRenderer` — styled terminal sessions.
22. `FileTreeRenderer` — recursive file tree.
23. `AccordionRenderer` — details/summary panels.
24. `ApiRenderer` — method badges and endpoint cards.

### 12.5 Phase 5 — Integration and Polish

25. Integrate `DocumentRenderer` into `ReaderPage`.
26. Wire up theme toggle support.
27. Add TOC sidebar layout mode.
28. Performance profiling and `React.memo` verification.
29. Error boundary around entire renderer.
30. Write unit tests for each renderer component using `vitest` + `@testing-library/react`.

### 12.6 Migration Path from ContentRenderer

The existing `ContentRenderer` component in `src/lib/content-engine/components/ContentRenderer.tsx` currently handles a subset of blocks inline. After `DocumentRenderer` is complete:

1. `ContentRenderer` is deprecated in favor of `DocumentRenderer`.
2. `ContentRenderer` is refactored to delegate to `DocumentRenderer` internally.
3. All callers of `ContentRenderer` are migrated to `DocumentRenderer`.
4. `ContentRenderer` is removed in a subsequent major version.

---

_End of Document Renderer Specification v1.0.0_
