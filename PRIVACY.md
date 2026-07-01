# Notch — Privacy Policy

_Last updated: 2026-06-27_

Notch is a **local-first, bring-your-own-key (BYOK)** browser extension. It is built so that your data stays on your device and is only ever sent to services **you** explicitly configure. Notch has **no backend server**, performs **no analytics or telemetry**, and **never** sends your data to the developers.

## What Notch stores, and where

All of the following is stored **locally on your device** (browser `IndexedDB` and `browser.storage.local`). None of it is transmitted to Notch or any third party except as described under "Network connections" below.

| Data                                                | Purpose                                             | Location                                          |
| --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| Captured page content, summaries, notes, highlights | The knowledge base you build                        | IndexedDB (`notch_db`)                            |
| Embeddings / search index                           | Semantic & full-text search                         | IndexedDB                                         |
| Provider API keys                                   | Authenticating to the AI provider **you** configure | IndexedDB / `browser.storage.local` (unencrypted) |
| Settings & appearance                               | Your preferences                                    | `browser.storage.local`                           |

**API keys are stored unencrypted in the browser's local database.** Anyone with access to your browser profile can read them. Clear them at any time in **Settings → Providers → Clear all API keys**, or remove an individual provider.

## Network connections

Notch only makes network requests in these cases, all driven by your actions or configuration:

1. **Your AI provider** — When you capture or chat (and are not in local-only/on-device mode), the relevant page content and your prompt are sent to the AI provider endpoint **you** configured (e.g. OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, or any OpenAI-compatible/Ollama endpoint), authenticated with your key. Notch does not proxy or see this traffic.
2. **On-device model downloads (opt-in)** — If you enable On-Device AI and choose a model, the model weights are downloaded **on demand** from the Hugging Face Hub (`huggingface.co`). Models are **not** bundled in the extension. Nothing is sent — only downloaded.
3. **Capturing arXiv / Semantic Scholar pages** — When you capture one of these pages, Notch fetches the corresponding PDF from `arxiv.org` / `semanticscholar.org` to extract its text.
4. **Media thumbnails** — Capturing a page with embedded YouTube content may load thumbnails from `img.youtube.com`.
5. **PDF export styling** — Exporting a document to PDF loads the KaTeX math stylesheet from `cdn.jsdelivr.net` into the print document.
6. **Remote PlantUML diagrams (opt-in, off by default)** — Only if you explicitly enable it in Settings, PlantUML diagram source is sent to `plantuml.com` to render an image. Disabled by default; always suppressed when the **Local-only lock** is on.

When the **Local-only lock** is enabled in Settings, Notch performs **no network calls at all** — capture and chat use the bundled offline NLP and any installed on-device models.

## What Notch does NOT do

- ❌ No analytics, telemetry, tracking, or "phone-home" of any kind.
- ❌ No advertising or selling of data.
- ❌ No remote code execution — all executable code is packaged in the extension.
- ❌ No transmission of your content or keys to the developers or any server we operate.

## Your control over your data

- Delete any captured document from the Library at any time.
- Clear all stored API keys in **Settings → Providers**.
- Uninstalling the extension removes all locally stored data.

## Permissions

- `storage` — persist your knowledge base and settings locally.
- `tabs` / `activeTab` — read the current page when you ask Notch to capture it.
- `scripting` (Chrome) — inject the extraction logic into the page you are capturing.
- `contextMenus` (Chrome) — the right-click "Capture with Notch" entry.
- `host_permissions` (`*://*/*`) — capture works on any site you choose; the content script only runs to extract a page when you invoke capture.
- `debugger` + `downloads` (Chrome, **optional**) — requested only when you use one-click PDF export, never at install time.

## Contact

For privacy questions, open an issue on the project repository.
