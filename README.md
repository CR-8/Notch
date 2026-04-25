# Notch — A High-Density Knowledge Base for Web Content

> Capture, structure, and interrogate web content with your own AI keys. Build a permanent, queryable knowledge base from ephemeral articles, documentation, and research — with full data ownership.

**Built for:** Developers, researchers, students, and knowledge workers who demand speed, data privacy, and structured information density.

**Platform:** Chrome (MV3) + Firefox (MV2) browser extension

![Popup](ui/Popup_1.png)

---

## Table of Contents

1. [What is Notch?](#what-is-notch)
2. [Core Features](#core-features)
3. [How It Works](#how-it-works)
4. [Technology Stack](#technology-stack)
5. [Generation Modes](#generation-modes)
6. [Data Storage & Architecture](#data-storage--architecture)
7. [Getting Started](#getting-started)
8. [Configuration](#configuration)
9. [Project Structure](#project-structure)
10. [Development & Testing](#development--testing)
11. [Future Improvements](#future-improvements)
12. [License](#license)

---

## What is Notch?

Notch is a browser extension that transforms how you capture and interact with web content. Instead of bookmark chaos or fragmented notes, Notch turns every article, documentation page, and research resource into a **structured, AI-enhanced knowledge asset** that lives permanently in your browser.

### The Problem It Solves

- **Information sprawl:** Articles disappear, links rot, bookmarks pile up
- **Passive consumption:** You read but don't retain or retrieve
- **Data dependency:** Cloud services lock your information behind paywalls or terms of service
- **Search friction:** Generic search engines can't understand *your* knowledge base
- **Context loss:** You remember *something* but can't find it

### The Notch Solution

1. **One-click capture** on any webpage
2. **AI structuring** extracts summaries, entities, concepts, timelines, and diagrams
3. **Local-first storage** in your browser (IndexedDB)
4. **Bring-your-own-key (BYOK)** — you control the AI via your own Gemini API key
5. **RAG chat** — ask questions and get answers with source citations
6. **Full ownership** — your data never leaves your device

---

## Core Features

### 1. **Smart Content Capture**
- Click the Notch icon on any webpage
- Extension extracts readable content (removes ads, nav clutter)
- Sends to your AI for structuring
- Results appear as clean, organized markdown

### 2. **Reader View — Dual-Pane Layout**
- **Left pane:** Original article with highlight preservation
- **Right pane:** AI-structured notes with:
  - Summary (2-6 sentences depending on mode)
  - Key entities (people, orgs, technologies)
  - Timeline (for chronological content)
  - Concepts (technical terms with definitions)
  - Main content (restructured into logical sections)
  - Diagrams (ASCII art converted to Mermaid/PlantUML)
  - Images (positioned contextually)

### 3. **RAG Chat — Interrogate Your Documents**
- Ask questions about any captured document
- Responses include **inline citation chips** `[1]` `[2]` that scroll to source
- Uses semantic search (local embeddings) + LLM for precise answers
- Preserves quota by using the BALANCED model for queries

### 4. **Library Dashboard**
- Browse all captured documents in a dense, searchable grid
- Filter by domain, date, tags, starred/archived status
- Full-text search powered by fuzzy matching
- Tag-based organization
- Star/archive documents for curation
- Bulk operations support

### 5. **Settings & Onboarding**
- Paste your Google AI Studio API key (free, no credit card)
- Choose default generation mode (FAST / BALANCED / DEEP)
- Toggle local Ollama support for offline inference
- View API quota usage and generation history
- Export documents as Markdown

---

## How It Works

### The Capture Pipeline

```
1. User clicks Notch icon on webpage
   ↓
2. Content script injects into page and extracts DOM
   ↓
3. Mozilla Readability parses readable content + images
   ↓
4. Content + image refs sent to background service worker
   ↓
5. Background worker calls your AI (Gemini or Ollama)
   ↓
6. AI returns structured markdown (summary, entities, concepts, diagrams)
   ↓
7. Document stored in IndexedDB with metadata
   ↓
8. User can now view in Reader, search, chat, or export
```

### The RAG Chat Pipeline

```
1. User types question in Chat pane
   ↓
2. Question embedded using local HuggingFace model (ALL-MiniLM)
   ↓
3. Cosine similarity search finds most relevant document chunks
   ↓
4. Top-K chunks sent to LLM with question
   ↓
5. LLM returns answer with inline citations [1] [2]
   ↓
6. Citation chips link back to source paragraphs
```

### Key Technical Decisions

#### Content Extraction
- **Mozilla Readability** removes noise and extracts semantic content
- Preserves article structure, links, and images
- Gracefully degrades on poorly-formatted pages

#### Local Embeddings (WASM)
- **Why local?** Privacy + speed. Your queries never leave the device
- **Technology:** HuggingFace `@huggingface/transformers` + ONNX Runtime (WASM)
- **Model:** `sentence-transformers/all-MiniLM-L6-v2` (32MB, runs in ~100ms per document)
- **Trade-off:** Smaller model (lower quality) vs. browser WASM constraints

#### Three-Tier Generation Modes
- **FAST:** For quick captures, summaries, and RAG queries (preserve quota)
- **BALANCED:** Sweet spot for most users (good quality, high quota)
- **DEEP:** For research documents requiring exhaustive analysis (lower quota)

---

## Technology Stack

### Why Each Choice?

| Layer | Tech | Why |
|---|---|---|
| **Framework** | [WXT](https://wxt.dev) | Modern, Vite-based extension builder with React integration; handles MV3/MV2 differences automatically |
| **UI Library** | React 19 | Latest React with built-in optimizations; excellent for dense UIs |
| **Styling** | Tailwind CSS v4 | Utility-first, no bundle bloat; integrates with Vite via `@tailwindcss/vite` |
| **Components** | shadcn/ui + Radix | Unstyled, accessible primitives; full control over appearance |
| **Rich Text** | Tiptap | Headless editor built on ProseMirror; handles complex Markdown + code blocks |
| **Content Parsing** | Mozilla Readability | Battle-tested, used by Firefox Reader Mode; handles edge cases gracefully |
| **AI / LLM** | Google Gemini API | Free tier (500–14.4K req/day); open-weight model alternatives (Gemma 3) |
| **Local Embeddings** | HuggingFace Transformers + ONNX | Only privacy-respecting solution for WASM; subset of HF ecosystem |
| **Embeddings Runtime** | ONNX Runtime (WASM) | Lightweight, sub-50MB footprint; runs in browser threads |
| **Storage** | Chrome `storage.local` → IndexedDB | Standard extension API; IndexedDB wrapper for larger payloads (docs + embeddings) |
| **Diagrams** | Mermaid + PlantUML | Convert ASCII art to interactive diagrams; Mermaid renders in browser, PlantUML server-rendered |
| **Search** | Fuse.js | Fuzzy matching for library search; tiny bundle (~5KB), instant results |
| **Testing** | Vitest + fast-check | Fast unit tests; property-based testing catches edge cases (UTF-8, pagination, etc.) |
| **Type Safety** | TypeScript 5.9 | Full type safety across extension boundaries; shared types in `lib/types.ts` |

---

## Generation Modes

Notch supports three AI models, each with different quotas and trade-offs:

| Mode | Model | Free Quota | Latency | Quality | Use Case |
|---|---|---|---|---|---|
| **FAST** | `gemini-3.1-flash-lite-preview` | 500 req/day | ~1s | Good | Quick summaries, RAG queries |
| **BALANCED** | `gemma-3-12b-it` | 14,400 req/day | ~3s | Excellent | Default; research documents |
| **DEEP** | `gemma-3-27b-it` | 14,400 req/day | ~5s | Best | Deep research, complex analysis |

### Selection Logic
- **RAG Chat always uses BALANCED** to preserve FAST quota for future captures
- **User can override at capture time** — choose FAST for quick reads, DEEP for research
- **Quota display** — Settings page shows remaining daily quota per mode

### Local Inference (Ollama)
- Wired into type system and settings schema
- For offline/privacy-first users who run `ollama serve`
- Endpoint defaults to `http://localhost:11434`
- No quota limits; runs entirely on-device

---

## Data Storage & Architecture

### Storage Layers

#### 1. **IndexedDB (Persistent)**
```typescript
// Documents stored with full content
{
  id: "uuid",
  title: "Article Title",
  url: "https://...",
  domain: "example.com",
  capturedAt: "2026-04-20T...",
  wordCount: 5000,
  mode: "BALANCED",
  provider: "gemini",
  
  // Full content
  content: "...", // Markdown
  summary: "...",
  keyEntities: [...],
  timeline: [...],
  concepts: [...],
  tags: [],
  images: [...],
  
  // Embeddings (only if embeddings generated)
  embeddingsGenerated: true
}
```

#### 2. **Chrome Storage API (Metadata Only)**
```typescript
// DocumentMeta stored for library listing (no full content)
{
  id: "uuid",
  title: "Article Title",
  url: "https://...",
  domain: "example.com",
  summary: "...",
  tags: [],
  isStarred: false,
  isArchived: false,
  isRead: false,
  mode: "BALANCED",
  capturedAt: "2026-04-20T..."
}
```

#### 3. **In-Memory Cache (Session)**
- DocumentChunk embeddings cached during RAG queries
- Cleared on tab close

### Storage Quotas

| Browser | Quota | Per-domain Limit |
|---|---|---|
| **Chrome** | 10 MB IndexedDB per origin | 50 MB Chrome Storage API |
| **Firefox** | Unlimited* | Unlimited* |

*Firefox has no hard quota limits for `storage.local` or IndexedDB.

### Data Flow

**Capture:**
```
Content Script → Background Worker → AI API → IndexedDB + storage.local
```

**Query:**
```
User query → Embedding engine (HF/ONNX) → Similarity search → Chunk retrieval → LLM → Response
```

**Export:**
```
IndexedDB document → Markdown formatter → Download `.md` file
```

### Data Privacy & Security

✅ **All data stays on your device** — IndexedDB is sandboxed per-origin  
✅ **BYOK model** — your AI key never reaches Notch servers  
✅ **No telemetry** — no calls home, no tracking, no analytics  
✅ **Open-source** — audit the code yourself  
✅ **Local embeddings** — your search queries never leave the browser  

⚠️ **Considerations:**
- Embeddings are stored alongside documents; larger corpus = larger IndexedDB footprint
- Chrome quota is 10 MB per origin; manage by archiving or exporting old docs
- Browser sync may expose encrypted storage data to your Google/Mozilla account

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **pnpm**
- **Google AI Studio API key** (free, [get it here](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repo
git clone <repository-url>
cd notch

# Install dependencies
npm install

# Start dev server (Chrome)
npm run dev

# Or for Firefox
npm run dev:firefox
```

### Load the Extension

**Chrome:**
1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select `.output/chrome-mv3-dev` folder
5. Notch icon appears in toolbar

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `.output/firefox-mv2-dev/manifest.json`
4. Notch icon appears in toolbar

### First Capture

1. Navigate to any webpage
2. Click Notch icon → Settings
3. Paste your Google AI Studio API key
4. Choose generation mode (FAST / BALANCED / DEEP)
5. Save
6. Return to article, click Notch → **[CAPTURE PAGE]**
7. Wait for processing → **[OPEN IN READER →]**
8. Click to view dual-pane Reader

---

## Configuration

### API Key Setup

1. Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open extension **Settings** (right-click extension → Options, or via popup)
3. Paste key in "API Key" field
4. Select generation mode
5. Save

### Generation Mode Selection

```plaintext
┌─ FAST        → Quick summaries, RAG queries (500/day quota)
├─ BALANCED    → Default, recommended (14.4K/day quota)
└─ DEEP        → Research documents (14.4K/day quota)
```

### Ollama Configuration (Offline)

For local inference without internet:

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Pull a model
ollama pull mistral  # or any other model

# Then in Notch Settings, toggle "Use Local (Ollama)" 
# and set endpoint to http://localhost:11434
```

### Export Settings

Documents can be exported as:
- **Single Markdown** file
- **Markdown + images** folder
- **All documents** bulk export (`.zip`)

---

## Project Structure

```
notch/
├── src/
│   ├── entrypoints/
│   │   ├── popup/
│   │   │   ├── App.tsx          # 320×480px capture UI
│   │   │   ├── main.tsx
│   │   │   ├── index.html
│   │   │   └── style.css
│   │   ├── reader/
│   │   │   ├── App.tsx          # Dual-pane reader + RAG chat
│   │   │   ├── main.tsx
│   │   │   ├── index.html
│   │   │   └── style.css
│   │   ├── newtab/
│   │   │   └── ...              # (Reserved for future dashboard)
│   │   ├── options/
│   │   │   ├── App.tsx          # Settings & onboarding
│   │   │   ├── main.tsx
│   │   │   ├── index.html
│   │   │   └── style.css
│   │   ├── background.ts        # Service worker
│   │   │                         # - Handles capture pipeline
│   │   │                         # - Manages embeddings generation
│   │   │                         # - Orchestrates storage
│   │   └── content.ts           # Content script
│   │                             # - Injected into webpages
│   │                             # - Extracts DOM + readability
│   │
│   ├── components/
│   │   ├── ChatPanel.tsx        # RAG chat interface
│   │   ├── MermaidBlock.tsx     # Mermaid diagram renderer
│   │   ├── PlantUMLBlock.tsx    # PlantUML diagram renderer
│   │   ├── CodeBlockExtension.ts # Tiptap code block config
│   │   ├── UnifiedCodeNodeView.tsx # Rich code display
│   │   └── ui/                  # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── textarea.tsx
│   │       ├── badge.tsx
│   │       ├── scroll-area.tsx
│   │       ├── separator.tsx
│   │       ├── skeleton.tsx
│   │       └── tooltip.tsx
│   │
│   ├── lib/
│   │   ├── ai-client.ts         # Gemini API wrapper
│   │   ├── embedding-engine.ts  # HF Transformers + ONNX
│   │   ├── retrieval.ts         # Cosine similarity RAG
│   │   ├── idb.ts               # IndexedDB helpers
│   │   ├── storage.ts           # chrome.storage wrapper
│   │   ├── export.ts            # Markdown export logic
│   │   ├── types.ts             # Shared TypeScript types
│   │   ├── validation.ts        # Input validation
│   │   ├── utils.ts             # Helper functions
│   │   ├── logger.ts            # Structured logging
│   │   └── __tests__/           # Property-based tests
│   │       ├── ai-parsing.property.test.ts
│   │       ├── chunking.property.test.ts
│   │       ├── deletion.property.test.ts
│   │       ├── diagram-renderer.property.test.ts
│   │       ├── dom-extraction.property.test.ts
│   │       ├── export.property.test.ts
│   │       ├── fuzzy-search.property.test.ts
│   │       ├── library-render.property.test.ts
│   │       ├── mutations.property.test.ts
│   │       ├── popup-status.property.test.ts
│   │       ├── quota.property.test.ts
│   │       ├── retrieval.property.test.ts
│   │       ├── settings.property.test.ts
│   │       ├── sort-order.property.test.ts
│   │       ├── storage.property.test.ts
│   │       ├── tag-filter.property.test.ts
│   │       ├── tag-persistence.property.test.ts
│   │       ├── validation.property.test.ts
│   │       └── setup.ts
│   │
│   └── assets/
│       └── globals.css          # Global styles
│
├── .kiro/                       # Kiro autonomous agent configurations
├── .roo/                        # Roo code assistant context
├── .claude/                     # Claude AI prompt configurations
├── .agents/                     # Additional agentic workflows
├── public/
│   ├── icon/                    # Extension icons (16, 32, 48, 96, 128)
│   └── ort/                     # ONNX Runtime WASM + JS modules
│       └── ort-wasm-simd-threaded.mjs
│
├── wxt.config.ts                # WXT build config
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Vitest testing config
├── tailwind.config.js           # Tailwind CSS config
├── components.json              # shadcn/ui config
├── package.json
├── README.md
├── Idea.md                      # Product design doc
├── SKILL.md                     # Agent skill instructions
├── skills-lock.json             # Agent skills dependency lock
└── LICENSE
```

### Key Files Explained

#### `src/lib/ai-client.ts`
- Wrapper around Google Gemini API
- Handles authentication, rate limits, error recovery
- Implements prompt templates for FAST, BALANCED, DEEP modes
- RAG query builder with context injection

#### `src/lib/embedding-engine.ts`
- Initializes HuggingFace Transformers model in WASM
- Generates embeddings for document chunks
- Handles lazy loading to minimize initial bundle
- Manages worker threads for non-blocking processing

#### `src/lib/retrieval.ts`
- Cosine similarity search over embeddings
- Top-K chunk retrieval for RAG
- Includes chunking strategy (sentence-level or paragraph-level)

#### `src/lib/idb.ts`
- Wrapper around IndexedDB for documents and metadata
- Handles schema versioning
- CRUD operations for documents and embeddings

#### `src/entrypoints/background.ts`
- Service worker that orchestrates the entire capture pipeline
- Listens for capture requests from popup
- Calls content script → readability → AI → storage
- Manages embeddings generation in background

#### `src/entrypoints/content.ts`
- Injected into every webpage
- Extracts DOM, filters noise, detects images
- Sends to background worker for processing

---

## Development & Testing

### Local Development

```bash
# Start dev server (auto-rebuilds on changes)
npm run dev

# Type check
npm run compile

# Run all tests
npm test

# Watch tests
npm test -- --watch
```

### Testing Strategy

Notch uses **property-based testing** with [fast-check](https://github.com/dubzzz/fast-check) for robustness:

```bash
npm test                      # Run all tests
npm test -- --reporter=verbose # Verbose output
npm test -- --run             # Single run (no watch)
```

#### Test Coverage

| Module | Tests |
|---|---|
| `ai-parsing` | Prompt template building, model selection |
| `chunking` | Document splitting, boundary handling |
| `deletion` | Archive/deletion workflows |
| `diagram-renderer` | Mermaid/PlantUML conversion |
| `dom-extraction` | Readability integration |
| `export` | Markdown + image export |
| `fuzzy-search` | Fuse.js library search |
| `library-render` | Library UI state management |
| `mutations` | Storage mutations (add/update/delete) |
| `popup-status` | Popup state machine |
| `quota` | API quota tracking |
| `retrieval` | Embedding similarity search |
| `settings` | Settings persistence |
| `sort-order` | Sorting/filtering logic |
| `storage` | IndexedDB operations |
| `tag-filter` | Tag-based filtering |
| `tag-persistence` | Tag metadata storage |
| `validation` | Input sanitization |

### Build Targets

```bash
# Chrome MV3 (production)
npm run build

# Firefox MV2 (production)
npm run build:firefox

# Chrome dev build (watch mode)
npm run dev

# Pack for Web Store
npm run zip
```

---

## Future Improvements

### Near-term (Q2-Q3 2026)

- [ ] **Incremental Sync** — Back up documents to user's chosen cloud (Google Drive, S3, etc.) with differential updates
- [ ] **Better Embedding Models** — Upgrade from `all-MiniLM` to `multilingual-e5-large` for better cross-language support
- [ ] **Collaborative Tags** — Shared tag hierarchies + syncing across devices
- [ ] **Search Refinements** — BM25 hybrid search (keyword + semantic)
- [ ] **Mobile Companion App** — Read and search captured documents on iOS/Android
- [ ] **Browser Sync** — Seamless sync between Chrome and Firefox instances
- [ ] **RAG-based Model** — Implement a rack-based architecture for handling large content using byte stuffing techniques inspired by computer network framing
- [ ] **Content Segmentation** — Automatically break content >4000 words into segments, process them separately, and compile results using byte stuffing
- [ ] **Folder Organization & Mass Export** — Add folder sections for project organization and bulk export of all PDFs in a folder

### Mid-term (Q4 2026 – Q1 2027)

- [ ] **Obsidian Plugin** — Export Notch library as Obsidian vault with bidirectional links
- [ ] **Knowledge Graph** — Visualize entity relationships across all documents
- [ ] **Custom Fine-tuning** — Fine-tune embeddings on your own documents
- [ ] **API Server** — Self-hosted Notch backend for team/org collaboration
- [ ] **Summarization Chains** — Progressive summarization (one-liner → paragraph → page)
- [ ] **Video Support** — Transcribe YouTube videos, podcasts, and extract content

### Long-term (2027+)

- [ ] **Offline AI Models** — Integrate `llama.cpp` for fully offline LLM inference
- [ ] **Multi-provider LLMs** — Support OpenAI, Anthropic, HuggingFace Inference API
- [ ] **Advanced RAG** — Multi-hop reasoning, SQL over documents
- [ ] **Browser Integration** — Native Chromium embedding for better isolation
- [ ] **Desktop App** — Standalone Electron app with native desktop features

### Performance Optimizations

- [ ] **Lazy-load embeddings** — Only generate on-demand
- [ ] **Chunk-level caching** — Cache frequently accessed chunks
- [ ] **Service worker persistence** — Reduce memory footprint
- [ ] **WASM optimizations** — Upgrade to fastest ONNX Runtime v20

### Known Limitations

⚠️ **Current constraints:**
- IndexedDB quota: 10 MB per origin (Chrome). Recommend archiving docs > 2 years old.
- Embeddings take 100-200ms per document on older devices.
- PlantUML diagrams require server-side rendering (non-local).
- No native support for PDF extraction (use browser's native PDF viewer → capture → structuring).

---

## Build & Deployment

### Development

```bash
npm install
npm run dev
# Open chrome://extensions → Load unpacked → .output/chrome-mv3-dev
```

### Production

```bash
npm run build
npm run zip
# Upload .output/notch.zip to Chrome Web Store
```

### Firefox

```bash
npm run build:firefox
npm run zip:firefox
# Upload to addons.mozilla.org
```

---

## Contributing

Contributions welcome! Areas needing help:

- [ ] Embedding model improvements
- [ ] UI/UX refinements
- [ ] Additional diagram format support
- [ ] Performance optimizations
- [ ] Documentation and examples

---

## Troubleshooting

### "API Key Invalid"
- Verify key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Ensure no extra whitespace or quotes

### "Quota Exceeded"
- Check remaining quota in Settings
- Switch to BALANCED mode for RAG queries
- Wait until tomorrow for daily reset

### "Storage Full"
- Archive old documents in Library
- Export as Markdown and delete locally
- Consider Firefox (unlimited quota)

### "Chat Not Responding"
- Ensure document embeddings are generated (check "Embeddings generated" status)
- Verify API key has quota remaining
- Check browser console for errors: `F12 → Console`

---

## Recent Architectural Changes & Updates

- **Agentic Workflows Integration**: The repository has been instrumented with autonomous agent configurations, enabling extensibility via `.kiro`, `.roo`, and `.claude`.
- **Skill Definitions Layer**: Integrated `skills` schema for defining executable AI protocols (`SKILL.md` and `skills-lock.json`).
- **Complete Test Coverage Structure**: Leveraged `fast-check` to implement a property-based testing strategy.
- **Local Embedded WASM**: Seamless on-device HuggingFace pipeline initialization for offline-capable similarity search metrics.

---

## License

[MIT](LICENSE) © 2026 Notch Contributors