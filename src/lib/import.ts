import { PDFDocument, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';
import type { Document, DocumentChunk } from './types';
import { saveDocument, saveDocIndex, getDocIndex } from './storage';
import { saveChunk } from './idb';
import { log } from './logger';
import type { ParsedPdf } from './pdf-parser';

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
    const notchAttachment = attachments.find((a) => a.name === 'notch_data.json');

    if (!notchAttachment) {
      log.info('storage', `No Notch metadata found in PDF "${fileName}", parsing as standard PDF`);
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const pdfParser = (await import('./pdf-parser')) as {
        parsePdfBytes: (bytes: number[], fileName: string) => Promise<ParsedPdf>;
      };
      const parsed = await pdfParser.parsePdfBytes(bytes, fileName);

      const { runCapturePipeline } = await import('./pipeline');
      const extraction = {
        title: parsed.title,
        url: '',
        domain: 'local-file',
        textContent: parsed.content,
        cleanedHtml: parsed.content
          .split('\n\n')
          .map((p) => `<p>${p}</p>`)
          .join(''),
        images: [],
        videos: [],
        wordCount: parsed.wordCount,
        metaDescription: '',
      };

      const docId = await runCapturePipeline(extraction, 'FAST', ['imported-pdf']);
      return docId;
    }

    let parsed: NotchBundle;
    try {
      parsed = JSON.parse(new TextDecoder().decode(notchAttachment.data)) as NotchBundle;
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
      throw new Error(`[${fileName}] ${msg}`, { cause: err });
    }
    throw err;
  }
}
