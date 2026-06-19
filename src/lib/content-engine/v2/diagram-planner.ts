// ── Diagram Planning Engine ───────────────────────────────────────────────────

import type { PlannedDiagram, DiagramPlanType, DiagramPlanResult, ContentFrame, DepthMode } from './types';
import { DEPTH_CONFIGS } from './types';

export class DiagramPlanner {
  private mode: DepthMode;
  private planned: PlannedDiagram[] = [];

  constructor(mode: DepthMode) {
    this.mode = mode;
  }

  planDiagrams(frames: ContentFrame[]): DiagramPlanResult {
    this.planned = [];
    const config = DEPTH_CONFIGS[this.mode];
    let priority = 0;

    for (const frame of frames) {
      const framePlans = this.planForFrame(frame, priority);
      this.planned.push(...framePlans);
      priority += framePlans.length;
    }

    // Sort by priority and trim to budget
    this.planned.sort((a, b) => b.priority - a.priority);
    const totalPossible = this.planned.length;
    const totalNeeded = Math.min(this.planned.length, config.maxDiagrams);
    this.planned = this.planned.slice(0, totalNeeded);

    return {
      diagrams: this.planned,
      totalNeeded,
      totalPossible,
    };
  }

  private planForFrame(frame: ContentFrame, basePriority: number): PlannedDiagram[] {
    const plans: PlannedDiagram[] = [];
    const text = frame.sourceText;
    const topic = frame.topic;
    const lower = text.toLowerCase();
    let priority = basePriority;

    // Architecture detection
    if (this.shouldPlanArchitecture(lower, frame)) {
      plans.push(this.createPlan('architecture', frame, 'System architecture', priority + 10));
      plans.push(this.createPlan('component', frame, 'Component breakdown', priority + 8));
    }

    // Flowchart detection
    if (this.shouldPlanFlowchart(lower, frame)) {
      plans.push(this.createPlan('flowchart', frame, 'Process flow', priority + 9));
    }

    // Sequence detection
    if (this.shouldPlanSequence(lower, frame)) {
      plans.push(this.createPlan('sequence', frame, 'Interaction sequence', priority + 9));
    }

    // ER/Data detection
    if (this.shouldPlanER(lower, frame)) {
      plans.push(this.createPlan('er', frame, 'Entity relationships', priority + 7));
    }

    // Class diagram detection
    if (this.shouldPlanClass(lower, frame)) {
      plans.push(this.createPlan('class', frame, 'Class structure', priority + 7));
    }

    // State diagram detection
    if (this.shouldPlanState(lower, frame)) {
      plans.push(this.createPlan('state', frame, 'State transitions', priority + 6));
    }

    // Mindmap for knowledge-heavy frames
    if (frame.metadata.keyTerms.length >= 4) {
      plans.push(this.createPlan('mindmap', frame, 'Knowledge map', priority + 5));
    }

    // Timeline for chronological content
    if (this.shouldPlanTimeline(lower, frame)) {
      plans.push(this.createPlan('timeline', frame, 'Timeline', priority + 6));
    }

    // Gantt for project/process content
    if (this.shouldPlanGantt(lower, frame)) {
      plans.push(this.createPlan('gantt', frame, 'Schedule', priority + 5));
    }

    // Multiplied by depth mode
    const multiplier = DEPTH_CONFIGS[this.mode].diagramMultiplier;
    return plans.slice(0, Math.ceil(plans.length * multiplier));
  }

  private shouldPlanArchitecture(text: string, frame: ContentFrame): boolean {
    const architectureTerms = /\b(architecture|system|infrastructure|component|service|layer|module|platform|framework)\b/i;
    const hasComponents = /\b(api|database|server|client|gateway|queue|cache|worker|load\s*balancer)\b/i;
    return architectureTerms.test(text) || hasComponents.test(text) || frame.topic === 'Architecture';
  }

  private shouldPlanFlowchart(text: string, frame: ContentFrame): boolean {
    const processTerms = /\b(process|workflow|flow|pipeline|step|stage|phase|sequence|procedure|algorithm)\b/i;
    const hasSteps = /\b(first|second|then|next|finally|if|when|after|before|while)\b/i;
    return processTerms.test(text) || (hasSteps.test(text) && frame.metadata.wordCount > 100) || frame.topic === 'Implementation';
  }

  private shouldPlanSequence(text: string, frame: ContentFrame): boolean {
    const sequenceTerms = /\b(request|response|send|receive|call|invoke|notify|callback|message|event|handler)\b/i;
    const hasInteractions = /\b(client|server|service|provider|consumer|publish|subscribe|emit|listen)\b/i;
    return (sequenceTerms.test(text) && hasInteractions.test(text)) || frame.topic === 'API';
  }

  private shouldPlanER(text: string, frame: ContentFrame): boolean {
    const dataTerms = /\b(entity|relation|attribute|schema|table|column|field|record|database|model|datastore|persist)\b/i;
    const hasRelationships = /\b(has|belongs|owns|contains|references|maps|links|associates)\b/i;
    return dataTerms.test(text) && hasRelationships.test(text) || frame.topic === 'Data';
  }

  private shouldPlanClass(text: string, frame: ContentFrame): boolean {
    const classTerms = /\b(class|interface|abstract|extends|implements|inherits|method|property|object|type)\b/i;
    const hasStructure = /\b{|\bpublic\b|\bprivate\b|\bprotected\b|\bstatic\b|\bfunction\b|\bmethod\b/;
    return classTerms.test(text) && hasStructure.test(text);
  }

  private shouldPlanState(text: string, frame: ContentFrame): boolean {
    const stateTerms = /\b(state|status|transition|phase|stage|mode|lifecycle|cycle)\b/i;
    return stateTerms.test(text) && /\b(from|to|change|become|enter|exit|start|stop|pause)\b/i.test(text);
  }

  private shouldPlanTimeline(text: string, frame: ContentFrame): boolean {
    const timelineTerms = /\b(timeline|history|evolution|chang?angelog|roadmap|milestone|version|release|date|year|month)\b/i;
    return timelineTerms.test(text) && /\b\d{4}\b/.test(text);
  }

  private shouldPlanGantt(text: string, frame: ContentFrame): boolean {
    const ganttTerms = /\b(schedule|deadline|duration|timeline|milestone|phase|sprint|quarter)\b/i;
    return ganttTerms.test(text) && /\b(days?|weeks?|months?|Q[1-4]|sprint)\b/i.test(text);
  }

  private createPlan(type: DiagramPlanType, frame: ContentFrame, reason: string, priority: number): PlannedDiagram {
    return {
      id: `diagram-${frame.index}-${type}`,
      type,
      reason,
      sectionRef: frame.id,
      mermaidTemplate: this.getMermaidTemplate(type, frame),
      plantumlFallback: this.getPlantUMLFallback(type, frame),
      priority,
    };
  }

  getPlannedDiagrams(): PlannedDiagram[] {
    return this.planned;
  }

  getMermaidTemplate(type: DiagramPlanType, frame: ContentFrame): string {
    const title = frame.title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    switch (type) {
      case 'architecture':
        return `flowchart TB\n  subgraph ${title}\n    A[Component] --> B[Service]\n    B --> C[Database]\n  end\n  User --> A`;
      case 'flowchart':
        return `flowchart LR\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D`;
      case 'sequence':
        return `sequenceDiagram\n  participant Client\n  participant Server\n  participant DB\n  Client->>Server: Request\n  Server->>DB: Query\n  DB-->>Server: Result\n  Server-->>Client: Response`;
      case 'class':
        return `classDiagram\n  class ${title.replace(/\s/g, '')} {\n    +attribute\n    +operation()\n  }\n  class Related {\n    +attribute\n    +operation()\n  }\n  ${title.replace(/\s/g, '')} --> Related`;
      case 'er':
        return `erDiagram\n  ENTITY1 ||--o{ ENTITY2 : relates`;
      case 'mindmap':
        return `mindmap\n  root((${title}))\n    Topic1\n      Subtopic\n    Topic2\n    Topic3`;
      case 'timeline':
        return `timeline\n  title ${title}\n  Event 1 : Description\n  Event 2 : Description\n  Event 3 : Description`;
      case 'state':
        return `stateDiagram-v2\n  [*] --> Idle\n  Idle --> Processing : Start\n  Processing --> Complete : Finish\n  Complete --> [*]`;
      case 'gantt':
        return `gantt\n  title ${title}\n  dateFormat YYYY-MM-DD\n  section Phase 1\n  Task 1 :a1, 2024-01-01, 30d\n  Task 2 :after a1, 20d`;
      default:
        return `flowchart LR\n  A[Start] --> B[End]`;
    }
  }

  private getPlantUMLFallback(type: DiagramPlanType, frame: ContentFrame): string {
    switch (type) {
      case 'component':
        return `@startuml\ncomponent "${frame.title}" {\n  interface "API"\n  component "Logic" {\n    [Service]\n  }\n}\n@enduml`;
      case 'deployment':
        return `@startuml\nnode "Server" {\n  artifact "App"\n}\nnode "Database" {\n  database "DB"\n}\n@enduml`;
      case 'sequence':
        return `@startuml\nactor User\nparticipant System\ndatabase DB\nUser -> System : request\nSystem -> DB : query\nDB --> System : data\nSystem --> User : response\n@enduml`;
      default:
        return `@startuml\n@enduml`;
    }
  }
}

export function createDiagramPlanner(mode: DepthMode): DiagramPlanner {
  return new DiagramPlanner(mode);
}
