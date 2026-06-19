import { Readability } from '@mozilla/readability';
import type { DOMExtraction } from '../lib/types';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== 'EXTRACT_DOM') return;

      // Run extraction and respond directly — this is what browser.tabs.sendMessage awaits
      try {
        const body = document.body ?? document.documentElement;
        const readableText = body?.textContent ?? document.documentElement?.textContent ?? '';
        const readableHtml = body?.innerHTML ?? document.documentElement?.outerHTML ?? '';
        const documentClone = document.cloneNode(true) as Document;
        const reader = new Readability(documentClone);
        const article = reader.parse();

        const images = Array.from(document.querySelectorAll('img'))
          .map(img => {
            let paragraphContext = '';
            let el: Element | null = img;
            while (el && el.tagName !== 'P') el = el.parentElement;
            if (el) paragraphContext = (el as HTMLElement).innerText ?? '';
            return { url: img.src, alt: img.alt ?? '', paragraphContext };
          })
          .filter(img => img.url);

        const extraction: DOMExtraction = {
          title: document.title || body?.querySelector('title')?.textContent || 'Untitled document',
          url: window.location.href,
          domain: window.location.hostname,
          textContent: article?.textContent ?? readableText,
          cleanedHtml: article?.content ?? readableHtml,
          images,
          wordCount: (article?.textContent ?? readableText)
            .split(/\s+/).filter(Boolean).length,
          metaDescription:
            document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
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
