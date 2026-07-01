// ── Mermaid Auto-Fixer ────────────────────────────────────────────────────────

import type { MermaidValidationResult } from './validator';

export interface FixResult {
  original: string;
  fixed: string;
  changes: string[];
  confidence: number;
}

export function autoFixMermaid(code: string, validation?: MermaidValidationResult): FixResult {
  const changes: string[] = [];
  let fixed = code;

  if (validation && !validation.valid) {
    const hasUnbalancedParens = validation.errors.some((e) =>
      e.message.includes('Unbalanced parentheses'),
    );
    const hasUnbalancedQuotes = validation.errors.some((e) => e.message.includes('quotes'));

    if (hasUnbalancedParens) {
      fixed = fixUnbalancedParens(fixed);
      changes.push('Fixed unbalanced parentheses');
    }

    if (hasUnbalancedQuotes) {
      fixed = fixUnbalancedQuotes(fixed);
      changes.push('Fixed unbalanced quotes');
    }
  }

  // Structural fixes
  fixed = fixEmptyLabels(fixed);
  fixed = fixDanglingArrows(fixed);
  fixed = fixDirectionSyntax(fixed);
  fixed = fixSectionFormatting(fixed);
  fixed = removeEmptyLines(fixed);

  const fixedHasChanges = fixed !== code;

  return {
    original: code,
    fixed,
    changes: fixedHasChanges ? changes : [],
    confidence: changes.length === 0 ? 1.0 : 0.9,
  };
}

function fixUnbalancedParens(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const openC = (line.match(/\(/g) ?? []).length;
      let close = (line.match(/\)/g) ?? []).length;
      while (openC > close) {
        line += ')';
        close++;
      }
      while (close > openC) {
        line = line.replace(/\)(?!.*\))/, '');
        close--;
      }
      return line;
    })
    .join('\n');
}

function fixUnbalancedQuotes(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      if (line.includes('"') && (line.match(/"/g) ?? []).length % 2 !== 0) {
        if (line.startsWith('"') || !line.endsWith('"')) {
          return line + '"';
        }
      }
      if (line.includes("'") && (line.match(/'/g) ?? []).length % 2 !== 0) {
        return line + "'";
      }
      return line;
    })
    .join('\n');
}

function fixEmptyLabels(code: string): string {
  return code.replace(/\[\]/g, '[ ]').replace(/\(\)/g, '( )').replace(/\{\}/g, '{ }');
}

function fixDanglingArrows(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (
        trimmed === '-->' ||
        trimmed === '==>' ||
        trimmed === '-.->' ||
        trimmed === '--o' ||
        trimmed === '--x'
      ) {
        return ''; // Remove dangling arrows
      }
      return line;
    })
    .join('\n');
}

function fixDirectionSyntax(code: string): string {
  const lines = code.split('\n');
  if (lines.length > 0) {
    const first = lines[0].trim();
    // Auto-correct common direction typos
    lines[0] = first
      .replace(/\b(?:graph|flowchart)\s+(Td|T D)\b/i, '$1 LR')
      .replace(/\b(?:graph|flowchart)\s+(Lr)\b/i, '$1 LR');
  }
  return lines.join('\n');
}

function fixSectionFormatting(code: string): string {
  // Ensure gantt/journey sections have proper indentation
  return code
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^section\s+/i.test(trimmed) && !line.startsWith('  ')) {
        if (!line.startsWith('    ')) {
          return '    ' + trimmed;
        }
      }
      return line;
    })
    .join('\n');
}

function removeEmptyLines(code: string): string {
  return code
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}
