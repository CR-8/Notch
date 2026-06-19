import { useState, useMemo } from 'react';
import type { RichTableElement } from '../types';
import { InlineMarkdown } from './InlineMarkdown';
import { inlineToPlainText } from '../inline-md';

interface RichTableProps {
  data: RichTableElement;
  number?: number;
}

export function RichTable({ data, number }: RichTableProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState('');

  const processedRows = useMemo(() => {
    let rows = [...data.rows];

    // Filter — compare against plain text so markdown markers don't interfere.
    if (filterText) {
      const lower = filterText.toLowerCase();
      rows = rows.filter(row =>
        row.some(cell => inlineToPlainText(cell).toLowerCase().includes(lower)),
      );
    }

    // Sort — on the rendered (plain) text, not the raw markdown.
    if (sortColumn !== null) {
      rows.sort((a, b) => {
        const aVal = inlineToPlainText(a[sortColumn] ?? '').toLowerCase();
        const bVal = inlineToPlainText(b[sortColumn] ?? '').toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return sortAsc ? cmp : -cmp;
      });
    }

    return rows;
  }, [data.rows, sortColumn, sortAsc, filterText]);

  function toggleSort(colIndex: number) {
    if (sortColumn === colIndex) {
      setSortAsc(v => !v);
    } else {
      setSortColumn(colIndex);
      setSortAsc(true);
    }
  }

  return (
    <div className="my-6" data-table-id={data.caption}>
      {data.caption && (
        <p className="text-[13px] text-[var(--color-ink-muted)] mb-2 font-medium">
          {number ? `Table ${number}: ` : ''}<InlineMarkdown text={data.caption} />
        </p>
      )}

      {data.filterable && (
        <div className="mb-2">
          <input
            type="text"
            placeholder="Filter table..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="notion-input text-[12px] w-full max-w-[240px]"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-hairline)]">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-[var(--color-canvas-soft)]">
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-4 py-2.5 text-[12px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide border-b border-[var(--color-hairline)] ${
                    data.sortable ? 'cursor-pointer hover:bg-[var(--color-surface-hover)] select-none' : ''
                  }`}
                  style={{ textAlign: col.align }}
                  onClick={() => data.sortable && toggleSort(i)}
                >
                  <span className="inline-flex items-center gap-1">
                    <InlineMarkdown text={col.header} />
                    {data.sortable && sortColumn === i && (
                      <span className="text-[10px]">{sortAsc ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.columns.length}
                  className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-faint)]"
                >
                  No matching rows
                </td>
              </tr>
            ) : (
              processedRows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-[var(--color-hairline)] last:border-b-0 hover:bg-[var(--color-surface-hover)]/50 transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-4 py-2.5 text-[13px] text-[var(--color-ink)]"
                      style={{ textAlign: data.columns[ci]?.align ?? 'left' }}
                    >
                      <InlineMarkdown text={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[var(--color-ink-faint)] mt-1.5">
        {processedRows.length} of {data.rows.length} rows
        {data.sortable && ' — Click headers to sort'}
      </p>
    </div>
  );
}
