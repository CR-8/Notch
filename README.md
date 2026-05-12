# Notch — AI-Powered Knowledge Base for Web Content

<p align="center">
  <img src="ui/Popup_1.png" alt="Notch Popup" width="320"/>
</p>

> Capture, structure, and interrogate web content with your own AI keys. Build a permanent, queryable knowledge base from articles, documentation, and research — with full data ownership.

**Built for:** Developers, researchers, students, and knowledge workers who demand speed, data privacy, and structured information density.

**Platform:** Chrome (MV3) + Firefox (MV2) browser extension

---

## Table of Contents

1. [Features](#features)
2. [Screenshots](#screenshots)
3. [Technology Stack](#technology-stack)
4. [Data Storage](#data-storage)
5. [Getting Started](#getting-started)
6. [Configuration](#configuration)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Project Structure](#project-structure)
9. [Development](#development)
10. [UX Improvements](#ux-improvements)
11. [License](#license)

---

## Features

### Smart Content Capture
- **One-click capture** from any webpage
- **AI structuring** extracts summaries, entities, concepts, timelines, and diagrams
- **Mozilla Readability** removes ads and clutter
- Supports **PDF import** and processing

### Reader View — Dual-Pane Layout
- **Left pane:** Original article with highlight preservation
- **Right pane:** AI-structured notes with:
  - Summary (2-6 sentences depending on mode)
  - Key entities (people, organizations, technologies)
  - Timeline (for chronological content)
  - Concepts (technical terms with definitions)
  - Restructured content in logical sections
  - Diagram rendering (Mermaid/PlantUML)
  - Contextually positioned images

### RAG Chat — Interrogate Your Documents
- Ask questions about any captured document
- **Inline citation chips** `[1]` `[2]` that scroll to source
- Semantic search using local embeddings
- Preserves quota by using BALANCED mode for queries

### Library Dashboard
- Browse all captured documents in a dense, searchable grid
- Filter by **domain, date, tags, starred/archived** status
- Full-text search powered by Fuse.js fuzzy matching
- **Tag-based organization** with color coding
- Star/archive documents for curation
- **Folder organization** with drag-and-drop
- Multiple view modes: **Compact**, **Comfortable**, **Detailed**
- Bulk operations support

### Settings & Configuration
- Multiple LLM providers: **Anthropic (Claude)**, **OpenRouter**, **OpenCode**
- Dynamic model fetching from API endpoints
- **Three generation modes**: FAST / BALANCED / DEEP
- Theme customization (dark/light/system)
- Font family and size options
- Accent color picker

---

## Screenshots

| Popup | Library | Reader |
|-------|---------|--------|
| ![Popup](ui/Popup_1.png) | ![Library](ui/Library.png) | ![Reader](ui/Reader.png) |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | [WXT](https://wxt.dev) | Modern Vite-based extension builder |
| **UI** | React 19 | Component-based UI |
| **Styling** | Tailwind CSS v4 | Utility-first styling |
| **Components** | shadcn/ui + Radix | Accessible UI primitives |
| **Rich Text** | Tiptap | Markdown editor |
| **Content Parsing** | Mozilla Readability | Article extraction |
| **AI** | Anthropic, OpenRouter, OpenCode APIs | LLM processing |
| **Local Embeddings** | HuggingFace Transformers + ONNX | Semantic search (WASM) |
| **Storage** | IndexedDB + chrome.storage | Local-first persistence |
| **Diagrams** | Mermaid + PlantUML | Render diagrams |
| **Search** | Fuse.js | Fuzzy library search |
| **Testing** | Vitest + fast-check | Property-based testing |
| **Types** | TypeScript 5.9 | Full type safety |

---

## Data Storage

### Storage Layers

1. **IndexedDB** - Full documents with content, embeddings
2. **Chrome Storage API** - Document metadata for fast listing
3. **In-Memory Cache** - Session-based embeddings cache

### Privacy & Security

- ✅ All data stays on your device (IndexedDB sandboxed per-origin)
- ✅ **BYOK model** - your AI key never reaches Notch servers
- ✅ No telemetry - no calls home
- ✅ Local embeddings - search queries never leave browser

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- API key from [Anthropic](https://console.anthropic.com/), [OpenRouter](https://openrouter.ai/), or [OpenCode](https://opencode.ai/)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-repo/notch.git
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
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `.output/chrome-mv3-dev`

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `.output/firefox-mv2-dev/manifest.json`

---

## Configuration

### Setting Up API Key

1. Get a key from [Anthropic](https://console.anthropic.com/), [OpenRouter](https://openrouter.ai/), or [OpenCode](https://opencode.ai/zen/v1)
2. Open extension **Settings**
3. Select your provider
4. Paste your API key
5. Select generation mode
6. Save

### Generation Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **FAST** | Quick captures | Summaries, RAG queries |
| **BALANCED** | Quality + speed | Default, research |
| **DEEP** | Best quality | Complex analysis |
| **LOCAL** | Offline NLP | No internet required |

### Offline Setup (Ollama)

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Pull a model
ollama pull mistral

# In Notch Settings, enable "Offline" mode
# Set endpoint to http://localhost:11434
```

---

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| `/` | Focus search (in library) |
| `Esc` | Close modals/clear search |

### Library
| Shortcut | Action |
|----------|--------|
| `j` / `↓` | Next document |
| `k` / `↑` | Previous document |
| `Enter` | Open selected document |
| `s` | Toggle star |
| `a` | Toggle archive |
| `d` | Delete document |

### Reader
| Shortcut | Action |
|----------|--------|
| `←` / `→` | Previous/Next document |
| `?` | Show keyboard help |

---

## Project Structure

```
notch/
├── src/
│   ├── entrypoints/
│   │   ├── popup/         # Capture popup UI (320x480px)
│   │   ├── reader/        # Dual-pane reader + RAG chat
│   │   ├── newtab/        # Library dashboard
│   │   ├── settings/      # Settings & configuration
│   │   ├── background.ts  # Service worker
│   │   └── content.ts    # Content script (injected)
│   ├── components/
│   │   ├── ChatPanel.tsx       # RAG chat interface
│   │   ├── MermaidBlock.tsx    # Mermaid renderer
│   │   ├── PlantUMLBlock.tsx   # PlantUML renderer
│   │   ├── UnifiedCodeNodeView.tsx
│   │   ├── EmptyState.tsx
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── ai-client.ts        # LLM API wrapper
│       ├── embedding-engine.ts # HF Transformers + ONNX
│       ├── retrieval.ts        # Cosine similarity RAG
│       ├── idb.ts             # IndexedDB helpers
│       ├── storage.ts         # chrome.storage wrapper
│       ├── export.ts          # Markdown/PDF export
│       ├── types.ts           # TypeScript types
│       ├── markdown-parser.ts # Markdown parsing
│       └── ...
├── public/
│   └── icon/               # Extension icons
├── wxt.config.ts           # WXT build config
├── tailwind.config.js      # Tailwind config
├── package.json
└── README.md
```

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (auto-rebuild)
npm run dev

# Type check
npm run compile

# Run tests
npm test

# Build for production
npm run build

# Build for Firefox
npm run build:firefox
```

---

## UX Improvements

The following UX enhancements are planned or in progress:

### Implemented
- ✅ Dynamic model fetching from OpenRouter/OpenCode APIs
- ✅ Folder organization with drag-and-drop
- ✅ Multiple view modes (compact/comfortable/detailed)
- ✅ Tag color customization
- ✅ Storage quota warnings
- ✅ PDF import with fallback parsing
- ✅ Export folders as ZIP

### Planned Enhancements

**Popup**
- [ ] Keyboard shortcuts display
- [ ] Capture progress indicator with detailed status
- [ ] Recent captures list (last 5 docs)
- [ ] Quick re-capture from history

**Library**
- [ ] Bulk selection (shift+click)
- [ ] Bulk operations (delete, archive, tag)
- [ ] Hover preview with document summary
- [ ] Document count stats
- [ ] Better drag-and-drop feedback

**Reader**
- [ ] Document navigation (previous/next)
- [ ] Scroll sync between panes
- [ ] Print-friendly view
- [ ] Citation click animation

**Settings**
- [ ] API key validation with status indicator
- [ ] Model pricing/quota info display
- [ ] Connection test button

**General**
- [ ] Toast notifications for actions
- [ ] Keyboard shortcuts help modal
- [ ] Better loading skeletons

---

## License

MIT © 2026 Notch Contributors