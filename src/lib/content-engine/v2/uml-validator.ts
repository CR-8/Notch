import type { DiagramPlanType, ContentFrame } from './types';

export interface UMLValidationResult {
  valid: boolean;
  errors: UMLError[];
  warnings: string[];
  fallback: string | null;
  mermaidEquivalent: string | null;
  convertable: boolean;
}

export interface UMLError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface UMLDiagramInfo {
  kind: 'component' | 'deployment' | 'sequence' | 'activity' | 'usecase';
  label: string;
  content: string;
  id: string;
}

const PLANTUML_HEADER = /^@startuml\s*$/m;
const PLANTUML_FOOTER = /^@enduml\s*$/m;
const PLANTUML_TYPES = [
  /^\s*(actor|participant|usecase|boundary|control|entity|database|collections|queue)\b/im,
  /^\s*(class|interface|enum|abstract)\b/im,
  /^\s*(component|component\s+\[|artifact|node|folder|file|frame|cloud|datatabase|storage)\b/im,
  /^\s*(state|state\s+\[|hide|skinparam|note|partition)\b/im,
  /^\s*(start|stop|end|if|else|endif|repeat|while|fork|split)\b/im,
];

export class UMLValidator {
  validate(content: string): UMLValidationResult {
    const errors: UMLError[] = [];
    const warnings: string[] = [];

    if (!content.trim()) {
      return {
        valid: false,
        errors: [{ line: 0, message: 'Empty PlantUML content', severity: 'error' }],
        warnings: [],
        fallback: null,
        mermaidEquivalent: null,
        convertable: false,
      };
    }

    if (!PLANTUML_HEADER.test(content)) {
      errors.push({ line: 1, message: 'Missing @startuml declaration', severity: 'error' });
    }

    if (!PLANTUML_FOOTER.test(content)) {
      errors.push({ line: content.split('\n').length, message: 'Missing @enduml declaration', severity: 'error' });
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("'")) continue;

      this.checkLineIssues(line, i + 1, errors);
    }

    const hasContent = lines.some(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("'") && !trimmed.startsWith('@start') && !trimmed.startsWith('@end');
    });

    if (!hasContent) {
      warnings.push('PlantUML diagram has no content between @startuml and @enduml');
    }

    const hasElements = PLANTUML_TYPES.some(pattern => pattern.test(content));
    if (!hasElements) {
      warnings.push('No recognizable PlantUML elements found (actors, components, states, etc.)');
    }

    const fallback = this.generateFallbackMarkdown(content);
    const mermaidEquivalent = this.suggestMermaidEquivalent(content);
    const convertable = mermaidEquivalent !== null;

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      fallback,
      mermaidEquivalent,
      convertable,
    };
  }

  shouldUsePlantUML(frame: ContentFrame): boolean {
    const topic = frame.topic;
    const text = frame.sourceText;

    const componentTerms = /\b(component|deployment|artifact|node|execution environment|runtime)\b/i;
    const deploymentTerms = /\b(deploy|server|hosting|infrastructure|cluster|container|orchestrat)\b/i;
    const activityTerms = /\b(workflow|activity|action|decision|fork|join|swimlane)\b/i;

    if (frame.metadata.hasDiagrams && /```plantuml/.test(text)) return true;

    if (topic === 'Architecture' && deploymentTerms.test(text) && componentTerms.test(text)) return true;
    if (topic === 'Deployment' && (deploymentTerms.test(text) || componentTerms.test(text))) return true;

    return false;
  }

  detectUMLDiagrams(frames: ContentFrame[]): UMLDiagramInfo[] {
    const diagrams: UMLDiagramInfo[] = [];

    for (const frame of frames) {
      const text = frame.sourceText;
      const plantumlBlocks = text.match(/```plantuml\n([\s\S]*?)```/g);

      if (plantumlBlocks) {
        for (const block of plantumlBlocks) {
          const content = block.replace(/```plantuml\n|\n```/g, '').trim();
          diagrams.push({
            kind: this.inferUMLKind(content),
            label: frame.title,
            content,
            id: `uml-${frame.index}`,
          });
        }
      }
    }

    return diagrams;
  }

  getConversionAdvice(frame: ContentFrame): {
    shouldConvert: boolean;
    targetType: DiagramPlanType | null;
    mermaidTemplate: string;
  } {
    if (!this.shouldUsePlantUML(frame)) {
      const mermaidEquivalent = this.suggestMermaidEquivalent(frame.sourceText);
      if (mermaidEquivalent) {
        return {
          shouldConvert: true,
          targetType: this.inferDiagramPlanType(mermaidEquivalent),
          mermaidTemplate: mermaidEquivalent,
        };
      }
    }

    return {
      shouldConvert: false,
      targetType: null,
      mermaidTemplate: '',
    };
  }

  private checkLineIssues(line: string, lineNum: number, errors: UMLError[]): void {
    const bracketMap: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
    const stack: Array<{ char: string; line: number }> = [];

    for (const ch of line) {
      if (ch in bracketMap) {
        stack.push({ char: ch, line: lineNum });
      }
      if (ch === '}' || ch === ']' || ch === ')') {
        const expected = Object.entries(bracketMap).find(([, v]) => v === ch)?.[0];
        const last = stack.pop();
        if (last && last.char !== expected) {
          errors.push({
            line: lineNum,
            message: `Mismatched bracket '${ch}', expected '${bracketMap[last.char] || '?'}'`,
            severity: 'error',
          });
        }
      }
    }

    if (line.startsWith('skinparam') && !line.includes('{')) {
      const hasSkin = /^skinparam\s+\w+\s/.test(line);
      if (!hasSkin) {
        errors.push({ line: lineNum, message: 'Invalid skinparam format', severity: 'warning' });
      }
    }

    if (line.includes('-->') && line.match(/->/g)!.length > 4) {
      errors.push({ line: lineNum, message: 'Excessive arrows on single line', severity: 'warning' });
    }
  }

  private inferUMLKind(content: string): UMLDiagramInfo['kind'] {
    if (/\b(component|component\s+\[|artifact|node|folder|file|frame|cloud)\b/i.test(content)) return 'component';
    if (/\b(deploy|node|device|system\s+context|runtime)\b/i.test(content)) return 'deployment';
    if (/->/.test(content) && /\b(actor|participant)\b/i.test(content)) return 'sequence';
    if (/\b(if|else|endif|repeat|while|fork|split|start|stop|end)\b/i.test(content)) return 'activity';
    if (/\b(usecase|actor)\b/i.test(content)) return 'usecase';
    return 'component';
  }

  private inferDiagramPlanType(mermaidCode: string): DiagramPlanType | null {
    if (/^flowchart\b|^graph\b/.test(mermaidCode)) return 'flowchart';
    if (/^sequenceDiagram\b/.test(mermaidCode)) return 'sequence';
    if (/^classDiagram\b/.test(mermaidCode)) return 'class';
    if (/^stateDiagram\b/.test(mermaidCode)) return 'state';
    if (/^erDiagram\b/.test(mermaidCode)) return 'er';
    if (/^mindmap\b/.test(mermaidCode)) return 'mindmap';
    if (/^timeline\b/.test(mermaidCode)) return 'timeline';
    if (/^gantt\b/.test(mermaidCode)) return 'gantt';
    return null;
  }

  private suggestMermaidEquivalent(content: string): string | null {
    if (/\bcomponent\b/i.test(content) && /\binterface\b/i.test(content)) {
      return `flowchart TB\n  subgraph System\n    A[Component] -->|API| B[Component]\n  end`;
    }

    if (/\b(actor|participant)\b/i.test(content) && /->/.test(content)) {
      return `sequenceDiagram\n  participant Client\n  participant Server\n  Client->>Server: Request\n  Server-->>Client: Response`;
    }

    if (/\bstate\b/i.test(content) && /-->/.test(content)) {
      return `stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : Start\n  Active --> [*] : Complete`;
    }

    if (/\b(class|interface|abstract|enum)\b/i.test(content)) {
      return `classDiagram\n  class Example {\n    +attribute\n    +operation()\n  }`;
    }

    return null;
  }

  private generateFallbackMarkdown(content: string): string | null {
    const lines = content.split('\n').filter(l => {
      const t = l.trim();
      return t && !t.startsWith('@') && !t.startsWith("'");
    });

    if (lines.length === 0) return null;

    return ['**PlantUML Diagram (fallback text):**', '', ...lines.map(l => `- ${l.trim()}`)].join('\n');
  }
}

export function createUMLValidator(): UMLValidator {
  return new UMLValidator();
}
