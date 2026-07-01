import { Readability } from '@mozilla/readability';
import type { DOMExtraction, RuntimeMessage } from '../lib/types';

interface YtTranscriptSegment {
  transcriptSegmentRenderer?: {
    snippet?: { runs?: Array<{ text?: string }> };
  };
}

interface YtEngagementPanel {
  engagementPanelSectionListRenderer?: {
    content?: {
      transcriptRenderer?: {
        content?: {
          transcriptSearchPanelRenderer?: {
            body?: {
              transcriptSegmentListRenderer?: {
                initialSegments?: YtTranscriptSegment[];
              };
            };
          };
        };
      };
    };
  };
}

interface YtCaptionTrack {
  languageCode?: string;
  baseUrl?: string;
}

interface YtPlayerCaptions {
  playerCaptionsTracklistRenderer?: {
    captionTracks?: YtCaptionTrack[];
  };
}

// ── CAP-4: YouTube transcript extraction ─────────────────────────────────────

/**
 * Returns true if the current page is a YouTube video watch page.
 */
function isYouTubePage(): boolean {
  const host = window.location.hostname;
  return (
    (host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') &&
    window.location.pathname === '/watch'
  );
}

/**
 * Extract transcript from ytInitialData (window.ytInitialData) which YouTube
 * inlines into the page as a JSON blob. This is the fastest path.
 */
function extractFromYtInitialData(): string | null {
  try {
    const win = window as { ytInitialData?: { engagementPanels?: YtEngagementPanel[] } };
    const yd = win.ytInitialData;
    if (!yd) return null;

    const panels = yd.engagementPanels;
    if (!panels) return null;

    for (const panel of panels) {
      const content = panel.engagementPanelSectionListRenderer?.content;
      const transcriptRenderer = content?.transcriptRenderer;
      if (!transcriptRenderer) continue;

      const body = transcriptRenderer.content?.transcriptSearchPanelRenderer?.body;
      const segments = body?.transcriptSegmentListRenderer?.initialSegments;
      if (!segments) continue;

      const lines: string[] = [];
      for (const seg of segments) {
        const text = seg.transcriptSegmentRenderer?.snippet?.runs?.[0]?.text;
        if (text) lines.push(text.trim());
      }
      if (lines.length > 0) return lines.join(' ');
    }
  } catch {
    // ytInitialData parsing failed — try other methods
  }
  return null;
}

/**
 * Fetch transcript from YouTube's timedtext API.
 * We get the track list from ytInitialData player captions, then fetch the XML.
 */
async function fetchTimedTextTranscript(): Promise<string | null> {
  try {
    const win = window as {
      ytInitialData?: { captions?: YtPlayerCaptions };
      ytInitialPlayerResponse?: { captions?: YtPlayerCaptions };
    };
    const yd = win.ytInitialData;
    const playerResp = win.ytInitialPlayerResponse;

    const captions = playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      const captionsAlt = yd?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionsAlt || captionsAlt.length === 0) return null;
    }

    const tracks =
      playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
      yd?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) return null;

    const enTrack = tracks.find((t: YtCaptionTrack) => t.languageCode === 'en') ?? tracks[0];
    const baseUrl = enTrack.baseUrl;
    if (!baseUrl) return null;

    const res = await fetch(`${baseUrl}&fmt=json3`);
    if (!res.ok) return null;
    const data = (await res.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
    const events = data.events;
    if (!events) return null;

    const lines: string[] = [];
    for (const ev of events) {
      if (!ev.segs) continue;
      const seg = ev.segs
        .map((s) => s.utf8 ?? '')
        .join('')
        .trim();
      if (seg && seg !== '\n') lines.push(seg);
    }
    return lines.length > 0 ? lines.join(' ') : null;
  } catch {
    return null;
  }
}

/**
 * Fallback: scrape visible caption text from the DOM if auto-captions are showing.
 */
function scrapeVisibleCaptions(): string | null {
  const captionEl = document.querySelector(
    '.captions-text, .ytp-caption-segment, [class*="caption"]',
  );
  const text = captionEl?.textContent?.trim();
  return text && text.length > 20 ? text : null;
}

/**
 * Get video title and description as fallback text.
 */
function getYouTubeMetadata(): { title: string; description: string } {
  const title =
    document
      .querySelector('h1.ytd-video-primary-info-renderer, h1[class*="title"]')
      ?.textContent?.trim() ?? document.title.replace(' - YouTube', '').trim();

  const desc =
    document
      .querySelector('#description-inline-expander, #description yt-formatted-string')
      ?.textContent?.trim() ?? '';

  return { title, description: desc.slice(0, 3000) };
}

/**
 * CAP-4: Main YouTube extraction — tries 3 methods, returns a DOMExtraction
 * with the transcript as textContent.
 */
async function extractYouTubeTranscript(): Promise<DOMExtraction> {
  const { title, description } = getYouTubeMetadata();
  const videoId = new URLSearchParams(window.location.search).get('v') ?? '';

  // Method 1: ytInitialData (synchronous)
  let transcript = extractFromYtInitialData();

  // Method 2: Timed-text API (async fetch)
  if (!transcript) {
    transcript = await fetchTimedTextTranscript();
  }

  // Method 3: Visible captions (DOM scrape — only works if captions are open)
  if (!transcript) {
    transcript = scrapeVisibleCaptions();
  }

  const hasTranscript = !!transcript && transcript.length > 100;
  const textContent = hasTranscript
    ? `${title}\n\n[YouTube Video Transcript]\n\n${transcript}\n\n[Description]\n${description}`
    : `${title}\n\n[YouTube Video — transcript unavailable]\n\n${description}`;

  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  return {
    title,
    url: window.location.href,
    domain: window.location.hostname,
    textContent,
    cleanedHtml: `<h1>${title}</h1><p>${textContent.replace(/\n/g, '<br>')}</p>`,
    images: [],
    videos: [
      {
        url: window.location.href,
        title,
        description: description.slice(0, 500),
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      },
    ],
    wordCount,
    metaDescription: description.slice(0, 200),
    youtubeVideoId: videoId,
    hasTranscript,
  };
}

// CAP-7: Paywall signals — patterns that strongly suggest a paywall or unreadable page.
const PAYWALL_SELECTORS = [
  '[class*="paywall"]',
  '[class*="pay-wall"]',
  '[class*="subscription"]',
  '[class*="subscriber-only"]',
  '[class*="premium-content"]',
  '[id*="paywall"]',
  '[id*="subscribe-wall"]',
  '[data-component*="paywall"]',
  '.gate',
  '.content-gate',
];

const PAYWALL_TEXT_PATTERNS = [
  /subscribe to read/i,
  /subscribe for full access/i,
  /subscriber.only content/i,
  /this article is for subscribers/i,
  /create a free account to continue/i,
  /sign up to continue reading/i,
  /you.ve reached your free article limit/i,
  /you've reached your free article limit/i,
  /to continue reading, please/i,
  /unlock (this|the) article/i,
  /exclusive (for|to) members/i,
];

/**
 * CAP-7: Detect whether a page is paywalled or has insufficient readable text.
 * Returns { isPaywalled, signal } or { isPaywalled: false }.
 */
function detectPaywall(
  body: HTMLElement,
  wordCount: number,
): { isPaywalled: boolean; signal?: string } {
  // Check for common paywall DOM elements
  for (const sel of PAYWALL_SELECTORS) {
    try {
      if (body.querySelector(sel)) {
        return { isPaywalled: true, signal: `Found element matching selector: ${sel}` };
      }
    } catch {
      /* invalid selector — skip */
    }
  }

  // Check for paywall meta tags
  const metaPaywall =
    document.querySelector('meta[name="paywall"]') ??
    document.querySelector('meta[property="og:paywall"]');
  if (metaPaywall) {
    return { isPaywalled: true, signal: 'Meta tag paywall marker found' };
  }

  // Check for paywall text patterns in the first 2000 chars of visible text
  const visibleText = body.innerText?.slice(0, 2000) ?? '';
  for (const pat of PAYWALL_TEXT_PATTERNS) {
    if (pat.test(visibleText)) {
      return { isPaywalled: true, signal: `Paywall text pattern: ${pat.source}` };
    }
  }

  // Check for very low word count on a page that clearly has lots of HTML
  // (indicative of blocked content)
  if (wordCount < 30 && body.innerHTML.length > 5000) {
    return {
      isPaywalled: true,
      signal: `Very low word count (${wordCount}) with large HTML (${body.innerHTML.length} chars)`,
    };
  }

  return { isPaywalled: false };
}

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
      // CAP-3: capture only the current text selection
      if (message.type === 'CAPTURE_SELECTION') {
        try {
          const sel = window.getSelection()?.toString().trim() ?? '';
          const body = document.body ?? document.documentElement;
          const extraction: DOMExtraction = {
            title: document.title || 'Untitled selection',
            url: window.location.href,
            domain: window.location.hostname,
            textContent: (sel || '').length > 0 ? sel : (body?.textContent ?? ''),
            cleanedHtml: sel ? `<p>${sel}</p>` : (body?.innerHTML ?? ''),
            images: [],
            videos: [],
            wordCount: (sel || '').split(/\s+/).filter(Boolean).length,
            metaDescription: '',
            selectionText: sel,
          };
          sendResponse(extraction);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendResponse({ error: `Selection extraction failed: ${msg}` });
        }
        return true;
      }

      if (message.type !== 'EXTRACT_DOM') return;

      // CAP-4: YouTube — use transcript extraction instead of Readability
      if (isYouTubePage()) {
        extractYouTubeTranscript()
          .then((extraction) => sendResponse(extraction))
          .catch((err) =>
            sendResponse({
              error: `YouTube extraction failed: ${err instanceof Error ? err.message : String(err)}`,
            }),
          );
        return true; // keep channel open for async response
      }

      // Run extraction and respond directly — this is what browser.tabs.sendMessage awaits
      try {
        const body = document.body ?? document.documentElement;
        const readableText = body?.textContent ?? document.documentElement?.textContent ?? '';
        const readableHtml = body?.innerHTML ?? document.documentElement?.outerHTML ?? '';
        const documentClone = document.cloneNode(true) as Document;
        const reader = new Readability(documentClone);
        const article = reader.parse();

        const images = Array.from(document.querySelectorAll('img'))
          .filter((img) => {
            if (!img.src) return false;
            if (
              img.naturalWidth > 0 &&
              img.naturalHeight > 0 &&
              (img.naturalWidth < 50 || img.naturalHeight < 50)
            )
              return false;
            if (img.offsetWidth === 0 || img.offsetHeight === 0) return false;
            const style = window.getComputedStyle(img);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
              return false;
            return true;
          })
          .map((img) => {
            let paragraphContext = '';
            let el: Element | null = img;
            while (el && el.tagName !== 'P') el = el.parentElement;
            if (el) paragraphContext = (el as HTMLElement).innerText ?? '';
            return { url: img.src, alt: img.alt ?? '', paragraphContext };
          })
          .filter((img) => img.url);

        const videos = Array.from(
          document.querySelectorAll(
            'video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="youtube-nocookie"]',
          ),
        )
          .map((el) => {
            if (el.tagName === 'VIDEO') {
              const video = el as HTMLVideoElement;
              return {
                url: video.src || video.querySelector('source')?.src || '',
                title: (el as HTMLElement).title || document.title,
                description: '',
                duration: video.duration ? Math.round(video.duration) : undefined,
              };
            }
            const iframe = el as HTMLIFrameElement;
            return {
              url: iframe.src,
              title: iframe.title || document.title,
              description: '',
            };
          })
          .filter((v) => v.url);

        const finalText = article?.textContent ?? readableText;
        const wordCount = finalText.split(/\s+/).filter(Boolean).length;

        // CAP-7: detect paywall before handing off to background
        const { isPaywalled, signal: paywallSignal } = detectPaywall(body, wordCount);

        const extraction: DOMExtraction = {
          title: document.title || body?.querySelector('title')?.textContent || 'Untitled document',
          url: window.location.href,
          domain: window.location.hostname,
          textContent: finalText,
          cleanedHtml: article?.content ?? readableHtml,
          images,
          videos,
          wordCount,
          metaDescription:
            document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
          isPaywalled,
          paywallSignal,
        };

        sendResponse(extraction);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendResponse({ error: `DOM extraction failed: ${message}` });
      }

      // Return true to keep the message channel open for the async sendResponse
      return true;
    });
  },
});
