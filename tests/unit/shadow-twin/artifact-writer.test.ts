/**
 * @fileoverview Unit-Tests für Shadow-Twin Artefakt Writer
 * 
 * @description
 * Testet writeArtifact() für v2 und legacy Modi, Deduplizierung (überschreibt statt dupliziert),
 * dotFolder vs sibling, und verschiedene Artefakt-Typen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeArtifact } from '@/lib/shadow-twin/artifact-writer';
import type { StorageProvider, StorageItem } from '@/lib/storage/types';
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types';
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin';

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
  logArtifactWrite: vi.fn(),
}));

// Mock shadow-twin utilities
vi.mock('@/lib/storage/shadow-twin', () => ({
  findShadowTwinFolder: vi.fn(),
  generateShadowTwinFolderName: vi.fn((name: string) => `.${name}`),
}));

/**
 * Erstellt einen Mock StorageProvider für Tests
 */
function createMockProvider(): StorageProvider {
  const items: Record<string, StorageItem[]> = {};
  const folders: Record<string, StorageItem> = {};
  let nextId = 1;
  const uploadCalls: Array<{ parentId: string; fileName: string }> = [];

  return {
    getItemById: vi.fn(async (id: string) => {
      for (const itemList of Object.values(items)) {
        const found = itemList.find(item => item.id === id);
        if (found) return found;
      }
      return folders[id] || null;
    }),
    listItemsById: vi.fn(async (parentId: string) => {
      return items[parentId] || [];
    }),
    getBinary: vi.fn(),
    uploadFile: vi.fn(async (parentId: string, file: File) => {
      uploadCalls.push({ parentId, fileName: file.name });
      const id = `file-${nextId++}`;
      const item: StorageItem = {
        id,
        type: 'file',
        metadata: { name: file.name },
        parentId,
      };
      if (!items[parentId]) items[parentId] = [];
      // Überschreibe existierende Datei mit gleichem Namen
      const existingIndex = items[parentId].findIndex(
        i => i.type === 'file' && i.metadata.name === file.name
      );
      if (existingIndex >= 0) {
        items[parentId][existingIndex] = item;
      } else {
        items[parentId].push(item);
      }
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
    // Helper für Tests: Zugriff auf Upload-Calls
    _getUploadCalls: () => uploadCalls,
  } as unknown as StorageProvider & { _getUploadCalls: () => Array<{ parentId: string; fileName: string }> };
}

describe('writeArtifact', () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    vi.clearAllMocks();
  });

  describe('V2-Modus', () => {
    it('sollte neues Transcript im dotFolder erstellen', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.document.pdf' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transcript',
        mode: 'v2',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.location).toBe('dotFolder');
      expect(result.shadowTwinFolderId).toBe(shadowTwinFolderId);
      expect(result.wasUpdated).toBe(false);
      expect(result.file.metadata.name).toBe('document.de.md');
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('sollte existierendes Transcript im dotFolder überschreiben (dedupliziert)', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const existingFile: StorageItem = {
        id: 'existing-1',
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
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([existingFile]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Updated Transcript',
        mode: 'v2',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.location).toBe('dotFolder');
      expect(result.wasUpdated).toBe(true);
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('sollte neues Transcript als Sibling erstellen wenn createFolder=false', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transcript',
        mode: 'v2',
        createFolder: false,
      });

      expect(result).not.toBeNull();
      expect(result.location).toBe('sibling');
      expect(result.shadowTwinFolderId).toBeUndefined();
      expect(result.wasUpdated).toBe(false);
      expect(result.file.metadata.name).toBe('document.de.md');
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        parentId,
        expect.objectContaining({ name: 'document.de.md' })
      );
    });

    it('sollte existierendes Transcript als Sibling überschreiben', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const existingFile: StorageItem = {
        id: 'existing-1',
        type: 'file',
        metadata: { name: 'document.de.md' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([existingFile]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Updated Transcript',
        mode: 'v2',
        createFolder: false,
      });

      expect(result).not.toBeNull();
      expect(result.location).toBe('sibling');
      expect(result.wasUpdated).toBe(true);
      expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('sollte Transformation mit Template-Name erstellen', async () => {
      const sourceName = 'audio.mp3';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.audio.mp3' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transformation',
        targetLanguage: 'de',
        templateName: 'Besprechung',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transformation',
        mode: 'v2',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.file.metadata.name).toBe('audio.Besprechung.de.md');
      expect(result.wasUpdated).toBe(false);
    });

    it('sollte Shadow-Twin-Verzeichnis erstellen wenn nicht vorhanden', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';

      vi.mocked(findShadowTwinFolder).mockResolvedValue(null);
      vi.mocked(mockProvider.createFolder).mockResolvedValue({
        id: 'new-folder-1',
        type: 'folder',
        metadata: { name: '.document.pdf' },
        parentId,
      } as StorageItem);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transcript',
        mode: 'v2',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(mockProvider.createFolder).toHaveBeenCalledTimes(1);
      expect(mockProvider.createFolder).toHaveBeenCalledWith(parentId, '.document.pdf');
    });
  });

  describe('Legacy-Modus', () => {
    it('sollte neues Transcript im dotFolder erstellen', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.document.pdf' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transcript',
        mode: 'legacy',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.location).toBe('dotFolder');
      expect(result.wasUpdated).toBe(false);
      expect(result.file.metadata.name).toBe('document.de.md');
    });

    it('sollte existierendes Transcript im dotFolder überschreiben', async () => {
      const sourceName = 'document.pdf';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const existingFile: StorageItem = {
        id: 'existing-1',
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
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([existingFile]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transcript',
        targetLanguage: 'de',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Updated Transcript',
        mode: 'legacy',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.wasUpdated).toBe(true);
    });

    it('sollte Transformation mit Template-Name erstellen', async () => {
      const sourceName = 'audio.mp3';
      const parentId = 'parent-1';
      const shadowTwinFolderId = 'shadow-folder-1';
      const shadowTwinFolder: StorageItem = {
        id: shadowTwinFolderId,
        type: 'folder',
        metadata: { name: '.audio.mp3' },
        parentId,
      };

      vi.mocked(findShadowTwinFolder).mockResolvedValue(shadowTwinFolder);
      vi.mocked(mockProvider.listItemsById).mockResolvedValue([]);

      const key: ArtifactKey = {
        sourceId: 'source-1',
        kind: 'transformation',
        targetLanguage: 'de',
        templateName: 'Besprechung',
      };

      const result = await writeArtifact(mockProvider, {
        key,
        sourceName,
        parentId,
        content: '# Transformation',
        mode: 'legacy',
        createFolder: true,
      });

      expect(result).not.toBeNull();
      expect(result.file.metadata.name).toBe('audio.Besprechung.de.md');
    });
  });
});




