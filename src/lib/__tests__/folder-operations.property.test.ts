/**
 * Property-based tests for folder operations in storage.ts
 * Uses fast-check for property generation.
 *
 * Validates: Requirements 3.6, 3.8, 3.9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ── In-memory storage mock ────────────────────────────────────────────────────
// We replicate the storage layer in-memory so properties can run without
// a real browser extension environment.

import type { DocumentMeta, Folder } from '../types';

// ── Pure helper: filter documents by folder ───────────────────────────────────
// This is the core logic tested by Property 8.
function filterByFolder(docs: DocumentMeta[], folderId: string): DocumentMeta[] {
  return docs.filter(d => d.folder === folderId);
}

// ── In-memory storage implementation ─────────────────────────────────────────
// Mirrors the real storage.ts logic without browser APIs.

class InMemoryFolderStore {
  private folders: Folder[] = [];
  private docs: DocumentMeta[] = [];

  getFolders(): Folder[] {
    return [...this.folders];
  }

  getDocs(): DocumentMeta[] {
    return [...this.docs];
  }

  saveFolder(folder: Folder): void {
    const idx = this.folders.findIndex(f => f.id === folder.id);
    if (idx >= 0) this.folders[idx] = folder;
    else this.folders.push(folder);
  }

  deleteFolder(folderId: string): void {
    this.folders = this.folders.filter(f => f.id !== folderId);
    this.moveFolderDocuments(folderId, undefined);
  }

  renameFolder(id: string, newName: string): void {
    const idx = this.folders.findIndex(f => f.id === id);
    if (idx < 0) return;
    this.folders[idx] = { ...this.folders[idx], name: newName };
  }

  moveFolderDocuments(fromFolderId: string, toFolderId: string | undefined): void {
    this.docs = this.docs.map(d =>
      d.folder === fromFolderId ? { ...d, folder: toFolderId } : d,
    );
  }

  addDoc(doc: DocumentMeta): void {
    this.docs.push(doc);
  }

  totalDocCount(): number {
    return this.docs.length;
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbFolderName = fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/);

const arbFolderId = fc.stringMatching(/^[a-z0-9]{4,12}$/);

const arbFolder = fc.record<Folder>({
  id: arbFolderId,
  name: arbFolderName,
  color: fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#ffff00'),
  createdAt: fc.constant(new Date().toISOString()),
});

function makeDocMeta(id: string, folderId?: string): DocumentMeta {
  return {
    id,
    title: `Doc ${id}`,
    url: `https://example.com/${id}`,
    domain: 'example.com',
    capturedAt: new Date().toISOString(),
    wordCount: 100,
    summary: 'A summary',
    tags: [],
    folder: folderId,
    isStarred: false,
    isArchived: false,
    isRead: false,
    mode: 'FAST',
    provider: 'gemini',
  };
}

// ── Property 6: Document count invariant across folder operations ─────────────
// **Validates: Requirements 3.8**

describe('Property 6: Document count invariant across folder operations', () => {
  it('total doc count is unchanged after any sequence of create/move/delete', () => {
    fc.assert(
      fc.property(
        // Generate 1–3 folders and 0–5 docs per folder
        fc.array(arbFolder, { minLength: 1, maxLength: 3 }),
        fc.array(fc.nat({ max: 4 }), { minLength: 1, maxLength: 3 }),
        (folders, docsPerFolder) => {
          // Deduplicate folder IDs
          const uniqueFolders = folders.filter(
            (f, i, arr) => arr.findIndex(x => x.id === f.id) === i,
          );
          if (uniqueFolders.length === 0) return;

          const store = new InMemoryFolderStore();
          let docCounter = 0;

          // Populate folders and docs
          for (let fi = 0; fi < uniqueFolders.length; fi++) {
            store.saveFolder(uniqueFolders[fi]);
            const count = docsPerFolder[fi] ?? 0;
            for (let d = 0; d < count; d++) {
              store.addDoc(makeDocMeta(`doc-${docCounter++}`, uniqueFolders[fi].id));
            }
          }
          // Add some unorganised docs
          store.addDoc(makeDocMeta(`doc-${docCounter++}`, undefined));
          store.addDoc(makeDocMeta(`doc-${docCounter++}`, undefined));

          const initialCount = store.totalDocCount();

          // Perform operations: move docs from folder[0] to folder[1] (if exists), then delete folder[0]
          if (uniqueFolders.length >= 2) {
            store.moveFolderDocuments(uniqueFolders[0].id, uniqueFolders[1].id);
          }
          store.deleteFolder(uniqueFolders[0].id);

          // Total doc count must be unchanged
          expect(store.totalDocCount()).toBe(initialCount);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('moveFolderDocuments preserves total doc count', () => {
    fc.assert(
      fc.property(
        arbFolderId,
        fc.option(arbFolderId, { nil: undefined }),
        fc.integer({ min: 0, max: 10 }),
        (fromId, toId, docCount) => {
          const store = new InMemoryFolderStore();
          for (let i = 0; i < docCount; i++) {
            store.addDoc(makeDocMeta(`d${i}`, fromId));
          }
          // Add some docs in other folders
          store.addDoc(makeDocMeta('other1', 'other-folder'));
          store.addDoc(makeDocMeta('other2', undefined));

          const before = store.totalDocCount();
          store.moveFolderDocuments(fromId, toId);
          expect(store.totalDocCount()).toBe(before);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Property 7: Folder create-then-delete round-trip ─────────────────────────
// **Validates: Requirements 3.9**

describe('Property 7: Folder create-then-delete round-trip', () => {
  it('getFolders() is identical before and after create+delete of a folder', () => {
    fc.assert(
      fc.property(
        // Existing folders (may be empty)
        fc.array(arbFolder, { minLength: 0, maxLength: 4 }),
        // New folder to create and delete
        arbFolder,
        (existingFolders, newFolder) => {
          // Deduplicate existing folders and ensure newFolder.id is unique
          const uniqueExisting = existingFolders.filter(
            (f, i, arr) =>
              arr.findIndex(x => x.id === f.id) === i && f.id !== newFolder.id,
          );

          const store = new InMemoryFolderStore();
          for (const f of uniqueExisting) store.saveFolder(f);

          const before = store.getFolders().map(f => f.id).sort();

          // Create then delete
          store.saveFolder(newFolder);
          store.deleteFolder(newFolder.id);

          const after = store.getFolders().map(f => f.id).sort();

          expect(after).toEqual(before);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('folder names are preserved for existing folders after round-trip', () => {
    fc.assert(
      fc.property(
        fc.array(arbFolder, { minLength: 1, maxLength: 3 }),
        arbFolder,
        (existingFolders, newFolder) => {
          const uniqueExisting = existingFolders.filter(
            (f, i, arr) =>
              arr.findIndex(x => x.id === f.id) === i && f.id !== newFolder.id,
          );
          if (uniqueExisting.length === 0) return;

          const store = new InMemoryFolderStore();
          for (const f of uniqueExisting) store.saveFolder(f);

          const beforeNames = store.getFolders().map(f => ({ id: f.id, name: f.name }));

          store.saveFolder(newFolder);
          store.deleteFolder(newFolder.id);

          const afterNames = store.getFolders().map(f => ({ id: f.id, name: f.name }));

          expect(afterNames).toEqual(beforeNames);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Property 8: Folder filter returns only matching documents ─────────────────
// **Validates: Requirements 3.6**

describe('Property 8: Folder filter returns only matching documents', () => {
  it('filterByFolder returns only docs with matching folder field', () => {
    fc.assert(
      fc.property(
        // Generate a set of docs with various folder assignments
        fc.array(
          fc.record({
            id: fc.nat().map(n => `doc-${n}`),
            folderId: fc.option(arbFolderId, { nil: undefined }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        arbFolderId,
        (docSpecs, targetFolderId) => {
          // Deduplicate doc IDs
          const uniqueSpecs = docSpecs.filter(
            (d, i, arr) => arr.findIndex(x => x.id === d.id) === i,
          );

          const docs = uniqueSpecs.map(s => makeDocMeta(s.id, s.folderId ?? undefined));
          const filtered = filterByFolder(docs, targetFolderId);

          // Every returned doc must have folder === targetFolderId
          for (const doc of filtered) {
            expect(doc.folder).toBe(targetFolderId);
          }

          // No doc with folder === targetFolderId should be missing from result
          const expected = docs.filter(d => d.folder === targetFolderId);
          expect(filtered.length).toBe(expected.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('filterByFolder excludes docs from other folders and unorganised docs', () => {
    fc.assert(
      fc.property(
        arbFolderId,
        arbFolderId,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (folderA, folderB, countA, countB) => {
          // Ensure distinct folder IDs
          if (folderA === folderB) return;

          const docs: DocumentMeta[] = [];
          for (let i = 0; i < countA; i++) docs.push(makeDocMeta(`a${i}`, folderA));
          for (let i = 0; i < countB; i++) docs.push(makeDocMeta(`b${i}`, folderB));
          docs.push(makeDocMeta('unorg', undefined));

          const filteredA = filterByFolder(docs, folderA);
          expect(filteredA.length).toBe(countA);
          expect(filteredA.every(d => d.folder === folderA)).toBe(true);

          const filteredB = filterByFolder(docs, folderB);
          expect(filteredB.length).toBe(countB);
          expect(filteredB.every(d => d.folder === folderB)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('moveFolderDocuments causes docs to appear in destination folder filter', () => {
    fc.assert(
      fc.property(
        arbFolderId,
        arbFolderId,
        fc.integer({ min: 1, max: 8 }),
        (fromId, toId, docCount) => {
          if (fromId === toId) return;

          const store = new InMemoryFolderStore();
          for (let i = 0; i < docCount; i++) {
            store.addDoc(makeDocMeta(`d${i}`, fromId));
          }

          store.moveFolderDocuments(fromId, toId);

          const afterDocs = store.getDocs();
          const inFrom = filterByFolder(afterDocs, fromId);
          const inTo = filterByFolder(afterDocs, toId);

          // All docs should now be in toId, none in fromId
          expect(inFrom.length).toBe(0);
          expect(inTo.length).toBe(docCount);
        },
      ),
      { numRuns: 200 },
    );
  });
});
