/**
 * @fileoverview Unit-Tests für Shadow-Twin Artefakt Resolver
 * 
 * @description
 * Testet resolveArtifact() für v2 und legacy Modi, verschiedene Speicherorte (dotFolder vs sibling),
 * preferredKind, templateName und Fehlerfälle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver';
import type { StorageProvider, StorageItem } from '@/lib/storage/types';
import { findShadowTwinFolder, findShadowTwinMarkdown } from '@/lib/storage/shadow-twin';

// Mock Logger
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock artifact-logger
vi.mock('@/lib/shadow-twin/artifact-logger', () => ({
  logArtifactResolve: vi.fn(),
}));

// Mock shadow-twin utilities
vi.mock('@/lib/storage/shadow-twin', () => ({
  findShadowTwinFolder: vi.fn(),
  findShadowTwinMarkdown: vi.fn(),
  generateShadowTwinFolderName: vi.fn((name: string) => `.${name}`),
}));

/**
 * Erstellt einen Mock StorageProvider für Tests
 */
function createMockProvider(): StorageProvider {
  const items: Record<string, StorageItem[]> = {};
  const folders: Record<string, StorageItem> = {};
  let nextId = 1;

  return {
    getItemById: vi.fn(async (id: string) => {
      // Suche in allen Items
      for (const itemList of Object.values(items)) {
        const found = itemList.find(item => item.id === id);
        if (found) return found;
      }
      // Suche in Folders
      return folders[id] || null;
    }),
    listItemsById: vi.fn(async (parentId: string) => {
      return items[parentId] || [];
    }),
    getBinary: vi.fn(),
    uploadFile: vi.fn(async (parentId: string, file: File) => {
      const id = `file-${nextId++}`;
      const item: StorageItem = {
        id,
        type: 'file',
        metadata: { name: file.name },
        parentId,
      };
      if (!items[parentId]) items[parentId] = [];
      items[parentId].push(item);
      return item;
    }),
    deleteItem: vi.fn(),
    createFolder: vi.fn(async (parentId: string, name: string) => {
      const id = `folder-${nextId++}`;
      const folder: StorageItem = {
        id,
        type: 'folder',
        metadata: { name },
        parentId,
      };
      folders[id] = folder;
      if (!items[parentId]) items[parentId] = [];
      items[parentId].push(folder);
      return folder;
    }),
  } as unknown as StorageProvider;
}

describe('resolveArtifact', () => {
  let mockProvider: StorageProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    vi.clearAllMocks();
  });

  describe('V2-Modus', () => {
    it('sollte Transcript im dotFolder finden', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const transcriptFile: StorageItem = {
        id: 'transcript-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId: shadowTwinFolderId,
      };

      // Mock: Shadow-Twin-Folder existiert
      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.document.pdf' },
        parentId,
      };
      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transcriptFile]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        preferredKind: 'transcript',
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transcript');
      expect(result?.fileId).toBe('transcript-1');
      expect(result?.fileName).toBe('document.de.md');
      expect(result?.location).toBe('dotFolder');
      expect(result?.shadowTwinFolderId).toBe(shadowTwinFolderId);
    });

    it('sollte Transformation im dotFolder finden', async () => {
      const sourceName = 'audio.mp3';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const transformationFile: StorageItem = {
        id: 'transformation-1',
        type: 'file',
        metadata: { name: 'audio.Besprechung.de.md' },
        parentId: shadowTwinFolderId,
      };

      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.audio.mp3' },
        parentId,
      };
      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transformationFile]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        templateName: 'Besprechung',
        preferredKind: 'transformation',
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transformation');
      expect(result?.fileId).toBe('transformation-1');
      expect(result?.fileName).toBe('audio.Besprechung.de.md');
      expect(result?.location).toBe('dotFolder');
    });

    it('sollte Transcript als Sibling finden wenn kein dotFolder existiert', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const transcriptFile: StorageItem = {
        id: 'transcript-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transcriptFile]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        preferredKind: 'transcript',
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transcript');
      expect(result?.location).toBe('sibling');
      expect(result?.shadowTwinFolderId).toBeUndefined();
    });

    it('sollte null zurückgeben wenn Artefakt nicht gefunden wird', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        preferredKind: 'transcript',
      });

      expect(result).toBeNull();
    });

    it('sollte preferredKind verwenden wenn angegeben', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const transcriptFile: StorageItem = {
        id: 'transcript-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transcriptFile]);

      // Auch wenn templateName fehlt, sollte preferredKind 'transcript' verwendet werden
      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        preferredKind: 'transcript',
      });

      expect(result?.kind).toBe('transcript');
    });

    it('sollte templateName automatisch ArtifactKind bestimmen', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const transformationFile: StorageItem = {
        id: 'transformation-1',
        type: 'file',
        metadata: { name: 'document.Besprechung.de.md' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transformationFile]);

      // Ohne preferredKind, aber mit templateName → sollte 'transformation' sein
      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'v2',
        targetLanguage: 'de',
        templateName: 'Besprechung',
      });

      expect(result?.kind).toBe('transformation');
    });
  });

  describe('Legacy-Modus', () => {
    it('sollte Transcript im dotFolder finden', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const transcriptFile: StorageItem = {
        id: 'transcript-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId: shadowTwinFolderId,
      };

      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.document.pdf' },
        parentId,
      };
      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(findShadowTwinMarkdown).mockResolvedValue(transcriptFile);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'legacy',
        targetLanguage: 'de',
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transcript');
      expect(result?.fileId).toBe('transcript-1');
      expect(result?.location).toBe('dotFolder');
    });

    it('sollte Transcript als Sibling finden wenn kein dotFolder existiert', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const transcriptFile: StorageItem = {
        id: 'transcript-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([transcriptFile]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'legacy',
        targetLanguage: 'de',
      });

      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transcript');
      expect(result?.location).toBe('sibling');
    });

    it('sollte null zurückgeben wenn nichts gefunden wird', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(findShadowTwinMarkdown).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const result = await resolveArtifact(mockProvider, {
        sourceItemId: 'source-1',
        sourceName,
        parentId,
        mode: 'legacy',
        targetLanguage: 'de',
      });

      expect(result).toBeNull();
    });
  });
});




