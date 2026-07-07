/**
 * NDL Renderer — converts NDL AST to React JSX
 *
 * Reuses existing content-engine components (DiagramBlock,
 * CalloutBlock, RichCodeBlock, RichTable, ImageBlock)
 * where possible. Falls back to raw HTML rendering for
 * paragraph and list nodes.
 */

import React from 'react';
import type { ASTNode, DocumentAST } from '../schemas';

/* ── Renderer Props ──────────────────────────────────────────────────── */

export interface DocumentRendererProps {
  doc: DocumentAST;
  theme?: 'light' | 'dark';
  showTOC?: boolean;
  className?: string;
}

/* ── Simple HTML Rendering (no external deps) ────────────────────────── */

function InlineHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function BlockHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ── Individual Node Renderers ───────────────────────────────────────── */

function renderHeading(node: ASTNode, index: number): React.ReactNode {
  const h = node as any;
  const tag = `h${h.level}` as keyof JSX.IntrinsicElements;
  const id = h.id ?? `h-${index}`;
  const number = h.number ?? '';

  return React.createElement(
    tag,
    { key: `heading-${id}`, id, className: `heading heading-${h.level}` },
    number ? <span className="heading-number">{number}. </span> : null,
    h.text,
  );
}

function renderParagraph(node: ASTNode): React.ReactNode {
  const p = node as any;
  return <p key={p.id ?? 'p'} className="paragraph" dangerouslySetInnerHTML={{ __html: p.html }} />;
}

function renderList(node: ASTNode): React.ReactNode {
  const l = node as any;
  const Tag = l.ordered ? 'ol' : 'ul';
  return (
    <Tag key={l.id ?? 'list'} className={`list ${l.ordered ? 'list-ordered' : 'list-unordered'}`}>
      {l.items.map((item: any, i: number) => (
        <li key={i} className="list-item">
          {item.checked !== undefined ? (
            <label className="task-item">
              <input type="checkbox" checked={item.checked} readOnly />
              <span>{item.content}</span>
            </label>
          ) : (
            <InlineHtml html={item.content} />
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderCode(node: ASTNode): React.ReactNode {
  const c = node as any;
  const lines = c.content.split('\n');
  const lineCount = lines.length;

  return (
    <div key={c.id ?? 'code'} className="code-block-wrapper">
      {c.filename && <div className="code-filename">{c.filename}</div>}
      <pre className={`code-block language-${c.language}`}>
        {c.showLineNumbers && (
          <code className="line-numbers" aria-hidden="true">
            {lines.map((_: string, i: number) => (
              <span key={i} className="line-number">
                {i + 1}
              </span>
            ))}
          </code>
        )}
        <code className={`language-${c.language}`}>{c.content}</code>
      </pre>
    </div>
  );
}

function renderDiagram(node: ASTNode): React.ReactNode {
  const d = node as any;
  return (
    <div key={d.id ?? 'diagram'} className="diagram-block">
      <pre className="mermaid-source">{d.content}</pre>
      {d.caption && <p className="diagram-caption">{d.caption}</p>}
    </div>
  );
}

function renderCallout(node: ASTNode): React.ReactNode {
  const c = node as any;
  const kindClass = `callout callout-${c.kind}`;
  return (
    <div key={c.id ?? 'callout'} className={kindClass}>
      {c.title && <strong className="callout-title">{c.title}</strong>}
      <div className="callout-content" dangerouslySetInnerHTML={{ __html: c.html }} />
    </div>
  );
}

function renderTable(node: ASTNode): React.ReactNode {
  const t = node as any;
  return (
    <div key={t.id ?? 'table'} className="table-wrapper">
      <table className="rich-table">
        <thead>
          <tr>
            {t.columns.map((col: any, i: number) => (
              <th key={i} className={`table-header align-${col.align ?? 'left'}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row: string[], ri: number) => (
            <tr key={ri}>
              {row.map((cell: string, ci: number) => (
                <td key={ci} className={`table-cell align-${t.columns[ci]?.align ?? 'left'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {t.caption && <p className="table-caption">{t.caption}</p>}
    </div>
  );
}

function renderImage(node: ASTNode): React.ReactNode {
  const img = node as any;
  return (
    <figure key={img.id ?? 'img'} className="image-block">
      <img src={img.url} alt={img.alt} loading="lazy" />
      {img.caption && <figcaption className="image-caption">{img.caption}</figcaption>}
    </figure>
  );
}

function renderVideo(node: ASTNode): React.ReactNode {
  const v = node as any;
  return (
    <div key={v.id ?? 'video'} className="video-block">
      {v.provider === 'youtube' || v.provider === 'vimeo' ? (
        <div className="video-embed">
          <iframe src={v.url} title={v.title ?? ''} allowFullScreen loading="lazy" />
        </div>
      ) : (
        <video controls poster={v.posterUrl}>
          <source src={v.url} />
        </video>
      )}
      {v.caption && <p className="video-caption">{v.caption}</p>}
    </div>
  );
}

function renderEquation(node: ASTNode): React.ReactNode {
  const eq = node as any;
  return (
    <div
      key={eq.id ?? 'equation'}
      className={`equation-block ${eq.displayMode ? 'equation-display' : 'equation-inline'}`}
    >
      {eq.displayMode ? (
        <div className="katex-block">{eq.content}</div>
      ) : (
        <span className="katex-inline">{eq.content}</span>
      )}
    </div>
  );
}

function renderBlockquote(node: ASTNode): React.ReactNode {
  const bq = node as any;
  return (
    <blockquote key={bq.id ?? 'bq'} className="blockquote">
      <div dangerouslySetInnerHTML={{ __html: bq.html }} />
      {bq.citation && <cite>{bq.citation}</cite>}
    </blockquote>
  );
}

function renderReference(node: ASTNode): React.ReactNode {
  const ref = node as any;
  return (
    <div key={ref.id ?? 'ref'} className="references-block">
      <h3 className="references-title">References</h3>
      <ol className="references-list">
        {ref.items.map((item: any, i: number) => (
          <li key={i} className="reference-item">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.text}
              </a>
            ) : (
              item.text
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function renderThematicBreak(): React.ReactNode {
  return <hr key="hr" className="thematic-break" />;
}

function renderSemanticBlock(node: ASTNode): React.ReactNode {
  const s = node as any;
  return (
    <div key={s.id ?? 'sem'} className={`semantic-block semantic-${s.kind}`}>
      {s.title && <h3 className="semantic-title">{s.title}</h3>}
      <div className="semantic-content" dangerouslySetInnerHTML={{ __html: s.html }} />
    </div>
  );
}

function renderTerminal(node: ASTNode): React.ReactNode {
  const t = node as any;
  return (
    <div key={t.id ?? 'term'} className="terminal-block">
      {t.sessionName && <div className="terminal-header">{t.sessionName}</div>}
      <pre className="terminal-content">
        {t.lines.map((line: any, i: number) => (
          <code key={i} className="terminal-line">
            {line.prompt && <span className="terminal-prompt">{line.prompt} </span>}
            {line.input && <span className="terminal-input">{line.input}</span>}
            {line.output && <span className="terminal-output">{line.output}</span>}
            {'\n'}
          </code>
        ))}
      </pre>
    </div>
  );
}

function renderFileTree(node: ASTNode): React.ReactNode {
  const ft = node as any;
  return (
    <div key={ft.id ?? 'tree'} className="file-tree-block">
      {ft.rootLabel && <div className="file-tree-root">{ft.rootLabel}/</div>}
      <ul className="file-tree-list">
        {ft.entries.map((entry: any, i: number) => (
          <li key={i} className={`file-tree-entry file-tree-${entry.type}`}>
            {entry.type === 'directory' ? '📁 ' : '📄 '}
            {entry.name}
            {entry.children && (
              <ul className="file-tree-children">
                {entry.children.map((child: any, ci: number) => (
                  <li key={ci} className={`file-tree-entry file-tree-${child.type}`}>
                    {child.type === 'directory' ? '📁 ' : '📄 '}
                    {child.name}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderAccordion(node: ASTNode): React.ReactNode {
  const a = node as any;
  return (
    <div key={a.id ?? 'acc'} className="accordion-block">
      {a.panels.map((panel: any, i: number) => (
        <details key={i} className="accordion-panel">
          <summary className="accordion-title">{panel.title}</summary>
          <div className="accordion-content" dangerouslySetInnerHTML={{ __html: panel.content }} />
        </details>
      ))}
    </div>
  );
}

function renderApi(node: ASTNode): React.ReactNode {
  const api = node as any;
  const methodColors: Record<string, string> = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete',
  };
  return (
    <div key={api.id ?? 'api'} className="api-block">
      {api.endpoints.map((ep: any, i: number) => (
        <div key={i} className="api-endpoint">
          <div className="api-endpoint-header">
            <span className={`api-method ${methodColors[ep.method] ?? 'method-default'}`}>
              {ep.method}
            </span>
            <code className="api-path">{ep.path}</code>
          </div>
          <p className="api-description">{ep.description}</p>
          {ep.requestBody && (
            <div className="api-body">
              <strong>Request:</strong>
              <pre>
                <code>{ep.requestBody}</code>
              </pre>
            </div>
          )}
          {ep.responseBody && (
            <div className="api-body">
              <strong>Response:</strong>
              <pre>
                <code>{ep.responseBody}</code>
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Node Dispatcher ──────────────────────────────────────────────────── */

function renderNode(node: ASTNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'heading':
      return renderHeading(node, index);
    case 'paragraph':
      return renderParagraph(node);
    case 'list':
      return renderList(node);
    case 'code':
      return renderCode(node);
    case 'diagram':
      return renderDiagram(node);
    case 'callout':
      return renderCallout(node);
    case 'table':
      return renderTable(node);
    case 'image':
      return renderImage(node);
    case 'video':
      return renderVideo(node);
    case 'equation':
      return renderEquation(node);
    case 'blockquote':
      return renderBlockquote(node);
    case 'reference':
      return renderReference(node);
    case 'thematic_break':
      return renderThematicBreak();
    case 'semantic':
      return renderSemanticBlock(node);
    case 'terminal':
      return renderTerminal(node);
    case 'file_tree':
      return renderFileTree(node);
    case 'accordion':
      return renderAccordion(node);
    case 'api':
      return renderApi(node);
    default:
      return null;
  }
}

/* ── TOC Renderer ─────────────────────────────────────────────────────── */

function renderTOC(doc: DocumentAST): React.ReactNode {
  const toc = doc.hierarchy.toc;
  if (toc.length === 0) return null;

  function renderTOCItems(items: any[], depth = 0): React.ReactNode {
    return (
      <ul className={`toc-level toc-depth-${depth}`}>
        {items.map((item, i) => (
          <li key={item.id ?? i} className="toc-item">
            <a href={`#${item.id}`} className="toc-link">
              {item.number && <span className="toc-number">{item.number}. </span>}
              {item.text}
            </a>
            {item.children.length > 0 && renderTOCItems(item.children, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <nav className="document-toc" aria-label="Table of Contents">
      <h2 className="toc-title">Contents</h2>
      {renderTOCItems(toc)}
    </nav>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

export function DocumentRenderer({
  doc,
  theme = 'light',
  showTOC = true,
  className = '',
}: DocumentRendererProps) {
  return (
    <article className={`document-renderer theme-${theme} ${className}`}>
      {doc.title && (
        <header className="document-header">
          <h1 className="document-title">{doc.title}</h1>
          {doc.metadata.readingTimeMinutes > 0 && (
            <p className="document-meta">
              {doc.metadata.wordCount.toLocaleString()} words · {doc.metadata.readingTimeMinutes}{' '}
              min read
              {doc.metadata.complexity && ` · Complexity ${doc.metadata.complexity}/10`}
            </p>
          )}
        </header>
      )}

      {showTOC && renderTOC(doc)}

      <div className="document-content">
        {doc.nodes.map((node, index) => renderNode(node, index))}
      </div>

      {doc.warnings.length > 0 && (
        <div className="document-warnings">
          <h3>Warnings</h3>
          <ul>
            {doc.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/* ── Default export ───────────────────────────────────────────────────── */

export default DocumentRenderer;
