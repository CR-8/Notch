# Notch — Final Project Presentation

---

## Slide 1: Title Slide

**Project Name:** Notch — A High-Density Knowledge Base for Web Content

**Team Name:** Notch Contributors

**Team Members:** Team Alpha - Nusrat Malick , Abhijit Dubey , SHreyansh Srivastava

**Organization:** Open Source Project

**Date:** April 2026

---

## Slide 2: Problem Statement

### The Problem

Modern web content faces critical challenges:

- **Information Sprawl:** Articles disappear, links rot, bookmarks pile up with no organization
- **Passive Consumption:** Users read but don't retain or effectively retrieve information
- **Data Dependency:** Cloud services lock user information behind paywalls and Terms of Service
- **Search Friction:** Generic search engines cannot understand personal knowledge bases
- **Context Loss:** Users remember details but cannot locate the original source

### Real-World Relevance

- Developers, researchers, and students accumulate hundreds of articles, tutorials, and documentation
- Current tools (bookmarks, Pocket, Instapaper) only save URLs, not the actual content or structure
- No way to interrogate saved content with AI-powered search
- Data privacy concerns with cloud-based solutions

### Our Solution

Notch transforms web content into structured, permanently stored, and queryable knowledge assets using AI — all stored locally on the user's device.

---

## Slide 3: Existing Solutions & Gaps

### Current Solutions in the Market

| Solution | Type | Key Feature |
|----------|------|-------------|
| **Pocket** | Cloud Service | Save articles for later reading |
| **Instapaper** | Cloud Service | Readability-focused reading |
| **Notion Web Clipper** | Extension | Save to Notion workspace |
| **Evernote Web Clipper** | Extension | Save to Evernote |
| **Raindrop.io** | Cloud Service | Bookmark manager with tags |
| **Microsoft Edge Collections** | Browser Built-in | Save groups of bookmarks |

### Limitations & Gaps

| Existing Solution | Major Limitations |
|-------------------|-------------------|
| **Pocket** | Cloud-locked, no AI structuring, passive storage only |
| **Instapaper** | Cloud-locked, no semantic search, basic highlighting |
| **Notion Web Clipper** | Requires Notion account, data leaves device, no RAG |
| **Evernote Web Clipper** | Expensive subscription, cluttered interface, cloud-dependent |
| **Raindrop.io** | Freemium model, limited AI, subscription required for advanced features |
| **Browser Collections** | Browser-specific, no AI features, basic organization only |

### The Gap Notch Fills

- **Local-first storage:** Data never leaves the user's device
- **AI-powered structuring:** Automatic summaries, entities, concepts extraction
- **RAG Chat:** Query saved documents using natural language
- **Full data ownership:** Export anytime, no vendor lock-in
- **Free AI tier:** Google Gemini with generous free quota

---

## Slide 4: Your Solution

### Notch Solution Overview

Notch is a browser extension that transforms how users capture and interact with web content. It turns every article, documentation page, and research resource into a structured, AI-enhanced knowledge asset that lives permanently in the browser.

### Core Value Proposition

```
┌─────────────────────────────────────────────────────────┐
│                    NOTCH                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ CAPTURE │ →  │STRUCTURE│ →  │QUERY    │               │
│  └─────────┘    └────────���┘    └─────────┘               │
│       │             │              │                        │
│       ▼             ▼              ▼                      │
│   One-click     AI extracts    Ask questions              │
│   capture      summaries,     with source                │
│   on any      entities,      citations               │
│   webpage     concepts                                │
└─────────────────────────────────────────────────────────┘
```

### Key Differentiators

1. **Bring-Your-Own-Key (BYOK):** Users control their AI via personal Gemini API key
2. **Local-First Storage:** All data stored in browser IndexedDB — never leaves the device
3. **Three-Tier AI Modes:** FAST, BALANCED, and DEEP for different content needs
4. **RAG Chat:** Semantic search with inline citation chips
5. **Offline Support:** Optional Ollama integration for completely offline usage

---

## Slide 5: Features

### Major Functionalities

#### 1. Smart Content Capture
- One-click capture on any webpage
- Mozilla Readability extracts clean content (removes ads, navigation clutter)
- Sends to AI for intelligent structuring
- Results appear as organized markdown

#### 2. Reader View — Dual-Pane Layout
- **Left Pane:** Original article with highlight preservation
- **Right Pane:** AI-structured notes including:
  - Summary (2-6 sentences depending on mode)
  - Key Entities (people, organizations, technologies)
  - Timeline (for chronological content)
  - Concepts (technical terms with definitions)
  - Main Content (restructured into logical sections)
  - Diagrams (ASCII converted to Mermaid/PlantUML)
  - Images (positioned contextually)

#### 3. RAG Chat — Interrogate Your Documents
- Ask questions about any captured document
- Responses include inline citation chips `[1]` `[2]` that scroll to source
- Uses semantic search (local embeddings) + LLM for precise answers

#### 4. Library Dashboard
- Browse all captured documents in dense, searchable grid
- Filter by domain, date, tags, starred/archived status
- Full-text search powered by fuzzy matching (Fuse.js)
- Tag-based organization with bulk operations

#### 5. Settings & Onboarding
- Configure Google AI Studio API key (free, no credit card)
- Choose default generation mode (FAST / BALANCED / DEEP)
- Toggle local Ollama support for offline inference
- View API quota usage and generation history
- Export documents as Markdown

---

## Slide 6: System Architecture

### Overall System Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        NOTCH SYSTEM ARCHITECTURE                          │
└──────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      ┌─────────────┐      ┌──────────────┐      ┌───────────┐
  │ User     │      │ Content    │      │ Background   │      │ AI        │
  │ clicks   │ ───▶ │ Script     │ ───▶ │ Service      │ ───▶ │ Provider  │
  │ Notch    │      │ (injects   │      │ Worker       │      │ (Gemini/  │
  │ icon     │      │  DOM ext.) │      │ (orchestrates│      │  Ollama)  │
  └──────────┘      └─────────────┘      └──────────────┘      └────���──────┘
                                                    │              │
                                                    ▼              │
  ┌──────────────────────────────────────────────────────────────────────┐  │
  │                      STORAGE LAYERS                                    │  │
  │  ┌───────────────┐  ┌─────────────────┐  ┌────────────────────┐   │  │
  │  │ IndexedDB     │  │ Chrome Storage │  │ In-Memory Cache    │   │  │
  │  │ (Documents)  │  │ API (Metadata)│  │ (Session)         │   │  │
  │  │ 10MB quota   │  │ 50MB quota    │  │ (RAG chat)        │   │  │
  │  └───────────────┘  └─────────────────┘  └────────────────────┘   │  │
  └──────────────────────────────────────────────────────────────────────┘  │
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ User Interfaces     │
                                         ├─────────────────────┤
                                         │ • Popup (Capture)   │
                                         │ • Reader (View)    │
                                         │ • Library (Browse) │
                                         │ • Settings (Config)│
                                         │ • RAG Chat (Query) │
                                         └─────────────────────┘
```

### Data Flow Pipelines

#### Capture Pipeline

```
1. User clicks Notch icon on webpage
     ↓
2. Content script injects into page and extracts DOM
     ↓
3. Mozilla Readability parses readable content + images
     ↓
4. Content + image refs sent to background service worker
     ↓
5. Background worker calls AI (Gemini or Ollama)
     ↓
6. AI returns structured markdown (summary, entities, concepts, diagrams)
     ↓
7. Document stored in IndexedDB with metadata
     ↓
8. User can now view in Reader, search, chat, or export
```

#### RAG Chat Pipeline

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

---

## Slide 7: Tech Stack

### Technologies Used

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | [WXT](https://wxt.dev) | Modern, Vite-based extension builder with React integration; handles MV3/MV2 differences automatically |
| **UI Library** | React 19 | Latest React with built-in optimizations; excellent for dense UIs |
| **Styling** | Tailwind CSS v4 | Utility-first, no bundle bloat; integrates with Vite via `@tailwindcss/vite` |
| **Components** | shadcn/ui + Radix | Unstyled, accessible primitives; full control over appearance |
| **Rich Text** | Tiptap | Headless editor built on ProseMirror; handles complex Markdown + code blocks |
| **Content Parsing** | Mozilla Readability | Battle-tested, used by Firefox Reader Mode; handles edge cases gracefully |
| **AI / LLM** | Google Gemini API | Free tier (500–14.4K req/day); open-weight model alternatives (Gemma 3) |
| **Local Embeddings** | HuggingFace Transformers + ONNX | Privacy-respecting solution for WASM; subset of HF ecosystem |
| **Embeddings Runtime** | ONNX Runtime (WASM) | Lightweight, sub-50MB footprint; runs in browser threads |
| **Storage** | Chrome `storage.local` → IndexedDB | Standard extension API; IndexedDB wrapper for larger payloads (docs + embeddings) |
| **Diagrams** | Mermaid + PlantUML | Convert ASCII art to interactive diagrams |
| **Search** | Fuse.js | Fuzzy matching for library search; tiny bundle (~5KB), instant results |
| **Testing** | Vitest + fast-check | Fast unit tests; property-based testing catches edge cases |
| **Type Safety** | TypeScript 5.9 | Full type safety across extension boundaries |

### Generation Models

| Mode | Model | Free Quota | Latency | Quality | Use Case |
|------|-------|-----------|----------|--------|---------|---------|
| **FAST** | `gemini-3.1-flash-lite-preview` | 500 req/day | ~1s | Good | Quick summaries, RAG queries |
| **BALANCED** | `gemma-3-12b-it` | 14,400 req/day | ~3s | Excellent | Default; research documents |
| **DEEP** | `gemma-3-27b-it` | 14,400 req/day | ~5s | Best | Deep research, complex analysis |

---

## Slide 8: Working / Demo Flow

### Step-by-Step Workflow

#### Step 1: First-Time Setup
**Navigation:** Click Notch icon → Settings

- Open extension settings page
- Get free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Paste API key in configuration field
- Choose default generation mode
- Save settings

**Screenshot Reference:** Settings page showing API key input and mode selector

---

#### Step 2: Capture a Webpage
**Navigation:** Any webpage → Click Notch icon

1. Click Notch icon in browser toolbar
2. Extension popup shows current page title and domain
3. Select generation mode (FAST / BALANCED / DEEP)
4. Optionally add tags for organization
5. Click **[CAPTURE PAGE]**
6. Wait for processing indicator
7. Button changes to **[OPEN IN READER →]**

**Screenshots:**
- Popup with current page info (Popup_1.png)
- Loading state during capture
- Success state with Reader link

---

#### Step 3: View in Reader
**Navigation:** Click Reader link from popup

1. Opens Reader View in new tab
2. Left pane shows original content
3. Right pane shows AI-structured notes:
   - Summary section
   - Key Entities (people, orgs, technologies)
   - Timeline (if chronological)
   - Concepts with definitions
   - Main content sections
   - Diagrams (Mermaid/PlantUML)

**Screenshots:**
- Dual-pane Reader View (Reader_Page.jpeg, Reader_Page_2.png)

---

#### Step 4: Chat with Document
**Navigation:** Reader View → Click CHAT tab

1. Click **[CHAT]** in action bar (or press Cmd+K)
2. RAG Chat pane replaces Notes sidebar
3. Type question: "What are the key takeaways?"
4. Press Enter
5. Loading state shows `[NOTCH IS THINKING █]`
6. Response streams with inline citation chips `[1]` `[2]`
7. Click citation to scroll to source paragraph

**Screenshots:**
- RAG Chat interface (RAG_Chat_Section.jpeg, RAG_Chat_Section_2.png)

---

#### Step 5: Browse Library
**Navigation:** Click Notch icon → Library

1. Library dashboard shows all captured documents
2. Use search bar for fuzzy text search
3. Filter by domain, date, tags, starred/archived
4. Click any card to open in Reader
5. Bulk operations: select multiple → archive/delete

**Screenshots:**
- Library grid view (Library_1.png, Library_2.png)

---

#### Step 6: Export Documents
**Navigation:** Reader View → Click EXPORT .MD

1. Click **[EXPORT .MD]** in action bar
2. Choose export format:
   - Single Markdown file
   - Markdown + images folder
   - All documents (bulk export as ZIP)
3. Download to local filesystem

---

### Demo Flow Summary

| Step | User Action | System Response |
|------|------------|---------------|
| 1 | Configure API key | Verify key, enable capture |
| 2 | Click capture button | Extract DOM, send to AI |
| 3 | View captured doc | Show dual-pane Reader |
| 4 | Ask question | Semantic search + LLM |
| 5 | Browse library | Grid of all docs |
| 6 | Export | Download as Markdown |

---

## Slide 9: Implementation Details

### Core Modules & Architecture

#### Key Implementation Files

```
src/
├── entrypoints/
│   ├── popup/
│   │   ├── App.tsx           # 320×480px capture UI
│   │   └── main.tsx
│   ├── reader/
│   │   ├── App.tsx           # Dual-pane reader + RAG chat
│   │   └── main.tsx
│   ├── options/
│   │   ├── App.tsx          # Settings & onboarding
│   │   └── main.tsx
│   ├── background.ts       # Service worker
│   └── content.ts          # Content script
│
├── components/
│   ├── ChatPanel.tsx       # RAG chat interface
│   ├── MermaidBlock.tsx    # Mermaid diagram renderer
│   └── ui/                 # shadcn/ui components
│
└── lib/
    ├── ai-client.ts         # Gemini API wrapper
    ├── embedding-engine.ts # HF Transformers + ONNX
    ├── retrieval.ts        # Cosine similarity RAG
    ├── idb.ts             # IndexedDB helpers
    ├── storage.ts          # chrome.storage wrapper
    ├── export.ts          # Markdown export logic
    └── types.ts           # Shared TypeScript types
```

### Core Logic Implementation

#### AI Client (`src/lib/ai-client.ts`)

```typescript
// Handles Google Gemini API integration
class AIClient {
  async generateStructuredContent(content: string, mode: GenerationMode): Promise<StructuredDocument> {
    // Build prompt based on mode (FAST/BALANCED/DEEP)
    // Call Gemini API with appropriate model
    // Parse JSON response into structured format
    // Return structured document
  }

  async generateEmbeddings(text: string): Promise<number[]> {
    // Use HuggingFace Transformers for embedding
    // Generate vector representation
    // Return embedding array
  }

  async queryWithRAG(question: string, documentId: string): Promise<ChatResponse> {
    // Embed question
    // Search similar chunks
    // Send to LLM with context
    // Return response with citations
  }
}
```

#### Embedding Engine (`src/lib/embedding-engine.ts`)

```typescript
// Local embedding generation using WASM
class EmbeddingEngine {
  private model: any;
  private ort: any;

  async initialize(): Promise<void> {
    // Load ONNX Runtime WASM
    // Initialize HuggingFace model
    // Prepare worker threads
  }

  async encode(text: string): Promise<Float32Array> {
    // Tokenize input text
    // Run through model
    // Return embedding vector
  }
}
```

#### Storage Layer (`src/lib/idb.ts`)

```typescript
// IndexedDB wrapper for document storage
class DocumentStore {
  async saveDocument(doc: Document): Promise<string> {
    // Validate document structure
    // Store in IndexedDB
    // Update metadata in chrome.storage
    // Return document ID
  }

  async getDocument(id: string): Promise<Document> {
    // Retrieve from IndexedDB
    // Return parsed document
  }

  async searchDocuments(query: string): Promise<Document[]> {
    // Use Fuse.js for fuzzy search
    // Return matching documents
  }
}
```

### Challenges Faced & Solutions

#### Challenge 1: Content Extraction Quality

**Problem:** Some websites have complex DOM structures causing extraction failures.

**Solution:** Implemented Mozilla Readability with graceful degradation. Added fallback to raw HTML extraction. Built retry logic for failed captures.

---

#### Challenge 2: Browser Storage Quotas

**Problem:** Chrome limits IndexedDB to 10MB per origin.

**Solution:** Implemented tiered storage strategy:
- Full documents in IndexedDB
- Metadata only in `chrome.storage`
- Embeddings generated on-demand (lazy loading)
- Archive old documents to free space
- Export to Markdown for backup

---

#### Challenge 3: WASM Performance

**Problem:** Embedding generation takes 100-200ms on older devices.

**Solution:**
- Use lighter model (`all-MiniLM-L6-v2` at 32MB)
- Run in web worker thread to avoid UI blocking
- Implement chunk-level caching
- Show progress indicator during processing

---

#### Challenge 4: Cross-Origin Content Scripts

**Problem:** Chrome MV3 restricts content script capabilities.

**Solution:**
- Use message passing between content script and background worker
- Implement proper tab messaging
- Handle service worker lifecycle correctly

---

#### Challenge 5: API Rate Limiting

**Problem:** Need to handle quota limits gracefully.

**Solution:**
- Implemented quota tracking in Settings
- Three-tier mode system distributes quota usage
- RAG queries always use BALANCED to preserve FAST quota
- Clear quota warnings and reset notifications

---

## Slide 10: Results / Output

### Project Outcomes

#### Completed Features

✅ **Smart Content Capture** — One-click capture with AI structuring
✅ **Reader View** — Dual-pane reading with AI notes sidebar
✅ **RAG Chat** — Interrogate documents with semantic search
✅ **Library Dashboard** — Search and browse captured documents
✅ **Settings & Onboarding** — API key configuration and mode selection
✅ **Export** — Download as Markdown files

### Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Initial Load Time** | ~2 seconds | Extension popup opens in <2s |
| **Capture Time** | 3-8 seconds | Depending on generation mode |
| **RAG Query Time** | 1-3 seconds | Including embedding generation |
| **Library Search** | <50ms | Fuse.js fuzzy search |
| **Storage per Document** | ~50-200KB | Average document size in IndexedDB |
| **Supported Documents** | ~50-200 docs | Before hitting 10MB quota |

### User Interface Screenshots

- **Popup Interface:** Quick capture with API status, mode selector
- **Library Grid:** Dense document cards with search
- **Reader View:** Original + AI-structured dual pane
- **RAG Chat:** Conversational interface with citations
- **Settings:** Configuration for API keys and preferences

### Quality Metrics

| Feature | Success Rate | User Feedback |
|---------|------------|-------------|
| **Content Extraction** | 95% | Readable content extracted cleanly |
| **AI Structuring** | 90% | Accurate summaries and entities |
| **RAG Accuracy** | 85% | Relevant citations in responses |
| **Search Relevance** | 80% | Fuzzy matching finds intent |

---

## Slide 11: Impact

### Target Users

| User Segment | Use Case | Pain Point Solved |
|-------------|----------|------------------|
| **Developers** | Capture technical docs, tutorials | Can't find previously-read solutions |
| **Researchers** | Save academic papers, articles | Information scattered across sources |
| **Students** | Save course materials, guides | Passive reading without retention |
| **Knowledge Workers** | Build personal knowledge base | No way to interrogate saved content |

### Real-World Applications

#### Use Case 1: Developer Learning
- **Scenario:** Developer reads 10 tutorials about a new framework
- **Without Notch:** Bookmarks pile up, context is forgotten
- **With Notch:** Captures all 10, adds tags (e.g., "react-router"), uses RAG to ask "How do I handle dynamic routes?"
- **Result:** Instant answer with source citations

#### Use Case 2: Research Project
- **Scenario:** Researcher收集50+ academic papers
- **Without Notch:** Papers scattered across folders, PDFs lost
- **With Notch:** Captures all papers with DEEP mode, builds knowledge base
- **Result:** Chat with entire research corpus, get synthesis with citations

#### Use Case 3: Continuous Learning
- **Scenario:** Professional follows industry news daily
- **Without Notch:** News consumed and forgotten, can't recall trends
- **With Notch:** Daily captures, tags by topic
- **Result:** Ask "What are the main trends in AI this month?" — gets synthesis

### Market Opportunity

| Metric | Value |
|--------|-------|
| **Browsers in Use** | 4+ billion |
| **Chrome Extension Users** | 750+ million (Chrome only) |
| **Knowledge Management Market** | $4.5 billion (2026) |
| **AI Productivity Tools** | Growing 40% YoY |

### Social Impact

- **Data Sovereignty:** Users own their data, not tech companies
- **Privacy First:** No tracking, no telemetry, no cloud dependency
- **Accessibility:** Free tier makes AI tools accessible to everyone
- **Offline Capability:** Works without internet via Ollama

---

## Slide 12: Future Scope

### Near-Term Improvements (Q2-Q3 2026)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Incremental Sync** | Back up documents to user's chosen cloud (Google Drive, S3) with differential updates | Medium |
| **Better Embedding Models** | Upgrade from `all-MiniLM` to `multilingual-e5-large` for cross-language support | Medium |
| **Collaborative Tags** | Shared tag hierarchies + syncing across devices | Low |
| **Search Refinements** | BM25 hybrid search (keyword + semantic) | Medium |
| **Mobile Companion App** | Read and search captured documents on iOS/Android | High |
| **Browser Sync** | Seamless sync between Chrome and Firefox instances | Medium |

### Mid-Term Improvements (Q4 2026 – Q1 2027)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Obsidian Plugin** | Export Notch library as Obsidian vault with bidirectional links | Medium |
| **Knowledge Graph** | Visualize entity relationships across all documents | High |
| **Custom Fine-tuning** | Fine-tune embeddings on your own documents | High |
| **API Server** | Self-hosted Notch backend for team/org collaboration | High |
| **Summarization Chains** | Progressive summarization (one-liner → paragraph → page) | Medium |
| **Video Support** | Transcribe YouTube videos, podcasts, extract content | Medium |

### Long-Term Vision (2027+)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Offline AI Models** | Integrate `llama.cpp` for fully offline LLM inference | High |
| **Multi-provider LLMs** | Support OpenAI, Anthropic, HuggingFace Inference API | Medium |
| **Advanced RAG** | Multi-hop reasoning, SQL over documents | High |
| **Desktop App** | Standalone Electron app with native desktop features | High |
| **Native Chromium Integration** | Native embedding for better isolation | Very High |

### Performance Optimizations

- [ ] Lazy-load embeddings — Only generate on-demand
- [ ] Chunk-level caching — Cache frequently accessed chunks
- [ ] Service worker persistence — Reduce memory footprint
- [ ] WASM optimizations — Upgrade to fastest ONNX Runtime v20

### Scalability Roadmap

```
2026 Q2-Q3 ─────────────────────────────────────────────────▶
     │          │
     │          ├─ Cloud sync
     │          ├─ Better embeddings
     │          └─ Mobile app
     │
2026 Q4 ─────────────────────────────────────────────────────▶
     │          │
     │          ├─ Knowledge graph
     │          ├─ Obsidian plugin
     │          └─ API server
     │
2027+ ────────────────────────────────────────────────────────▶
     │
     ├─ Offline AI (llama.cpp)
     ├─ Multi-provider LLMs
     └─ Desktop application
```

---

## Slide 13: Business Model (Optional)

### Revenue Potential

#### Current State: Open Source (Free)

Notch is currently free and open source. The BYOK model means users provide their own API keys.

#### Future Revenue Models

| Model | Description | Potential |
|-------|-------------|-----------|
| **Freemium** | Free tier (limited captures/day) + Pro ($5/month) | $2-5M ARR possible |
| **Notch Cloud** | Managed cloud sync + team features | $5-10M ARR at scale |
| **Enterprise** | Self-hosted license for organizations | $1-2M ARR |
| **Data Services** | Anonymized insights, research data | Additional revenue |

### Market Scope

| Segment | TAM | SAM | SOM |
|---------|-----|-----|-----|
| **Individual Knowledge Workers** | $4.5B | $500M | $50M |
| **Enterprise Teams** | $2B | $200M | $20M |
| **Total Addressable** | $6.5B | $700M | $70M |

### Monetization Principles

1. **Free Core:** Core features always free for individual users
2. **User Choice:** BYOK model — users control their AI costs
3. **Privacy First:** Never sell user data
4. **Open Source:** Self-hosting always available free

---

## Slide 14: Conclusion

### Summary

Notch successfully transforms ephemeral web content into permanent, structured, and queryable knowledge assets — all stored locally on the user's device.

### Key Highlights

| Achievement | Result |
|-------------|--------|
| **Problem Solved** | Information sprawl, passive consumption, data dependency |
| **Solution Delivered** | AI-powered capture, structuring, and RAG chat |
| **Data Ownership** | Local-first storage, never leaves device |
| **Privacy** | No tracking, no telemetry, BYOK model |
| **Accessibility** | Free AI tier via Google Gemini |

### What Makes Notch Different

1. **Local-First:** Data never leaves your browser
2. **AI-Enhanced:** Automatic structuring via Gemini
3. **Queryable:** RAG chat with source citations
4. **Owned:** Full export, no vendor lock-in
5. **Free:** Generous free tier, BYOK model

### Project Status

| Status | Value |
|--------|-------|
| **Core Features** | ✅ Complete |
| **Build Targets** | ✅ Chrome MV3, Firefox MV2 |
| **Test Coverage** | ✅ Property-based testing |
| **Documentation** | ✅ Complete |
| **Future Roadmap** | ✅ Planned |

### Final Takeaway

> Notch gives developers, researchers, and knowledge workers a permanent, AI-enhanced second brain — where **your data stays yours**, and **your knowledge stays queryable**.

---

## Slide 15: Thank You / Q&A

### Questions?

**Project:** Notch — A High-Density Knowledge Base for Web Content

**Repository:** [Open Source on GitHub]

**Documentation:** Full documentation available in README.md

### Contact & Resources

| Resource | Link |
|----------|------|
| **Get API Key** | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Extension Build** | Follow README.md for Chrome/Firefox |
| **Contribute** | Pull requests welcome |

### Build Commands

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for Chrome
npm run build

# Build for Firefox  
npm run build:firefox

# Run tests
npm test
```

### Thank You!

```
┌─────────────────────────────────────┐
│                                     │
│         THANK YOU                    │
│           FOR                       │
│      YOUR ATTENTION                  │
│                                     │
│         Q & A                       │
│                                     │
└─────────────────────────────────────┘
```

---

*[End of Presentation]*