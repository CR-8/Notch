import {
  saveDocument,
  checkStorageQuota,
  requestPersist,
  ensureSchema,
  getProvider,
  getAllNotes,
} from '../lib/storage';
import { testProviderConnection } from '../lib/providers/registry';
import {
  runCapturePipeline,
  runRAGPipeline,
  generateEmbeddingsForDocument,
  translateText,
} from '../lib/pipeline';
import { importNotchPDF } from '../lib/import';
import { findDuplicateId } from '../lib/dedupe';
import { log } from '../lib/logger';
import type {
  DOMExtraction,
  GenerationMode,
  ReadingLevel,
  RuntimeMessage,
  TestResult,
} from '../lib/types';
import type { ParsedPdf } from '../lib/pdf-parser';

function trySendToPopup(msg: RuntimeMessage): void {
  try {
    browser.runtime.sendMessage(msg).catch(() => {});
  } catch {
    /* no popup */
  }
}

export default defineBackground({
  main() {
    log.info('background', '=== Notch service worker started ===');

    // ONB-1/2: open the welcome flow on fresh install.
    browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') }).catch(() => {});
      }

      // CAP-2: register the right-click context menu item once (on install or update).
      // Using try/catch because Firefox MV2 may not support contextMenus in all builds.
      try {
        browser.contextMenus?.create(
          {
            id: 'notch-capture',
            title: 'Capture this page with Notch',
            contexts: ['page', 'selection', 'link'],
          },
          () => {
            // Suppress "already exists" error on reload / update.
            if (browser.runtime.lastError) {
              /* ignore */
            }
          },
        );
      } catch {
        /* contextMenus unavailable */
      }
    });

    // CAP-2: handle right-click menu clicks.
    try {
      browser.contextMenus?.onClicked.addListener((info, tab) => {
        if (info.menuItemId !== 'notch-capture') return;
        const tabId = tab?.id;
        const url = tab?.url ?? info.pageUrl;
        if (!tabId) return;
        log.info('background', `Context-menu capture triggered: tab=${tabId}`);
        void handleCapture('FAST', [], tabId, url).catch((err) => {
          log.error('background', 'Context-menu capture failed', err);
        });
      });
    } catch {
      /* contextMenus unavailable */
    }

    // CAP-2: keyboard shortcut (Alt+Shift+C declared in wxt.config.ts commands).
    try {
      browser.commands?.onCommand?.addListener((command: string) => {
        if (command !== 'capture-page') return;
        log.info('background', 'Keyboard shortcut capture triggered');
        void (async () => {
          const tabs = await browser.tabs
            .query({ active: true, currentWindow: true })
            .catch(() => []);
          const tab = tabs[0];
          if (!tab?.id) return;
          try {
            await handleCapture('FAST', [], tab.id, tab.url);
          } catch (err) {
            log.error('background', 'Keyboard shortcut capture failed', err);
          }
        })();
      });
    } catch {
      /* commands API unavailable */
    }

    ensureSchema().catch((err) => log.warn('background', 'Schema migration error', err));

    void requestPersist().then((granted) => {
      log.info('background', `Persistent storage ${granted ? 'granted' : 'not granted'}`);
    });

    // Resume stuck captures on startup
    void (async () => {
      try {
        const stuck = await (await import('../lib/storage')).getNotesByStatus('captured');
        for (const note of stuck) {
          log.warn('background', `Found stuck capture: ${note.id} - "${note.title}"`);
          note.status = 'failed';
          await saveDocument(note);
        }
      } catch {
        /* db might not be ready */
      }
    })();

    browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
      void handleRuntimeMessage(message)
        .then(sendResponse)
        .catch(() => {});
      return true;
    });

    browser.runtime.onMessage.addListener((message: { type: string }) => {
      if (message.type === 'ABORT_RAG') {
        import('../lib/pipeline').then((mod) => mod.abortRAG()).catch(() => {});
      }
    });
  },
});

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeMessage | undefined> {
  try {
    log.info('background', `Message: ${message.type}`);
    switch (message.type) {
      case 'CAPTURE_PAGE':
        return handleCapture(
          message.payload.mode,
          message.payload.tags,
          message.payload.tabId,
          message.payload.url,
        );
      case 'CAPTURE_SELECTION':
        return handleCapture(
          message.payload.mode,
          message.payload.tags,
          message.payload.tabId,
          message.payload.url,
          message.payload.selectionText,
        );
      case 'TEST_CONNECTION':
        return handleTestConnection(message.payload.providerId);
      case 'RAG_QUERY':
        return handleRAG(
          message.payload.documentId,
          message.payload.query,
          message.payload.readingLevel,
        );
      case 'GENERATE_EMBEDDINGS':
        return handleGenerateEmbeddings(message.payload.documentId);
      case 'IMPORT_PDF':
        return handleImportPDF(message.payload.fileName, message.payload.bytes);
      case 'TRANSLATE':
        return handleTranslate(message.payload.text, message.payload.targetLanguage);
      default:
        return;
    }
  } catch (err) {
    log.error('background', `Unhandled error in message listener: ${String(err)}`);
    return;
  }
}

async function handleRAG(
  documentId: string,
  query: string,
  readingLevel?: ReadingLevel,
): Promise<RuntimeMessage> {
  try {
    let accumulated = '';
    const { answer, citations } = await runRAGPipeline(
      query,
      documentId,
      (chunk) => {
        accumulated += chunk;
        trySendToPopup({ type: 'RAG_CHUNK', payload: { chunk: accumulated, documentId } });
      },
      readingLevel,
    );
    return { type: 'RAG_RESPONSE', payload: { answer, citations } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `RAG failed: ${message}`, err);
    return { type: 'RAG_ERROR', payload: { error: message } };
  }
}

async function handleTranslate(text: string, targetLanguage: string): Promise<RuntimeMessage> {
  try {
    const translated = await translateText(text, targetLanguage);
    return { type: 'TRANSLATE_RESULT', payload: { translated } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Translate failed: ${message}`, err);
    return { type: 'TRANSLATE_ERROR', payload: { error: message } };
  }
}

async function handleGenerateEmbeddings(documentId: string): Promise<RuntimeMessage> {
  try {
    await generateEmbeddingsForDocument(documentId);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Embedding generation failed: ${message}`, err);
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

async function handleImportPDF(fileName: string, bytes: number[]): Promise<RuntimeMessage> {
  try {
    const file = new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' });
    const documentId = await importNotchPDF(file);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `PDF import failed: ${message}`, err);
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

/**
 * Returns true when the URL's shape strongly suggests it points to a PDF file
 * or to a research paper landing page that serves a PDF directly.
 *
 * Covers:
 * - Generic `.pdf` extension / query / path patterns
 * - arXiv PDF links (arxiv.org/pdf/... and arxiv.org/abs/...)
 * - bioRxiv / medRxiv (biorxiv.org/content/...full.pdf, or /content/... without extension)
 * - Semantic Scholar PDF links
 * - SSRN working papers
 * - PubMed Central full-text PDFs
 * - Springer, Nature, ACM, IEEE, Wiley, Elsevier, ScienceDirect PDF paths
 * - ResearchGate publication links
 */
function isPdfUrl(url?: string): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    const lower = url.toLowerCase();
    return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf/');
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // Generic: URL ends with .pdf, has /pdf/ segment, or has pdf= query
  if (path.endsWith('.pdf') || path.includes('/pdf/') || parsed.searchParams.has('pdf'))
    return true;

  // arXiv: arxiv.org/abs/XXXX → abstract page (the PDF is linked from here, but we
  // can also grab it via /pdf/XXXX). We intercept /pdf/ above; also intercept /abs/
  // so clicking Capture on the abstract page fetches the PDF.
  // NOTE: /html/ is an HTML-rendered version — treat as normal DOM page, not PDF.
  if (
    (host === 'arxiv.org' || host.endsWith('.arxiv.org')) &&
    (path.startsWith('/abs/') || path.startsWith('/pdf/'))
  )
    return true;

  // bioRxiv / medRxiv
  if (
    (host === 'biorxiv.org' ||
      host.endsWith('.biorxiv.org') ||
      host === 'medrxiv.org' ||
      host.endsWith('.medrxiv.org')) &&
    path.includes('/content/')
  )
    return true;

  // Semantic Scholar — PDFs served via /reader/ or direct PDF links
  if (
    (host === 'semanticscholar.org' || host.endsWith('.semanticscholar.org')) &&
    (path.includes('/reader/') || path.endsWith('.pdf'))
  )
    return true;

  // SSRN working papers
  if ((host === 'ssrn.com' || host.endsWith('.ssrn.com')) && path.includes('/abstract='))
    return true;

  // PubMed Central — full text pages often include downloadable PDFs
  if (
    (host === 'ncbi.nlm.nih.gov' || host.endsWith('.ncbi.nlm.nih.gov')) &&
    path.startsWith('/pmc/articles/')
  )
    return true;

  // Europe PMC
  if (host === 'europepmc.org' && path.includes('/article/')) return true;

  // ResearchGate — paper detail pages
  if (
    (host === 'researchgate.net' || host.endsWith('.researchgate.net')) &&
    path.startsWith('/publication/')
  )
    return true;

  // Springer (springer.com/article, link.springer.com/article|chapter)
  if (
    (host === 'springer.com' || host.endsWith('.springer.com') || host === 'link.springer.com') &&
    (path.startsWith('/article/') || path.startsWith('/chapter/'))
  )
    return true;

  // Nature journals
  if ((host === 'nature.com' || host.endsWith('.nature.com')) && path.startsWith('/articles/'))
    return true;

  // IEEE Xplore
  if (
    (host === 'ieeexplore.ieee.org' || host.endsWith('.ieeexplore.ieee.org')) &&
    path.startsWith('/document/')
  )
    return true;

  // ACM Digital Library
  if (host === 'dl.acm.org' && path.startsWith('/doi/')) return true;

  // Wiley Online Library
  if (
    host === 'onlinelibrary.wiley.com' &&
    (path.startsWith('/doi/full/') || path.startsWith('/doi/pdf/'))
  )
    return true;

  // ScienceDirect / Elsevier
  if (
    (host === 'sciencedirect.com' || host.endsWith('.sciencedirect.com')) &&
    path.startsWith('/science/article/')
  )
    return true;

  // JSTOR
  if ((host === 'jstor.org' || host.endsWith('.jstor.org')) && path.startsWith('/stable/'))
    return true;

  // HAL open archive (France)
  if (
    (host === 'hal.science' ||
      host.endsWith('.hal.science') ||
      host === 'hal.archives-ouvertes.fr') &&
    /\/[a-z]+-\d+/.test(path)
  )
    return true;

  return false;
}

/**
 * Check whether a URL actually serves a PDF by doing a lightweight HEAD request
 * and inspecting Content-Type.  Returns false on any network error so the caller
 * can fall through to normal DOM extraction.
 *
 * Only called when `isPdfUrl()` returned false — avoids double-requesting URLs
 * we already know are PDFs.
 */
async function detectsPdfContentType(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ct = resp.headers.get('content-type') ?? '';
    return ct.toLowerCase().startsWith('application/pdf');
  } catch {
    return false;
  }
}

/**
 * For research paper landing pages that don't serve the PDF bytes directly,
 * derive the canonical PDF download URL.
 *
 * Examples:
 *  - arxiv.org/abs/2305.12345  → arxiv.org/pdf/2305.12345
 *  - biorxiv.org/content/10.../v1  → biorxiv.org/content/10.../v1.full.pdf
 *  - everything else → unchanged (the caller will try fetching it as-is)
 */
function resolveCanonicalPdfUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // arXiv: /abs/XXXXX → /pdf/XXXXX
    if (host === 'arxiv.org' && path.startsWith('/abs/')) {
      return `https://arxiv.org/pdf/${path.slice('/abs/'.length)}`;
    }

    // bioRxiv / medRxiv: append .full.pdf if not already a PDF path
    if (
      host === 'biorxiv.org' ||
      host === 'medrxiv.org' ||
      host.endsWith('.biorxiv.org') ||
      host.endsWith('.medrxiv.org')
    ) {
      if (!path.endsWith('.pdf') && !path.endsWith('.full.pdf')) {
        return `${url.split('?')[0]}.full.pdf`;
      }
    }

    // Semantic Scholar /reader/ → strip /reader prefix (canonical PDF URL)
    if (host.includes('semanticscholar.org') && path.startsWith('/reader/')) {
      const rest = path.slice('/reader/'.length);
      return `https://api.semanticscholar.org/graph/v1/paper/${rest}/pdf`;
    }
  } catch {
    // Malformed URL — return unchanged
  }
  return url;
}

/**
 * True when a DOM extraction came back essentially empty — the signature of a
 * browser's native PDF viewer (or a JS-gated page) whose DOM exposes no real
 * text. This is the "10 chars / Untitled document" failure mode.
 */
function looksEmptyExtraction(e: DOMExtraction): boolean {
  return (e.wordCount ?? 0) < 10 || (e.textContent?.trim().length ?? 0) < 50;
}

/**
 * Download a URL as PDF bytes and parse them into a DOMExtraction via pdf.js.
 * Throws if the fetch fails or the bytes contain no readable text, so the caller
 * can decide whether to fall back to DOM extraction.
 */
async function fetchAndParsePdf(rawUrl: string): Promise<DOMExtraction> {
  trySendToPopup({
    type: 'CAPTURE_PROGRESS',
    payload: { step: 'Downloading PDF document...', pct: 5 },
  });

  // Research-paper landing pages (arXiv /abs/, bioRxiv, Semantic Scholar …) don't
  // serve PDF bytes directly — resolve the canonical PDF URL when we can.
  const pdfFetchUrl = resolveCanonicalPdfUrl(rawUrl);
  const response = await fetch(pdfFetchUrl);
  if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Array.from(new Uint8Array(arrayBuffer));
  const fileName = pdfFetchUrl.split('/').pop()?.split('?')[0] || 'document.pdf';

  trySendToPopup({
    type: 'CAPTURE_PROGRESS',
    payload: { step: 'Extracting text from PDF...', pct: 10 },
  });
  const pdfParser = (await import('../lib/pdf-parser')) as {
    parsePdfBytes: (bytes: number[], fileName: string) => Promise<ParsedPdf>;
    buildResearchPaperMarkdown: (
      sections: ParsedPdf['sections'],
      title: string,
      authors?: string,
    ) => string;
  };
  const parsed = await pdfParser.parsePdfBytes(bytes, fileName);

  // If we detected a research paper, structure the content as labelled sections
  // so the pipeline can produce a better-targeted summary.
  const structuredContent =
    parsed.isPaper && parsed.sections.length > 0
      ? pdfParser.buildResearchPaperMarkdown(parsed.sections, parsed.title, parsed.authors)
      : parsed.content;

  return {
    title: parsed.title,
    url: rawUrl,
    domain: (() => {
      try {
        return new URL(rawUrl).hostname;
      } catch {
        return '';
      }
    })(),
    textContent: structuredContent,
    cleanedHtml: structuredContent
      .split('\n\n')
      .map((p) => `<p>${p}</p>`)
      .join(''),
    images: [],
    videos: [],
    wordCount: parsed.wordCount,
    metaDescription: parsed.authors ? `By ${parsed.authors}` : '',
    isPdf: true,
    isPaper: parsed.isPaper,
  };
}

async function handleCapture(
  mode: GenerationMode,
  tags: string[],
  tabId?: number,
  url?: string,
  selectionText?: string,
): Promise<RuntimeMessage> {
  try {
    // BUG-001: prefer the tabId/url resolved by the caller (popup), which runs in a
    // real window context. A Chrome MV3 service worker has no "current window", so
    // tabs.query({currentWindow:true}) can return [] here — fall back progressively.
    const tab = await resolveActiveTab(tabId, url);
    if (!tab?.id) throw new Error('No active tab found — open a page and try again');

    // CAP-5: if this page is already saved, open the existing note instead of
    // capturing a duplicate.
    if (tab.url && !selectionText) {
      const existing = await getAllNotes().catch(() => []);
      const dupId = findDuplicateId(
        tab.url,
        existing.map((n) => ({ id: n.id, url: n.url })),
      );
      if (dupId) {
        log.info('background', `Duplicate detected for ${tab.url}, returning existing ${dupId}`);
        return { type: 'CAPTURE_COMPLETE', payload: { documentId: dupId } };
      }
    }

    trySendToPopup({
      type: 'CAPTURE_PROGRESS',
      payload: { step: 'Extracting page content...', pct: 5 },
    });

    let extraction!: DOMExtraction;
    if (selectionText) {
      // CAP-3: the caller already has the selection text — build a synthetic extraction.
      extraction = {
        title: `Selection from ${tab.url ?? 'page'}`,
        url: tab.url ?? '',
        domain: (() => {
          try {
            return new URL(tab.url ?? '').hostname;
          } catch {
            return '';
          }
        })(),
        textContent: selectionText,
        cleanedHtml: `<p>${selectionText}</p>`,
        images: [],
        videos: [],
        wordCount: selectionText.split(/\s+/).filter(Boolean).length,
        metaDescription: '',
        selectionText,
      };
    } else if (isPdfUrl(tab.url)) {
      try {
        log.info('background', `PDF URL intercept: ${tab.url}`);
        extraction = await fetchAndParsePdf(tab.url!);
      } catch (pdfErr) {
        log.warn(
          'background',
          'Direct PDF fetch/parse failed, falling back to DOM extraction',
          pdfErr,
        );
        extraction = await extractDOM(tab.id, tab.url ?? '');
      }
    } else {
      // For non-PDF URLs we do a lightweight content-type check — some sites
      // serve PDFs without .pdf in the URL (e.g. via DOI redirects).
      let usedPdfPath = false;
      try {
        if (await detectsPdfContentType(tab.url!)) {
          log.info('background', `Content-Type PDF detected for: ${tab.url}`);
          extraction = await fetchAndParsePdf(tab.url!);
          usedPdfPath = true;
        }
      } catch (sniffErr) {
        log.warn(
          'background',
          'Content-type PDF sniff/parse failed, falling back to DOM',
          sniffErr,
        );
      }

      if (!usedPdfPath) {
        extraction = await extractDOM(tab.id, tab.url ?? '');

        // Resilience guard: browsers render PDFs in a native viewer whose DOM
        // exposes almost no text, so Readability returns a near-empty extraction
        // (the "10 chars / Untitled document" failure mode). When the DOM is
        // essentially empty, retry once via direct fetch + pdf.js. parsePdfBytes
        // throws on non-PDF/unreadable bytes, in which case we keep the DOM result.
        if (looksEmptyExtraction(extraction)) {
          try {
            log.warn(
              'background',
              `DOM extraction near-empty (${extraction.wordCount} words) — retrying via direct PDF fetch`,
            );
            extraction = await fetchAndParsePdf(tab.url!);
          } catch (retryErr) {
            log.warn(
              'background',
              'PDF retry after empty DOM failed; keeping DOM extraction',
              retryErr,
            );
          }
        }

        // CAP-7: warn the popup but still attempt capture (the user may want to try anyway).
        if (extraction.isPaywalled) {
          log.warn('background', `Paywall detected: ${extraction.paywallSignal}`);
          trySendToPopup({
            type: 'PAYWALL_DETECTED',
            payload: { signal: extraction.paywallSignal ?? 'Paywall detected', url: tab.url ?? '' },
          });
        }
      }
    }

    trySendToPopup({
      type: 'CAPTURE_PROGRESS',
      payload: { step: 'Starting AI structuring...', pct: 15 },
    });

    const documentId = await runCapturePipeline(extraction, mode, tags, (step, pct) => {
      trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step, pct } });
    });

    trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step: 'Checking storage...', pct: 95 } });
    await checkStorageQuota();

    log.success('background', `Capture complete: ${documentId}`);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Capture failed: ${message}`, err);
    trySendToPopup({ type: 'CAPTURE_ERROR', payload: { error: message } });
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

/**
 * BUG-001: resolve the active tab reliably across Chrome / Brave / Edge / Firefox.
 * Order: (1) tabId handed down by the popup, (2) active tab of the current window,
 * (3) active tab of the last-focused window, (4) any active tab. Service workers in
 * Chromium have no associated window, so `currentWindow:true` alone is unreliable.
 */
async function resolveActiveTab(
  tabId?: number,
  url?: string,
): Promise<{ id?: number; url?: string } | undefined> {
  if (typeof tabId === 'number') {
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab?.id) return { id: tab.id, url: tab.url ?? url };
    } catch {
      // tab closed between popup click and handling — fall through to queries
    }
  }

  const queries: Parameters<typeof browser.tabs.query>[0][] = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true },
    { active: true },
  ];
  for (const q of queries) {
    try {
      const [tab] = await browser.tabs.query(q);
      if (tab?.id) return { id: tab.id, url: tab.url };
    } catch {
      /* try the next strategy */
    }
  }
  return undefined;
}

async function extractDOM(tabId: number, _url: string): Promise<DOMExtraction> {
  try {
    const extraction: DOMExtraction | { error: string } = await browser.tabs.sendMessage(tabId, {
      type: 'EXTRACT_DOM',
      payload: {},
    });

    if (!extraction) throw new Error('No response from content script');
    if ('error' in extraction) throw new Error(extraction.error);
    return extraction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(msg)) throw err;

    log.warn('background', `Content script not available for tab ${tabId}, using scripting API`);

    if (!browser.scripting?.executeScript) {
      throw new Error(
        'Scripting API unavailable — ensure the extension has the "scripting" permission ' +
          'and host_permissions include the target page origin.',
        { cause: err },
      );
    }

    let results;
    try {
      results = await browser.scripting.executeScript({
        target: { tabId },
        func: () => {
          const body = document.body ?? document.documentElement;
          const textContent = body?.innerText ?? '';
          const structuredHTML = body?.innerHTML ?? '';
          const title = document.title || 'Untitled';
          const images = Array.from(document.querySelectorAll('img'))
            .map((img) => {
              let ctx = '';
              let el: Element | null = img;
              while (el && el.tagName !== 'P') el = el.parentElement;
              if (el) ctx = (el as HTMLElement).innerText ?? '';
              return { url: img.src, alt: img.alt ?? '', paragraphContext: ctx };
            })
            .filter((i) => i.url);
          return {
            title,
            url: window.location.href,
            domain: window.location.hostname,
            textContent,
            cleanedHtml: structuredHTML,
            images,
            videos: [],
            wordCount: textContent.split(/\s+/).filter(Boolean).length,
            metaDescription:
              document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
          } as DOMExtraction;
        },
      });
    } catch (scriptErr) {
      const scriptMsg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
      log.error(
        'background',
        `scripting.executeScript failed for tab ${tabId}: ${scriptMsg}`,
        scriptErr,
      );
      throw new Error(`Could not inject extraction script: ${scriptMsg}`, { cause: scriptErr });
    }

    const result = results?.[0]?.result;
    if (result) return result;
    throw new Error('Could not extract DOM from tab', { cause: err });
  }
}

async function handleTestConnection(providerId: string): Promise<RuntimeMessage> {
  try {
    const provider = await getProvider(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found`);
    const result: TestResult = await testProviderConnection(provider);
    return { type: 'TEST_CONNECTION_RESULT', payload: { providerId, result } };
  } catch (err) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      payload: {
        providerId,
        result: { success: false, latencyMs: 0, error: (err as Error).message },
      },
    };
  }
}
