import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';
import type { Document, DocumentChunk } from './types';
import { saveDocument, saveDocIndex, getDocIndex } from './storage';
import { saveChunk } from './idb';
import { log } from './logger';

export interface NotchBundle {
  document: Document;
  chunks: DocumentChunk[];
}

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

export async function importNotchPDF(file: File): Promise<string> {
  const fileName = file.name;
  log.info('storage', `Importing PDF: ${fileName}`);
  const arrayBuffer = await file.arrayBuffer();

  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const attachments = extractAttachments(pdfDoc);
    const notchAttachment = attachments.find(a => a.name === 'notch_data.json');

    if (!notchAttachment) {
      throw new Error(`[${fileName}] This PDF does not contain Notch data. Only PDFs exported from Notch can be imported.`);
    }

    let parsed: NotchBundle;
    try {
      parsed = JSON.parse(new TextDecoder().decode(notchAttachment.data));
    } catch {
      throw new Error(`[${fileName}] Invalid Notch data: attachment is not valid JSON.`);
    }

    const { document: doc, chunks } = parsed;
    const index = await getDocIndex();
    if (index.includes(doc.id)) {
      log.warn('storage', `Document ${doc.id} already exists, overwriting...`);
    } else {
      await saveDocIndex([doc.id, ...index]);
    }

    await saveDocument(doc);
    for (const chunk of chunks) {
      await saveChunk(chunk);
    }

    log.success('storage', `Successfully imported "${doc.title}" from PDF`);
    return doc.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith(`[${fileName}]`)) {
      log.error('storage', `Failed to import PDF "${fileName}": ${msg}`, err);
      throw new Error(`[${fileName}] ${msg}`);
    }
    throw err;
  }
}