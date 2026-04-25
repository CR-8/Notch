import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';
import type { Document, DocumentChunk } from './types';
import { saveDocument, saveDocIndex, getDocIndex } from './storage';
import { saveChunk, saveEmbedding } from './idb';
import { log } from './logger';

export interface NotchRAGBundle {
  document: Document;
  chunks: DocumentChunk[];
  embeddings: Array<{ id: string; vector: number[] }>;
}

/**
 * Extracts attachments from a pdf-lib PDFDocument by traversing the catalog's
 * Names → EmbeddedFiles tree. pdf-lib has no high-level getAttachments() API.
 */
function extractAttachments(pdfDoc: PDFDocument): Array<{ name: string; data: Uint8Array }> {
  try {
    const catalog = pdfDoc.catalog;
    if (!catalog.has(PDFName.of('Names'))) return [];

    const names = catalog.lookup(PDFName.of('Names'), PDFDict);
    if (!names.has(PDFName.of('EmbeddedFiles'))) return [];

    const embeddedFiles = names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    if (!embeddedFiles.has(PDFName.of('Names'))) return [];

    const efNames = embeddedFiles.lookup(PDFName.of('Names'), PDFArray);
    const attachments: Array<{ name: string; data: Uint8Array }> = [];

    for (let i = 0, len = efNames.size(); i < len; i += 2) {
      const nameObj = efNames.lookup(i);
      if (!nameObj) continue;
      const fileSpec = efNames.lookup(i + 1, PDFDict);
      const efDict = fileSpec.lookup(PDFName.of('EF'), PDFDict);
      const fileStream = efDict.lookup(PDFName.of('F'), PDFStream);
      attachments.push({
        name: nameObj.toString().replace(/[()]/g, ''),
        data: fileStream.getContents(),
      });
    }
    return attachments;
  } catch {
    return [];
  }
}

/**
 * Attempts to parse a PDF file and extract hidden Notch RAG data.
 * If found, restores the document, chunks, and embeddings to local storage.
 */
export async function importNotchPDF(file: File): Promise<string> {
  log.info('storage', `Importing PDF: ${file.name}`);
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const attachments = extractAttachments(pdfDoc);
    const notchAttachment = attachments.find(a => a.name === 'notch_data.json');
    
    if (!notchAttachment) {
      throw new Error('This PDF does not contain Notch RAG data. Only PDFs exported from Notch can be imported.');
    }

    const jsonString = new TextDecoder().decode(notchAttachment.data);
    const bundle = JSON.parse(jsonString) as NotchRAGBundle;
    
    const { document: doc, chunks, embeddings } = bundle;
    
    // Check if document already exists to avoid duplicates
    const index = await getDocIndex();
    if (index.includes(doc.id)) {
      log.warn('storage', `Document ${doc.id} already exists, overwriting...`);
    } else {
      await saveDocIndex([doc.id, ...index]);
    }

    // 1. Save full document and metadata
    await saveDocument(doc);

    // 2. Save chunks
    for (const chunk of chunks) {
      await saveChunk(chunk);
    }

    // 3. Save embeddings (convert back to Float32Array)
    for (const emb of embeddings) {
      await saveEmbedding(emb.id, doc.id, new Float32Array(emb.vector));
    }

    log.success('storage', `Successfully imported "${doc.title}" from PDF`);
    return doc.id;
  } catch (err) {
    log.error('storage', 'Failed to import PDF', err);
    throw err;
  }
}
