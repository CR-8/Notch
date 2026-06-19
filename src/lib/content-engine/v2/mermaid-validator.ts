import { validateMermaidCode, detectDiagramType } from '../mermaid/validator';
import type { MermaidValidationResult } from '../mermaid/validator';

export type V2MermaidDiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'journey'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'timeline'
  | 'gitGraph'
  | 'architecture'
  | 'block'
  | 'packet'
  | 'quadrantChart'
  | 'requirementDiagram'
  | 'c4'
  | 'sankey'
  | 'xyChart'
  | 'gitgraph'
  | 'c4context'
  | 'c4container'
  | 'c4component';

export interface V2MermaidValidationResult extends MermaidValidationResult {
  type: V2MermaidDiagramType | null;
  warnings: string[];
  suggestions: string[];
  fixable: boolean;
}

const SYNTAX_RULES: Record<string, RegExp[]> = {
  flowchart: [
    /^(flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/m,
    /--+|===|<-+>|\.\.+/,
  ],
  sequenceDiagram: [
    /->>|-->>|->>\+|-->>\+|->x|-->>x/,
    /\b(participant|actor|box)\s+\w+/,
  ],
  classDiagram: [
    /\bclass\s+\w+/,
    /<\|--|\*--|o--|\.\.>/,
  ],
  stateDiagram: [
    /^stateDiagram/m,
    /-->|:\s/,
    /\[{2}|\]{2}/,
  ],
  erDiagram: [
    /\|\|--o\{|\}|oo--\|/,
    /\{*\s*\w+\s*\{/,
  ],
  journey: [
    /^journey\s/m,
    /^title\s+/m,
    /^section\s+/m,
  ],
  gantt: [
    /^gantt\s/m,
    /^dateFormat\s+/m,
    /^title\s+/m,
    /^section\s+/m,
  ],
  pie: [
    /^pie\s/m,
    /"/,
  ],
  mindmap: [
    /^mindmap\s/m,
    /\(\(/,
  ],
  timeline: [
    /^timeline\s/m,
    /^title\s+/m,
  ],
  gitGraph: [
    /^gitGraph\s/m,
    /\b(commit|branch|checkout|merge)\b/,
  ],
  block: [
    /^block\s/m,
    /\{/,
  ],
  quadrantChart: [
    /^quadrantChart\s/m,
    /^title\s+/m,
    /"|x-axis|y-axis/,
  ],
  requirementDiagram: [
    /^requirementDiagram\s/m,
    /\b(requirement|element|relationship)\b/,
  ],
  sankey: [
    /^sankey-beta\s/m,
    /\s+\d+\.?\d*\s+/,
  ],
  xyChart: [
    /^xychart-beta\s/m,
    /^title\s+/m,
    /^x-axis\s+|^y-axis\s+/m,
    /^line\s+|^bar\s+/m,
  ],
  c4context: [
    /^C4Context\s/m,
    /\b(Person|System|System_Boundary)\b/,
  ],
  c4container: [
    /^C4Container\s/m,
    /\b(Container|Container_Boundary)\b/,
  ],
  c4component: [
    /^C4Component\s/m,
    /\b(Component|Component_Boundary)\b/,
  ],
};

export class MermaidValidatorV2 {
  validate(code: string): V2MermaidValidationResult {
    const baseResult = validateMermaidCode(code);
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const type = this.detectAdvancedType(code);

    if (type) {
      const typeRules = SYNTAX_RULES[type] ?? [];
      for (const rule of typeRules) {
        if (!rule.test(code)) {
          warnings.push(`Missing expected syntax pattern for ${type}: ${rule.source}`);
        }
      }
    }

    const structuralWarnings = this.checkStructuralIssues(code);
    warnings.push(...structuralWarnings);

    const suggestionList = this.generateSuggestions(code, type, baseResult);
    suggestions.push(...suggestionList);

    const fixable = baseResult.errors.length > 0 || warnings.length > 0;

    return {
      valid: baseResult.valid && warnings.length === 0,
      errors: baseResult.errors,
      type,
      warnings,
      suggestions,
      fixable,
    };
  }

  validateAll(diagrams: Array<{ id: string; code: string }>): Map<string, V2MermaidValidationResult> {
    const results = new Map<string, V2MermaidValidationResult>();
    for (const diagram of diagrams) {
      results.set(diagram.id, this.validate(diagram.code));
    }
    return results;
  }

  private detectAdvancedType(code: string): V2MermaidDiagramType | null {
    const baseType = detectDiagramType(code);
    if (baseType) {
      if (baseType === 'gitgraph' || baseType === 'gitGraph') {
        return code.includes('gitGraph') ? 'gitGraph' : 'gitgraph';
      }
      const typeMap: Record<string, V2MermaidDiagramType> = {
        flowchart: 'flowchart',
        sequenceDiagram: 'sequenceDiagram',
        classDiagram: 'classDiagram',
        stateDiagram: 'stateDiagram',
        erDiagram: 'erDiagram',
        journey: 'journey',
        gantt: 'gantt',
        pie: 'pie',
        mindmap: 'mindmap',
        timeline: 'timeline',
        gitGraph: 'gitGraph',
        gitgraph: 'gitgraph',
        architecture: 'architecture',
        block: 'block',
        packet: 'packet',
        quadrantChart: 'quadrantChart',
        requirementDiagram: 'requirementDiagram',
        c4: 'c4context',
        sankey: 'sankey',
        xyChart: 'xyChart',
      };
      return typeMap[baseType] ?? null;
    }

    const trimmed = code.trim();
    if (/^(C4Context|C4Container|C4Component)\b/.test(trimmed)) {
      if (/\bC4Context\b/.test(trimmed)) return 'c4context';
      if (/\bC4Container\b/.test(trimmed)) return 'c4container';
      if (/\bC4Component\b/.test(trimmed)) return 'c4component';
    }

    return null;
  }

  private checkStructuralIssues(code: string): string[] {
    const warnings: string[] = [];
    const lines = code.split('\n');

    let flowchartDirectionSet = false;
    let hasConnections = false;
    const braceStack: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('%%')) continue;

      if (/(flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i.test(line)) {
        flowchartDirectionSet = true;
      }

      if (/-->|===|==>|\.->|<-./.test(line)) {
        hasConnections = true;
      }

      for (const ch of line) {
        if (ch === '{' || ch === '[' || ch === '(') {
          const pair = ch === '{' ? '}' : ch === '[' ? ']' : ')';
          braceStack.push(pair);
        }
        if (ch === '}' || ch === ']' || ch === ')') {
          const expected = braceStack.pop();
          if (expected && ch !== expected) {
            warnings.push(`Line ${i + 1}: Mismatched brace '${ch}', expected '${expected}'`);
          }
        }
      }

      if (/^\s*[a-zA-Z]/.test(line) && !line.startsWith('%%') && !line.includes(' ') && !hasConnections && i === 0) {
        warnings.push('Line 1: Unexecuted node declaration (might be orphaned)');
      }
    }

    if (braceStack.length > 0) {
      warnings.push(`Unclosed braces: ${braceStack.join(', ')}`);
    }

    if (!flowchartDirectionSet && /flowchart|graph/.test(code)) {
      warnings.push('Flowchart direction not explicitly set. Add LR, TB, BT, RL, or TD.');
    }

    return warnings;
  }

  private generateSuggestions(code: string, type: V2MermaidDiagramType | null, result: MermaidValidationResult): string[] {
    const suggestions: string[] = [];

    if (!type) {
      suggestions.push('Add a valid diagram type declaration on the first line');
      return suggestions;
    }

    if (result.errors.length > 0) {
      suggestions.push('Fix syntax errors before rendering');
    }

    const typeSpecific: Partial<Record<V2MermaidDiagramType, () => string[]>> = {
      flowchart: () => {
        const s: string[] = [];
        if (!/\bsubgraph\b/.test(code)) {
          s.push('Consider using subgraph to organize related nodes');
        }
        if (!/\bstyle\b/.test(code)) {
          s.push('Add style declarations for visual differentiation');
        }
        return s;
      },
      sequenceDiagram: () => {
        const s: string[] = [];
        if (!/\b(activate|deactivate)\b/.test(code)) {
          s.push('Use activate/deactivate to show object lifespans');
        }
        if (!/\bnote\s+(right|left|over)\b/i.test(code)) {
          s.push('Add notes for additional context in interactions');
        }
        return s;
      },
      classDiagram: () => {
        const s: string[] = [];
        if (!/[+#~-]\s+\w+/.test(code)) {
          s.push('Add visibility markers (+, #, -, ~) to class members');
        }
        if (!/\b(abstract|interface|enum)\b/.test(code)) {
          s.push('Mark abstract classes or interfaces explicitly');
        }
        return s;
      },
      erDiagram: () => {
        const s: string[] = [];
        if (!/\|o|\|\|/.test(code)) {
          s.push('Use cardinality symbols (||, |o, o|, oo) for relationship clarity');
        }
        return s;
      },
      gantt: () => {
        const s: string[] = [];
        if (!/crit\b/.test(code)) {
          s.push('Mark critical tasks with "crit" for visibility');
        }
        if (!/milestone\b/.test(code)) {
          s.push('Add milestones to mark key dates');
        }
        return s;
      },
      pie: () => {
        const s: string[] = [];
        if (!/^title\s+/m.test(code)) {
          s.push('Add a title to describe the pie chart');
        }
        return s;
      },
      mindmap: () => {
        const s: string[] = [];
        if (!/\(\(/.test(code)) {
          s.push('Use ((node)) for the root mindmap node');
        }
        return s;
      },
      timeline: () => {
        const s: string[] = [];
        if (!/^section\s+/m.test(code)) {
          s.push('Use sections to group timeline events');
        }
        return s;
      },
    };

    const generator = typeSpecific[type];
    if (generator) {
      suggestions.push(...generator());
    }

    return suggestions;
  }
}

export function createMermaidValidatorV2(): MermaidValidatorV2 {
  return new MermaidValidatorV2();
}
