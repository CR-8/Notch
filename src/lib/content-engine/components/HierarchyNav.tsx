import { useState } from 'react';
import type { ContentHierarchy } from '../types';
import type { TOCItem } from '../hierarchy';

interface HierarchyNavProps {
  hierarchy: ContentHierarchy;
  toc: TOCItem[];
  onNavigate: (id: string) => void;
}

function TOCNode({ item, depth, onNavigate }: { item: TOCItem; depth: number; onNavigate: (id: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (depth > 4) return null;

  return (
    <li>
      <button
        onClick={() => {
          onNavigate(item.id);
          setExpanded(v => !v);
        }}
        className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)] transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="text-[10px] text-[var(--color-ink-faint)] shrink-0 w-6">{item.number}</span>
        <span className="truncate">{item.text}</span>
      </button>
      {expanded && item.children.length > 0 && (
        <ul className="list-none">
          {item.children.map((child, i) => (
            <TOCNode key={i} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HierarchyNav({ hierarchy, toc, onNavigate }: HierarchyNavProps) {
  const [tab, setTab] = useState<'toc' | 'figures' | 'tables'>('toc');

  const figureCount = hierarchy.figures.length;
  const tableCount = hierarchy.tables.length;
  const diagramCount = hierarchy.diagrams.length;

  return (
    <div className="w-full">
      <div className="flex border-b border-[var(--color-hairline)] mb-3">
        {(['toc', 'figures', 'tables'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[11px] font-medium px-3 py-1.5 transition-colors border-b-2 ${
              tab === t
                ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                : 'text-[var(--color-ink-faint)] border-transparent hover:text-[var(--color-ink-muted)]'
            }`}
          >
            {t === 'toc' ? 'Contents' : t === 'figures' ? `Figures (${figureCount + diagramCount})` : `Tables (${tableCount})`}
          </button>
        ))}
      </div>

      {tab === 'toc' && (
        <ul className="list-none space-y-0.5 max-h-[60vh] overflow-y-auto">
          {toc.map((item, i) => (
            <TOCNode key={i} item={item} depth={0} onNavigate={onNavigate} />
          ))}
        </ul>
      )}

      {tab === 'figures' && (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {[...hierarchy.figures, ...hierarchy.diagrams]
            .sort((a, b) => a.sectionIndex - b.sectionIndex)
            .map((f, i) => (
              <button
                key={i}
                onClick={() => onNavigate(f.id)}
                className="w-full text-left px-2 py-1 rounded text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2"
              >
                <span className="text-[10px] font-medium text-[var(--color-primary)] shrink-0">
                  {f.type === 'figure' ? 'Fig' : 'Diag'} {f.number}
                </span>
                <span className="truncate">{f.caption}</span>
              </button>
            ))}
          {figureCount + diagramCount === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)] px-2">No figures</p>
          )}
        </div>
      )}

      {tab === 'tables' && (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {hierarchy.tables.map((t, i) => (
            <button
              key={i}
              onClick={() => onNavigate(t.id)}
              className="w-full text-left px-2 py-1 rounded text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2"
            >
              <span className="text-[10px] font-medium text-[var(--color-primary)] shrink-0">
                Table {t.number}
              </span>
              <span className="truncate">{t.caption || `Table ${t.number}`}</span>
            </button>
          ))}
          {tableCount === 0 && (
            <p className="text-[12px] text-[var(--color-ink-faint)] px-2">No tables</p>
          )}
        </div>
      )}
    </div>
  );
}
