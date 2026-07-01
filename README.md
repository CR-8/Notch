# Notch — AI-Powered Knowledge Base for Web Content

> Capture, structure, and interrogate web content with your own AI keys. Build a permanent, queryable knowledge base from articles, documentation, and research — with full data ownership.

**Platform:** Chrome (MV3) + Firefox (MV2) browser extension

---

## Quick Start

```bash
git clone https://github.com/your-repo/notch.git
cd notch
npm install
npm run dev
```

Load `.output/chrome-mv3-dev` in `chrome://extensions` (developer mode).

---

## Features

- **One-click capture** from any webpage — AI extracts summaries, entities, concepts, timelines, and diagrams
- **Dual-pane reader** with original article + AI-structured notes side by side
- **RAG chat** — ask questions about any captured document with inline citations
- **Library dashboard** — searchable grid with tags, folders, star/archive, and multiple view modes
- **PDF import** with automatic research paper detection
- **On-device TTS** with Kokoro neural text-to-speech (multiple voices)
- **Diagram rendering** — Mermaid and PlantUML
- **Bring your own key** — OpenAI, Anthropic, Gemini, Ollama, or any OpenAI-compatible endpoint
- **Local-only mode** — all processing on-device with no network calls

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Technology Stack](#technology-stack)
3. [Data Storage & Privacy](#data-storage--privacy)
4. [Configuration](#configuration)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Project Structure](#project-structure)
7. [Development](#development)
8. [License](#license)

---

## Technology Stack

| Layer            | Technology                                  | Purpose                      |
| ---------------- | ------------------------------------------- | ---------------------------- |
| **Framework**    | [WXT](https://wxt.dev)                      | Vite-based extension builder |
| **UI**           | React 19 + Tailwind CSS v4 + shadcn/ui      | Component system             |
| **Markdown**     | marked + KaTeX + DOMPurify                  | Render and sanitize          |
| **AI**           | BYOK — OpenAI / Anthropic / Gemini / Ollama | LLM processing               |
| **On-device AI** | HuggingFace Transformers + ONNX             | Local embeddings + TTS       |
| **Storage**      | IndexedDB (Dexie) + chrome.storage          | Local-first persistence      |
| **Diagrams**     | Mermaid + PlantUML                          | Diagram rendering            |
| **Search**       | Fuse.js                                     | Fuzzy library search         |
| **Testing**      | Vitest + fast-check                         | Property-based testing       |

---

## Data Storage & Privacy

- **All data stays on your device** — IndexedDB sandboxed per extension origin
- **BYOK model** — your AI key is stored locally and sent only to your configured provider endpoint, never to Notch servers
- **No telemetry** — no calls home, no analytics, no tracking
- **Local embeddings** — search queries never leave the browser
- **Local-only lock** — forces all processing on-device with no network calls
- **Optional PlantUML rendering** — off by default; enable in Settings to send diagram source to `plantuml.com`

---

## Configuration

### API Key Setup

1. Get a key from [Anthropic](https://console.anthropic.com/), [OpenAI](https://platform.openai.com/), [OpenRouter](https://openrouter.ai/), or [Google Gemini](https://aistudio.google.com/)
2. Open extension **Settings** → select your provider → paste your key → save

### Generation Modes

| Mode         | Description     | Best For               |
| ------------ | --------------- | ---------------------- |
| **FAST**     | Quick captures  | Summaries, RAG queries |
| **BALANCED** | Quality + speed | Default, research      |
| **DEEP**     | Best quality    | Complex analysis       |
| **LOCAL**    | Offline NLP     | No internet required   |

### Offline Setup (Ollama)

```bash
ollama serve
ollama pull mistral
# Set endpoint to http://localhost:11434 in Notch Settings
```

---

## Keyboard Shortcuts

| Shortcut               | Action                 |
| ---------------------- | ---------------------- |
| `Alt+Shift+C` (global) | Capture current page   |
| `/`                    | Focus search           |
| `j` / `↓`              | Next document          |
| `k` / `↑`              | Previous document      |
| `s`                    | Toggle star            |
| `a`                    | Toggle archive         |
| `d`                    | Delete document        |
| `←` / `→` (reader)     | Previous/Next document |

---

## Project Structure

```
notch/
├── src/
│   ├── entrypoints/
│   │   ├── popup/         # Capture popup
│   │   ├── reader/        # Dual-pane reader + RAG chat
│   │   ├── newtab/        # Library dashboard
│   │   ├── settings/      # Settings
│   │   ├── welcome/       # Onboarding flow
│   │   ├── offscreen/     # Offscreen document
│   │   ├── background.ts  # Service worker
│   │   └── content.ts     # Content script
│   ├── components/
│   │   ├── ui/            # shadcn/ui primitives
│   │   ├── ChatPanel.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── storage.ts     # Dexie + chrome.storage wrapper
│   │   ├── pipeline.ts    # Capture pipeline
│   │   ├── on-device.ts   # Local embeddings/chat/TTS
│   │   ├── providers/     # AI provider adapters
│   │   ├── content-engine/# Structured content AST + rendering
│   │   ├── capture/       # Content classification + extraction
│   │   ├── tts.ts         # Kokoro TTS
│   │   └── ...
│   └── assets/
│       └── globals.css    # Tailwind + design tokens
├── public/
│   └── icon/
├── wxt.config.ts
├── eslint.config.js
└── package.json
```

---

## Development

```bash
# Install
npm install

# Dev server (auto-rebuild)
npm run dev

# Type check
npm run typecheck

# Lint + format
npm run lint
npm run format

# Run tests (111+ property-based tests)
npm test

# Build
npm run build
npm run build:firefox
```

### Scripts

| Script                  | Description                   |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Start Chrome dev server       |
| `npm run dev:firefox`   | Start Firefox dev server      |
| `npm run build`         | Production build for Chrome   |
| `npm run build:firefox` | Production build for Firefox  |
| `npm run typecheck`     | TypeScript type check         |
| `npm run lint`          | ESLint (zero warnings policy) |
| `npm run format`        | Prettier check                |
| `npm test`              | Vitest test suite             |
| `npm run zip`           | Package for Chrome Web Store  |
| `npm run zip:firefox`   | Package for Firefox Add-ons   |

---

## License

MIT © 2026 Notch Contributors
