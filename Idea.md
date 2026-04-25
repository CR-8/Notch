# Notch - Full Desktop Experience

## Product Overview

**The Pitch:** Notch is a high-density, brutalist web reader and 
second brain. It captures, parses, and interrogates web content 
via a Bring-Your-Own-Keys (BYOK) architecture, transforming 
ephemeral articles, documentation, and AI chat threads into 
structured, permanent knowledge.

**For:** Developers, students, and researchers who prioritize 
speed, data ownership, and high-information-density interfaces 
over friendly, consumer-grade aesthetics.

**Device:** desktop

**Design Direction:** High contrast dark mode, zero-radius 
corners, highly structured grid-based layouts with visible 1px 
borders everywhere. Terminal-inspired, but heavily typographic.

**Inspired by:** Linear, Vercel Dashboard, classic Swiss grid 
posters.

---

## Screens

- **Extension Popup:** Quick capture interface with live API 
  status, generation mode selector, and tag input.
- **Library Dashboard:** Dense, filterable grid of all captured 
  documents with sidebar navigation.
- **Reader View:** Dual-pane reading environment separating 
  original content from AI-generated structure.
- **RAG Chat Pane:** Sidebar for interrogating the active 
  document via semantic search and LLM.
- **Settings & Onboarding:** Central hub for API key 
  configuration, quickstart guide, and generation mode tuning.

---

## Key Flows

**Capture and Read:** User saves a page for deep processing.

1. User is on any webpage -> clicks Notch extension icon
2. Extension popup opens -> shows current page title and domain
3. User selects generation mode `[FAST]` `[DEEP]` `[LOCAL]`
4. User clicks **[CAPTURE PAGE]** -> parsing initiates, 
   API status dots glow violet
5. Button changes to **[OPEN IN READER →]** on success
6. User clicks -> lands on Reader View with structured notes 
   alongside original content

**Query Knowledge:** User chats with a captured document.

1. User is on **Reader View** -> clicks **[CHAT]** in action bar
   or presses `Cmd+K`
2. RAG Chat Pane replaces the Notes sidebar
3. User types "What are the key takeaways?" -> hits `Enter`
4. `[NOTCH IS THINKING █]` loading state appears
5. Response streams in with inline citation chips `[1]` `[2]`
6. Clicking a citation scrolls left pane to source paragraph

---

<details>
<summary>Design System</summary>

## Color Palette

- **Primary:** `#5E6AD2` - Violet for primary actions, active 
  states, focus rings, hover borders
- **Background:** `#000000` - Pure black base for all screens
- **Surface:** `#0F0F0F` - Cards, panels, sidebars, inputs
- **Text:** `#EAEAEA` - High-legibility off-white for body text
- **Muted:** `#666666` - Metadata, timestamps, inactive labels
- **Danger:** `#FF3366` - Errors and destructive actions only
- **Border:** `#222222` - Universal structural divider

## Typography

- **Headings:** `Space Grotesk`, 700, 24–32px, tracking -0.02em
- **Body (Prose):** `Inter Tight`, 400, 16px, line-height 1.6
- **UI & Labels:** `JetBrains Mono`, 400, 12–14px, UPPERCASE
- **Buttons:** `JetBrains Mono`, 600, 13px, UPPERCASE, 
  tracking 0.05em

**Style notes:**
- `0px` border radius everywhere. Everything is a sharp box.
- Borders are universally `1px solid #222222`.
- Active elements get `2px solid #5E6AD2` border.
- Focus states: `box-shadow: 0 0 0 1px #5E6AD2`.
- Hover: border shifts to `#5E6AD2`, no background fill change.
- No drop shadows anywhere.
- Skeleton loading: `linear-gradient(#0F0F0F, #1A1A1A)`.

## Design Tokens

```css
:root {
  --color-primary: #5E6AD2;
  --color-background: #000000;
  --color-surface: #0F0F0F;
  --color-text: #EAEAEA;
  --color-muted: #666666;
  --color-border: #222222;
  --color-danger: #FF3366;
  --font-headings: 'Space Grotesk', sans-serif;
  --font-body: 'Inter Tight', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 0px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --border-struct: 1px solid var(--color-border);
}
```

</details>

---

<details>
<summary>Screen Specifications</summary>

### Extension Popup

**Purpose:** Rapid capture of the current active browser tab 
with API health checks, mode selection, and tagging.

**Layout:** 320px wide × 480px tall fixed box. Horizontal zones 
separated by 1px `#222222` borders.

**Key Elements:**
- **Header Zone:** `NOTCH` wordmark in `JetBrains Mono` 13px 
  bold left-aligned. Right side: 3 square 6×6px status dots 
  labeled `OAI` `ANT` `GEM` in `JetBrains Mono` 10px `#666666` 
  below each. Dot color: `#5E6AD2` if key configured, 
  `#FF3366` if missing.
- **Page Context Zone:** `CURRENT PAGE` label `JetBrains Mono` 
  10px `#666666`. Page title below in `JetBrains Mono` 12px 
  `#EAEAEA` truncated with ellipsis. Domain in 
  `JetBrains Mono` 10px `#666666`.
- **API Key Input:** `API CONFIGURATION` label. Single password 
  input, 40px height, `#0F0F0F` background, `1px #222222` 
  border, placeholder `PASTE API KEY...` in `JetBrains Mono`.
- **Generation Mode Selector:** `MODE` label. 3 horizontal 
  bordered boxes: `[FAST]` `[DEEP]` `[LOCAL]` in 
  `JetBrains Mono` 11px. Active mode: `#5E6AD2` border and 
  text color.
- **Tag Input:** `TAGS` label. Borderless input `Space Grotesk` 
  14px, placeholder `add tags, press enter...`. Tags render 
  as square chips with `1px #222222` border.
- **Capture Button:** Full-width sticky bottom, 48px height, 
  `#5E6AD2` background, `#000000` text, 
  `JetBrains Mono` 600 uppercase `[ CAPTURE PAGE ]`.

**States:**
- **Loading:** Button text → `[ PARSING... ]`, pulsing opacity 
  CSS animation.
- **Success:** Button bg → `#0F0F0F`, text → 
  `[ OPEN IN READER → ]`.
- **Error:** Button border → `#FF3366`, text → 
  `[ ERROR — RETRY ]`.

**Interactions:**
- **Focus Input:** Border shifts to `#5E6AD2`, subtle glow.
- **Hover Button:** Opacity drops to `0.85`.
- **Mode Select:** Clicked mode box gets `2px #5E6AD2` border.

---

### Library Dashboard

**Purpose:** Main directory of all captured documents. High 
information density with navigation and filtering.

**Layout:** Full screen. Left sidebar `240px` fixed, main 
content area fills remaining width.

**Key Elements:**
- **Sidebar:** `NOTCH` wordmark top, `Space Grotesk` 700 18px + 
  `BETA` chip in `JetBrains Mono` 9px `#666666`. Nav items: 
  `[LIBRARY]` `[FAVORITES]` `[ARCHIVE]` `[SETTINGS]` each 
  48px tall, `1px #222222` bottom border, `JetBrains Mono` 
  12px uppercase. Active: `2px left border #5E6AD2`, 
  text `#EAEAEA`. Inactive: `#666666`.
- **Control Bar:** 56px tall, `1px #222222` bottom border. 
  Left: search input `400px` wide, border-bottom only, 
  `JetBrains Mono` placeholder `SEARCH YOUR LIBRARY...`. 
  Right: sort dropdown `SORT: RECENT ↓` `JetBrains Mono` 12px.
- **Article Card:** `0px` radius, `1px #222222` border, 
  `#0F0F0F` background.
  - Title area: `Space Grotesk` 600 16px `#EAEAEA`, 2 lines max.
  - Metadata row: domain • word count • date in 
    `JetBrains Mono` 11px `#666666`.
  - Tag chips: square, `1px #222222` border, `#0F0F0F` bg, 
    `JetBrains Mono` 10px.
- **Hover State:** Card border → `#5E6AD2`, bg → `#000000`.
- **Click Card:** Navigates to Reader View.

**States:**
- **Empty:** `NO DOCUMENTS FOUND. CAPTURE SOMETHING.` centered, 
  `Space Grotesk` 24px `#222222`.
- **Loading:** Skeleton card grid, `#0F0F0F` blocks pulsing 
  to `#1A1A1A`.

---

### Reader View

**Purpose:** Distraction-free reading with AI-generated 
structural notes in a persistent sidebar.

**Layout:** 70/30 horizontal split. Left pane original content, 
right pane AI notes. `1px #222222` vertical divider.

**Key Elements:**
- **Top Bar:** 48px height, `1px #222222` bottom border. 
  Left: breadcrumb `LIBRARY / [ARTICLE TITLE]` in 
  `JetBrains Mono` 12px, muted / white. Right: action tabs 
  `[NOTES]` `[CHAT]` `[EXPORT .MD]` each `1px #222222` border, 
  32px height. Active tab: `2px #5E6AD2` border + text.
- **Left Pane Content:** `#000000` bg, inner max-width `65ch` 
  centered. Title: `Space Grotesk` 700 32px. Author + date: 
  `JetBrains Mono` 12px `#666666`. Body: `Inter Tight` 400 
  16px `#EAEAEA` line-height 1.6. Paragraph spacing 24px.
- **Text Selection Tooltip:** On highlight, small floating box 
  appears: `[ HIGHLIGHT ]` `[ ASK AI ]` in `JetBrains Mono` 
  11px, `1px #222222` border, `#0F0F0F` bg.
- **Right Pane Notes:** `#0F0F0F` bg. `AI NOTES` label top. 
  Structured boxes for `SUMMARY` `KEY ENTITIES` `TIMELINE` 
  `CONCEPTS` — each in `1px #222222` border container. 
  Section label: `JetBrains Mono` 10px `#5E6AD2`. 
  Content: `Inter Tight` 14px `#EAEAEA`.

**States:**
- **Loading:** Skeleton text lines `linear-gradient 
  #0F0F0F → #1A1A1A` pulsing.

**Interactions:**
- **Scroll:** Right pane stays sticky.
- **Click [CHAT]:** Right pane transitions to RAG Chat Pane.
- **Click [ASK AI]:** Opens RAG Chat with selected text 
  pre-filled as context.
- **Click Note Entity:** Highlights linked paragraph in left 
  pane at `#5E6AD2` 20% opacity background.

---

### RAG Chat Pane

**Purpose:** Conversational interface for querying the active 
captured document using RAG and LLM.

**Layout:** Replaces right pane (30%) in Reader View. Top: 
scrollable chat history. Bottom: fixed input area.

**Key Elements:**
- **Context Pill:** Top of pane. `CHATTING WITH:` 
  `JetBrains Mono` 10px `#666666`. Article title: 
  `JetBrains Mono` 10px `#5E6AD2`. `1px #222222` bottom border.
- **User Bubble:** Right-aligned. `#0F0F0F` bg, `1px #222222` 
  border, 12px padding. Header: `[USER]` `JetBrains Mono` 
  10px `#666666`. Text: `Inter Tight` 14px `#EAEAEA`.
- **AI Bubble:** Left-aligned. No background. Header: `[NOTCH]` 
  `JetBrains Mono` 10px `#5E6AD2`. Text: `Inter Tight` 14px 
  `#EAEAEA`. Inline citation chips: `[1]` `[2]` — square, 
  `#0F0F0F` bg, `#5E6AD2` text, `1px` border. Clicking scrolls 
  left pane to source paragraph.
- **Input Area:** Fixed bottom, 72px height, `1px #222222` 
  top border. Multiline input full width, `#000000` bg, 
  `JetBrains Mono` 13px, placeholder `ASK ABOUT THIS 
  DOCUMENT...`. Submit `→` icon right-aligned in `#5E6AD2`.

**States:**
- **Loading:** `[NOTCH IS THINKING █]` with blinking cursor 
  block in `#5E6AD2`.
- **Error:** `[CONNECTION FAILED]` in `#FF3366`.

**Interactions:**
- **Press Enter:** Clears input, appends user bubble, triggers 
  loading state.
- **Hover Citation Chip:** Highlights linked paragraph in 
  left pane with `#222222` background.

---

### Settings & Onboarding

**Purpose:** First-time setup hub and configuration center 
for API keys, generation modes, and onboarding resources.

**Layout:** Full screen. Single column centered, max-width 
`600px`. `#000000` background.

**Key Elements:**
- **Page Header:** `SETTINGS` in `Space Grotesk` 700 32px. 
  Subtitle: `CONFIGURE YOUR KEYS AND GENERATION PREFERENCES` 
  in `JetBrains Mono` 12px `#666666`. `1px #222222` 
  bottom border.
- **Quickstart Section:** Label `GETTING STARTED` 
  `JetBrains Mono` 11px `#666666`. Link: 
  `WATCH QUICKSTART ON YOUTUBE ↗` `JetBrains Mono` 13px 
  `#5E6AD2`, underline on hover.
- **API Keys Section:** Label `API KEYS`. Three provider blocks 
  (OpenAI, Anthropic, Gemini), each with:
  - Provider name: `JetBrains Mono` 12px `#EAEAEA` uppercase.
  - `GET API KEY ↗` link: `JetBrains Mono` 11px `#5E6AD2`.
  - Password input: full width, 40px height, `#0F0F0F` bg, 
    `1px #222222` border, `JetBrains Mono` placeholder.
  - On paste: border flashes `#5E6AD2`, shows `[VERIFIED]` in 
    `#5E6AD2` or `[INVALID]` in `#FF3366`.
  - `1px #222222` bottom border between providers.
- **Generation Mode Section:** Label `GENERATION MODE`. 
  3 radio option rows stacked, each 48px tall, `1px #222222` 
  border box:
  - `[FAST]` — GPT-3.5 / Claude Haiku. Best for quick captures.
  - `[DEEP]` — GPT-4 / Claude Opus. Detailed structured notes.
  - `[LOCAL]` — Ollama. Fully offline, no API key required.
  Active option: `2px #5E6AD2` left border, label `#5E6AD2`. 
  Description: `Inter Tight` 14px `#666666`.
- **Save Button:** Full width, 48px height, `#5E6AD2` bg, 
  `#000000` text, `JetBrains Mono` 600 `[ SAVE SETTINGS ]`.
  Success state: bg `#0F0F0F`, text `[ SETTINGS SAVED ✓ ]`.

</details>

---

<details>
<summary>Build Guide</summary>

**Stack:** React + Tailwind CSS v3 + native CSS transitions only.
No Framer Motion. No animation libraries.

**Build Order:**
1. **Design System Setup:** Configure `tailwind.config.js` with 
   exact hex values, `0px` radius, Space Grotesk + Inter Tight 
   + JetBrains Mono fonts via Google Fonts CDN.
2. **Settings & Onboarding:** Critical path — API key state 
   logic must work before any LLM call can be tested.
3. **Library Dashboard:** Layout shell, sidebar nav, card grid, 
   hover states, empty state.
4. **Reader View:** Split-pane architecture, prose typography, 
   sticky sidebar, selection tooltip.
5. **RAG Chat Pane:** Scrollable message list, citation chips, 
   fixed bottom input, streaming UI.
6. **Extension Popup:** Independent 320×480px mini-app using 
   same Tailwind classes, hooks into Chrome browser APIs.

</details>