// ── UML Integration ───────────────────────────────────────────────────────────

import type { UMLKind } from '../types';

export interface UMLGenerationRequest {
  kind: UMLKind;
  content: string;
  title?: string;
  actors?: string[];
  components?: string[];
}

export interface UMLGenerationResult {
  kind: UMLKind;
  plantumlCode: string;
  isValid: boolean;
  errors: string[];
}

// Detect UML type from content and generate PlantUML code
export function generatePlantUMLCode(request: UMLGenerationRequest): UMLGenerationResult {
  const errors: string[] = [];

  switch (request.kind) {
    case 'class':
      return { ...request, plantumlCode: buildClassDiagram(request), isValid: true, errors: [] };
    case 'sequence':
      return { ...request, plantumlCode: buildSequenceDiagram(request), isValid: true, errors: [] };
    case 'activity':
      return { ...request, plantumlCode: buildActivityDiagram(request), isValid: true, errors: [] };
    case 'usecase':
      return { ...request, plantumlCode: buildUseCaseDiagram(request), isValid: true, errors: [] };
    case 'component':
      return { ...request, plantumlCode: buildComponentDiagram(request), isValid: true, errors: [] };
    case 'deployment':
      return { ...request, plantumlCode: buildDeploymentDiagram(request), isValid: true, errors: [] };
    default:
      return { ...request, plantumlCode: '', isValid: false, errors: [`Unsupported UML kind: ${request.kind}`] };
  }
}

export function detectUMLIntent(content: string): UMLKind | null {
  const lower = content.toLowerCase();

  if (/\b(interface|abstract class|class\s+\w+|extends|implements)\b/i.test(content)
    && /\{/.test(content)
    && /\+|\-|#/.test(content)) {
    return 'class';
  }

  if (/\b(request|response|send|receive|notify|callback|actor|participant|->>?|-->>?)\b/i.test(content)) {
    return 'sequence';
  }

  if (/\b(start|stop|action|decision|if|then|else|flow|workflow)\b/i.test(content)) {
    return 'activity';
  }

  if (/\b(actor|use case|scenario|system boundary)\b/i.test(content)) {
    return 'usecase';
  }

  if (/\b(component|interface|connector|port|provided|required)\b/i.test(content)) {
    return 'component';
  }

  if (/\b(node|device|execution environment|artifact|deployment|server)\b/i.test(content)) {
    return 'deployment';
  }

  return null;
}

function buildClassDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Class Diagram'}`, '');
  lines.push(request.content);
  lines.push('', '@enduml');
  return lines.join('\n');
}

function buildSequenceDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Sequence Diagram'}`, '');

  if (request.actors) {
    for (const actor of request.actors) {
      lines.push(`actor "${actor}" as ${actor.replace(/\s+/g, '_')}`);
    }
    lines.push('');
  }

  lines.push(request.content);
  lines.push('', '@enduml');
  return lines.join('\n');
}

function buildActivityDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Activity Diagram'}`, '');
  lines.push(':Start;');
  lines.push(request.content);
  lines.push(':End;');
  lines.push('', '@enduml');
  return lines.join('\n');
}

function buildUseCaseDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Use Case Diagram'}`, '');
  lines.push(request.content);
  lines.push('', '@enduml');
  return lines.join('\n');
}

function buildComponentDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Component Diagram'}`, '');
  lines.push(request.content);
  lines.push('', '@enduml');
  return lines.join('\n');
}

function buildDeploymentDiagram(request: UMLGenerationRequest): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  lines.push(`title ${request.title || 'Deployment Diagram'}`, '');
  lines.push(request.content);
  lines.push('', '@enduml');
  return lines.join('\n');
}

// Convert Mermaid class diagram to PlantUML syntax
export function mermaidClassToPlantUML(mermaidCode: string): string {
  const lines: string[] = ['@startuml', 'skinparam style strictuml', ''];
  const mermaidLines = mermaidCode.split('\n').filter(l => {
    const t = l.trim();
    return t && !t.startsWith('classDiagram') && !t.startsWith('%%');
  });

  for (const line of mermaidLines) {
    const trimmed = line.trim();
    // Mermaid: ClassName { +attribute -method() }
    // PlantUML: class ClassName { +attribute -method() }
    if (/^\w+\s*\{/.test(trimmed)) {
      lines.push(trimmed);
    } else if (trimmed.startsWith('}')) {
      lines.push(trimmed);
    } else if (trimmed.includes('-->') || trimmed.includes('--|>') || trimmed.includes('..|>') || trimmed.includes('..>')) {
      const rel = trimmed
        .replace('-->', '-->')
        .replace('--|>', '<|--')
        .replace('..|>', '<|..')
        .replace('..>', '..>');
      lines.push(rel);
    } else if (/^[+#~-]\s/.test(trimmed)) {
      lines.push('  ' + trimmed);
    } else if (trimmed) {
      lines.push(trimmed);
    }
  }

  lines.push('', '@enduml');
  return lines.join('\n');
}
