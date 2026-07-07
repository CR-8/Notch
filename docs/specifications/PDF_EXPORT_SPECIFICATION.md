# PDF Export Specification

**Version:** 1.0.0
**Status:** RFC (Request for Comments)
**Last Updated:** 2026-07-06
**Author:** Notch Architectural Committee
**Applies To:** Document export subsystem, PDF generation pipeline, print-optimized rendering

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Export Pipeline](#2-export-pipeline)
3. [CSS @page Rules](#3-css-page-rules)
4. [Table of Contents Generation](#4-table-of-contents-generation)
5. [PDF Bookmarks](#5-pdf-bookmarks)
6. [Font Handling](#6-font-handling)
7. [Page Break Management](#7-page-break-management)
8. [Code Block Rendering](#8-code-block-rendering)
9. [Table Rendering](#9-table-rendering)
10. [Image Handling](#10-image-handling)
11. [Document Metadata](#11-document-metadata)
12. [TypeScript Implementation](#12-typescript-implementation)
13. [Integration with Document Pipeline](#13-integration-with-document-pipeline)
14. [Implementation Plan](#14-implementation-plan)

---

## 1. Introduction

The PDF Export subsystem is the terminal stage of the Notch Document Language (NDL) pipeline, responsible for converting the typed `DocumentAST` into a print-ready PDF document. Rather than generating PDF binary directly, the exporter produces a print-optimized HTML document that is then converted to PDF by the browser's native print-to-PDF facility or by a headless Chromium instance (Puppeteer) for server-side generation.

This specification defines the complete architecture, CSS layout engine, bookmark generation, page break management, typography system, and TypeScript contracts governing the PDF export path.

### 1.1 Scope

- **In scope:** The `exportToPrintHTML()` function, `PDFExportOptions` configuration interface, print-optimized CSS generation, TOC rendering with page references, PDF bookmark injection via CSS properties, font selection and fallback chains, page break control strategies, code/table/image rendering rules, metadata injection, and integration with the document pipeline.
- **Out of scope:** Binary PDF generation, server-side deployment of Puppeteer, watermarking, DRM, digital signatures, and screen-only rendering behaviors.

### 1.2 Design Goals

1. **Fidelity:** The PDF output must visually match the Reader rendering as closely as print allows. No content loss, no reflow artifacts.
2. **Determinism:** The same `DocumentAST` and `PDFExportOptions` must produce byte-identical HTML output on every invocation.
3. **Self-Containment:** The generated HTML is a standalone document with embedded CSS. No external stylesheets, no JavaScript, no network requests.
4. **Browser-Native:** All PDF features (bookmarks, page numbers, running headers) are achieved via standard CSS print features and HTML semantics. No post-processing of PDF binary.
5. **Configurability:** Every layout parameter (page size, margins, fonts, TOC inclusion, bookmark depth) is exposed via the `PDFExportOptions` interface.

---

## 2. Export Pipeline

### 2.1 Pipeline Stages

```
DocumentAST (typed AST from parser/transformer pipeline)
    |
    v
exportToPrintHTML()
    |  1. Merge user options with defaults
    |  2. Call exportToMarkdown() for markdown intermediate
    |  3. Parse markdown to basic HTML (standalone converter)
    |  4. Build TOC HTML from DocumentAST.hierarchy.toc
    |  5. Generate complete HTML page with embedded CSS
    v
Print-Optimized HTML (standalone, self-contained)
    |
    +---> Browser Print-to-PDF (client-side)
    |        window.print() triggered by user action
    |        Browser's native print dialog renders PDF
    |
    +---> Puppeteer (server-side)
             await page.pdf() with configured options
             Produces PDF buffer for download
```

### 2.2 Two Conversion Strategies

The exporter supports two output strategies, selected by the consuming context:

**Strategy A: Client-Side Browser Print (default).** The generated HTML is injected into a hidden iframe or new window, and `window.print()` is called. The browser's native print engine handles CSS @page rules, running headers, page numbers, and PDF metadata from `<meta>` tags. This strategy requires no server infrastructure and is used when the user initiates PDF export from the Reader UI.

**Strategy B: Server-Side Puppeteer.** The generated HTML is written to a temporary file or streamed to a Node.js Puppeteer instance. `page.pdf()` is called with `printBackground: true`, `preferCSSPageSize: true`, and `displayHeaderFooter: false` (since headers/footers are managed by CSS @page rules, not Puppeteer's template system). This strategy is used for batch export, API-driven generation, and programmatic downloads.

### 2.3 No Binary Post-Processing

The exporter deliberately avoids post-processing the PDF binary. All PDF features (bookmarks, page numbers, running headers, internal links) are implemented via CSS print features (`@page`, `bookmark-level`, `bookmark-label`, `target-counter`). This eliminates dependency on PDF manipulation libraries and ensures full compatibility with browser rendering engines.

---

## 3. CSS @page Rules

### 3.1 Page Size and Margins

The `@page` rule defines the physical page geometry. Two page sizes are supported, selectable via `PDFExportOptions.pageSize`:

```css
/* A4 (default) */
@page {
  size: 210mm 297mm;
  margin: 20mm 25mm 20mm 25mm;
}

/* Letter */
@page {
  size: 216mm 279mm;
  margin: 20mm 25mm 20mm 25mm;
}
```

Margins are independently configurable via `PDFExportOptions.marginTop`, `marginBottom`, `marginLeft`, `marginRight`. All values are specified in millimeters and default to 20mm (top/bottom) and 25mm (left/right). The content area width is computed as page width minus left and right margins: for A4 with default margins, content width = 210mm - 50mm = 160mm.

### 3.2 Running Headers and Footers

The `@page` margin boxes are used for running headers and page numbers:

```css
@page {
  @top-center {
    content: 'Document Title';
    font-family: 'Times New Roman', serif;
    font-size: 9pt;
    color: #666;
  }
  @bottom-center {
    content: 'Page ' counter(page);
    font-family: 'Times New Roman', serif;
    font-size: 9pt;
    color: #666;
  }
}
```

**Rules:**

| Rule | Description                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------- |
| HDR1 | The running header displays the document title (from `PDFExportOptions.title`) centered in the top margin |
| HDR2 | The footer displays "Page N" centered in the bottom margin where N is the current page number             |
| HDR3 | The first page suppresses both header and footer via `@page :first`                                       |
| HDR4 | The TOC page suppresses the running header (retains page numbers)                                         |
| HDR5 | Header font size is 9pt, color #666, serif font family                                                    |
| HDR6 | Page numbers use the CSS `counter(page)` function, auto-reset by the browser                              |

### 3.3 First Page and Named Pages

The `:first` pseudo-class suppresses decorative elements on the title page:

```css
@page :first {
  @top-center {
    content: none;
  }
  @bottom-center {
    content: none;
  }
  margin-top: 40mm; /* More space for title page */
}
```

Named pages allow different sections to have distinct page layouts. The TOC page and content pages use separate named pages when the TOC is enabled:

```css
@page toc {
  @top-center {
    content: 'Contents';
  }
  @bottom-center {
    content: 'Page ' counter(page);
  }
}
@page content {
  @top-center {
    content: 'Document Title';
  }
  @bottom-center {
    content: 'Page ' counter(page);
  }
}
```

The TOC container and content article apply `page: toc` and `page: content` respectively to activate these named pages.

### 3.4 Page Counter Resets

The TOC page uses `counter-reset: page` at the end of the TOC section to ensure content pages begin numbering from 1. This is achieved by:

```css
.pdf-toc-page {
  page-break-after: always;
}
.pdf-content {
  counter-reset: page 1;
}
```

---

## 4. Table of Contents Generation

### 4.1 Data Source

The TOC is built from `DocumentAST.hierarchy.toc`, which contains a nested `HeadingNode[]` tree. This tree is produced by the transformer pipeline and represents the full heading hierarchy (H1 through H6) with section numbers assigned.

### 4.2 TOC Rendering

The TOC is rendered as a nested unordered list with indentation proportional to heading depth:

```html
<div class="pdf-toc-page">
  <h1 class="pdf-toc-title">Contents</h1>
  <ul class="pdf-toc">
    <li style="margin-left: 0px">
      <a href="#section-1"> <span class="toc-number">1. </span>Introduction </a>
    </li>
    <li style="margin-left: 20px">
      <a href="#section-1-1"> <span class="toc-number">1.1. </span>Background </a>
    </li>
    <!-- Recursive for all depths -->
  </ul>
</div>
```

**Rules:**

| Rule | Description                                                                  |
| ---- | ---------------------------------------------------------------------------- |
| TOC1 | Each heading becomes an `<li>` with an anchor `<a>` linking to `#heading-id` |
| TOC2 | Indentation increases by 20px per depth level (0, 20px, 40px, ...)           |
| TOC3 | Section numbers (from `HeadingNode.number`) are rendered as bold prefixes    |
| TOC4 | The TOC page uses `page-break-after: always` to separate from content        |
| TOC5 | If `includeTOC` is false, the entire TOC section is omitted                  |
| TOC6 | Empty TOCs (zero headings) produce no output                                 |
| TOC7 | Maximum depth rendered in TOC is configurable via `maxTocDepth` (default 4)  |

### 4.3 Page Reference Generation

Page references in the TOC are generated using CSS `target-counter`:

```css
.pdf-toc a::after {
  content: leader('.') ' ' target-counter(attr(href url), page);
  float: right;
}
```

This produces dot leaders followed by the page number where each heading appears. The `target-counter()` CSS function is supported by all modern browser print engines and resolves the page number of the target anchor at print time.

---

## 5. PDF Bookmarks

### 5.1 CSS Bookmark Properties

PDF bookmarks (also called PDF outlines or table of contents in the PDF navigation pane) are generated using standard CSS bookmark properties supported by Chromium's print engine:

```css
/* H1-level entries (root document sections) */
[data-bookmark='true'] {
  bookmark-label: attr(data-bookmark-label);
  bookmark-level: 1;
}

/* H2-level entries */
h2[data-bookmark='true'] {
  bookmark-level: 2;
}

/* H3-level entries */
h3[data-bookmark='true'] {
  bookmark-level: 3;
}

/* H4-level entries */
h4[data-bookmark='true'] {
  bookmark-level: 4;
}
```

### 5.2 Data Attribute Strategy

Rather than relying on the CSS class name (which is fragile when styling changes), each heading element receives explicit `data-bookmark` and `data-bookmark-label` attributes at HTML generation time:

```html
<h1 id="introduction" data-bookmark="true" data-bookmark-label="1. Introduction">
  1. Introduction
</h1>
```

**Rules:**

| Rule | Description                                                                              |
| ---- | ---------------------------------------------------------------------------------------- |
| BM1  | Every heading (H1-H4) receives `data-bookmark="true"` when `includeBookmarks` is enabled |
| BM2  | H5 and H6 headings do not generate bookmarks to avoid over-nesting the PDF outline       |
| BM3  | The bookmark label is the heading text preceded by its section number                    |
| BM4  | `bookmark-level` maps H1→1, H2→2, H3→3, H4→4                                             |
| BM5  | If `includeBookmarks` is false, no `data-bookmark` attributes are emitted                |

### 5.3 Bookmark Level Mapping

| Heading Level | Bookmark Level | PDF Outline Depth  |
| ------------- | -------------- | ------------------ |
| H1            | 1              | Top-level entry    |
| H2            | 2              | Second-level entry |
| H3            | 3              | Third-level entry  |
| H4            | 4              | Fourth-level entry |
| H5            | (none)         | Not included       |
| H6            | (none)         | Not included       |

This mapping ensures the PDF outline is navigable without becoming excessively deep.

---

## 6. Font Handling

### 6.1 Font Selection

The PDF output uses a three-family typographic system optimized for print:

| Role      | Font Stack                                       | Fallback Rationale                                                                                        |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Body text | `"Times New Roman", "Georgia", serif`            | Serif for readability in long-form print; Georgia as cross-platform serif fallback                        |
| Headings  | `"Helvetica Neue", "Arial", sans-serif`          | Sans-serif for clean heading contrast against serif body                                                  |
| Code      | `"Courier New", "Consolas", "Monaco", monospace` | Monospace for code fidelity; Courier New is universally available; Consolas for Windows; Monaco for macOS |

### 6.2 Font Sizing

Base font size is configurable via `PDFExportOptions.fontSize` (default 11pt). All other sizes are derived proportionally:

| Element       | Size          | Derivation                                |
| ------------- | ------------- | ----------------------------------------- |
| Body          | `fontSize` pt | Configurable (default 11pt)               |
| H1            | 24pt          | Fixed                                     |
| H2            | 18pt          | Fixed                                     |
| H3            | 14pt          | Fixed                                     |
| H4            | 12pt          | Fixed                                     |
| Code/Pre      | 9pt           | Fixed (smaller for monospace readability) |
| Table cell    | 10pt          | Fixed                                     |
| Header/Footer | 9pt           | Fixed (margin box content)                |
| Caption       | 10pt          | Fixed                                     |

### 6.3 Line Spacing

Body text uses `line-height: 1.6` for comfortable print reading. Code blocks use `line-height: 1.4` to conserve vertical space. Headings use tighter spacing (`line-height: 1.2`).

### 6.4 Font Embedding Decision

Font embedding is intentionally not performed. The selected fonts (Times New Roman, Helvetica Neue, Courier New) are standard print fonts available on virtually all systems. Embedding would increase the output file size by several megabytes without perceptible quality improvement. If custom fonts are required in the future, they should be embedded as base64 `@font-face` declarations in the CSS, with the font files loaded asynchronously and cached prior to generation.

---

## 7. Page Break Management

### 7.1 Break Prevention Rules

The following elements must not break across pages unless they exceed the page height:

```css
pre,
code,
table,
figure,
img,
.diagram-block,
.callout,
.equation-block,
.reference-block {
  page-break-inside: avoid;
  break-inside: avoid;
}
```

The `page-break-inside` property (legacy) and `break-inside` property (modern) are both specified for maximum browser compatibility.

### 7.2 Break Prevention Strategy

Page break avoidance follows a three-tier strategy:

1. **Tier 1 — Avoid inside elements:** All monolithic blocks (code, tables, figures, images, callouts, equations, diagrams) set `page-break-inside: avoid`. The browser will push the entire element to the next page if it does not fit in the remaining space.

2. **Tier 2 — Avoid orphan/widow lines:** Body text sets `orphans: 3` and `widows: 3`, ensuring at least three lines of a paragraph remain together at page breaks.

3. **Tier 3 — Avoid breaks after headings:** All headings set `page-break-after: avoid` and `break-after: avoid` to prevent a heading from being stranded at the bottom of a page with its content on the next page.

### 7.3 Break Enforcement Rules

Certain structural boundaries require explicit page breaks:

```css
/* Major section breaks before H1 */
h1 {
  page-break-before: always;
  break-before: page;
}

/* No break before H2+ (they follow their parent section) */
h2,
h3,
h4,
h5,
h6 {
  page-break-before: auto;
}
```

**Rules:**

| Rule | Description                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------- |
| PB1  | H1 headings always start on a new page (`page-break-before: always`)                           |
| PB2  | H2-H6 headings do not force page breaks but prevent break-after                                |
| PB3  | Code blocks avoid internal breaks but use `white-space: pre-wrap` to reflow if near a boundary |
| PB4  | Tables shorter than one page remain intact; taller tables may still break (browser discretion) |
| PB5  | Images apply `page-break-inside: avoid` and `max-width: 100%`                                  |
| PB6  | Widow/orphan control set to 3 lines minimum                                                    |

### 7.4 Manual Page Break Override

A CSS utility class `.page-break` is provided for manual break insertion:

```css
.page-break {
  page-break-before: always;
  break-before: page;
}
```

This class is applied to the TOC page wrapper and may be applied to specific content blocks via the `meta` field on AST nodes (e.g., `{ meta: { pageBreakBefore: true } }`).

---

## 8. Code Block Rendering

### 8.1 HTML Structure

Each code block is rendered as:

```html
<pre class="language-python">
  <code>def hello():
    print("world")</code>
</pre>
```

### 8.2 CSS Styling

```css
pre {
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 9pt;
  line-height: 1.4;
  background: #f5f5f5;
  padding: 8pt;
  border: 1px solid #ddd;
  border-radius: 2pt;
  page-break-inside: avoid;
  break-inside: avoid;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: break-word;
  margin: 8pt 0;
}

code {
  font-family: inherit;
  font-size: inherit;
  padding: 1pt 3pt;
  background: #f0f0f0;
  border-radius: 1pt;
}

pre code {
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
}
```

### 8.3 Rendering Rules

| Rule | Description                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CB1  | Background: light gray (#f5f5f5) for block; lighter (#f0f0f0) for inline `code`                                                                        |
| CB2  | Border: 1px solid #ddd around block, rounded corners (2pt)                                                                                             |
| CB3  | Line wrapping enabled via `white-space: pre-wrap` and `word-break: break-all`                                                                          |
| CB4  | Font: monospace stack at 9pt                                                                                                                           |
| CB5  | Inline code uses background-only styling (no border)                                                                                                   |
| CB6  | Inline code inside a `<pre>` block inherits `pre` styling with no background                                                                           |
| CB7  | Language identifier is emitted as a class on `<pre>` for potential syntax highlighting (not applied in print, but preserved for forward compatibility) |
| CB8  | Long lines wrap; no horizontal scroll in PDF output                                                                                                    |

### 8.4 Syntax Highlighting

Syntax highlighting in the PDF output is intentionally minimal. The print-optimized HTML does not include syntax coloration because:

1. The standalone markdown-to-HTML converter used in `exportToPrintHTML()` does not have access to the full syntax highlighting infrastructure.
2. Colored code in print can appear noisy and reduces contrast on paper.
3. Users requiring syntax-colored PDF should use the Reader's screen rendering with browser print-to-PDF, which retains the on-screen colors.

If syntax coloration is required in a future version, it should be implemented by running the code content through a lightweight highlighter (e.g., `shiki` or `highlight.js`) during HTML generation, with the results emitted as inline `<span>` elements with color classes.

---

## 9. Table Rendering

### 9.1 HTML Structure

Tables are rendered as standard HTML tables:

```html
<table>
  <thead>
    <tr>
      <th>Column A</th>
      <th>Column B</th>
      <th>Column C</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Value 1</td>
      <td>Value 2</td>
      <td>Value 3</td>
    </tr>
  </tbody>
</table>
```

### 9.2 CSS Styling

```css
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt 0;
  font-size: 10pt;
  page-break-inside: avoid;
  break-inside: avoid;
}

th,
td {
  border: 1px solid #999;
  padding: 4pt 6pt;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f0f0f0;
  font-weight: bold;
}

thead {
  display: table-header-group;
}
```

### 9.3 Header Row Repetition

The `<thead>` element with `display: table-header-group` causes the browser to repeat the header row at the top of each page fragment when a table spans multiple pages. This is critical for readability of multi-page tables.

### 9.4 Rendering Rules

| Rule | Description                                                                       |
| ---- | --------------------------------------------------------------------------------- |
| TB1  | Tables render at 100% of the content width (full text column)                     |
| TB2  | Borders: 1px solid #999 on all cells                                              |
| TB3  | Header cells: bold, light gray background (#f0f0f0)                               |
| TB4  | Font size: 10pt (one point smaller than body for density)                         |
| TB5  | Cell padding: 4pt vertical, 6pt horizontal                                        |
| TB6  | Header rows repeat on page breaks via `<thead>` + `display: table-header-group`   |
| TB7  | Tables shorter than one page are kept intact via `page-break-inside: avoid`       |
| TB8  | Tables are preceded by 12pt margin, followed by 12pt margin                       |
| TB9  | Column alignment from `ColumnDef.align` maps to `text-align` on `<th>` and `<td>` |

### 9.5 Wide Table Handling

Tables narrower than the content width render at natural width. Tables wider than the content width are constrained by `width: 100%` and cells are proportionally compressed. If individual cell content causes overflow, `word-break: break-word` is applied to prevent column overflow.

---

## 10. Image Handling

### 10.1 HTML Structure

Images are rendered as:

```html
<figure>
  <img src="https://example.com/image.png" alt="Descriptive alt text" />
  <figcaption>Figure 1: Descriptive caption</figcaption>
</figure>
```

### 10.2 CSS Styling

```css
img {
  max-width: 100%;
  height: auto;
  page-break-inside: avoid;
  break-inside: avoid;
}

figure {
  margin: 12pt 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}

figcaption {
  font-size: 10pt;
  color: #555;
  margin-top: 4pt;
  font-style: italic;
}
```

### 10.3 Rendering Rules

| Rule | Description                                                                    |
| ---- | ------------------------------------------------------------------------------ |
| IM1  | Images scale to a maximum of 100% content width (never exceed the text column) |
| IM2  | Aspect ratio preserved via `height: auto`                                      |
| IM3  | Images avoid page breaks as a unit (image + caption stay together)             |
| IM4  | Images without captions render as standalone `<img>` rather than `<figure>`    |
| IM5  | Alt text from `ImageNode.alt` populates the `alt` attribute                    |
| IM6  | Figure captions are rendered as `<figcaption>` with italic styling at 10pt     |
| IM7  | No border, no shadow on images (print-optimized)                               |
| IM8  | Images that exceed page height are scaled proportionally to fit                |

### 10.4 Image Loading Strategy

Images are referenced by their original URL (`ImageNode.url`). No image downloading or embedding occurs during HTML generation. The PDF consumer (browser print or Puppeteer) resolves the URLs at render time. This keeps the HTML generation fast and avoids embedding large binary payloads.

For offline or archival use cases, a future enhancement should pre-download images and replace URLs with base64 data URIs or file:// references, controlled by an `embedImages` option in `PDFExportOptions`.

---

## 11. Document Metadata

### 11.1 PDF Document Properties

PDF metadata (title, author, subject, date) is injected via HTML `<meta>` tags and standard document metadata:

```html
<head>
  <meta charset="UTF-8" />
  <title>Document Title</title>
  <meta name="author" content="Notch" />
  <meta name="date" content="2026-07-06" />
  <meta name="description" content="Generated by Notch Document System" />
  <meta name="generator" content="Notch PDF Exporter v1.0" />
</head>
```

### 11.2 Metadata Mapping

| PDF Property | Source                                                              | HTML Mechanism              |
| ------------ | ------------------------------------------------------------------- | --------------------------- |
| Title        | `PDFExportOptions.title`                                            | `<title>` tag               |
| Author       | `PDFExportOptions.author` (defaults to "Notch")                     | `<meta name="author">`      |
| Subject      | Auto-generated from document title + document class                 | `<meta name="description">` |
| Date         | `PDFExportOptions.date` (defaults to ISO-8601 generation timestamp) | `<meta name="date">`        |
| Creator      | "Notch PDF Exporter v{version}"                                     | `<meta name="generator">`   |

### 11.3 Browser and Puppeteer Handling

- **Browser print:** Chromium-based browsers read `<title>` for the PDF title and `<meta name="author">` for the author field. Other metadata may be read inconsistently; the essential fields (title, author) are prioritized.
- **Puppeteer:** `page.pdf()` accepts `{ title, author }` options that override the document metadata. The exporter should pass these values when calling Puppeteer for full control.

---

## 12. TypeScript Implementation

### 12.1 PDFExportOptions Interface

```typescript
interface PDFExportOptions {
  title: string;
  author?: string;
  date?: string;
  fontSize?: number;
  pageSize?: 'A4' | 'Letter';
  includeTOC: boolean;
  includePageNumbers: boolean;
  includeBookmarks: boolean;
  maxTocDepth?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}
```

### 12.2 Default Configuration

```typescript
const DEFAULT_OPTIONS: PDFExportOptions = {
  title: 'Document',
  author: 'Notch',
  fontSize: 11,
  pageSize: 'A4',
  includeTOC: true,
  includePageNumbers: true,
  includeBookmarks: true,
  maxTocDepth: 4,
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 25,
  marginRight: 25,
};
```

### 12.3 Primary Export Function

```typescript
function exportToPrintHTML(doc: DocumentAST, options: Partial<PDFExportOptions> = {}): string;
```

**Contract:**

| Aspect          | Specification                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Input           | `DocumentAST` (validated, enriched) + partial options                                                                  |
| Output          | Complete HTML document string (doctype + html + head + body)                                                           |
| Purity          | Deterministic: same inputs produce identical output                                                                    |
| No side effects | Does not write files, make network requests, or mutate the AST                                                         |
| Error handling  | Missing or malformed AST nodes produce graceful degradation (empty paragraphs, blank code blocks) rather than throwing |

### 12.4 Internal Function Decomposition

```
exportToPrintHTML(doc, options)
  |
  +-- validateAndMergeOptions(options) -> PDFExportOptions
  |
  +-- generateTOCHTML(doc.hierarchy.toc) -> string
  |     Recursively renders HeadingNode[] as nested <ul>/<li>
  |
  +-- exportToMarkdown(doc, { numberedHeadings: true }) -> string
  |     Delegates to the markdown exporter for intermediate format
  |
  +-- markdownToBasicHTML(markdown) -> string
  |     Standalone markdown parser (no external deps):
  |     - Fenced code blocks -> <pre><code>
  |     - ATX headings -> <h1..h6> with IDs
  |     - Paragraphs -> <p>
  |     - Lists -> <li> (flat)
  |     - Blockquotes -> <blockquote>
  |     - Tables -> <table> (basic)
  |     - Horizontal rules -> <hr>
  |
  +-- generateHTMLPage(opts, tocHTML, bodyHTML) -> string
        Builds the complete HTML document with:
        - DOCTYPE, html, head, meta tags
        - Embedded CSS (all @page rules, font stacks, layout)
        - Conditional TOC section
        - Content article
        - No script tags
```

### 12.5 Helper Functions

```typescript
function escapeHTML(text: string): string
  - Escapes &, <, >, " for safe text injection

function slugify(text: string, maxLength?: number): string
  - Lowercases, replaces non-alphanumeric with hyphens, trims, truncates

function generateTOCHTML(toc: HeadingNode[], depth?: number): string
  - Recursive TOC tree rendering

function markdownToBasicHTML(md: string): string
  - Standalone line-by-line state machine for markdown conversion

function generateHTMLPage(
  opts: PDFExportOptions,
  tocHTML: string,
  bodyHTML: string
): string
  - Assembles the final HTML document
```

### 12.6 Export Surface

```typescript
// Core
export { exportToPrintHTML } from './exporters/pdf';
export type { PDFExportOptions } from './exporters/pdf';

// Auxiliary
export { exportToMarkdownOnly } from './exporters/pdf';
export { exportToHTML } from './exporters/pdf';
```

---

## 13. Integration with Document Pipeline

### 13.1 Pipeline Position

The PDF exporter sits at the terminal stage of the NDL pipeline, after the renderer:

```
Markdown (from AI model)
    |
    v
NDL Parser
    |
    v
NDL Validator
    |
    v
NDL Transformers
    |
    v
Document Renderer (React/Reader)
    |
    v
PDF Exporter <-- THIS SPECIFICATION
    |
    v
Print-Optimized HTML -> PDF
```

### 13.2 Calling from the Reader UI

The Reader triggers PDF export when the user selects "Export as PDF" from the document menu:

```typescript
import { exportToPrintHTML } from '@/document-system/exporters/pdf';
import type { DocumentAST } from '@/document-system/schemas';

function handlePDFExport(ast: DocumentAST, title: string) {
  const html = exportToPrintHTML(ast, {
    title,
    author: 'Notch',
    pageSize: 'A4',
    includeTOC: true,
    includePageNumbers: true,
    includeBookmarks: true,
  });

  // Strategy A: Open in new window and print
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url);
  win?.addEventListener('load', () => win.print());

  // Strategy B (alternative): Use Puppeteer via API
  // fetch('/api/export-pdf', { method: 'POST', body: JSON.stringify({ html }) })
}
```

### 13.3 Calling from the Export API

For server-side or batch export, the HTML is sent to a Puppeteer endpoint:

```typescript
import puppeteer from 'puppeteer';
import { exportToPrintHTML } from '@/document-system/exporters/pdf';

async function generatePDF(ast: DocumentAST, title: string): Promise<Buffer> {
  const html = exportToPrintHTML(ast, { title, pageSize: 'A4' });
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkIdle' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false, // Headers/footers via CSS @page
  });
  await browser.close();
  return pdf;
}
```

### 13.4 Purity and Caching

`exportToPrintHTML()` is a pure function: it receives a `DocumentAST` and returns a string. It does not:

- Read or write files
- Make network requests
- Access the DOM
- Depend on global state
- Parse or validate the AST (validated upstream)

This purity enables caching: the same AST + options always produces the same HTML string. Consumers may cache the result keyed by a hash of the AST content and options.

### 13.5 Error Handling

The exporter is designed to never throw during normal operation. Node-level failures (missing fields, empty content) produce degraded but valid output:

| Failure Mode               | Behavior                                           |
| -------------------------- | -------------------------------------------------- |
| Empty `DocumentAST.nodes`  | Produces an empty document with title and metadata |
| Missing heading ID         | Falls back to slugified heading text               |
| Empty `hierarchy.toc`      | Omits TOC section (even if `includeTOC` is true)   |
| Unparseable markdown       | Emits raw text as paragraph content                |
| Null/undefined node fields | Tolerated; empty strings used as fallback          |

The caller is responsible for passing a validated `DocumentAST`. If validation is skipped, the exporter makes no guarantees about output quality.

---

## 14. Implementation Plan

### 14.1 Phase 1 — Core Infrastructure

1. Implement `exportToPrintHTML()` signature with partial options merging.
2. Implement `generateHTMLPage()` with the minimal CSS scaffold.
3. Implement `markdownToBasicHTML()` as a standalone state-machine converter.
4. Implement `escapeHTML()` and `slugify()` helpers.

### 14.2 Phase 2 — TOC and Bookmarks

5. Implement `generateTOCHTML()` with recursive heading rendering.
6. Add `data-bookmark` and `data-bookmark-label` attributes to heading elements.
7. Add CSS `bookmark-level` and `bookmark-label` rules.
8. Add TOC page reference CSS (`target-counter`, `leader()`).

### 14.3 Phase 3 — Layout and Typography

9. Implement `@page` rules for both A4 and Letter sizes.
10. Add running header and footer CSS (`@top-center`, `@bottom-center`).
11. Configure font stacks and sizing system.
12. Add page break management CSS (avoid/always rules).

### 14.4 Phase 4 — Content Rendering

13. Enhance `markdownToBasicHTML()` to properly handle all GFM constructs.
14. Add table rendering with `<thead>`/`<tbody>` structure.
15. Add code block rendering with `pre-wrap` wrapping.
16. Add image rendering with `<figure>`/`<figcaption>`.
17. Add standard block element styling (blockquotes, lists, rules).

### 14.5 Phase 5 — Integration and Polish

18. Integrate with Reader UI export flow.
19. Add configuration panel for page size, margins, and TOC options.
20. Write unit tests for `exportToPrintHTML()` against known AST fixtures.
21. Write visual regression tests comparing output HTML snapshots.
22. Document Puppeteer integration in the project README.
23. Add `maxTocDepth` filtering to TOC generation.

### 14.6 Future Enhancements

| Feature                              | Priority | Notes                                               |
| ------------------------------------ | -------- | --------------------------------------------------- |
| Syntax highlighting in code blocks   | Medium   | Requires lightweight highlighter dependency         |
| Image embedding (base64/file://)     | Low      | Increases HTML size; suppresses network requests    |
| Custom running headers (per-section) | Low      | Requires page named-page switching mid-document     |
| PDF/A compliance mode                | Low      | For archival-grade PDF generation                   |
| Table of figures/tables              | Low      | Additional TOC-like sections for figures and tables |
| Watermark support                    | Low      | Requested for draft/preview PDFs                    |

---

_End of PDF Export Specification v1.0.0_
