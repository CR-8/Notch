/**
 * NDL Validator — strict validation of the NDL AST
 *
 * Enforces heading hierarchy, structure rules, content rules,
 * and general best practices. Returns ValidationResult with
 * typed errors and warnings.
 */

import {
  type ASTNode,
  type DocumentAST,
  type ValidationResult,
  type ValidationEntry,
  type HeadingNode,
  type CalloutKind,
  type CodeLanguage,
  type DiagramKind,
  type SourcePosition,
} from '../schemas';

/* ── Config ───────────────────────────────────────────────────────────── */

export interface ValidationOptions {
  strict: boolean;
  checkExternalRefs: boolean;
  maxHeadingDepth: number;
  allowedCallouts: CalloutKind[];
  allowedLanguages: CodeLanguage[];
  allowedDiagramKinds: DiagramKind[];
}

const DEFAULT_OPTIONS: ValidationOptions = {
  strict: false,
  checkExternalRefs: false,
  maxHeadingDepth: 6,
  allowedCallouts: [
    'note',
    'tip',
    'warning',
    'danger',
    'info',
    'important',
    'caution',
    'success',
    'question',
  ],
  allowedLanguages: [
    'typescript',
    'tsx',
    'javascript',
    'jsx',
    'python',
    'rust',
    'go',
    'ruby',
    'java',
    'kotlin',
    'swift',
    'c',
    'cpp',
    'csharp',
    'php',
    'html',
    'css',
    'scss',
    'sql',
    'json',
    'yaml',
    'toml',
    'xml',
    'markdown',
    'bash',
    'dockerfile',
    'graphql',
    'diff',
    'mermaid',
    'plantuml',
    'text',
  ],
  allowedDiagramKinds: [
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'mindmap',
    'timeline',
    'gitGraph',
    'quadrantChart',
    'zenuml',
    'architecture',
    'plantuml',
  ],
};

/* ── Rules ────────────────────────────────────────────────────────────── */

interface Rule {
  name: string;
  check: (doc: DocumentAST) => ValidationEntry[];
}

function rules(options: ValidationOptions): Rule[] {
  return [
    headingHierarchyRule(options),
    firstHeadingRule(),
    duplicateHeadingRule(),
    emptySectionsRule(),
    diagramContentRule(),
    calloutKindRule(options),
    codeLanguageRule(options),
    diagramKindRule(options),
    imageAltRule(),
    tableStructureRule(),
    metadataRule(),
  ];
}

/* ── Heading Hierarchy ─────────────────────────────────────────────────── */

function headingHierarchyRule(_opts: ValidationOptions): Rule {
  return {
    name: 'heading-hierarchy',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      const allHeadings = flattenHeadingNodes(doc.hierarchy.toc);
      for (let i = 1; i < allHeadings.length; i++) {
        const prev = allHeadings[i - 1];
        const curr = allHeadings[i];
        if (curr.level > prev.level + 1) {
          entries.push({
            nodeId: curr.id,
            rule: 'heading-hierarchy',
            message: `Heading "${curr.text}" jumps from level ${prev.level} to ${curr.level}. Expected maximum level ${prev.level + 1}.`,
            severity: 'error',
          });
        }
        if (curr.level < 1 || curr.level > 6) {
          entries.push({
            nodeId: curr.id,
            rule: 'heading-hierarchy',
            message: `Heading "${curr.text}" has invalid level ${curr.level}. Allowed: 1-6.`,
            severity: 'error',
          });
        }
      }
      return entries;
    },
  };
}

/* ── First Heading (h1) ───────────────────────────────────────────────── */

function firstHeadingRule(): Rule {
  return {
    name: 'first-heading',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      const allHeadings = flattenHeadingNodes(doc.hierarchy.toc);
      if (allHeadings.length > 0 && allHeadings[0].level !== 1) {
        entries.push({
          nodeId: allHeadings[0].id,
          rule: 'first-heading',
          message: 'Document must start with a level-1 heading.',
          severity: 'error',
        });
      }
      return entries;
    },
  };
}

/* ── Duplicate Headings ───────────────────────────────────────────────── */

function duplicateHeadingRule(): Rule {
  return {
    name: 'duplicate-heading',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      const seen = new Map<string, HeadingNode[]>();
      for (const h of flattenHeadingNodes(doc.hierarchy.toc)) {
        const key = `${h.level}:${h.text}`;
        const existing = seen.get(key) ?? [];
        existing.push(h);
        seen.set(key, existing);
      }
      for (const [, group] of seen) {
        if (group.length > 1) {
          for (const h of group) {
            entries.push({
              nodeId: h.id,
              rule: 'duplicate-heading',
              message: `Duplicate heading: "${h.text}" (level ${h.level}).`,
              severity: 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Empty Sections ───────────────────────────────────────────────────── */

function emptySectionsRule(): Rule {
  return {
    name: 'empty-section',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      const headingPositions = findHeadingPositions(doc.nodes);
      for (const h of flattenHeadingNodes(doc.hierarchy.toc)) {
        const idx = headingPositions.get(h.id ?? '');
        if (idx !== undefined) {
          let hasContent = false;
          for (let i = idx + 1; i < doc.nodes.length; i++) {
            const n = doc.nodes[i];
            if (n.type === 'heading') break;
            if (n.type === 'paragraph' && (n as any).raw?.trim()) {
              hasContent = true;
              break;
            }
          }
          if (!hasContent) {
            entries.push({
              nodeId: h.id,
              rule: 'empty-section',
              message: `Section "${h.text}" is empty (no content after heading).`,
              severity: 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Diagram Content ──────────────────────────────────────────────────── */

function diagramContentRule(): Rule {
  return {
    name: 'diagram-content',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'diagram') {
          const d = n as any;
          if (!d.content || d.content.trim().length < 3) {
            entries.push({
              nodeId: n.id,
              rule: 'diagram-content',
              message: 'Diagram has no or insufficient content.',
              severity: 'error',
            });
          }
          if (d.content.split('\n').length < 2) {
            entries.push({
              nodeId: n.id,
              rule: 'diagram-content',
              message: 'Diagram content should have at least 2 lines.',
              severity: 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Allowed Callout Kinds ────────────────────────────────────────────── */

function calloutKindRule(opts: ValidationOptions): Rule {
  return {
    name: 'callout-kind',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'callout') {
          const c = n as any;
          if (!opts.allowedCallouts.includes(c.kind)) {
            entries.push({
              nodeId: n.id,
              rule: 'callout-kind',
              message: `Callout kind "${c.kind}" is not in the allowed list.`,
              severity: opts.strict ? 'error' : 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Code Language Validation ─────────────────────────────────────────── */

function codeLanguageRule(opts: ValidationOptions): Rule {
  return {
    name: 'code-language',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'code') {
          const c = n as any;
          if (!c.language || c.language === 'text' || c.language === '') continue;
          if (!opts.allowedLanguages.includes(c.language)) {
            entries.push({
              nodeId: n.id,
              rule: 'code-language',
              message: `Unknown or disallowed language identifier "${c.language}".`,
              severity: opts.strict ? 'error' : 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Diagram Kind Validation ──────────────────────────────────────────── */

function diagramKindRule(opts: ValidationOptions): Rule {
  return {
    name: 'diagram-kind',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'diagram') {
          const d = n as any;
          if (!opts.allowedDiagramKinds.includes(d.kind)) {
            entries.push({
              nodeId: n.id,
              rule: 'diagram-kind',
              message: `Diagram kind "${d.kind}" is not in the allowed list.`,
              severity: 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Image Alt Text ───────────────────────────────────────────────────── */

function imageAltRule(): Rule {
  return {
    name: 'image-alt',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'image') {
          const img = n as any;
          if (!img.alt || img.alt.trim().length === 0) {
            entries.push({
              nodeId: n.id,
              rule: 'image-alt',
              message: 'Image is missing alt text.',
              severity: 'warning',
            });
          }
        }
      }
      return entries;
    },
  };
}

/* ── Table Structure ──────────────────────────────────────────────────── */

function tableStructureRule(): Rule {
  return {
    name: 'table-structure',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      for (const n of doc.nodes) {
        if (n.type === 'table') {
          const t = n as any;
          if (!t.columns || t.columns.length === 0) {
            entries.push({
              nodeId: n.id,
              rule: 'table-structure',
              message: 'Table has no column definitions.',
              severity: 'error',
            });
          }
          for (let i = 0; i < t.rows.length; i++) {
            if (t.rows[i].length !== t.columns.length) {
              entries.push({
                nodeId: n.id,
                rule: 'table-structure',
                message: `Row ${i + 1} has ${t.rows[i].length} cells but expected ${t.columns.length}.`,
                severity: 'error',
              });
            }
          }
        }
      }
      return entries;
    },
  };
}

/* ── Metadata ─────────────────────────────────────────────────────────── */

function metadataRule(): Rule {
  return {
    name: 'metadata',
    check(doc: DocumentAST): ValidationEntry[] {
      const entries: ValidationEntry[] = [];
      if (!doc.title) {
        entries.push({ rule: 'metadata', message: 'Document has no title.', severity: 'warning' });
      }
      if (doc.metadata.wordCount === 0) {
        entries.push({
          rule: 'metadata',
          message: 'Document appears to have zero words.',
          severity: 'info',
        });
      }
      return entries;
    },
  };
}

/* ── Validation Engine ────────────────────────────────────────────────── */

export function validate(
  doc: DocumentAST,
  options: Partial<ValidationOptions> = {},
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationEntry[] = [];
  const warnings: ValidationEntry[] = [];

  for (const rule of rules(opts)) {
    const entries = rule.check(doc);
    for (const e of entries) {
      if (e.severity === 'error') errors.push(e);
      else warnings.push(e);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function flattenHeadingNodes(nodes: HeadingNode[]): HeadingNode[] {
  const result: HeadingNode[] = [];
  function walk(list: HeadingNode[]) {
    for (const n of list) {
      result.push(n);
      walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

function findHeadingPositions(nodes: ASTNode[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'heading' && nodes[i].id) {
      positions.set(nodes[i].id!, i);
    }
  }
  return positions;
}

export function validateSingle(
  node: ASTNode,
  options: Partial<ValidationOptions> = {},
): ValidationEntry | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (node.type === 'code') {
    const c = node as any;
    if (c.language && !opts.allowedLanguages.includes(c.language)) {
      return {
        nodeId: node.id,
        rule: 'code-language',
        message: `Unknown language identifier "${c.language}".`,
        severity: 'warning',
      };
    }
  }
  if (node.type === 'callout') {
    const c = node as any;
    if (!opts.allowedCallouts.includes(c.kind)) {
      return {
        nodeId: node.id,
        rule: 'callout-kind',
        message: `Disallowed callout kind "${c.kind}".`,
        severity: 'warning',
      };
    }
  }
  return null;
}
