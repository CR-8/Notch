// @vitest-environment jsdom

/**
 * Property 14: DOM Extraction Collects All Images with Context
 *
 * For any HTML with <img> elements, the extraction function returns entries
 * with non-empty `url` for images with a src, and `paragraphContext` from
 * the nearest ancestor <p> when present.
 *
 * Validates: Requirements 9.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Pure function extracted from content.ts logic
// Note: uses textContent instead of innerText for jsdom compatibility
// (innerText requires CSS layout which jsdom does not compute)
function extractImages(doc: Document): Array<{ url: string; alt: string; paragraphContext: string }> {
  return Array.from(doc.querySelectorAll('img')).map(img => {
    let paragraphContext = '';
    let el: Element | null = img;
    while (el && el.tagName !== 'P') {
      el = el.parentElement;
    }
    if (el) paragraphContext = (el as HTMLElement).textContent ?? '';
    return { url: img.src, alt: img.alt ?? '', paragraphContext };
  }).filter(img => img.url);
}

function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Property 14: DOM Extraction Collects All Images with Context', () => {
  it('image inside <p> has non-empty url and paragraphContext from the <p>', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.string(),
        // Ensure paragraph text has at least one non-whitespace char so innerText is non-empty
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (imgUrl, alt, paragraphText) => {
          const safeAlt = alt.replace(/"/g, '&quot;');
          const safeParagraphText = paragraphText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const html = `<p>${safeParagraphText} <img src="${imgUrl}" alt="${safeAlt}"></p>`;
          const doc = parseHTML(html);
          const images = extractImages(doc);

          expect(images.length).toBeGreaterThanOrEqual(1);
          const image = images[0];
          expect(image.url).toBeTruthy();
          expect(image.paragraphContext).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('image NOT inside <p> has non-empty url and empty paragraphContext', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.string(),
        (imgUrl, alt) => {
          const safeAlt = alt.replace(/"/g, '&quot;');
          const html = `<div><img src="${imgUrl}" alt="${safeAlt}"></div>`;
          const doc = parseHTML(html);
          const images = extractImages(doc);

          expect(images.length).toBeGreaterThanOrEqual(1);
          const image = images[0];
          expect(image.url).toBeTruthy();
          expect(image.paragraphContext).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('images without src attribute are filtered out', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (alt) => {
          const safeAlt = alt.replace(/"/g, '&quot;');
          // An img with no src attribute at all: img.src resolves to '' in jsdom
          const html = `<p>some text <img alt="${safeAlt}"></p>`;
          const doc = parseHTML(html);
          const images = extractImages(doc);

          // img.src with no src attribute is '' in jsdom — filtered out
          expect(images.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all returned images have a non-empty url', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            url: fc.webUrl(),
            alt: fc.string(),
            inParagraph: fc.boolean(),
            paragraphText: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (imgDefs) => {
          const imgTags = imgDefs.map(({ url, alt, inParagraph, paragraphText }) => {
            const safeAlt = alt.replace(/"/g, '&quot;');
            const tag = `<img src="${url}" alt="${safeAlt}">`;
            return inParagraph ? `<p>${paragraphText} ${tag}</p>` : `<div>${tag}</div>`;
          });
          const html = `<body>${imgTags.join('')}</body>`;
          const doc = parseHTML(html);
          const images = extractImages(doc);

          for (const image of images) {
            expect(image.url).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
