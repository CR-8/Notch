import JSZip from 'jszip';
import { db } from './db';
import type { Document } from './types';

export async function exportFolderAsZip(
  folderId: string,
  format: 'markdown' | 'pdf',
): Promise<Blob> {
  const allDocs = await db.notes.where('folder').equals(folderId).toArray();
  if (allDocs.length === 0) throw new Error('No documents in this folder');

  const zip = new JSZip();

  if (format === 'markdown') {
    for (const doc of allDocs) {
      const slug = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'untitled';
      const content = buildMarkdownExport(doc);
      zip.file(`${slug}.md`, content);
    }
  } else {
    throw new Error('PDF folder export not yet supported — use markdown format');
  }

  return zip.generateAsync({ type: 'blob' });
}

function buildMarkdownExport(doc: Document): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
  lines.push(`url: ${doc.url}`);
  lines.push(`domain: ${doc.domain}`);
  lines.push(`captured: ${doc.capturedAt}`);
  lines.push(`words: ${doc.wordCount}`);
  if (doc.tags.length > 0) lines.push(`tags: [${doc.tags.map(t => `"${t}"`).join(', ')}]`);
  if (doc.summary) lines.push(`summary: "${doc.summary.replace(/"/g, '\\"')}"`);
  lines.push('---');
  lines.push('');

  if (doc.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(doc.summary);
    lines.push('');
  }

  if (doc.keyPoints.length > 0) {
    lines.push('## Key Points');
    lines.push('');
    for (const point of doc.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  const content = doc.content ?? '';
  if (content) {
    lines.push(content);
  }

  return lines.join('\n');
}
