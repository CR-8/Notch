import katex from 'katex';

const BLOCK_MATH = /\$\$([\s\S]*?)\$\$/g;
const INLINE_MATH = /(?<!\$)\$([^\n$]+?)\$(?!\$)/g;

export function renderMath(text: string): string {
  let result = text;

  result = result.replace(BLOCK_MATH, (_, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `<div class="math-error">${expr.trim()}</div>`;
    }
  });

  result = result.replace(INLINE_MATH, (_, expr: string) => {
    try {
      return katex.renderToString(expr.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="math-error">${expr.trim()}</span>`;
    }
  });

  return result;
}
