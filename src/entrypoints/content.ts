import { Readability } from '@mozilla/readability';
import type { DOMExtraction } from '../lib/types';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== 'EXTRACT_DOM') return;

      // Run extraction and respond directly — this is what browser.tabs.sendMessage awaits
      try {
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
          title: document.title,
          url: window.location.href,
          domain: window.location.hostname,
          textContent: article?.textContent ?? document.body.innerText,
          structuredHTML: article?.content ?? document.body.innerHTML,
          images,
          wordCount: (article?.textContent ?? document.body.innerText)
            .split(/\s+/).filter(Boolean).length,
          metaDescription:
            document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
        };

        sendResponse(extraction);
      } catch (err) {
        sendResponse({ error: (err as Error).message });
      }

      // Return true to keep the message channel open for the async sendResponse
      return true;
    });
  },
});
