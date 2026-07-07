// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeSvg } from '../sanitize';

describe('sanitizeHtml (DOMPurify)', () => {
  it('removes <script> tags and their content', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips event handler attributes', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes javascript: URLs in links', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('drops forbidden tags (iframe, form, style)', () => {
    const out = sanitizeHtml(
      '<iframe src="evil"></iframe><form><input></form><style>body{x:1}</style><p>ok</p>',
    );
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('<form');
    expect(out.toLowerCase()).not.toContain('<input');
    expect(out.toLowerCase()).not.toContain('<style');
    expect(out).toContain('<p>ok</p>');
  });

  it('preserves safe formatting, links and tables', () => {
    const html =
      '<strong>bold</strong> <em>i</em> <code>c</code> <a href="https://x.com">l</a>' +
      '<table><tbody><tr><td>1</td></tr></tbody></table>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<code>c</code>');
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain('<td>1</td>');
  });

  it('preserves the style attribute used by KaTeX math output', () => {
    const out = sanitizeHtml(
      '<span class="katex" style="height:0.8em;vertical-align:-0.2em;">x</span>',
    );
    expect(out).toContain('class="katex"');
    expect(out).toContain('style=');
  });

  it('hardens new-tab links against reverse-tabnabbing', () => {
    const out = sanitizeHtml('<a href="https://x.com" target="_blank">l</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe('sanitizeSvg', () => {
  it('keeps svg structure but strips embedded scripts', () => {
    const out = sanitizeSvg('<svg><rect width="10" height="10"/><script>alert(1)</script></svg>');
    expect(out.toLowerCase()).toContain('<svg');
    expect(out.toLowerCase()).toContain('<rect');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips event handlers from svg nodes', () => {
    const out = sanitizeSvg('<svg><rect onclick="alert(1)" width="10" height="10"/></svg>');
    expect(out.toLowerCase()).not.toContain('onclick');
  });
});
