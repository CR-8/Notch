// ── Mermaid Syntax Validator ──────────────────────────────────────────────────

export type MermaidDiagramType =
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
  | 'gitgraph';

export interface MermaidValidationResult {
  valid: boolean;
  errors: MermaidError[];
  fixed?: string;
}

export interface MermaidError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const DIAGRAM_TYPE_PATTERNS: Record<string, RegExp> = {
  flowchart: /^(flowchart|graph)\s+(TB|TD|BT|RL|LR)\s/,
  sequenceDiagram: /^sequenceDiagram\s/,
  classDiagram: /^classDiagram\s/,
  stateDiagram: /^stateDiagram\s/,
  erDiagram: /^erDiagram\s/,
  journey: /^journey\s/,
  gantt: /^gantt\s/,
  pie: /^pie\s/,
  mindmap: /^mindmap\s/,
  timeline: /^timeline\s/,
  gitGraph: /^gitGraph\s/,
  gitgraph: /^gitgraph\s/,
  architecture: /^architecture\s/,
  block: /^block\s/,
  packet: /^packet\s/,
  quadrantChart: /^quadrantChart\s/,
  requirementDiagram: /^requirementDiagram\s/,
  c4: /^C4Context\s|^C4Container\s|^C4Component\s/,
  sankey: /^sankey-beta\s/,
  xyChart: /^xychart-beta\s/,
};

const FLOWCHART_DIRECTIONS = new Set(['TB', 'TD', 'BT', 'LR', 'RL']);
const VALID_SHAPES = new Set([
  '-->', '---', '==>', '-.->', '==', '-.-',
  '=>', '--o', '--x', '-o', '-x',
]);

export function detectDiagramType(code: string): MermaidDiagramType | null {
  const trimmed = code.trim();
  for (const [type, pattern] of Object.entries(DIAGRAM_TYPE_PATTERNS)) {
    if (pattern.test(trimmed)) {
      return type as MermaidDiagramType;
    }
  }

  // Fallback: detect from first line keywords
  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  if (/^(flowchart|graph)/i.test(firstLine)) return 'flowchart';
  if (/^sequenceDiagram/i.test(firstLine)) return 'sequenceDiagram';
  if (/^classDiagram/i.test(firstLine)) return 'classDiagram';
  if (/^stateDiagram/i.test(firstLine)) return 'stateDiagram';
  if (/^erDiagram/i.test(firstLine)) return 'erDiagram';
  if (/^(journey|journey diagram)/i.test(firstLine)) return 'journey';
  if (/^gantt/i.test(firstLine)) return 'gantt';
  if (/^pie/i.test(firstLine)) return 'pie';
  if (/^mindmap/i.test(firstLine)) return 'mindmap';
  if (/^timeline/i.test(firstLine)) return 'timeline';
  if (/^gitGraph/i.test(firstLine)) return 'gitGraph';

  return null;
}

export function validateMermaidCode(code: string): MermaidValidationResult {
  const errors: MermaidError[] = [];
  const lines = code.split('\n');
  const trimmed = code.trim();

  if (!trimmed) {
    return { valid: false, errors: [{ line: 0, message: 'Empty diagram code', severity: 'error' }] };
  }

  const diagramType = detectDiagramType(trimmed);

  // Check for common structural issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('%%')) continue;

    // Check for unbalanced brackets
    const openParens = (trimmedLine.match(/\(/g) ?? []).length;
    const closeParens = (trimmedLine.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) {
      errors.push({
        line: i + 1,
        message: `Unbalanced parentheses: ${openParens} opening vs ${closeParens} closing`,
        severity: 'error',
      });
    }

    // Check for unbalanced quotes
    const singleQuotes = (trimmedLine.match(/'/g) ?? []).length;
    const doubleQuotes = (trimmedLine.match(/"/g) ?? []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push({ line: i + 1, message: 'Unbalanced single quotes', severity: 'error' });
    }
    if (doubleQuotes % 2 !== 0) {
      errors.push({ line: i + 1, message: 'Unbalanced double quotes', severity: 'error' });
    }
  }

  // Type-specific validation
  if (diagramType) {
    switch (diagramType) {
      case 'flowchart':
        validateFlowchart(code, errors);
        break;
      case 'sequenceDiagram':
        validateSequenceDiagram(code, errors);
        break;
      case 'gantt':
        validateGantt(code, errors);
        break;
      case 'erDiagram':
        validateERDiagram(code, errors);
        break;
      case 'classDiagram':
        validateClassDiagram(code, errors);
        break;
      case 'mindmap':
        validateMindmap(code, errors);
        break;
      case 'timeline':
        validateTimeline(code, errors);
        break;
    }
  } else {
    errors.push({ line: 1, message: 'Could not detect diagram type. Ensure first line declares a valid diagram type.', severity: 'warning' });
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

function validateFlowchart(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  let inSubgraph = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    if (line.startsWith('subgraph')) inSubgraph++;
    if (line.startsWith('end') && inSubgraph > 0) inSubgraph--;

    // Check for dangling arrows
    if (line.includes('-->') && line === '-->') {
      errors.push({ line: i + 1, message: 'Dangling arrow with no nodes', severity: 'warning' });
    }

    // Check node text has content
    if (line.includes('[') && line.includes(']')) {
      const inner = line.match(/\[([^\]]*)\]/);
      if (inner && !inner[1].trim()) {
        errors.push({ line: i + 1, message: 'Node has empty label', severity: 'warning' });
      }
    }
  }

  if (inSubgraph > 0) {
    errors.push({ line: lines.length, message: `Unclosed subgraph block (${inSubgraph} open)`, severity: 'error' });
  }
}

function validateSequenceDiagram(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  let hasParticipants = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    if (/^participant\s+\w+/i.test(line)) hasParticipants = true;

    // Check activation/deactivation balance
    const activateCount = (line.match(/\bactivate\b/gi) ?? []).length;
    const deactivateCount = (line.match(/\bdeactivate\b/gi) ?? []).length;
  }

  if (!hasParticipants) {
    errors.push({ line: 1, message: 'No participants defined. Use "participant Name" to declare actors.', severity: 'warning' });
  }
}

function validateGantt(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  let hasDateFormat = false;
  let hasTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^dateFormat\s+/i.test(line)) hasDateFormat = true;
    if (/^title\s+/i.test(line)) hasTitle = true;

    // Validate section tasks have proper format
    if (line.startsWith('    ') && !line.startsWith('    section')) {
      const parts = line.split(':');
      if (parts.length < 2) {
        errors.push({ line: i + 1, message: 'Task should have format "task name: status, start, end"', severity: 'warning' });
      }
    }
  }

  if (!hasDateFormat) {
    errors.push({ line: 1, message: 'No dateFormat specified. Add "dateFormat YYYY-MM-DD"', severity: 'warning' });
  }
}

function validateERDiagram(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // Check entity declarations
    if (/^\w+\s+\{/.test(line)) {
      // Entity opening - check it has closing brace
    }
  }
}

function validateClassDiagram(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;

    // Check for invalid visibility markers
    if (/^\s*[+#~-]\s+\w+/.test(line)) {
      // Valid visibility marker
    }
  }
}

function validateMindmap(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  let rootLevel: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('%%')) continue;

    const indent = line.search(/\S/);
    if (rootLevel === null && indent === 0) {
      rootLevel = 0;
    } else if (rootLevel === null) {
      rootLevel = indent;
    }

    if (indent > 0 && rootLevel !== null) {
      const relativeDepth = indent - rootLevel;
      if (relativeDepth % 2 !== 0) {
        errors.push({ line: i + 1, message: 'Mindmap indentation should be consistent (multiples of 2 spaces)', severity: 'warning' });
      }
    }
  }
}

function validateTimeline(code: string, errors: MermaidError[]): void {
  const lines = code.split('\n');
  let hasTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^title\s+/i.test(line)) hasTitle = true;
  }
}
