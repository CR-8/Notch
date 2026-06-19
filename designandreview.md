# New session - 2026-06-19T02:59:08.945Z

**Session ID:** ses_1222e97eeffeFKurZvgfrT8eTu
**Created:** 6/19/2026, 8:29:08 AM
**Updated:** 6/19/2026, 8:38:10 AM

---

## User

# NOTCH Library Redesign — Product, UX, Information Architecture & Visual System Overhaul

You are a Senior Product Designer, Information Architect, Staff Frontend Engineer, and Design Systems Lead.

Your task is to completely redesign the NOTCH Library experience.

Do not focus only on visual improvements.

The goal is to transform NOTCH from:

"A place where documents are stored"

into

"A place where knowledge is explored."

---

# Context

NOTCH is not a bookmarking application.

NOTCH is not a PDF reader.

NOTCH is not a note-taking application.

NOTCH captures webpages, PDFs, articles, repositories, and research content and transforms them into structured knowledge objects.

The system extracts:

* Summaries
* Concepts
* Entities
* Timelines
* Diagrams
* Images
* Relationships
* Metadata
* Knowledge Graphs

However the current library UI behaves as if documents are simple files.

The UI severely underutilizes extracted knowledge.

---

# Current Problems

## Problem 1

All document cards look identical.

Current card:

* Title
* Domain
* Word Count
* Date
* Snippet

This makes:

* Research reports
* Tutorials
* News articles
* Technical papers

all appear visually identical.

The user cannot immediately understand:

* What the document contains
* Why it matters
* How much value exists inside

---

## Problem 2

The library feels like a database viewer.

It does not feel like:

* Notion
* Readwise
* Fabric
* NotebookLM
* Arc Max
* Perplexity Collections

It feels like raw storage.

---

## Problem 3

Knowledge extraction is hidden.

The system already knows:

* Entities
* Concepts
* Timelines
* Relationships
* Diagrams
* Images

Yet the library displays none of these.

---

## Problem 4

The right side of the layout is underutilized.

The current grid wastes space.

The user sees very few documents at once.

---

## Problem 5

The sidebar provides almost no navigation power.

Current:

* All Documents
* Favorites
* Archive
* Folders

This is insufficient.

---

# Primary Goal

Redesign the entire library around the idea of:

Knowledge Objects

instead of

Documents

---

# Design Principles

The library should feel:

* Intelligent
* Exploratory
* Research-focused
* Premium
* Dense but readable
* Fast

The user should discover knowledge.

Not browse files.

---

# Information Architecture Redesign

Propose a completely new IA.

Examples:

Library

Recent

Favorites

Archive

Collections

Topics

Entities

Concepts

Timelines

Knowledge Graph

Research Spaces

Folders

Provide justification for every navigation item.

---

# Search Redesign

Current search only searches titles.

Redesign search into:

Global Knowledge Search

The user should be able to search:

* Document titles
* Concepts
* Entities
* Timeline events
* Sources
* Tags
* Relationships

Provide:

* Search architecture
* Search UX
* Search result design

---

# Card Redesign

Current cards are too generic.

Redesign cards as Knowledge Cards.

Each card should expose:

* Reading time
* Concepts count
* Entity count
* Diagram count
* Image count
* Timeline availability
* Knowledge density score
* Source
* Capture date

Show multiple card concepts.

Examples:

* Compact Card
* Detailed Card
* Research Card
* Visual Card

For each card type explain:

* Use case
* Advantages
* Drawbacks

---

# Visual Preview System

Documents should have intelligent previews.

Examples:

* Timeline thumbnail
* Knowledge graph preview
* Diagram preview
* Entity map preview
* Generated cover image

Design a preview hierarchy.

Explain how the preview should be selected automatically.

---

# Sidebar Redesign

Current sidebar is mostly empty.

Redesign it.

Potential sections:

Knowledge

Research

Topics

Recent Activity

Collections

Folders

Storage

Pinned Entities

Pinned Concepts

Suggested structure should be justified.

---

# New Views

The current library only supports a grid/list style.

Design additional views.

Examples:

Grid View

Compact View

Knowledge Graph View

Timeline View

Entity View

Concept View

Relationship View

Research Workspace View

For each:

* Purpose
* UX
* Technical feasibility

---

# Hover Experience

Design hover interactions.

When hovering a document:

Display:

* Summary
* Concepts
* Entities
* Diagram preview
* Timeline preview

without opening the document.

---

# Metadata Surface Area

Currently metadata is hidden.

Design a metadata system.

Possible fields:

* Reading Time
* Word Count
* Complexity
* Knowledge Density
* Topic
* Category
* Confidence Score
* Entity Count
* Concept Count
* Diagram Count
* Timeline Count

Explain which should be visible.

Which should be hidden.

---

# Knowledge Graph Integration

Design how NOTCH should expose:

* Concepts
* Entities
* Relationships

inside the library.

The library should make users feel they own a growing knowledge base.

Not a collection of saved webpages.

---

# Design System

Create recommendations for:

Typography

Spacing

Cards

Badges

Tags

Filters

Sidebar

Navigation

Empty States

Loading States

Skeletons

Dark Theme

Premium Feel

---

# Competitive Analysis

Compare NOTCH against:

* Readwise Reader
* NotebookLM
* Fabric
* Obsidian
* Notion
* Arc Max
* Perplexity Collections

Identify:

* What NOTCH should copy
* What NOTCH should avoid
* What unique strengths NOTCH already has

---

# Deliverables

Provide:

1. Full UX audit.
2. Full UI audit.
3. Information architecture redesign.
4. Navigation redesign.
5. Card redesign concepts.
6. Search redesign.
7. Metadata redesign.
8. Knowledge graph integration strategy.
9. View system redesign.
10. Component hierarchy.
11. Design system recommendations.
12. Wireframes using ASCII sketches.
13. Detailed implementation plan.
14. Frontend component changes.
15. State management changes.
16. Database/schema changes if required.
17. Production-ready recommendations.

Do not provide generic UI advice.

Think like a product designer hired to redesign NOTCH into a category-defining knowledge platform. 

---

## Assistant

**Tool: task**

---

## Assistant

Let me read the current library code and key types to understand the exact current state before designing.

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

Now I have a complete understanding of the current codebase. Let me produce the comprehensive redesign.

---

# NOTCH Library Redesign — Complete Deliverable

## 0. EXECUTIVE SUMMARY

NOTCH's extraction pipeline already computes: entities, concepts, timelines, relationships, topics, document type, complexity, diagram count, quality score — **none of which is surfaced in the library UI**. The library is an 1141-line monolithic file that treats rich knowledge objects as flat file listings. The redesign exposes everything the system already knows, transforms the IA from folder-based to knowledge-based navigation, and creates a premium exploratory experience.

---

## 1. INFORMATION ARCHITECTURE REDESIGN

```
LIBRARY (top level)
├── Home                    — Smart feed: recent captures, trending entities, suggested connections
├── Favorites               — Starred documents (keep)
├── Archive                 — Deprioritized documents (keep)
│
├── TOPICS (auto-derived)   — Generated from extraction pipeline topics[]
│   Each topic → filtered view + entity cloud + concept map
│
├── ENTITIES                — All extracted entities across library
│   ├── By Type: Technology / Organization / Person / Product / Standard
│   ├── By Frequency: most-mentioned first
│   └── Entity Detail → shows all documents mentioning that entity
│
├── CONCEPTS                — All extracted concept definitions
│   └── Concept Detail → glossary mode + linked documents
│
├── TIMELINES               — Documents with timeline extraction
│   ├── Global Timeline: merged events across documents
│   └── Per-document timelines
│
├── RELATIONSHIPS           — Knowledge graph connections
│   └── Interactive graph view
│
├── KNOWLEDGE GRAPH         — Full visual graph browser
│
├── COLLECTIONS             — Curated groups (rename from Folders)
│
└── RESEARCH SPACES         — New: session-based workspaces with pinned docs + notes
```

**Justification:**

| Nav Item | Why |
|---|---|
| **Home** | Replace dead "All Documents" with a dynamic, intelligent feed. Shows recently captured, high-value docs (qualityScore > 70), and knowledge suggestions (e.g. "3 documents mention 'Transformer' — explore the concept"). |
| **Topics** | Already extracted by `documentPlanner.ts` and `detectDocumentType()`. Grouping by topic is more useful than folders because it's automatic, cross-cutting, and reveals thematic clusters. |
| **Entities** | `extractEntities()` already returns typed entities with mention counts. An entity browser turns the library into a knowledge base — the user can navigate by "what is being discussed" rather than "what was saved." |
| **Concepts** | `extractConcepts()` returns defined terms. A concept index becomes a personal glossary. |
| **Timelines** | `extractTimeline()` returns dated events. A timeline view across documents reveals temporal narratives. |
| **Relationships / KG** | `extractRelationships()` returns `(source, target, relation)` triples. The library becomes explorable as a graph, not just a list. |
| **Collections** | Folders renamed for premium positioning. Still user-managed. |
| **Research Spaces** | New: pinned subset of documents + notes + active queries. For active research projects. |
| **Archive** | Low-value documents, out of the way. |

---

## 2. NAVIGATION REDESIGN (Sidebar)

```
┌─────────────────────────────────────┐
│ NOTCH                    ⌘K         │  ← Header + command palette trigger
├─────────────────────────────────────┤
│                                     │
│  Home                               │  ← Icon: compass
│  Favorites           ★ 12           │  ← With count badges
│  Archive            □ 8             │
│                                     │
│ ── KNOWLEDGE ────────────────────── │
│  Topics            ●  6             │  ← Auto-derived topics with count
│  Entities          ◆  47            │
│  Concepts          ⬡  23            │
│  Timelines         ↻  5             │
│  Knowledge Graph   ⊞                │
│                                     │
│ ── SPACES ───────────────────────── │
│  Research Spaces   +                │
│  └─ LLM Security    3               │  ← Active research space
│  └─ React Patterns  7               │
│                                     │
│ ── COLLECTIONS ──────────────────── │
│  + New Collection                   │
│  └─ ● Papers           14           │  ← Color dot + count
│  └─ ● Tutorials        8            │
│  └─ ● Reference        23           │
│                                     │
│ ── RECENT ACTIVITY ──────────────── │
│  Captured "Building LLM..."   2m    │  ← Live activity feed
│  Read "React 19 Patterns"    15m    │
│  Starred "RAG Architecture"   1h    │
│                                     │
│ ── STORAGE ─────────────────────── │
│  ████████░░░░ 72% used              │  ← Visual storage bar
│  Export All     Compact              │
│                                     │
└─────────────────────────────────────┘
```

**Key changes:**
- **Knowledge section** is new — the core differentiator. Every extraction output gets a navigation entry.
- **Spaces section** replaces ad-hoc folder usage. Research spaces are session-based workspaces (pinned docs + notes + chat context).
- **Collections** is the renamed Folders section (premium positioning).
- **Recent Activity** shows live feed of captures, reads, stars — makes the library feel alive.
- **Storage bar** gives immediate feedback on quota.
- **Command palette** (`⌘K`) for power users to jump to any document, entity, concept, or topic.

---

## 3. CARD REDESIGN — Knowledge Cards

The current card shows: title, domain, wordCount, date, snippet. Everything looks identical.

### Card Type 1: Compact Card

```
┌────────────────────────────────────────────────────────────────────────┐
│ ★ │ Transformer: Attention is All You Need                           │
│    │ arxiv.org           ● AI · Deep Learning · 2017                  │
│    │ 📄 12p · 🧠 8 concepts · ◆ 23 entities · 📊 3 diagrams          │
│    │ Knowledge Density: ████████░░ High  |  Captured 2d ago           │
└────────────────────────────────────────────────────────────────────────┘
```

**Use case:** Density-optimized view, power users. Shows at a glance: title, domain, type badges (topic tags), knowledge metrics, and richness indicators.

**Advantages:** High information density. Fit ~20 items per screen. At-a-glance comparison.
**Drawbacks:** No summary. Requires learned reading of iconography.

### Card Type 2: Detailed Card (default)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ★ │ Transformer: Attention is All You Need                     │📊 3 · 💡 8│
│   │ arxiv.org · Vaswani et al., 2017 · 12 min read                       │
├────────────────────────────────────────────────────────────────────────────┤
│   "The dominant sequence transduction models are based on complex RNNs    │
│   or CNNs... We propose a new simple network architecture, the            │
│   Transformer, based solely on attention mechanisms..."                   │
├────────────────────────────────────────────────────────────────────────────┤
│   🧠 Concepts        ◆ Entities           📊 Diagrams       │  ↻ Timeline │
│   ┌────────────      ┌──────────────      ┌────────────     │  2017: Pape…  │
│   │ Self-Attention   │ Transformer         │ Architecture   │  2018: BERT…  │
│   │ Multi-Head Attn  │ BERT                │ Attention Comp │  2019: GPT…   │
│   │ Positional Enc   │ GPT                 │ ──────────     │               │
│   └────────────      └──────────────      └────────────     │               │
│                                                               │           │
│   📷 4 images  |  Knowledge Density: ████████░░ 82/100         │           │
│   Tags: #deep-learning #nlp #transformer                       │           │
└────────────────────────────────────────────────────────────────────────────┘
```

**Use case:** Default view. Rich preview without opening document.

**Advantages:** Shows extracted knowledge inline. User can evaluate document value without clicking. Feels like a knowledge base, not a file list.

**Drawbacks:** Taller cards, fewer visible per page (2 columns).

### Card Type 3: Visual Card

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   [GENERATED COVER IMAGE / DIAGRAM THUMBNAIL]                     │
│   ┌──────────────────────────────────────────────────────┐       │
│   │         Transformer Architecture                      │       │
│   │   Input → Embedding → Multi-Head Attention → Output   │       │
│   └──────────────────────────────────────────────────────┘       │
│                                                                    │
│   Transformer: Attention is All You Need                          │
│   arxiv.org · 2017 · 12 min read                                  │
│   ◆ 23 entities · 📊 3 diagrams · 8 concepts                     │
└────────────────────────────────────────────────────────────────────┘
```

**Use case:** Gallery/bento mode. Best for visual documents (diagrams, architecture, design).

**Advantages:** Visually striking. Leverages existing diagram extraction (Mermaid/PlantUML). Works as a grid that looks like a design tool.

**Drawbacks:** Requires generated/selected visual. Some documents lack diagrams.

### Card Type 4: Research Card

```
┌────────────────────────────────────────────────────────────────────┐
│ ★ │ Attention Is All You Need                                     │
│   │ arXiv:1706.03762 · NeurIPS 2017 · Cited by 50k+               │
├────────────────────────────────────────────────────────────────────┤
│  Key Entities:                                                     │
│  ◆ Transformer (M:47)  ◆ Self-Attention (M:23)  ◆ BERT (M:12)    │
│  ◆ GPT (M:8)           ◆ Cross-Attention (M:7)                    │
├────────────────────────────────────────────────────────────────────┤
│  Relationship Graph:                                               │
│  Transformer ──uses──→ Self-Attention                              │
│  Transformer ──enables──→ Parallel Training                        │
│  BERT ──based-on──→ Transformer                                   │
├────────────────────────────────────────────────────────────────────┤
│  Timeline:  2017 (Paper) → 2018 (BERT) → 2019 (GPT-2) → 2020...  │
│  Document Type: Research Paper | Complexity: 72/100               │
└────────────────────────────────────────────────────────────────────┘
```

**Use case:** Research papers, technical documents. Maximum knowledge exposure.

**Advantages:** Shows entities with mention counts, relationships, timeline. Researcher can evaluate relevance immediately.

**Drawbacks:** Information-dense, may overwhelm casual users. Best as a toggleable card variant.

---

## 4. VISUAL PREVIEW SYSTEM

### Preview Selection Hierarchy (automatic):
```
1. If diagramCount > 0    → Show first Mermaid/PlantUML diagram as thumbnail
2. If imageCount > 0      → Show first extracted image
3. If has timeline        → Show mini timeline sparkline
4. If entities.length > 5 → Show entity bubble cloud
5. If no visuals          → Show generated cover (title + topic gradient)
```

### Preview Types:
- **Diagram Thumbnail:** Renders first diagram at small scale with overlay saying "3 diagrams"
- **Entity Cloud:** Top 5 entities as colored bubbles sized by mention count
- **Timeline Sparkline:** Horizontal mini-timeline with dots at each event year
- **Concept Grid:** 2×2 grid of concept term + short definition
- **Generated Cover:** Gradient background based on document type + primary topic text overlayed

---

## 5. SEARCH REDESIGN

### Current: Fuse.js on title/tags/domain/summary (4 fields)
### Redesign: Global Knowledge Search

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍  Search everything...                          [⌘K]    [Entities] [Con] │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Results for "attention"                                             │   │
│  │                                                                     │   │
│  │ 📄 DOCUMENTS (4)                                                    │   │
│  │  │ Attention Is All You Need         arxiv.org          ◆ 23 ent   │   │
│  │  │ Attention Mechanisms in CV        openaccess.org     ◆ 12 ent   │   │
│  │                                                                     │   │
│  │ ◆ ENTITIES (3)                                                      │   │
│  │  │ Attention (concept) — 4 documents     │  Self-Attention — 3 docs │   │
│  │  │ Cross-Attention — 2 documents                                    │   │
│  │                                                                     │   │
│  │ 🧠 CONCEPTS (2)                                                     │   │
│  │  │ Scaled Dot-Product Attention: "Attention(Q,K,V) = softmax(...)"  │   │
│  │  │ Multi-Head Attention: "runs multiple attention in parallel"      │   │
│  │                                                                     │   │
│  │ ↻ TIMELINE EVENTS (1)                                               │   │
│  │  │ 2017 — "Attention Is All You Need" published at NeurIPS         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Search Architecture:
- **Search index** built from: title, domain, tags, summary, extracted entities[].name, concepts[].concept, timeline[].event, topics[], relationships[].source, relationships[].target
- **Hybrid approach:** Fuse.js for instant client-side matching (titles + tags) + Dexie query for entity/concept/timeline search
- **Result sections:** Grouped by content type (Documents, Entities, Concepts, Timelines)
- **Faceted filtering:** Filter by document type (tutorial/reference/news/analysis), date range, entity count thresholds
- **Keyboard-first:** Type query → arrow keys to navigate sections → Enter to select

---

## 6. METADATA SYSTEM

### Visibility Tiers:

**Tier 1 — Always visible (on card):**
- Reading time (computed from wordCount at ~200 wpm)
- Entity count + concept count (shows richness at a glance)
- Document type badge (tutorial/reference/news/analysis)
- Knowledge Density score (composite: entities×2 + concepts×3 + diagrams×5 + timeline×4 + qualityScore×0.3)

**Tier 2 — Visible on hover:**
- Quality score (0–100)
- Complexity/readability score
- Diagram count
- Image count
- Timeline count
- Top 3 entities

**Tier 3 — In detailed card or detail panel:**
- Full entity list with mention counts
- Full concept list with definitions
- Full timeline events
- Relationship graph
- Sources/citations
- Provider used for generation
- Generation mode (FAST/BALANCED/DEEP)

### Knowledge Density Score Formula:
```
density = (
  (entityCount * 2) +
  (conceptCount * 3) +
  (diagramCount * 5) +
  (timelineCount * 4) +
  (qualityScore * 0.3)
) / maxPossible * 100
```
Displayed as: `████████░░ 68/100 · High`

---

## 7. KNOWLEDGE GRAPH INTEGRATION

### Strategy: Three-tier integration

**Tier 1 — Embedded in cards (micro-graph):**
Each card shows a small relationship snippet for documents that have relationships:
```
Transformer ──enables──→ Parallel Training
```

**Tier 2 — Entity/Concept detail panel:**
Clicking an entity or concept in the sidebar opens a detail view showing:
- Definition
- All documents mentioning it
- Related entities (from relationships)
- Visual sub-graph centered on that entity

**Tier 3 — Full Knowledge Graph view:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Knowledge Graph                       [Filter] [Zoom] [Layout]   │
│                                                                     │
│         ┌───────┐                                                   │
│         │ BERT  │ ◀─── based-on ──── Transformer                   │
│         └───────┘                     │  │  │                      │
│                                       │  │  │                      │
│                               ┌────────┴┐ │ ┌──────────┐          │
│                               │Self-Attn│ │ │Positional│          │
│                               └─────────┘ │ │ Encoding │          │
│                                           │ └──────────┘          │
│                                  ┌────────┴────────┐              │
│                                  │ Multi-Head Attn │              │
│                                  └─────────────────┘              │
│                                                                     │
│  Node size = mention count  |  Edge width = relationship strength  │
└────────────────────────────────────────────────────────────────────┘
```
**Implementation:** Use D3.js force-directed graph or vis-network. Data already exists as `relationships[]` on each Document. Merge all relationships across documents → global graph.

---

## 8. VIEW SYSTEM

| View | Purpose | Columns | Technical Feasibility |
|---|---|---|---|
| **Grid** | Default. Detailed cards in 2-column layout. | 2 | Trivial — CSS grid change |
| **Compact** | Power user. Horizontal rows with knowledge metrics. | 1 | Already exists (rename/upgrade) |
| **Bento** | Mixed cards. Visual cards for diagram-rich docs, detailed for text-rich. | 3 | Medium — requires card type auto-selection |
| **Timeline View** | Documents arranged chronologically with timeline events extracted. Shows temporal narrative. | 1 | Medium — group by extracted timeline years |
| **Entity View** | Grid where each entity is a cell, showing connected documents inside. | N/A | Medium — entity→documents mapping |
| **Knowledge Graph** | Full interactive graph of entities + relationships. Nodes = entities, edges = relationships. | N/A | High — requires D3/vis.js |
| **Research Workspace** | Split panel: document list + pinned notes + entity cloud for active research space. | N/A | Medium — needs Spaces data model |

---

## 9. COMPONENT ARCHITECTURE

### New Component Tree:

```
LibraryApp
├── Sidebar
│   ├── SidebarHeader (logo + command palette trigger)
│   ├── NavSection (primary: Home, Favorites, Archive)
│   ├── KnowledgeSection (Topics, Entities, Concepts, Timelines, KG)
│   ├── SpacesSection (Research Spaces)
│   ├── CollectionsSection (folders renamed)
│   ├── RecentActivity
│   └── StorageBar
│
├── LibraryContent
│   ├── TopBar
│   │   ├── GlobalSearch (knowledge search)
│   │   ├── ViewSwitcher (Grid/Compact/Timeline/Graph)
│   │   ├── SortControl (density, date, title, entity count)
│   │   └── FilterBar (document type, date range, entity count)
│   │
│   ├── KnowledgePreviewBar (optional, bottom of topbar)
│   │   ├── EntityCloud (top entities across visible docs)
│   │   └── QuickFilters (entity chips, topic chips)
│   │
│   ├── DocumentGrid
│   │   ├── KnowledgeCard (polymorphic: compact/grid/research/visual)
│   │   │   ├── CardHeader (star, title, domain, type badge)
│   │   │   ├── KnowledgeMetrics (entities, concepts, diagrams, density)
│   │   │   ├── SummaryPreview (detailed mode)
│   │   │   ├── PreviewThumbnail (auto-selected preview)
│   │   │   ├── EntityTagList (top entities as colored pills)
│   │   │   ├── ConceptBadges (top concepts)
│   │   │   ├── TimelineSparkline
│   │   │   ├── RelationshipSnippet
│   │   │   ├── TagList (user tags)
│   │   │   └── CardActions (star, archive, move, delete)
│   │   │
│   │   ├── GridView
│   │   ├── CompactView
│   │   ├── TimelineView
│   │   └── EntityView
│   │
│   ├── KnowledgeGraphView (full view replacement)
│   │
│   └── Pagination / InfiniteScroll
│
├── EntityDetailPanel (slide-over, when entity clicked)
├── ConceptDetailPanel (slide-over, when concept clicked)
├── TimelineDetailPanel (slide-over, when timeline clicked)
├── SearchResultsPanel (slide-over or full overlay)
└── WorkspacePanel (for Research Spaces)
```

### New Files to Create:

```
src/components/library/
├── LibraryApp.tsx              (refactored from current App.tsx)
├── Sidebar.tsx                 (extracted)
├── TopBar.tsx                  (extracted)
├── GlobalSearch.tsx            (new)
├── KnowledgeCard.tsx           (new — replaces DocumentCard)
├── CardPreviews/
│   ├── DiagramPreview.tsx
│   ├── EntityCloud.tsx
│   ├── TimelineSparkline.tsx
│   ├── ConceptBadges.tsx
│   └── GeneratedCover.tsx
├── views/
│   ├── GridView.tsx
│   ├── CompactView.tsx
│   ├── TimelineView.tsx
│   ├── EntityView.tsx
│   └── KnowledgeGraphView.tsx
├── panels/
│   ├── EntityDetailPanel.tsx
│   ├── ConceptDetailPanel.tsx
│   └── SearchResultsPanel.tsx
├── KnowledgePreviewBar.tsx     (new)
├── ActivityFeed.tsx            (new)
├── StorageBar.tsx              (extracted)
└── CollectionSection.tsx       (refactored from folder list)
```

---

## 10. DATA SCHEMA CHANGES

### `DocumentMeta` type — currently too thin:

**Current:**
```typescript
type DocumentMeta = {
  id: string; title: string; url: string; domain: string;
  capturedAt: string; wordCount: number; summary: string;
  tags: string[]; folder?: string;
  isStarred: boolean; isArchived: boolean; isRead: boolean;
  mode: GenerationMode; provider: string;
};
```

**Proposed:**
```typescript
type DocumentMeta = {
  id: string; title: string; url: string; domain: string;
  capturedAt: string; wordCount: number; summary: string;
  tags: string[]; folder?: string;
  isStarred: boolean; isArchived: boolean; isRead: boolean;
  mode: GenerationMode; provider: string;
  // NEW FIELDS:
  documentType: string;          // 'tutorial' | 'reference' | 'news' | 'analysis' | 'documentation' | 'general'
  complexity: number;            // 0-100
  qualityScore: number;          // 0-100
  readingTimeMinutes: number;
  diagramCount: number;
  imageCount: number;
  entityCount: number;
  conceptCount: number;
  timelineCount: number;
  knowledgeDensity: number;      // computed
  topEntities: string[];         // top 3 by mention count
  topConcepts: string[];         // top 3
  topics: string[];              // extracted topics
  hasTimeline: boolean;
  hasRelationships: boolean;
  previewType: 'diagram' | 'image' | 'timeline' | 'entity-cloud' | 'generated';
  previewData?: string;          // JSON-encoded preview metadata
};
```

### Dexie Index Changes (`src/lib/db.ts`):
```typescript
this.version(5).stores({
  notes: 'id, status, domain, starred, archived, createdAt, diagramCount, qualityScore, documentType, entityCount, topics',
  // topics as multi-entry index for topic-based queries
});
```

### New Database Stores:
```typescript
// Entities index — cross-document entity registry
entityIndex: 'id, name, type, mentionCount',
// Concept index — cross-document concept registry
conceptIndex: 'id, concept',
// Timeline index — cross-document timeline events
timelineIndex: 'id, documentId, year',
```

### `storage.ts` changes:
```typescript
// New functions needed
export async function getEntityIndex(): Promise<EntityIndexEntry[]>
export async function getConceptIndex(): Promise<ConceptIndexEntry[]>
export async function getMergedTimeline(): Promise<MergedTimelineEvent[]>
export async function getGlobalRelationships(): Promise<GlobalRelationship[]>
export async function getTopics(): Promise<TopicEntry[]>
```

---

## 11. COMPETITIVE ANALYSIS

| Feature | NOTCH (current) | Readwise | NotebookLM | Obsidian | Notion | Perplexity | **NOTCH target** |
|---|---|---|---|---|---|---|---|
| Document capture | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | **Keep** |
| AI summaries | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | **Keep** |
| Entity extraction | ✅ (hidden) | ❌ | ❌ | ❌ | ❌ | ❌ | **SURFACE** |
| Concept extraction | ✅ (hidden) | ❌ | ❌ | ❌ | ❌ | ❌ | **SURFACE** |
| Timeline extraction | ✅ (hidden) | ❌ | ❌ | ❌ | ❌ | ❌ | **SURFACE** |
| Relationship graph | ✅ (hidden) | ❌ | ❌ | ✅ (manual) | ❌ | ❌ | **SURFACE** |
| Knowledge Graph view | ❌ | ❌ | ❌ | ✅ (plugin) | ❌ | ❌ | **Build** |
| Diagram generation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **Leverage** |
| RAG / Chat | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | **Improve** |
| Premium UI | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | **Target** |
| Keyboard navigation | ✅ (basic) | ✅ | ❌ | ✅ | ✅ | ❌ | **Improve** |
| Mobile | ❌ (extension) | ✅ | ✅ | ✅ | ✅ | ✅ | **Future** |

**What NOTCH should copy:**
- Readwise: card density, hover preview, keyboard-first navigation, reading progress
- NotebookLM: audio overviews, source grounding, notebook structure
- Obsidian: graph view, local-first, markdown export
- Notion: database views (table/gallery/timeline/calendar), templates
- Arc Max: command palette, split-view tabs

**What NOTCH should avoid:**
- Avoid being "just another read-later" (current trajectory without this redesign)
- Avoid complex plugin systems (keep it focused and opinionated)
- Avoid web-first rendering (keep it fast, local-first)

**Unique strengths NOTCH already has:**
- Automatic entity/concept/timeline extraction (nobody else does this automatically)
- Diagram generation (Mermaid/PlantUML) integrated into the capture pipeline
- Deterministic NLP extraction works offline — no API call needed
- It's a browser extension — captures anything on the web
- RAG on captures — Ask questions across your knowledge base

---

## 12. WIREFRAMES (ASCII)

### Home View (Default):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ NOTCH                                🔍 Search knowledge...    [Grid ▼] [Sort ▼]     │
├──────────────┬───────────────────────────────────────────────────────────────────────┤
│  🧭 Home     │  Recently Captured                                        Show all →  │
│  ★ Favorites │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  □ Archive   │  │ Attention Is All │ │ React 19 Deep   │ │ Building LLMs   │          │
│               │  │ You Need        │ │ Dive            │ │ from Scratch    │          │
│ ──────────── │  │ arxiv.org        │ │ react.dev       │ │ github.com      │          │
│  📊 Topics   │  │ 📄 15m · ◆23 ·📊3│ │ 📄 8m · ◆12 ·🧠5│ │ 📄 25m · ◆31   │          │
│  ◆ Entities  │  │ Research Paper   │ │ Tutorial        │ │ Documentation   │          │
│  🧠 Concepts │  │ ████████ 82/100  │ │ ██████ 65/100   │ │ ███████ 75/100  │          │
│  ↻ Timelines │  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
│  ⊞ Knowledge │                                                                       │
│    Graph     │  Trending Entities:  [Transformer] [BERT] [Attention] [React]         │
│               │                                                                       │
│ ──────────── │  High-Value Reads                                     Show all →      │
│  📁 Spaces   │  ┌─────────────────┐ ┌─────────────────┐                               │
│  └─ LLM Sec  │  │ RAG Architecture │ │ Prompt Engineer  │                               │
│               │  │ design pattern   │ │ best practices  │                               │
│ ──────────── │  │ ██████████ 95/100│ │ ████████ 88/100│                               │
│  📂 Collect. │  └─────────────────┘ └─────────────────┘                               │
│  └─ ● Papers │                                                                       │
│  └─ ● Tutorial│  < 1 2 3 ... 12 >                                                    │
│               │                                                                       │
│ ──────────── │                                                                       │
│  Recent:     │                                                                       │
│  Cap. 2m ago │                                                                       │
│  Read 15m ago│                                                                       │
│               │                                                                       │
│  Storage     │                                                                       │
│  ██████░░ 72%│                                                                       │
└──────────────┴───────────────────────────────────────────────────────────────────────┘
```

### Entity Sidebar → Detail Panel:

```
┌──────────────┬────────────────────────────────────────────────────────────────────┐
│  ◆ Entities  │  ◆ Transformer                                        ← Back      │
│    ────────  │                                                                    │
│  All (47)    │  Appears in 4 documents  |  Type: technology  |  47 mentions      │
│  ────────    │                                                                    │
│  Technology  │  Definition: "The Transformer is a neural network architecture...  │
│  │◆Transformr│                                                                    │
│  │◆BERT   23 │  Connected Documents:                                              │
│  │◆GPT    18 │  ┌────────────────────────────────────────────────────┐           │
│  │◆React  12 │  │ Attention Is All You Need     ◆ 47 mentions       │           │
│  │◆RAG     9 │  │ Transformer: A Novel Approach  ◆ 23 mentions       │           │
│  │◆Kubernts 7│  │ BERT: Pre-training...         ◆ 12 mentions       │           │
│  ────────    │  └────────────────────────────────────────────────────┘           │
│  Person      │                                                                    │
│  │◆Vaswani   │  Relationship Graph:                                              │
│  │◆Karpathy  │      ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  ────────    │      │  BERT    │──│Transformr│──│   GPT    │                   │
│  Concept     │      └──────────┘  └──────────┘  └──────────┘                   │
│  │◆Self-Attn  │           │              │              │                       │
│               │           │              │              │                       │
│               │      ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐                 │
│               │      │Self-Attn│   │Multi-Head │  │  Decoder │                 │
│               │      └─────────┘   └───────────┘  └─────────┘                 │
└──────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 13. IMPLEMENTATION PLAN

### Phase 1 — Foundation (Week 1)

**Files to create/modify:**

| File | Change |
|---|---|
| `src/lib/types.ts` | Extend `DocumentMeta` with all new fields. Add `EntityIndexEntry`, `ConceptIndexEntry`, `TopicEntry` types. Add `KnowledgeDensityScore` helper function. |
| `src/lib/db.ts` | Add v5 schema with new indices (`documentType`, `entityCount`, `topics` as multi-entry). Add entityIndex, conceptIndex, timelineIndex stores. |
| `src/lib/storage.ts` | Add `deriveRichDocumentMeta()` function that computes knowledge metrics from full Document. Add `getEntityIndex()`, `getConceptIndex()`, `getTopics()`, `getMergedTimeline()`. Modify `getDocumentMetas()` to return rich metas. |
| `src/lib/content-engine/extraction/types.ts` | Add `previewType` to exports. |

### Phase 2 — Sidebar + Navigation (Week 1-2)

**New files:**
- `src/components/library/Sidebar.tsx`
- `src/components/library/KnowledgeSection.tsx`
- `src/components/library/CollectionSection.tsx`
- `src/components/library/StorageBar.tsx`
- `src/components/library/ActivityFeed.tsx`
- `src/components/library/SidebarHeader.tsx`

**Modified files:**
- `src/entrypoints/newtab/App.tsx` — Extract Sidebar to its own component file; import new components
- `src/assets/globals.css` — Add sidebar section group styles, nav item variants

### Phase 3 — Knowledge Cards (Week 2-3)

**New files:**
- `src/components/library/KnowledgeCard.tsx`
- `src/components/library/CardPreviews/DiagramPreview.tsx`
- `src/components/library/CardPreviews/EntityCloud.tsx`
- `src/components/library/CardPreviews/TimelineSparkline.tsx`
- `src/components/library/CardPreviews/ConceptBadges.tsx`
- `src/components/library/CardPreviews/GeneratedCover.tsx`

**Modified files:**
- `src/entrypoints/newtab/App.tsx` — Replace `DocumentCard` with `KnowledgeCard`
- `src/assets/globals.css` — Add card type styles, preview container styles, knowledge metric badge styles

### Phase 4 — Search (Week 3)

**New files:**
- `src/components/library/GlobalSearch.tsx`
- `src/components/library/panels/SearchResultsPanel.tsx`

**Modified files:**
- `src/lib/storage.ts` — Add multi-field search function across entities, concepts, timelines, documents

### Phase 5 — Views (Week 3-4)

**New files:**
- `src/components/library/views/GridView.tsx`
- `src/components/library/views/CompactView.tsx`
- `src/components/library/views/TimelineView.tsx`
- `src/components/library/views/EntityView.tsx`
- `src/components/library/views/KnowledgeGraphView.tsx`

**Dependencies:**
- `d3-force` or `vis-network` for KnowledgeGraphView
- `date-fns` for timeline grouping

### Phase 6 — Detail Panels (Week 4)

**New files:**
- `src/components/library/panels/EntityDetailPanel.tsx`
- `src/components/library/panels/ConceptDetailPanel.tsx`
- `src/components/library/panels/TimelineDetailPanel.tsx`

**Modified files:**
- `src/entrypoints/newtab/App.tsx` — Add slide-over panel state management, import panel components

### Phase 7 — Research Spaces (Week 4-5)

**New files:**
- `src/components/library/WorkspacePanel.tsx`

**Modified:**
- `src/lib/types.ts` — Add `ResearchSpace` type
- `src/lib/db.ts` — Add `researchSpaces` store
- `src/lib/storage.ts` — Add CRUD for research spaces

---

## 14. DESIGN SYSTEM RECOMMENDATIONS

### Typography:
- **Current:** Inter throughout. Keep it. Add semibold (500) for knowledge metric labels, adjust caption to 11px for density.
- **New typography tokens:**
  - `--font-mono-metric` — IBM Plex Mono for numeric metrics (entity counts, scores)
  - Card title: `text-[15px] font-semibold leading-snug` (compact) / `text-[17px]` (detailed)

### Spacing:
- Card padding: `p-4` (compact) / `p-5` (detailed)
- Card gap between sections: `gap-2`
- Sidebar section spacing: `mb-6` between groups, `mb-1` section headers

### Colors:
- **Knowledge badges:**
  - Entity pill: `--color-accent-sky` bg at 10% opacity
  - Concept pill: `--color-accent-purple` bg at 10% opacity
  - Diagram badge: `--color-accent-teal` bg at 10% opacity
  - Timeline badge: `--color-accent-orange` bg at 10% opacity
- **Density score bar:** gradient from `--color-destructive` (0) → `--color-accent-orange` (50) → `--color-accent-green` (100)
- **Document type badges:**
  - Tutorial: green tint
  - Research: purple tint
  - News: blue tint
  - Reference: gray tint
  - Analysis: amber tint

### Cards:
- Base card: `rounded-xl border border-hairline bg-surface`
- Hover: `border-primary shadow-level-1`
- Preview thumbnail area: `rounded-lg bg-canvas-soft overflow-hidden` with optional gradient overlay
- Knowledge metric bar: `flex gap-3 text-[11px] text-ink-muted`

### Dark Theme:
- Already excellent. Add knowledge badge colors for dark mode at 15% opacity.

### Empty States:
- Show knowledge suggestions: "Capture your first technical paper to see entity extraction in action."
- When no entities exist for a document: "This document hasn't been processed yet. Open it to extract knowledge."

### Loading States:
- Card skeleton: preview area `h-24` + title `h-4 w-3/4` + metrics `h-3 w-full` + tags `h-6` — all with pulse animation
- Sidebar skeleton: nav items with reduced opacity
- Knowledge graph skeleton: pulsating circular placeholders in graph layout

---

## 15. FRONTEND CODE CHANGES — SPECIFIC

### `deriveRichDocumentMeta()` — new function in `storage.ts`:

```typescript
export function deriveRichDocumentMeta(doc: Document): RichDocumentMeta {
  const base = deriveDocumentMeta(doc);
  const entityCount = doc.entities?.length ?? 0;
  const conceptCount = doc.concepts?.length ?? 0;
  const timelineCount = doc.timeline?.length ?? 0;
  const diagramCount = doc.diagramCount ?? 0;
  const imageCount = doc.imageCount ?? 0;
  const qualityScore = doc.qualityScore ?? 50;
  const complexity = doc.complexity ?? 0;

  const knowledgeDensity = Math.round(
    (entityCount * 2 + conceptCount * 3 + diagramCount * 5 + timelineCount * 4 + qualityScore * 0.3) / 2
  );

  const topEntities = (doc.entities ?? [])
    .sort((a, b) => (b.mentions ?? 0) - (a.mentions ?? 0))
    .slice(0, 3)
    .map(e => e.name);

  const topConcepts = (doc.concepts ?? []).slice(0, 3).map(c => c.concept);

  const previewType = diagramCount > 0 ? 'diagram'
    : imageCount > 0 ? 'image'
    : timelineCount > 0 ? 'timeline'
    : entityCount > 5 ? 'entity-cloud'
    : 'generated';

  return {
    ...base,
    documentType: doc.documentType ?? 'general',
    complexity,
    qualityScore,
    readingTimeMinutes: doc.readingTimeMinutes ?? Math.max(1, Math.round(doc.wordCount / 200)),
    diagramCount,
    imageCount,
    entityCount,
    conceptCount,
    timelineCount,
    knowledgeDensity: Math.min(100, knowledgeDensity),
    topEntities,
    topConcepts,
    topics: doc.topics ?? [],
    hasTimeline: timelineCount > 0,
    hasRelationships: (doc.relationships?.length ?? 0) > 0,
    previewType,
  };
}
```

### `getDocumentMetas()` — modify to use rich function:

```typescript
export async function getDocumentMetas(ids: string[]): Promise<RichDocumentMeta[]> {
  const docs = await db.notes.bulkGet(ids);
  return docs.filter((d): d is Document => d != null).map(deriveRichDocumentMeta);
}
```

### Dexie v5 migration:

```typescript
this.version(5).stores({
  notes: 'id, status, domain, starred, archived, createdAt, diagramCount, qualityScore, documentType, *topics',
  chunks: 'id, noteId, paragraphIndex',
  vectors: 'chunkId, providerId, embeddingModel, embeddingVersion',
  conversations: 'id, createdAt',
  messages: 'id, documentId, role, createdAt',
  providers: 'id, enabled',
  highlights: 'id, documentId, createdAt',
  entityIndex: 'id, name, type',
  conceptIndex: 'id, concept',
  timelineIndex: 'id, documentId, year',
}).upgrade(async () => {
  // Build entityIndex, conceptIndex, timelineIndex from existing documents
});
```

### `globals.css` additions:

```css
/* Knowledge Badge Variants */
.notch-badge-entity {
  background: rgba(98, 174, 240, 0.1);
  color: var(--color-accent-sky);
  border-color: rgba(98, 174, 240, 0.2);
}
.notch-badge-concept {
  background: rgba(214, 182, 246, 0.1);
  color: var(--color-accent-purple);
  border-color: rgba(214, 182, 246, 0.2);
}
.notch-badge-diagram {
  background: rgba(42, 157, 153, 0.1);
  color: var(--color-accent-teal);
  border-color: rgba(42, 157, 153, 0.2);
}
.notch-badge-timeline {
  background: rgba(221, 91, 0, 0.1);
  color: var(--color-accent-orange);
  border-color: rgba(221, 91, 0, 0.2);
}

/* Density Score Bar */
.notch-density-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--color-hairline);
  overflow: hidden;
}
.notch-density-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
  background: linear-gradient(90deg, var(--color-destructive), var(--color-accent-orange), var(--color-accent-green));
}

/* Sidebar Section Groups */
.notch-sidebar-section {
  margin-bottom: 20px;
}
.notch-sidebar-section-header {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-ink-faint);
  padding: 0 12px;
  margin-bottom: 4px;
}

/* Preview Container */
.notch-preview {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-canvas-soft);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.notch-preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  color: white;
  font-size: 10px;
  font-weight: 500;
}
```

---

## 16. RISK ASSESSMENT

| Risk | Mitigation |
|---|---|
| Dexie v5 migration fails for large libraries | Test migration path with 1000+ documents. Use `upgrade()` hook with progress reporting. |
| Knowledge metrics slow down library load | Compute `deriveRichDocumentMeta()` in a deferred batch after initial render. Show skeleton cards for metrics. |
| Entity/Concept/Topic counts are zero for existing docs | Show "Open to extract" badge. Backfill when document is opened in reader. |
| Knowledge Graph view is performance-heavy | Use canvas-based rendering (D3-force with canvas). Cap at 200 nodes. Show subset by selected topic. |
| Sidebar becomes too deep | Group secondary items (Entities/Concepts/Timelines) under a "Knowledge" expandable section. |

---

## 17. SUCCESS METRICS

- **Card engagement:** % of documents opened from library (should increase with better previews)
- **Knowledge discovery:** Entity/concept/timeline click-through rate from library
- **Search depth:** % of searches that navigate to entity/concept results (not just document titles)
- **Retention:** DAU/MAU ratio after redesign
- **Perceived value:** User reports "I discovered knowledge I didn't know I had"

---

This redesign transforms NOTCH from a document viewer into a knowledge exploration platform. The key insight is that **every piece of data already exists** in the extraction pipeline — it simply needs to be surfaced in the UI. The implementation cost is relatively low (mostly frontend component work) because the backend extraction is already complete.

---

## User

# NOTCH Library Red Team UX Review

Act as:

* Former Notion Product Designer
* Former Readwise Product Designer
* Former Arc Browser Product Designer
* Staff UX Researcher
* Information Architect
* Power User of Knowledge Management Tools

Your job is NOT to improve NOTCH.

Your job is to brutally critique it.

Assume I am paying you $50,000 to identify every weakness in the current product.

Do not be polite.

Do not defend existing decisions.

Treat every UI component as guilty until proven useful.

---

# Context

NOTCH is intended to become:

* A personal knowledge system
* AI-powered research companion
* Intelligent document platform
* Knowledge graph generator
* Research workspace

Current users:

* Engineers
* Researchers
* Students
* Analysts
* Founders

---

# Your Mission

Review the library experience as if you encountered it for the first time.

Answer:

1. What feels unfinished?
2. What feels confusing?
3. What feels generic?
4. What feels low-value?
5. What feels like a developer tool?
6. What feels like technical debt?
7. What feels premium?
8. What would make users abandon it?

---

# Evaluate The Library

Review:

* Layout
* Navigation
* Sidebar
* Search
* Cards
* Metadata
* Discoverability
* Empty states
* Visual hierarchy
* Density
* Information architecture
* Personal knowledge management workflows

---

# Card Audit

Current cards contain:

* Title
* Source
* Word count
* Date
* Snippet

Critique this design.

Explain:

* What information is missing
* What information should be removed
* What information should be surfaced

Design a better card.

---

# Knowledge Visibility Audit

NOTCH extracts:

* Entities
* Concepts
* Timelines
* Relationships
* Images
* Diagrams
* Metadata

Evaluate how visible this knowledge is.

Assume a user does not know how NOTCH works.

Would they realize the system extracted anything intelligent?

If not:

Explain why.

---

# Competitive Review

Compare NOTCH against:

* Readwise Reader
* NotebookLM
* Fabric
* Notion
* Obsidian
* Arc Max
* Perplexity Collections

For each competitor explain:

* Where NOTCH is weaker
* Where NOTCH is stronger
* Where NOTCH is wasting opportunities

---

# Product Positioning Audit

Based solely on the UI:

What would a new user assume NOTCH is?

Examples:

* Bookmark manager
* Read-it-later app
* Note taking app
* AI research assistant
* Knowledge graph system
* Document archive

Explain why.

---

# Discoverability Audit

What features are hidden?

What features would users never discover?

What features deserve first-class visibility?

---

# Navigation Audit

Critique:

* Sidebar
* Top bar
* Search
* Filtering
* Sorting
* Folder system

Propose alternatives.

---

# Research Workflow Audit

Imagine a user capturing:

* 100 articles
* 50 PDFs
* 20 research reports

Would the current library still work?

Identify scaling problems.

---

# Knowledge Graph Audit

Assume NOTCH eventually supports:

* Entities
* Concepts
* Relationships
* Citations
* Timelines

How should those appear in the library?

Design the experience.

---

# Emotional Design Audit

Describe:

* What emotions the UI currently creates
* What emotions it should create

Examples:

Current:
"Storage"

Desired:
"Discovery"

Current:
"Archive"

Desired:
"Knowledge Workspace"

---

# Brutal Honesty Section

If you had to convince me NOTCH will fail because of its current UX:

What arguments would you make?

List the top 20 reasons.

---

# Final Deliverables

Provide:

1. Top 50 UX issues ranked by severity.
2. Top 20 product opportunities.
3. Top 10 quick wins.
4. Top 10 redesign ideas.
5. Top 5 features that should be deleted.
6. Top 5 features that should be promoted.
7. A complete redesign direction.
8. ASCII wireframes.
9. Component hierarchy.
10. User journey improvements.

Do not be diplomatic.

Act like a senior product reviewer whose job is to find flaws before users do. 

---

## Assistant

Let me re-read the exact current state to ground every critique in specific code evidence.

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

---

# NOTCH Library — Red Team UX Review

**Reviewers:** Former Notion PD, Former Readwise PD, Former Arc PD, Staff UX Researcher, IA, KM Power User

---

## TABLE OF CONTENTS

1. Top 50 UX Issues (ranked by severity)
2. Card Audit
3. Knowledge Visibility Audit
4. Competitive Review
5. Product Positioning Audit
6. Discoverability Audit
7. Navigation Audit
8. Research Workflow Audit
9. Knowledge Graph Audit
10. Emotional Design Audit
11. Brutal Honesty: 20 Reasons NOTCH Will Fail
12. Top 20 Product Opportunities
13. Top 10 Quick Wins
14. Top 10 Redesign Ideas
15. Top 5 Features to Delete
16. Top 5 Features to Promote
17. Complete Redesign Direction
18. ASCII Wireframes
19. Component Hierarchy
20. User Journey Improvements

---

## 1. TOP 50 UX ISSUES (RANKED BY SEVERITY)

### CRITICAL (will cause abandonment)

**1. The library hides all extracted knowledge.**
`src/lib/content-engine/extraction/extractors.ts` extracts entities, concepts, timelines, relationships, topics, document type, complexity. `DocumentMeta` in `src/lib/types.ts:247` has NONE of these fields. The capture pipeline (`pipeline.ts`) computes `diagramCount`, `qualityScore`, `readingTimeMinutes` — the card renders exactly zero of them. This is the single biggest UX sin in the entire product. The system screams "I'm intelligent" at the engineering level and whispers "I'm a basic bookmark manager" at the UI level. Users will never know the AI did anything.

**2. All cards look identical regardless of content type.**
`DocumentCard` (lines 386–582) renders the same shape for a 50-page research paper, a 2-minute tutorial, and a news article. A `documentType` field exists in `KnowledgeExtraction` (`'tutorial' | 'reference' | 'news' | 'analysis' | 'documentation' | 'general'`) but the card code never reads it. Visual differentiation is zero. The user cannot prioritize or triage visually.

**3. No hierarchy of importance.**
A 10-word snippet from Readwise with qualityScore=95 and a 10,000-word technical paper with qualityScore=40 render the same card with the same prominence. The system knows quality scores (`qualityScore` computed in db.ts v4 upgrade) but chooses not to surface them. Users cannot tell which documents deserve attention.

**4. Search is embarrassing for a knowledge tool.**
`fuseOptions` (line 26–37) searches exactly 4 fields: title, tags, domain, summary. It does NOT search entities, concepts, timeline events, topics, relationships, document types, or any of the extracted knowledge the system already computed. Searching "Transformer" will find documents with "Transformer" in the title but will NOT find documents that contain the entity "Transformer" with 47 mentions. The user has to know to look for something to find it — knowledge discovery is dead.

**5. No visual preview of any kind.**
The system extracts diagrams (Mermaid, PlantUML), images, timelines, entity maps. The card shows a text snippet. A document with 3 diagrams, 12 images, and a timeline looks identical to a plain text document. The `previewType` field I proposed in the redesign doesn't exist yet. The system is wasting its richest assets.

**6. Sidebar is 75% empty space.**
Lines 252–383: 3 navigation items + folders + import button + legend. No knowledge section. No entities. No concepts. No timelines. No topics. No recent activity. The most valuable real estate in the application is a wasteland.

**7. No concept of "knowledge density."**
The library cannot answer: "Which of my documents has the most extracted knowledge?" The system computes `qualityScore`, `diagramCount`, entity counts, concept counts — but there's no composite metric, no sort-by-density, no visual indicator that one document is knowledge-rich and another is a simple capture. Users must open every document to assess its value.

**8. The "Detailed" view mode is a lie.**
ViewMode `'detailed'` (line 167–179) just adds a summary preview and slightly larger padding. It's not "detailed" by any stretch. A truly detailed card would show entity counts, concept previews, diagram thumbnails, timeline presence, document type badges, quality scores. Current detail is: title + domain + word count + date + summary. That's basic at best.

**9. No entity or concept browsing.**
The sidebar's `topItems` array (line 232–236) has "All documents", "Favorites", "Archive". No "Entities", "Concepts", "Timelines", "Topics". The extraction pipeline produces these structured knowledge objects — there is literally no UI to access them. The knowledge is trapped in documents.

**10. Pagination at 12 items per page creates infinite scrolling frustration.**
`PAGE_SIZE = 24` (line 24 — actually 12). At "comfortable" view mode (3 columns), the user sees 12 cards = 4 rows. 4 rows of nearly identical cards before clicking "Next." For a user with 200+ documents, discovering anything is tedious manual clicking through pages of homogenous cards.

### HIGH (significant friction)

**11. No keyboard-first search.**
The `/` shortcut to focus search (line 83–89) is good. But once focused, pressing Enter searches only titles. No ability to search entities, concepts, or filter by document type from the keyboard. Readwise and Arc Max let you type `e:Transformer` to search entities. NOTCH: type anything, get title matches only.

**12. Tags are underpowered.**
Tags exist on `DocumentMeta` (line 250) and render as colored badges (lines 536–561). But there's no tag management, no tag hierarchy, no auto-tagging visible in the UI (auto-tag.ts exists!), no tag clouds, no tag-based entity discovery. Tags are flat, manual, and buried.

**13. Folder creation UX is hostile.**
Lines 284–312: Hidden behind a `+` button, requires typing a name, selecting from 20 color swatches (FOLDER_COLORS), then clicking "Create." No templates, no drag-to-create, no AI-suggested folders. For a knowledge tool in 2026, this is archaic.

**14. Color Legend is useless.**
Lines 584–643: A "Legend" section that shows colored folders and tag colors — visible only in the sidebar, taking up space, showing information the user already knows (they chose the colors). Worse, uncolored tags appear with a color picker inline — creating a secondary UI for tag color assignment that competes with the primary color picker in folder creation.

**15. No sticky entity pills.**
When I hover/tap an entity pill on a card, nothing happens — there's no entity detail panel, no entity search, no visualization of entity-document connections. The entity is a dead link.

**16. Star/Archive/Delete are the only actions.**
The card action bar (lines 486–490 compact, 563–579 detailed) offers star, archive, move-to-folder, delete. No "Quick Look," no "Share," no "Tag," no "Add to Research Space," no "Find Similar," no "Generate Summary." A read-later app has more actions than this knowledge platform.

**17. No reading progress.**
`isRead: boolean` exists on `DocumentMeta` (line 250) but is never set, never displayed, never used for filtering. Users cannot tell which documents they've read. In a knowledge management system, knowing what you've consumed is table stakes.

**18. Empty states reveal no intelligence.**
Lines 723–768: The empty state for "no documents" says "Open any web page, open the Notch extension, and click 'Capture this page' to save your first document." No onboarding journey, no sample data, no "Capture a demo page to see what NOTCH can do." The user installs and sees a blank slate with instructions. First-run retention will be low.

**19. No smart defaults.**
When a user captures their first document, they see a card with title, domain, word count, date, and maybe a summary. They have no idea that NOTCH extracted entities, concepts, and a timeline — because none of that is visible. The system should show a "knowledge breakdown" callout on the first card: "NOTCH identified 12 entities, 5 concepts, and a timeline in this document. Click to explore."

**20. The "Comfortable" view mode is neither comfortable nor compact.**
Three view modes (compact/comfortable/detailed) create three nearly identical card appearances. Compact is a horizontal row. Comfortable is a vertical card with less info than detailed. The differences are padding and summary visibility. Users will switch once, see no meaningful difference, and forget it exists.

**21. No batch operations.**
Lines 861–871: `handleStar`, `handleArchive`, `handleDelete` all operate on single documents. There is no select-all, no multi-select with shift-click, no batch star/archive/delete/move. Managing 100+ documents requires repetitive individual actions.

**22. Settings are buried.**
Line 182–188: Settings is a small text button in the header. For a tool that requires API key configuration (line 751 "No API key set" empty state), settings should be first-class. The empty state sends users to settings, but the navigation makes it invisible.

**23. No command palette.**
Line 83–91: Only `/` to focus search. No `⌘K` / `Ctrl+K` command palette. Superhuman, Linear, Arc, Notion, VS Code, Obsidian, Readwise — all have command palettes. NOTCH doesn't. Power users will feel crippled.

**24. Import PDF is buried at the bottom of the sidebar.**
Lines 360–374: "Import PDF" is a dashed border button at the bottom of the sidebar, below folders and color legend. It's visually noisy (dashed border) but positionally invisible (bottom of a scrollable section). This should be a top-level action.

**25. Export folder uses a toast-based error message.**
Lines 909–935: `addToast('Export not yet available', 'info')`. If the zip-export module failed to load (async import at line 20–22), the user gets a toast that says "Export not yet available" — which sounds like a feature limitation, not a loading failure. This is misleading.

### MEDIUM (accumulates into poor experience)

**26. No document type indicators.**
Lines 518–528: Card metadata shows domain, word count, date, folder. No document type badge. A 10-page tutorial and a 3-paragraph news article look identical until the user reads the content. The system already classifies documents via `detectDocumentType()` in `extractors.ts`.

**27. No entity count on cards.**
The `entities` field exists on `Document` (types.ts:53) and `ExtractedEntity[]` is returned by `extractKnowledge()`. The card has zero entity indicators. A research paper with 30+ entities gets the same visual weight as a simple bookmark with none.

**28. No concept count on cards.**
Same as entity count. `concepts` field exists. `extractConcepts()` runs. Zero UI visibility.

**29. No timeline indicator.**
`extractTimeline()` runs on every document. Documents with (say) 12 timeline events should show a "↻ 12 events" badge. The card shows nothing.

**30. No diagram count on cards.**
`diagramCount` is stored on the Document type. The library card ignores it. A paper with architecture diagrams and a pure-text article look identical.

**31. No relationship indicators.**
`relationships` field exists. `extractRelationships()` runs. A document with 8 entity relationships should hint at this richness. Nothing.

**32. Horizonatal scroll in the sidebar header.**
Line 253: `w-56` fixed width sidebar with `overflow-y-auto`. With 3 top items + folders + color legend + import button + storage bar (when added), the sidebar scrolls. The entire library navigation scrolls. The most important navigation tool requires scrolling to see all options.

**33. Folder management has no drag-reorder.**
Users can create folders (line 874–878) and delete them (879–884), but cannot reorder them. The order is creation order. With 8+ folders, important ones get buried.

**34. Three sorts are insufficient.**
`type SortOrder = 'newest' | 'oldest' | 'title-az'` (line 40). No sort by: quality score, entity count, concept count, knowledge density, reading time, document type, complexity. For a knowledge tool, sorting by "most knowledge-rich" should be the default.

**35. Active tag filter has no visual indicator on the card.**
Line 989: `tagFiltered = activeTag ? sorted.filter(m => m.tags.includes(activeTag)) : sorted`. The filtered cards show no highlighted tag match. The user sees cards but doesn't know why they matched unless they notice the filter badge above the grid (lines 1093–1101).

**36. Keyboard navigation has no visual selection state.**
Lines 992–1035: `selectedIndex` drives keyboard nav (j/k, Enter, s, a, d) but there's no visible highlight on the selected card. The user can't tell which card is focused. Keyboard navigation is effectively invisible.

**37. No undo for destructive actions.**
Line 1026: `confirm()`. Delete uses a browser-native confirm dialog. Archiving and starring have no undo. For a knowledge management tool where accidental actions lose curated data, this is insufficient.

**38. Storage warning is intrusive and unhelpful.**
Lines 645–655: `StorageQuotaWarning` shows as a red-tinted banner between the header and the document grid. It blocks content, provides no actionable path (no "Archive old documents" button, no "Export and free up space"), and dismisses permanently (line 1108: `onDismiss` just hides it).

**39. No document count per folder in sidebar.**
Folder items (lines 314–357) show only the folder name. No count of documents inside. The user must click each folder to see if it's populated. This is basic information architecture.

**40. Tag colors are assigned manually per tag.**
Lines 207, 376–381: `tagColors` and `ColorLegend` require the user to manually assign colors to each tag. No auto-color from tag name, no palette generation. For 50+ unique tags, this becomes unmanageable.

**41. No visual relationship between folder colors and card colors.**
Line 339: Folder colored dot in sidebar. Line 468–472: Folder colored dot on card. Line 526: Folder colored dot on detailed card. Three different rendering approaches for the same concept. The dot is 2px, 6px, and 6px respectively across these instances. No visual consistency.

**42. "Learn More" links to a potentially dead URL.**
Line 766: `browser.tabs.create({ url: 'https://notch.ai' })`. If that domain isn't active, the empty state sends users to a dead end. The "Learn More" CTA becomes a frustration point.

**43. Import status has no progress.**
Lines 939–969: `handleFileChange` sets `importStatus` to `'importing'` but there's no progress bar, no step indicator, no ETA. The import button just shows "Importing..." for 2.5 seconds (line 960). Large PDFs will appear frozen.

**44. No error recovery for failed imports.**
Line 964: `setTimeout(() => setImportStatus('idle'), 3000)`. After a failed import, the button shows "Failed — retry" for 3 seconds, then silently resets to "Import PDF." The error message is lost (only `console.error` at line 965). The user gets no explanation of why it failed.

**45. All documents are loaded at once.**
Lines 826–836: First 20 metas load, then the rest load in the background via `getDocumentMetas(index.slice(20))`. With 500+ documents, this means loading 500 items from IndexedDB into memory, all at once. No virtualization, no windowed rendering.

**46. No loading skeleton matches card content.**
Lines 734–738: `<Skeleton>` components are uniform rectangles. They don't approximate the card shape — no title area, no content area, no tag area. The skeleton is a placeholder shape that doesn't communicate what the user is waiting for.

**47. The "Notch" logo in the sidebar is just text.**
Line 255: `<span>Notch</span>`. No icon, no logo, no visual identity. In a premium knowledge tool, the brand mark is the most visible surface-level differentiator.

**48. Folder delete has no confirmation.**
Line 350: `onClick={() => onFolderDelete(folder.id)}`. No confirmation dialog. No "This will remove the folder label from all documents in it" warning. Accidental clicks destroy organization.

**49. View mode preference is persisted but unused.**
Line 1079: `saveViewMode(v)`. The view mode is saved to `browser.storage.local`. But the reader page doesn't read it. Reader always opens in default view. The preference doesn't flow across the experience.

**50. The entire library is one file.**
All 1141 lines in `src/entrypoints/newtab/App.tsx`. Sidebar, header, search, card, grid, pagination, keyboard nav, empty states, data fetching, state management — all in one monolithic component. This is technical debt that makes every change expensive and risky.

---

## 2. CARD AUDIT

### Current card information (lines 386–582):

| Field | Present | Value |
|---|---|---|
| Title | ✅ | Generic text |
| Domain | ✅ | URL domain |
| Word Count | ✅ | Raw number |
| Date | ✅ | ISO date string |
| Summary | ✅ (detailed mode only) | Text snippet |
| Star | ✅ | Toggle |
| Tags | ✅ | Colored badges |
| Folder | ✅ | Colored dot |
| Archive/Delete/Move | ✅ | Action buttons |

### What is MISSING that the system ALREADY has:

| Field | Exists in backend | Rendered on card |
|---|---|---|
| Entity count | `Document.entities[]` | ❌ |
| Concept count | `Document.concepts[]` | ❌ |
| Timeline count | `Document.timeline[]` | ❌ |
| Diagram count | `Document.diagramCount` | ❌ |
| Image count | `Document.imageCount` | ❌ |
| Quality score | `Document.qualityScore` | ❌ |
| Complexity | `Document.complexity` | ❌ |
| Document type | `KnowledgeExtraction.documentType` | ❌ |
| Topics | `Document.topics[]` | ❌ |
| Reading time | `Document.readingTimeMinutes` | ❌ |
| Entity names | `Document.entities[].name` | ❌ |
| Concept definitions | `Document.concepts[].definition` | ❌ |
| Timeline events | `Document.timeline[].description` | ❌ |
| Relationships | `Document.relationships[]` | ❌ |
| Preview | Any diagram/image | ❌ |

### What should be REMOVED:
- **Word count** as a raw number. It means nothing to a knowledge worker. Replace with reading time.
- **ISO date string** — `2024-03-15T12:00:00.000Z` is machine-readable but human-hostile. Show "2 days ago" or "Mar 15."
- **Summary (current implementation)** — a borderline useless 3-line clip that repeats the title. A summary is useful, but it should be an AI-generated structured abstract, not a raw text snippet.

### What should be SURFACED (in priority order):
1. **Document type badge** — colored pill (Tutorial/Research/News/Analysis/Reference)
2. **Knowledge density** — visual bar + score
3. **Entity + concept count** — icon + number
4. **Diagram count** — preview thumbnail if exists
5. **Reading time** — humanized: "12 min read"
6. **Top entities** — as colored pills (first 3)
7. **Timeline indicator** — "↻ 6 events" if timeline exists

### Redesigned card:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🧬 Research Paper  │  ★                                        │
│─────────────────────────────────────────────────────────────────────│
│ Attention Is All You Need                                         │
│ arxiv.org · Vaswani et al. · 12 min read · 2 days ago             │
│─────────────────────────────────────────────────────────────────────│
│ ┌─ Architecture Diagram ──────────────────┐                        │
│ │  [Mermaid/PlantUML thumbnail]           │                        │
│ │  ┌──────┐    ┌──────┐    ┌──────┐      │                        │
│ │  │Input │───→│Enc.  │───→│Dec.  │───→Out│                        │
│ │  └──────┘    └──────┘    └──────┘      │                        │
│ └─────────────────────────────────────────┘                        │
│─────────────────────────────────────────────────────────────────────│
│ ◆ Transformer (47)  ◆ Self-Attention (23)  ◆ BERT (12)           │
│ 🧠 Self-Attention  🧠 Multi-Head Attention  🧠 Positional Encoding│
│ 📊 3 diagrams  📷 4 images  ↻ 6 timeline events                   │
│─────────────────────────────────────────────────────────────────────│
│ Knowledge Density  ██████████░░░░  82/100  ·  Quality ████████ 95  │
│ #deep-learning #nlp #transformer #attention                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. KNOWLEDGE VISIBILITY AUDIT

### The Knowledge Gap: What's extracted vs. what's visible

| Knowledge Type | Extractor function | Exists in DB | Visible in Library |
|---|---|---|---|
| Entities | `extractEntities()` | `Document.entities[]` | **ZERO** |
| Concepts | `extractConcepts()` | `Document.concepts[]` | **ZERO** |
| Timelines | `extractTimeline()` | `Document.timeline[]` | **ZERO** |
| Relationships | `extractRelationships()` | `Document.relationships[]` | **ZERO** |
| Topics | `extractTopics()` | `Document.topics[]` | **ZERO** |
| Document Type | `detectDocumentType()` | `KnowledgeExtraction.documentType` | **ZERO** |
| Complexity | `estimateComplexity()` | `KnowledgeExtraction.complexity` | **ZERO** |
| Quality Score | Computed in db.ts v4 | `Document.qualityScore` | **ZERO** |
| Diagram Count | Computed in db.ts v4 | `Document.diagramCount` | **ZERO** |
| Image Count | Computed in db.ts v4 | `Document.imageCount` | **ZERO** |

### Verdict:

A new user who captures their first article and sees the library will believe NOTCH is a **dumb bookmark manager with AI summaries**. They will not know it extracts entities, concepts, timelines, relationships, or any structured knowledge — because none of that is visible anywhere in the library UI. They will only discover it if they:

1. Open the reader page
2. Navigate to a specific tab/panel
3. Know to look for it

The knowledge extraction is NOTCH's core differentiator. It is also NOTCH's most hidden feature. This is a catastrophic product failure.

**The user's mental model on first use:**

```
"I capture a webpage → I see a card with title, domain, word count, date, summary"
→ "This is a basic read-later app"
→ "Why would I use this over Pocket/Raindrop/Readwise?"
```

**NOTCH's lost narrative:**

```
"I capture a webpage → NOTCH extracts 12 entities, 5 concepts, a timeline, 
  and generates 3 diagrams automatically"
→ "This is an intelligent knowledge system"
→ "This is something no other tool does"
```

The gap between the engineering reality and the UX reality is the single biggest existential threat to NOTCH's product positioning.

---

## 4. COMPETITIVE REVIEW

### vs. Readwise Reader

| Dimension | Readwise | NOTCH | Verdict |
|---|---|---|---|
| Card density | High — compact rows, rich metadata | Medium — large cards, wasted space | Readwise wins |
| Knowledge extraction | Ghostread highlights, no entities | Full entity/concept/relationship extraction | NOTCH wins (hidden) |
| Keyboard navigation | Excellent — j/k, vim bindings, search-as-you-type | Basic — j/k, Enter, s, a, d | Readwise wins |
| Social proof | Reading lists, highlights from others | None | Readwise wins |
| Reader experience | Excellent typography, margins, focus mode | Strong — Notion prose style | Comparable |
| Export | Kindle, Notion, PDF, CSV | Markdown, PDF, ZIP | Comparable |
| **NOTCH opportunity** | Surfacing extracted entities inline in cards. Readwise does not do this. | | |

**Where NOTCH is weaker:** Density, keyboard UX, social features, onboarding, email capture
**Where NOTCH is stronger:** Entity extraction, concept extraction, diagram generation, relationship mapping
**Where NOTCH is wasting:** All of the above strengths are invisible

### vs. NotebookLM

| Dimension | NotebookLM | NOTCH | Verdict |
|---|---|---|---|
| Audio overviews | ✅ Groundbreaking feature | ❌ | NotebookLM wins |
| Source grounding | Excellent — shows exact citations | Has citations in RAG | Comparable |
| Notebook structure | Source grouping + notes | Documents only | NotebookLM wins |
| Knowledge extraction | Entity/concept extraction (limited) | Robust, typed, offline | NOTCH wins |
| Offline capability | ❌ | ✅ (deterministic NLP) | NOTCH wins |
| **NOTCH opportunity** | Audio overviews would be huge. Source-to-source relationship mapping is unique. | | |

**Where NOTCH is weaker:** Audio, notebook structure, Google-level polish
**Where NOTCH is stronger:** Offline extraction, diagram generation, browser extension capture
**Where NOTCH is wasting:** Extraction superiority means nothing when invisible

### vs. Fabric

| Dimension | Fabric | NOTCH | Verdict |
|---|---|---|---|
| Pattern-based extraction | ✅ Powerful custom patterns | ❌ Fixed pipeline | Different approach |
| CLI-first | ✅ | ❌ (extension) | Different audience |
| Visual UI | ❌ (CLI only) | ✅ | NOTCH wins |
| Multi-modal | ✅ Images, audio, video | Webpages, PDFs | Fabric wins |
| **NOTCH opportunity** | Pattern-like custom extractors. Fabric is popular with developers — NOTCH could offer similar power with a GUI. | | |

**Where NOTCH is weaker:** No custom extraction patterns, no CLI, no multi-modal
**Where NOTCH is stronger:** Visual interface, diagram generation, structured rendering
**Where NOTCH is wasting:** Not targeting the Fabric audience (power users who want extraction)

### vs. Obsidian

| Dimension | Obsidian | NOTCH | Verdict |
|---|---|---|---|
| Graph view | ✅ Excellent | ❌ | Obsidian wins |
| Plugin ecosystem | ✅ Massive | ❌ | Obsidian wins |
| Local-first | ✅ | ✅ | Comparable |
| Knowledge extraction | ❌ (manual) | ✅ (automatic) | NOTCH wins |
| Vault structure | ✅ Powerful | ❌ Flat storage | Obsidian wins |
| **NOTCH opportunity** | Obsidian's graph view is the gold standard. NOTCH has automatic relationship extraction — if surfaced as a graph, it would be MORE useful than Obsidian's manual graph. | | |

**Where NOTCH is weaker:** Graph view, plugins, vault organization, markdown editing
**Where NOTCH is stronger:** Automatic knowledge extraction, capture pipeline, diagram generation
**Where NOTCH is wasting:** Has relationship data that could power a superior graph view

### vs. Notion

| Dimension | Notion | NOTCH | Verdict |
|---|---|---|---|
| Database views | ✅ Table, board, timeline, calendar, gallery | ❌ Grid only | Notion wins |
| Templates | ✅ Excellent | ❌ | Notion wins |
| Collaboration | ✅ | ❌ (single user) | Notion wins |
| Web clipper | ✅ (limited) | ✅ (full capture + extraction) | NOTCH wins |
| AI features | ✅ (chat, summarize, Q&A) | ✅ (RAG, chat, extraction) | Comparable |
| **NOTCH opportunity** | Notion's database views (timeline, gallery, board) would transform NOTCH. NOTCH has richer per-document data than Notions' properties. | | |

**Where NOTCH is weaker:** Views, templates, collaboration, ecosystem
**Where NOTCH is stronger:** Web capture depth, offline extraction, diagram generation
**Where NOTCH is wasting:** Per-document knowledge data isn't exposed as "properties" for filtering/sorting/views

### vs. Arc Max

| Dimension | Arc Max | NOTCH | Verdict |
|---|---|---|---|
| Split view | ✅ | ❌ | Arc wins |
| Command palette | ✅ Excellent | ❌ | Arc wins |
| AI in browser | ✅ Ask on page, 5-second preview | ❌ (separate page) | Different approach |
| Knowledge base | ❌ (per-session) | ✅ (persistent) | NOTCH wins |
| **NOTCH opportunity** | Arc's 5-second preview and command palette UX are beautiful. NOTCH should study Arc's keyboard-first, minimal-chrome approach. | | |

**Where NOTCH is weaker:** Browser integration polish, command palette, split views
**Where NOTCH is stronger:** Persistent knowledge base, offline extraction, structured capture
**Where NOTCH is wasting:** Not borrowing Arc's interaction design patterns

### vs. Perplexity Collections

| Dimension | Perplexity | NOTCH | Verdict |
|---|---|---|---|
| Conversational search | ✅ Excellent | ✅ (RAG) | Comparable |
| Source management | ✅ Collections with auto-sources | ❌ Manual | Perplexity wins |
| Entity extraction | ✅ Automatic | ✅ Better | NOTCH wins |
| Timeline extraction | ❌ | ✅ | NOTCH wins |
| **NOTCH opportunity** | Perplexity Collections auto-adds sources. NOTCH should auto-extract topics and suggest collection membership. | | |

**Where NOTCH is weaker:** Source auto-collection, search quality
**Where NOTCH is stronger:** Offline, depth of extraction, diagrams
**Where NOTCH is wasting:** Auto-topic extraction exists but isn't used for auto-collection

---

## 5. PRODUCT POSITIONING AUDIT

### Based solely on the UI, a new user assumes NOTCH is:

```
A basic bookmark manager / read-it-later app
```

**Evidence:**
- Sidebar says "All documents," "Favorites," "Archive" — exactly what Pocket and Raindrop call their sections
- Cards show title, domain, word count, date, summary — exactly what a bookmark manager shows
- No mention of "knowledge," "entities," "concepts," "graphs," "intelligence" in the primary navigation
- The word "AI" or "knowledge" or "intelligence" appears nowhere in the library UI
- The library header (line 133) literally says "Library" — the most generic possible name

**What NOTCH should communicate immediately:**
- "Your personal knowledge base" (not "Library")
- "Intelligent document platform" (not "bookmark manager")
- Documents are "Knowledge Objects" with visible intelligence indicators

**The delta between perception and reality:**

| User perception | Actual capability |
|---|---|
| "It saves webpages" | Extracts entities, concepts, timelines, relationships |
| "It summarizes text" | Generates diagrams, knowledge graphs, structured markdown |
| "It has folders" | Has offline NLP, RAG querying, cross-document entity linking |
| "It's a basic extension" | Has a full content intelligence engine with v2 depth modes |

---

## 6. DISCOVERABILITY AUDIT

### Hidden features (would never discover without being told):

| Feature | Where it's hidden | Discoverability score |
|---|---|---|
| Entity extraction | Only visible in reader, if user navigates to correct tab | 1/10 |
| Concept extraction | Only visible in reader, if user navigates to correct tab | 1/10 |
| Timeline extraction | Only visible in reader, if user knows to look | 1/10 |
| Relationship extraction | Only visible in structured reader content | 1/10 |
| Knowledge Graph | Doesn't exist yet in library | 0/10 |
| Diagram generation | Only visible in reader if document has diagrams | 2/10 |
| RAG/Chat query | Accessible from reader side panel | 3/10 |
| Offline extraction | Invisible — user can't tell if processing was online or offline | 0/10 |
| Depth modes (FAST/BALANCED/DEEP) | In capture popup, mode selector | 3/10 |
| Auto-tagging | Runs silently, tags appear as regular tags | 4/10 |
| Keyboard shortcuts (j/k) | Undocumented, no visual hints | 1/10 |
| Search `/` shortcut | Placeholder text mentions it | 6/10 |
| Drag-to-folder | No tutorial, no affordance | 2/10 |
| Folder export | Hidden behind hover icon on folder | 1/10 |
| Storage quota warning | Background message, shows as dismissable banner | 3/10 |

### Features that deserve first-class visibility:

1. **Entity extraction** — should be visible on every card (count + top 3)
2. **Concept extraction** — should be visible on card hover or in card expansion
3. **Timeline extraction** — should be visible as an icon/badge
4. **Knowledge density** — should be the primary sort/filter metric
5. **Diagram count** — should show a preview thumbnail
6. **RAG/Ask** — should have a library-level query bar (not just reader)
7. **Depth mode** — should show which mode was used for each document
8. **Auto-tags** — should be distinguished from manual tags visually

---

## 7. NAVIGATION AUDIT

### Sidebar (lines 252–383):

```
Current:                     What it communicates:

NOTCH                        "This is an app name"
───                          ───
📄 All documents             "I have a flat list of files"
★ Favorites                  "I have a star system"
📦 Archive                   "I have a trash system"
───                          ───
FOLDERS                     "I have a folder system"
  + Create folder
  └─ Folder 1                "You organize everything manually"
  └─ Folder 2
```

**Problems:**
- Three navigation items is embarrassingly thin for a "knowledge platform"
- No "knowledge" section at all — the entire premise of the product is absent from navigation
- Folders are a 1990s paradigm for organization. Topics, entities, concepts are 2020s paradigms
- The word "intelligence," "knowledge," "discover," "explore" appears zero times
- Import PDF is a visual distraction in the sidebar, not a navigation item

**What a knowledge navigation should communicate:**

```
NOTCH (intelligent knowledge base)
───
🧭 Home / Feed              "Smart, curated, alive"
★ Favorites                 "Curation"
📦 Archive                  "Deprioritized"
───
🧠 KNOWLEDGE                "The core value proposition"
  📊 Topics (6)             "What themes exist across my captures"
  ◆ Entities (47)           "What things have been extracted"
  ⬡ Concepts (23)           "What definitions were found"
  ↻ Timelines (5)            "What chronological narratives exist"
  ⊞ Knowledge Graph         "How everything connects"
───
📂 COLLECTIONS              "User-defined organization (replaces folders)"
  └─ Papers (14)
  └─ Tutorials (8)
───
📋 RESEARCH SPACES          "Active working sessions"
  └─ LLM Security (3)
───
⚡ Recent Activity          "Feels alive"
  Captured 2m ago
  Read 15m ago
───
📦 Storage ██████░░ 72%    "Health awareness"
```

### Top Bar (lines 103–192):

```
Current:                     Problems:
Library [count]             
Search [________]           Too narrow (w-56, line 98)
[All Folders ▼]             Folder filter only — no type filter
[Newest|Oldest|A-Z]         Three basic sorts
[Compact|Comfort|Detailed]  Three nearly identical views
[Settings]                  Buried
```

**Problems:**
- Folder filter only filters by folder. No filter by document type, entity count, quality score, date range
- Sort is limited to date and title. No sort by knowledge density, entity count, quality score
- View mode selection is three buttons for three similar modes
- Search is a single input that only searches 4 fields
- No filter bar, no facet sidebar, no saved searches
- No "Add" button — capture happens from the extension popup, not the library

**What a knowledge top bar should look like:**

```
[← NOTCH]  Home  Topics  Entities  Concepts  Timelines  Graph  Spaces  ⋮
───
🔍 Search knowledge (entities, concepts, documents, topics...)  [⌘K]
───
[All Types ▼] [Sort: Density ▼] [Date Range ▼] [Entity Count ≥ ▼] [Topics ▼]
┌─[Grid]──[Compact]──[Timeline]──[Graph]─┐  [+ Capture] [+ Import]
```

---

## 8. RESEARCH WORKFLOW AUDIT

### Scenario: 100 articles + 50 PDFs + 20 research reports

**Phase 1: Onboarding (0–10 documents)**

The library works passably. The user reads summaries, opens interesting documents, stars a few. They might create 2–3 folders. They have no idea entities and concepts are being extracted.

**Phase 2: Growing (10–50 documents)**

Problems begin:
- Cards all look the same — can't distinguish papers from tutorials at a glance
- The user must remember which document contains which information — there's no entity browser
- Search becomes the primary navigation — but search only finds titles, not content
- The user can't filter by "research papers" because document type isn't surfaced
- The user can't find "all documents mentioning BERT" because entity search doesn't exist
- Tags proliferate (20+ unique tags) and become unmanageable

**Phase 3: Mature (50–170 documents)**

Critical failures:
- The user abandons folders because creating/assigning them is slow
- The grid shows 12 cards per page — 170 documents = 15 pages of similar-looking cards
- The user has no idea which documents are most valuable (no density/quality indicators)
- The user captures duplicate topics because there's no "before capturing, check entities" workflow
- The user cannot answer: "What do I know about this topic?" — the fundamental question a knowledge base should answer
- The user reverts to using a separate tool (Obsidian, Notion) for synthesis and NOTCH becomes a dead archive

**The scaling wall:**

The library doesn't have a "scaling wall" — it's not that performance degrades. It's that the value proposition collapses. The library is designed for browsing. With 170+ documents, browsing is impossible. The user needs querying, filtering, entity navigation, concept mapping, timeline synthesis. None of those exist.

---

## 9. KNOWLEDGE GRAPH AUDIT

### Current state:

Zero knowledge graph UI exists in the library. The `Document.relationships[]` field stores `{ source, target, relation }` triples. `extractRelationships()` (in `extractors.ts`) generates these deterministically. The data is there. The graph is invisible.

### Expected by 2026 knowledge tool users:

```
- Entity browser: Show all unique entities across the library, organized by type
- Entity detail: Click an entity → show all documents mentioning it + related entities
- Concept map: Show how concepts connect across documents
- Global timeline: Merge all timeline events → show as temporal narrative
- Cross-document graph: Visualize entity/relationship connections
```

### What NOTCH should build:

**Tier 1 (Phase 1): Entity Index**
- Sidebar: "◆ Entities (47)" → click → sorted list of all entities across library
- Click entity → see all documents with that entity + definition + related entities
- No graph visualization, just structured listings

**Tier 2 (Phase 2): Cross-Document Relationships**
- When viewing entity detail, show: "Entity X is connected to Y (via 'depends-on') in 3 documents"
- Render simple relationship lists before attempting visual graphs

**Tier 3 (Phase 3): Visual Graph**
- D3.js force-directed graph with entities as nodes (sized by mention count) and relationships as edges (colored by relation type)
- Filter by entity type, document, topic
- Click node → highlight connected nodes + show document list
- Animated transitions, zoom, pan

---

## 10. EMOTIONAL DESIGN AUDIT

### Current emotions:

| Element | Emotional response |
|---|---|
| Sidebar with 3 items | "This app is empty / unfinished" |
| Homogenous cards | "Everything looks the same — I can't find anything" |
| No entity/concept visibility | "What did the AI actually do? Nothing?" |
| Generic "Library" header | "This is a storage bucket, not a workspace" |
| Skeleton loaders (uniform rectangles) | "Amateur — doesn't know its own content shape" |
| Browser-native `confirm()` dialog | "Cheap — this was written in a weekend" |
| Dashed-border import button | "Beta quality — not confident enough to use solid borders" |
| Color legend at sidebar bottom | "I don't know what to do with this space" |
| Pagination (1/12) | "I have to click through 12 pages to see everything?" |
| No keyboard shortcuts visible | "This app doesn't respect power users" |

### Desired emotions:

| Element | Desired emotional response |
|---|---|
| Knowledge sidebar sections | "This app is intelligent — it understands my content" |
| Entity-rich cards | "Every document has hidden value — I want to explore" |
| Knowledge density bars | "I can prioritize my attention by value" |
| Dynamic "Home" feed | "My knowledge base is alive and growing" |
| Card-specific skeletons | "Even the loading state respects my content" |
| Command palette | "This app was built for how I work" |
| Graph view | "I can see my knowledge grow as a connected web" |

### The emotional arc the current UX creates:

```
Curiosity (installed) → Confusion (empty state) → Mild interest (captured first doc)
→ Disappointment (card looks like every bookmark manager) 
→ Frustration (can't find anything after 20+ docs) 
→ Abandonment (returns to Obsidian/Notion/Readwise)
```

### The emotional arc the UX should create:

```
Curiosity (installed) → Delight (onboarding shows knowledge extraction demo)
→ Excitement (first capture reveals entities, concepts, timeline)
→ Engagement (knowledge-dense cards invite exploration)
→ Loyalty (entity browser, timeline view, graph — irreplaceable)
→ Advocacy ("NOTCH understands my research better than I do")
```

---

## 11. BRUTAL HONESTY — 20 REASONS NOTCH WILL FAIL

1. **Your extraction engine is world-class. Your UI hides it completely.** No user will ever know about entities, concepts, timelines, or relationships because none of them appear in the library. You built a Ferrari and painted it to look like a Toyota Corolla.

2. **Your cards are indistinguishable.** A research paper with 47 entities, 8 concepts, and 3 diagrams looks the same as a 2-paragraph news article. Users cannot triage, prioritize, or discover valuable content at a glance.

3. **Your search is broken for a knowledge tool.** You search 4 fields. You should search 12+. Users searching for "Transformer" won't find documents that discuss Transformer architecture unless the title contains "Transformer."

4. **Your sidebar is an embarrassment.** Three navigation items for an app that claims to be a "knowledge platform." Notion has 12+ nav items in its sidebar. Obsidian has 20+ via plugins. You have 3.

5. **Your view modes are a lie.** "Detailed" mode shows a summary. That's not detailed. A detailed view mode should show entities, concepts, diagrams, timeline presence, and knowledge density.

6. **You have no entity browser.** Your extraction pipeline produces `ExtractedEntity[]` with types, descriptions, and mention counts. There is zero UI to browse, search, or explore entities. The data is trapped.

7. **You have no concept index.** `ExtractedConcept[]` with `concept` and `definition` — essentially a personal glossary. No UI. No way to discover what your system "knows."

8. **You have no timeline synthesis.** `ExtractedTimelineEvent[]` with dates and significance. A researcher needs "what happened in 2023 across my documents?" — your system has the data and zero UI.

9. **You have no knowledge graph.** The relationship extraction produces `(source, target, relation)` triples. Every competing knowledge tool has a graph view. You have nothing.

10. **Your folder system is from 1995.** Folders without auto-topic grouping, without entity-based suggestions, without smart collections. Users must manually create and curate everything.

11. **Your discoverability is fatal.** The `/` shortcut for search and `j/k` keyboard navigation are undocumented. Entity/concept extraction is invisible. Depth modes are in the capture popup. Users will never know 80% of your features exist.

12. **Your empty states have no intelligence.** The "no documents" state shows generic instructions. No demo data, no sample capture, no "see what NOTCH can do" callout. Users install, see blank, leave.

13. **You compete with Readwise on its turf and lose.** Readwise has better density, better keyboard nav, better onboarding, social proof, email capture, and a polished reader. Your only differentiator (extraction) is invisible.

14. **Your pagination is hostile.** 12 cards per page. 4 rows. For 200 documents = 17 pages. No infinite scroll, no virtualization, no density control that actually changes density meaningfully.

15. **Your batch operations don't exist.** Single-select only. Need to archive 50 documents? Click each one, click archive, confirm. 150 clicks. No shift-click, no select-all, no batch commands.

16. **Your keyboard navigation has no visible selection state.** `selectedIndex` drives it — but there's no visual highlight on the selected card. The user presses `j` and nothing visibly changes. They assume the shortcut is broken.

17. **Your quality score is invisible.** You compute `qualityScore` in db.ts v4. It's stored. It's never displayed. A document with qualityScore=95 and one with qualityScore=30 look identical. Users can't distinguish signal from noise.

18. **Your "detailed" card shows no detail.** I keep coming back to this because it's the most visible symptom of the gap between your engineering ambition and your UX execution. Your cards are not knowledge cards. They are file cards.

19. **Your competitive differentiators are literally invisible.** Entities, concepts, timelines, relationships, diagrams, offline NLP, RAG — these are features that no other tool combines. Not one of them is visible in the library.

20. **Your product tells users you're a bookmark manager.** The UI screams "bookmark manager." Your technology whispers "knowledge platform." The user believes the UI. They'll categorize you as "Pocket clone" and never discover the truth.

---

## 12. TOP 20 PRODUCT OPPORTUNITIES

| # | Opportunity | Impact | Effort |
|---|---|---|---|
| 1 | Surface entity count + top 3 entities on every card | Transformative | Low |
| 2 | Add document type badge (tutorial/research/news/etc.) | High | Low |
| 3 | Add knowledge density score sort + visual indicator | High | Low |
| 4 | Create entity browser in sidebar + entity detail panel | Transformative | Medium |
| 5 | Create concept index view | High | Medium |
| 6 | Create timeline view (global + per-document) | High | Medium |
| 7 | Redesign search to search entities, concepts, timelines, topics | Transformative | Medium |
| 8 | Add command palette (⌘K) | High | Medium |
| 9 | Add diagram thumbnail preview on cards | High | Medium |
| 10 | Redesign view modes: Grid (2-col), Compact (list), Bento (mixed), Timeline, Graph | High | High |
| 11 | Add batch selection (shift-click, select-all) | High | Low |
| 12 | Add infinite scroll + virtualization | Medium | Medium |
| 13 | Annotate which tags are auto-tagged vs. manual | Medium | Low |
| 14 | Show reading progress (read/unread + % complete) | High | Low |
| 15 | Add "Home" feed with Smart Showcase (high-value, recently added, trending entities) | High | Medium |
| 16 | Add research spaces (pinned docs + notes + entity focus) | High | High |
| 17 | Add cross-document entity linking (click entity → see all docs) | Transformative | Medium |
| 18 | Add knowledge graph view (D3.js) | High | High |
| 19 | Add capture-to-library flow with entity preview (see entities before saving) | Medium | Medium |
| 20 | Add AI-powered "Explore Connections" (find related documents across entity overlap) | High | Medium |

---

## 13. TOP 10 QUICK WINS (implement in days, not weeks)

### QW1: Show entity count + top 3 entities on cards
**File:** `src/entrypoints/newtab/App.tsx`, DocumentCard component (line 386)
**Change:** Add a `meta.entities` badge row between tags and actions. Use existing Badge component.
**Impact:** Users immediately see knowledge richness.

### QW2: Show document type badge
**File:** `src/lib/types.ts` (DocumentMeta) + `src/lib/storage.ts` (deriveDocumentMeta) + App.tsx
**Change:** Add `documentType` to DocumentMeta. Show as colored pill on card.
**Impact:** Cards become visually distinguishable.

### QW3: Add knowledge density to sort options
**File:** App.tsx line 40 (`SortOrder`) and line 983 (sorting logic)
**Change:** Add `'density'` option. Compute from entity/concept/diagram counts.
**Impact:** Users can sort by "most valuable first."

### QW4: Replace ISO dates with relative time
**File:** App.tsx line 521
**Change:** `{meta.capturedAt.slice(0, 10)}` → `{timeAgo(meta.capturedAt)}` tiny helper.
**Impact:** Immediate polish improvement.

### QW5: Replace word count with reading time
**File:** App.tsx line 520
**Change:** `{meta.wordCount}w` → `{Math.round(meta.wordCount/200)}m read`
**Impact:** More useful metric for users.

### QW6: Add visual selection state for keyboard nav
**File:** App.tsx DocumentGrid (line 770) + DocumentCard (line 501)
**Change:** Pass `isSelected` prop to DocumentCard, add ring/highlight class.
**Impact:** Keyboard navigation becomes usable.

### QW7: Add relative-time sidebar section for "Recent Activity"
**File:** App.tsx Sidebar (line 358)
**Change:** Add a `RecentActivity` component showing last 5 captures with relative times.
**Impact:** Feels alive.

### QW8: Show document count per folder
**File:** App.tsx Sidebar (line 340)
**Change:** After folder name, show `(N)` count in muted text.
**Impact:** Users know which folders are active.

### QW9: Add batch star/archive
**File:** App.tsx — add selection state + batch action bar
**Change:** Add `selectedIds: Set<string>` state. Show batch action bar when >0 selected.
**Impact:** Power users can manage 50+ documents quickly.

### QW10: Add document type filter to top bar
**File:** App.tsx header
**Change:** Add dropdown/button group: All | Tutorials | Papers | News | Analysis.
**Impact:** Users can triage by type immediately.

---

## 14. TOP 10 REDESIGN IDEAS

These are the ten highest-leverage changes to transform the product:

1. **Knowledge Cards** (replaces DocumentCard) — Rich cards showing entities, concepts, diagrams, density, type badge. Different card variants for different document types.

2. **Knowledge Sidebar** (replaces current sidebar) — Topics, Entities, Concepts, Timelines, Knowledge Graph sections. Recent activity feed. Storage health.

3. **Global Knowledge Search** (replaces Fuse.js) — Searches all knowledge fields, returns grouped results (Documents, Entities, Concepts, Timeline Events).

4. **Entity Browser** (new) — Click "Entities" in sidebar → see all entities sorted by mention count → click entity → see all documents + related entities + concept snippets.

5. **Timeline View** (new view mode) — Documents arranged chronologically with extracted timeline events. Merged global timeline across documents.

6. **Knowledge Graph View** (new view mode) — D3.js force-directed graph of entities + relationships. Filterable by topic, document, entity type.

7. **Command Palette** (⌘K) — Search documents, entities, concepts. Quick actions: capture, import, navigate. Keyboard-first power user entry point.

8. **Research Spaces** (new feature) — Curated subsets of documents with pinned entities, active notes, and focus context. For active research projects.

9. **Home Feed** (replaces "All Documents") — Smart default view showing recently captured, high-density documents, entity discovery callouts ("3 documents mention 'Transformer'"), and suggested connections.

10. **Knowledge Density Sort** (replaces "newest" as default) — Default sort by `knowledgeDensity` descending. Shows most valuable documents first. Changes the default behavior from "temporal" to "value-driven."

---

## 15. TOP 5 FEATURES TO DELETE

| Feature | Why |
|---|---|
| **Color Legend** (lines 584–643) | Wastes sidebar space. Shows information the user already set. The tag color picker hidden in the legend is a secondary UI that conflicts with the folder color picker. Delete. |
| **"Comfortable" view mode** | It's neither comfortable (too compact for reading) nor compact (too spacious for density). Three view modes is two too many when none are distinct. Replace with Grid (default) and Compact (dense list). |
| **Browser-native `confirm()` dialog** (line 1026) | Cheap feel. Blocks the event loop. No undo. Replace with toast-based undo action. |
| **Word count on cards** | Meaningless to knowledge workers. Replace with reading time. Or keep as secondary metadata but show reading time as primary. |
| **PAGE_SIZE = 12** | Creates constant page-turning friction. Replace with infinite scroll + virtualization, or increase PAGE_SIZE to 48+ for desktop. |

---

## 16. TOP 5 FEATURES TO PROMOTE

| Feature | Current status | Promote to |
|---|---|---|
| **Entity extraction** | Hidden in reader | Entity count + top 3 on every card. Entity browser in sidebar. Entity detail panel. |
| **Diagram generation** | Hidden in reader | Diagram thumbnail preview on cards. Diagram count badge. |
| **Timeline extraction** | Hidden in reader | Timeline badge on cards. Timeline view mode. Global timeline. |
| **Quality score** | Computed but invisible | Knowledge density bar on cards. Sort by density. Filter by quality threshold. |
| **RAG/chat** | Reader side panel only | Library-level "Ask your library" search bar. Cross-document Q&A. |

---

## 17. COMPLETE REDESIGN DIRECTION

### Philosophy

NOTCH is not a read-later app. NOTCH is not a bookmark manager. NOTCH is a **knowledge discovery engine** that happens to capture webpages.

Every UI decision must reinforce:
- **Intelligence** — The system already understands the content. Show that understanding.
- **Exploration** — Users should discover connections they didn't know existed.
- **Density** — Knowledge workers need information density, not whitespace.
- **Speed** — Keyboard-first, minimal clicks, instant responses.

### Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [SIDEBAR 240px]  │  [TOP BAR 48px]                                     │
│                   │  ┌────────────────────────────────────────────────┐ │
│ NOTCH      [⌘K]  │  │ Search...  [Type▼] [Sort▼] [Filter▼] [View▼]  │ │
│───────────────────│  └────────────────────────────────────────────────┘ │
│ 🧭 Home           │                                                    │
│ ★ Favorites       │                                                    │
│ 📦 Archive        │  [KNOWLEDGE FEED or GRID or TIMELINE or GRAPH]    │
│                   │                                                    │
│ 🧠 KNOWLEDGE      │  ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│   📊 Topics  (6)  │  │Card   1 │ │Card   2 │ │Card   3 │             │
│   ◆ Entities (47) │  │◆12 ·🧠5 │ │◆3 ·🧠1  │ │◆31 ·🧠8 │             │
│   ⬡ Concepts (23) │  │📊2 · 📷4│ │📊0 · 📷1│ │📊5 · 📷0│             │
│   ↻ Timelines (5) │  │████ 82  │ │████ 45  │ │██████ 91│             │
│   ⊞ Knowledge Gr.  │  └─────────┘ └─────────┘ └─────────┘             │
│                   │                                                    │
│ 📂 COLLECTIONS    │  [Infinite scroll — loads as user scrolls]        │
│   └─ Papers  (14) │                                                    │
│   └─ Tutorials (8)│  [Optional: Bottom Entity Bar]                    │
│                   │  ◆Transformer ◆BERT ◆GPT ◆Self-Attention ◆RAG    │
│ 📋 SPACES         │                                                    │
│   └─ LLM Sec  (3) │                                                    │
│                   │                                                    │
│ ⚡ Recent Activity│                                                    │
│   Cap. 2m ago     │                                                    │
│   Read 15m ago    │                                                    │
│                   │                                                    │
│ 📦 Storage 72%    │                                                    │
└───────────────────┴────────────────────────────────────────────────────┘
```

### Interaction Principles

1. **Entity-first navigation** — Every entity mention on a card is clickable → opens entity detail panel → shows all documents + relationships
2. **Hover preview** — Hover any card → shows expanded preview with concepts, timeline events, diagram thumbnail
3. **Keyboard absolutism** — `⌘K` command palette accessible from anywhere. `j/k` navigation with visible selection state. `f` to filter. `s` to star. `e` to open entity browser.
4. **Density as default** — Default view sorted by knowledge density descending. Show most valuable content first.
5. **Progressive disclosure** — Card shows density + counts at rest. Hover reveals preview. Click opens reader. Keyboard expands to knowledge panel.

---

## 18. ASCII WIREFRAMES

### Home Feed (default view):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NOTCH  │  🔍 Search entities, concepts, documents...        [Grid ▼]  [⌘K] │
├────────┴────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🔥 High-Value Reads                                         Show all →    │
│  ┌────────────────────────┐ ┌────────────────────────┐ ┌───────────────────┐│
│  │ 🧬 RESEARCH PAPER      │ │ 📘 TUTORIAL            │ │ 📰 NEWS           ││
│  │ RAG Architecture       │ │ React 19 Deep Dive     │ │ GPT-5 Announced   ││
│  │ ◆ 23 · 🧠 5 · 📊 4    │ │ ◆ 12 · 🧠 3 · 📊 1    │ │ ◆ 8 · 🧠 2        ││
│  │ ████████████ 94/100    │ │ ████████░░ 68/100      │ │ ████░░░░ 42/100  ││
│  │ BERT · GPT · RAG       │ │ hooks · context · perf │ │ OpenAI · GPT · M  ││
│  └────────────────────────┘ └────────────────────────┘ └───────────────────┘│
│                                                                              │
│  🧠 Trending Entities                                                       │
│  [Transformer] [BERT] [Self-Attention] [RAG] [GPT] [React] [Kubernetes]    │
│  Click any entity → explore all documents mentioning it                     │
│                                                                              │
│  ⏱ Recently Captured                                          Show all →  │
│  ┌────────────────────┬────────────────────┬────────────────────┬──────────┐│
│  │ Paper: Attention   │ Tutorial: Prompts  │ Doc: LangChain     │ Course:  ││
│  │ 2h ago · ◆ 31     │ 1d ago · ◆ 8      │ 3d ago · ◆ 15     │ 5d ago   ││
│  │ ██████████████ 97  │ ██████░░░░ 58     │ ████████░░░░ 72   │ █████ 52 ││
│  └────────────────────┴────────────────────┴────────────────────┴──────────┘│
│                                                                              │
│  🔗 Discovered Connections                                                  │
│  "3 documents mention 'Transformer' — grouped as a topic." [Explore]        │
│  "RAG Architecture and LangChain share 4 entities — view overlap." [Show]   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Entity Browser View:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NOTCH  │  ◆ Entities                                          [Sort: Count]│
├────────┴────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Filter by type:  [All] [Technology] [Person] [Organization] [Concept]      │
│                                                                              │
│  ◆ Transformer          47 mentions  ·  4 documents  ·  technology          │
│    └─ Documents: Attention Is All You Need, BERT Paper, GPT Paper, ...     │
│    └─ Related: Self-Attention (uses), Multi-Head Attention (uses)            │
│                                                                              │
│  ◆ BERT                 23 mentions  ·  3 documents  ·  technology          │
│    └─ Documents: BERT Paper, Transformer Survey, NLP Benchmarks             │
│    └─ Related: Transformer (based-on), Fine-tuning (enables)                 │
│                                                                              │
│  ◆ GPT                  18 mentions  ·  2 documents  ·  technology          │
│    └─ ...                                                                    │
│                                                                              │
│  ◆ Self-Attention       15 mentions  ·  3 documents  ·  concept             │
│    └─ ...                                                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Timeline View:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NOTCH  │  ↻ Timeline                                                  [Zoom]│
├────────┴────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  2024 ──────────────────────────────────────────────────────────────────     │
│                                                                              │
│  Q1 2024                                                                    │
│  ●─── RAG Architecture paper published       📄 RAG Architecture             │
│  ●─── GPT-5 announced at OpenAI event        📰 TechCrunch article           │
│  ●─── React 19 enters beta                   📘 React 19 Migration Guide     │
│                                                                              │
│  Q2 2024                                                                    │
│  ●─── LangChain v0.3 released                📄 Release notes                │
│  ●─── Kubernetes 1.30 ships                  📘 K8s upgrade guide            │
│                                                                              │
│  Q3 2024                                                                    │
│  ●─── Claude Sonnet 4 announced              📰 AI product launch             │
│  ●─── NOTCH v2.0 with Content Engine         🏗 Internal release             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Knowledge Graph View:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NOTCH  │  ⊞ Knowledge Graph                     [Filter] [Zoom] [Auto-layot]│
├────────┴────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                   ┌───────────┐                                             │
│          ┌────────│  BERT     │────────┐                                    │
│          │        │ (23)      │        │                                    │
│          │        └───────────┘        │                                    │
│          │           based-on          │                                    │
│          │                │            │                                    │
│          ▼                ▼            ▼                                    │
│  ┌───────────┐   ┌───────────────┐   ┌───────────┐                         │
│  │  Fine-    │   │ Transformer   │   │    GPT    │                         │
│  │  tuning   │   │ (47)          │   │ (18)      │                         │
│  │  (7)      │   └───────┬───────┘   └───────────┘                         │
│  └───────────┘           │                    │                             │
│                     uses │               based-on                          │
│                    ┌─────┴──────┐            │                              │
│                    │  Self-     │            │                              │
│                    │  Attention │ ◄──────────┘                              │
│                    │  (15)      │                                           │
│                    └────────────┘                                           │
│                                                                              │
│  Node size = mention count  │  Edge color = relationship type               │
│  Click node → filter to connected entities  │  Double-click → open entity   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 19. COMPONENT HIERARCHY

```
KnowledgeLibrary
├── Sidebar
│   ├── SidebarHeader            (logo + ⌘K trigger)
│   ├── PrimaryNav               (Home / Favorites / Archive)
│   ├── KnowledgeSection         (collapsible)
│   │   ├── NavItem → Topics (count)
│   │   ├── NavItem → Entities (count)
│   │   ├── NavItem → Concepts (count)
│   │   ├── NavItem → Timelines (count)
│   │   └── NavItem → Knowledge Graph
│   ├── CollectionsSection       (replaces folders)
│   │   ├── CollectionGroup
│   │   │   ├── CollectionItem (name, color, count, actions)
│   │   │   └── CreateCollection (inline creator)
│   │   └── DragDropProvider
│   ├── SpacesSection
│   │   ├── SpaceItem (name, document count, last active)
│   │   └── CreateSpace
│   ├── RecentActivity
│   │   └── ActivityItem (type, title, relative time)
│   └── StorageBar
│       ├── UsageBar (visual progress)
│       └── UsageText ("XX% used — XX MB / XX GB")
│
├── TopBar
│   ├── GlobalSearch
│   │   ├── SearchInput
│   │   ├── SearchResults (grouped: Documents, Entities, Concepts, Timelines)
│   │   ├── SearchFacets
│   │   └── KeyboardShortcutHint
│   ├── FilterBar
│   │   ├── DocumentTypeFilter (pills: All, Tutorial, Research, News, Analysis)
│   │   ├── SortSelector (Density, Date, Title, Entity Count, Quality)
│   │   ├── DateRangeFilter
│   │   └── EntityCountFilter
│   └── ViewSwitcher
│       ├── GridButton
│       ├── CompactButton
│       ├── TimelineButton
│       └── GraphButton
│
├── MainContent
│   ├── HomeFeed                 (default view)
│   │   ├── HighValueSection
│   │   │   └── StackedKnowledgeCard (horizontal row of high-density cards)
│   │   ├── TrendingEntities
│   │   │   └── EntityChip (clickable, sized by count)
│   │   ├── RecentCaptures
│   │   │   └── KnowledgeCardRow (compact row)
│   │   └── ConnectionDiscovery
│   │       └── SuggestionCard ("X docs mention Y — explore topic")
│   │
│   ├── GridView
│   │   └── VirtualizedGrid
│   │       └── KnowledgeCard (polymorphic)
│   │           ├── KnowledgeCardBase
│   │           │   ├── CardHeader (star, title, domain, type badge)
│   │           │   ├── KnowledgeMetrics (entity/concept/diagram/timeline counts)
│   │           │   ├── EntityPillRow (top 3 entities)
│   │           │   ├── ConceptBadgeRow (top 3 concepts)
│   │           │   ├── DensityScoreBar
│   │           │   ├── PreviewThumbnail (auto-selected)
│   │           │   │   ├── DiagramPreview
│   │           │   │   ├── EntityCloudPreview
│   │           │   │   ├── TimelineSparkline
│   │           │   │   └── GeneratedCover
│   │           │   ├── TagList
│   │           │   └── CardActions (star, archive, move, delete, find-similar)
│   │           ├── ResearchCardVariant (entity-heavy, for papers)
│   │           └── VisualCardVariant (diagram-heavy, for tutorials)
│   │
│   ├── CompactListView
│   │   └── CompactCardRow (horizontal, high density)
│   │
│   ├── TimelineView
│   │   ├── TimelineYear (year header)
│   │   │   ├── TimelineQuarter
│   │   │   │   └── TimelineEvent (event dot + document card)
│   │   │   └── ...
│   │   └── TimelineGlobalControls (zoom, filter by entity)
│   │
│   ├── EntityBrowserView
│   │   ├── EntityTypeFilter (tabs)
│   │   ├── EntityList (sorted by mention count)
│   │   │   └── EntityListItem (name, type, count, document list)
│   │   └── EntityDetailPanel (slide-over)
│   │       ├── EntityHeader (name, type, total mentions)
│   │       ├── RelatedEntities (connected via relationships)
│   │       ├── DocumentList (all docs mentioning entity)
│   │       └── MiniGraph (subgraph centered on entity)
│   │
│   └── KnowledgeGraphView
│       ├── GraphCanvas (D3.js force-directed)
│       ├── GraphControls (zoom, filter, auto-layout)
│       ├── NodeTooltip (entity name, count, top documents on hover)
│       └── GraphSidebar (selected node detail)
│
├── SlideOverPanel (contextual)
│   ├── EntityDetailPanel
│   ├── ConceptDetailPanel
│   └── SearchResultsPanel
│
└── CommandPalette (⌘K overlay)
    ├── SearchDocuments
    ├── SearchEntities
    ├── SearchConcepts
    ├── QuickActions (Capture, Import, New Space, New Collection)
    └── KeyboardShortcuts
```

---

## 20. USER JOURNEY IMPROVEMENTS

### Journey 1: First Capture (new user)

**Current:**
```
Install extension → Click capture → "Captured!" → Open library 
→ See card with title/domain/word count/date/summary 
→ "This looks like Pocket" → Abandon
```

**Redesigned:**
```
Install extension → Welcome flow: "NOTCH extracts entities, concepts, 
  timelines, and diagrams from every capture. Let's try it."
→ Guided capture of demo page → Capture completes 
→ Library opens with card showing: 
  ◆ 12 entities · 🧠 5 concepts · 📊 2 diagrams · ████████ 82/100
→ "NOTCH identified these entities in your document: [BERT] [GPT] [Transformer]..."
→ User clicks entity → Entity detail panel slides open
→ "This is what a knowledge base feels like."
→ Retention
```

### Journey 2: Research Session (power user)

**Current:**
```
Open library → See 15 pages of identical cards → Click "Newest" sort 
→ Scroll page 3 → Click a card → Reader opens → Read → Close tab 
→ Back to library → Lost scroll position → Start again
```

**Redesigned:**
```
⌘K → Type "RAG" → See documents + entities + concepts matching "RAG" 
→ Select document → Opens in reader (split view) 
→ Highlight text → NOTCH shows entity it mentions 
→ Alt+Click entity → Opens entity panel in library → See 4 related documents 
→ Press Space → Add all 4 to active Research Space "LLM Security" 
→ Open Research Space → See 12 pinned documents + entity cloud + notes 
→ Knowledge Graph tab shows how the 12 documents connect via entities
```

### Journey 3: Knowledge Discovery (serendipitous)

**Current:**
```
Open library → "I have 84 documents. What do I know?" 
→ Click through pages → Open random documents → Maybe find something interesting
```

**Redesigned:**
```
Open library → Home feed shows: "3 documents mention 'RAG'. Would you like to 
  explore this topic?" → Click → Topic view with entity cloud, timeline, 
  and related concepts → "RAG is connected to 'Vector Databases' (2 docs) 
  and 'Embeddings' (4 docs)" → Click → Discover connections across documents 
  the user didn't know existed
```

### Journey 4: Weekly Review

**Current:**
```
Cannot do. Library provides no synthesis, no summary view, no knowledge overview.
```

**Redesigned:**
```
Open library → Go to Timeline View → "This week: 12 captures, 84 new entities, 
  23 new concepts" → Knowledge Graph shows new entities added this week 
  as highlighted nodes → Click "This week's high-value reads" → See 
  top-5 documents by knowledge density → Review → Archive low-value → 
  Done in 5 minutes
```

---

## FINAL VERDICT

NOTCH has a world-class extraction engine and a below-average UI. The library is the single highest-leverage improvement the product could make — it's where users spend 80% of their time, and it currently communicates nothing about NOTCH's intelligence.

The gap between engineering and UX is the product's existential risk. Closing it is not optional. Every week the library hides the extraction pipeline is a week where users perceive NOTCH as a basic bookmark manager and churn to tools that have figured out how to surface intelligence.

The redesign is not cosmetic. It's a product positioning transformation. The UI must tell the same story the engineering does: **"This is a knowledge platform that understands your content."**

---

