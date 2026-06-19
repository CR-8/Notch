// ── Mermaid direction selection (Problem 5) ──────────────────────────────────
// Never hardcode `graph TD`. Pick the orientation from the diagram's semantic role.

export type MermaidDirection = 'TD' | 'LR' | 'RL' | 'BT';

export type DiagramRole =
  | 'timeline' | 'pipeline' | 'workflow' | 'process'   // → LR
  | 'hierarchy' | 'tree' | 'org' | 'mindmap'           // → TD
  | 'dependency' | 'reverse'                            // → RL
  | 'rootcause' | 'escalation';                         // → BT

const ROLE_DIRECTION: Record<DiagramRole, MermaidDirection> = {
  timeline: 'LR', pipeline: 'LR', workflow: 'LR', process: 'LR',
  hierarchy: 'TD', tree: 'TD', org: 'TD', mindmap: 'TD',
  dependency: 'RL', reverse: 'RL',
  rootcause: 'BT', escalation: 'BT',
};

/** Maps a semantic role to a flow direction. */
export function directionForRole(role: DiagramRole): MermaidDirection {
  return ROLE_DIRECTION[role] ?? 'TD';
}

/**
 * Infers the best direction from a diagram type + the text it describes. Pure.
 * Falls back to LR for left-to-right reading comfort on flow-like diagrams.
 */
export function selectMermaidDirection(diagramType: string, text = ''): MermaidDirection {
  const t = diagramType.toLowerCase();
  const l = text.toLowerCase();

  if (/timeline|gantt|roadmap|evolution|history/.test(t)) return 'LR';
  if (/sequence/.test(t)) return 'LR';
  if (/mindmap|hierarch|tree|org|class/.test(t)) return 'TD';
  if (/\b(root cause|rca|escalation|fishbone|why\b)/.test(l)) return 'BT';
  if (/\b(depend|requires|prerequisite|upstream)\b/.test(l)) return 'RL';
  if (/\b(pipeline|workflow|process|flow|stage|step|phase)\b/.test(l)) return 'LR';
  if (/architecture|component|system/.test(t)) return 'TD'; // top-down for layered systems
  return 'LR';
}

/** Rewrites a leading `graph TD` / `flowchart TD` to the chosen direction. */
export function applyDirection(mermaid: string, direction: MermaidDirection): string {
  return mermaid.replace(
    /^(\s*(?:graph|flowchart))\s+(TB|TD|LR|RL|BT)/im,
    (_m, head) => `${head} ${direction}`,
  );
}
