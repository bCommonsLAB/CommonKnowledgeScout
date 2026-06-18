/**
 * Tests fuer die Asset-Spiegelung (Befund B2d V2): Enumeration des Inbox-Shadow-
 * Twin-Ordners + Spiegeln ueber den Ziel-`ShadowTwinService` (idempotent).
 * Reine Storage-Helfer — mit Fake-Provider und Fake-Service getestet.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  enumerateInboxAssets,
  mirrorInboxAssetsToTarget,
  assetKindFromNameAndMime,
} from '@/lib/submissions/promotion-assets';
import type { StorageItem, StorageProvider } from '@/lib/storage/types';

function fileItem(id: string, name: string, parentId: string, mimeType = ''): StorageItem {
  return { id, parentId, type: 'file', metadata: { name, size: 1, modifiedAt: new Date(0), mimeType } };
}
function folderItem(id: string, name: string, parentId: string): StorageItem {
  return { id, parentId, type: 'folder', metadata: { name, size: 0, modifiedAt: new Date(0), mimeType: 'inode/directory' } };
}

/**
 * Minimaler Fake-Provider: nur die hier genutzten Methoden sind echt belegt,
 * der Rest wirft (sollte nie aufgerufen werden).
 */
function fakeProvider(opts: {
  itemsByFolder: Record<string, StorageItem[]>;
  itemsById?: Record<string, StorageItem>;
  binaries?: Record<string, { blob: Blob; mimeType: string }>;
}): StorageProvider {
  const notImpl = () => { throw new Error('nicht implementiert'); };
  return {
    name: 'fake',
    id: 'fake',
    isAuthenticated: () => true,
    validateConfiguration: async () => ({ isValid: true }),
    listItemsById: async (folderId: string) => opts.itemsByFolder[folderId] ?? [],
    getItemById: async (itemId: string) => {
      const found = opts.itemsById?.[itemId];
      if (!found) throw new Error(`getItemById: ${itemId}`);
      return found;
    },
    getBinary: async (fileId: string) => {
      const bin = opts.binaries?.[fileId];
      if (!bin) throw new Error(`getBinary: ${fileId}`);
      return bin;
    },
    createFolder: notImpl,
    deleteItem: notImpl,
    moveItem: notImpl,
    renameItem: notImpl,
    uploadFile: notImpl,
    getPathById: notImpl,
    getDownloadUrl: notImpl,
    getStreamingUrl: notImpl,
    getPathItemsById: notImpl,
  } as unknown as StorageProvider;
}

describe('assetKindFromNameAndMime', () => {
  it('erkennt Bilder per Mimetype und per Extension, ignoriert Markdown', () => {
    expect(assetKindFromNameAndMime('page_001.png', 'image/png')).toBe('image');
    expect(assetKindFromNameAndMime('img-0.jpeg', '')).toBe('image');
    expect(assetKindFromNameAndMime('clip.mp3', 'audio/mpeg')).toBe('audio');
    expect(assetKindFromNameAndMime('Invoice.de.md', 'text/markdown')).toBeNull();
  });
});

describe('enumerateInboxAssets', () => {
  it('listet nur Medien-Dateien des Inbox-Shadow-Twin-Ordners (ohne Transkript-MD)', async () => {
    const inboxProvider = fakeProvider({
      itemsById: { 'inbox-pdf-1': fileItem('inbox-pdf-1', 'Invoice.pdf', 'inbox-folder') },
      itemsByFolder: {
        'inbox-folder': [folderItem('twin-1', '_Invoice.pdf', 'inbox-folder')],
        'twin-1': [
          fileItem('a-1', 'page_001.png', 'twin-1', 'image/png'),
          fileItem('a-2', 'img-0.jpeg', 'twin-1', ''),
          fileItem('a-3', 'Invoice.de.md', 'twin-1', 'text/markdown'),
        ],
      },
    });

    const assets = await enumerateInboxAssets({ inboxProvider, sourceItemId: 'inbox-pdf-1', sourceName: 'Invoice.pdf' });
    expect(assets.map((a) => a.name)).toEqual(['page_001.png', 'img-0.jpeg']);
  });

  it('kein Shadow-Twin-Ordner -> leere Liste (legitim: keine Bilder extrahiert)', async () => {
    const inboxProvider = fakeProvider({
      itemsById: { 'inbox-pdf-1': fileItem('inbox-pdf-1', 'Invoice.pdf', 'inbox-folder') },
      itemsByFolder: { 'inbox-folder': [] },
    });
    const assets = await enumerateInboxAssets({ inboxProvider, sourceItemId: 'inbox-pdf-1', sourceName: 'Invoice.pdf' });
    expect(assets).toEqual([]);
  });
});

describe('mirrorInboxAssetsToTarget', () => {
  function inboxWithAssets() {
    return fakeProvider({
      itemsById: { 'inbox-pdf-1': fileItem('inbox-pdf-1', 'Invoice.pdf', 'inbox-folder') },
      itemsByFolder: {
        'inbox-folder': [folderItem('twin-1', '_Invoice.pdf', 'inbox-folder')],
        'twin-1': [
          fileItem('a-1', 'page_001.png', 'twin-1', 'image/png'),
          fileItem('a-2', 'page_002.png', 'twin-1', 'image/png'),
        ],
      },
      binaries: {
        'a-1': { blob: new Blob(['PNG-1']), mimeType: 'image/png' },
        'a-2': { blob: new Blob(['PNG-2']), mimeType: 'image/png' },
      },
    });
  }

  it('spiegelt alle Assets ueber den Ziel-Service und leitet die Bytes durch', async () => {
    const inboxProvider = inboxWithAssets();
    // Ziel-Provider ohne bestehenden Twin-Ordner (nichts vorhanden).
    const targetProvider = fakeProvider({ itemsByFolder: { 'folder-9': [] } });
    const uploadBinaryFragment = vi.fn(async () => ({}));
    const targetService = { getBinaryFragments: async () => null, uploadBinaryFragment } as never;

    const res = await mirrorInboxAssetsToTarget({
      inboxProvider,
      targetProvider,
      targetService,
      sourceItemId: 'inbox-pdf-1',
      sourceName: 'Invoice.pdf',
      targetParentId: 'folder-9',
    });

    expect(res.mirroredNames).toEqual(['page_001.png', 'page_002.png']);
    expect(uploadBinaryFragment).toHaveBeenCalledTimes(2);
    const first = uploadBinaryFragment.mock.calls[0][0];
    expect(first.fileName).toBe('page_001.png');
    expect(first.kind).toBe('image');
    expect(first.mimeType).toBe('image/png');
    expect(Buffer.isBuffer(first.buffer)).toBe(true);
    expect(first.buffer.toString()).toBe('PNG-1');
  });

  it('idempotent: bereits im Ziel vorhandene Assets (Mongo-Fragmente) werden uebersprungen', async () => {
    const inboxProvider = inboxWithAssets();
    const targetProvider = fakeProvider({ itemsByFolder: { 'folder-9': [] } });
    const uploadBinaryFragment = vi.fn(async () => ({}));
    const targetService = {
      getBinaryFragments: async () => [{ name: 'page_001.png' }],
      uploadBinaryFragment,
    } as never;

    const res = await mirrorInboxAssetsToTarget({
      inboxProvider,
      targetProvider,
      targetService,
      sourceItemId: 'inbox-pdf-1',
      sourceName: 'Invoice.pdf',
      targetParentId: 'folder-9',
    });

    expect(res.mirroredNames).toEqual(['page_002.png']);
    expect(uploadBinaryFragment).toHaveBeenCalledTimes(1);
  });

  it('idempotent: vorhandene Dateien im Ziel-Dot-Folder (FS) werden uebersprungen', async () => {
    const inboxProvider = inboxWithAssets();
    // FS-Ziel: getBinaryFragments=null, aber Datei liegt schon im Ziel-Twin-Ordner.
    const targetProvider = fakeProvider({
      itemsByFolder: {
        'folder-9': [folderItem('t-twin', '_Invoice.pdf', 'folder-9')],
        't-twin': [fileItem('t-a1', 'page_001.png', 't-twin', 'image/png')],
      },
    });
    const uploadBinaryFragment = vi.fn(async () => ({}));
    const targetService = { getBinaryFragments: async () => null, uploadBinaryFragment } as never;

    const res = await mirrorInboxAssetsToTarget({
      inboxProvider,
      targetProvider,
      targetService,
      sourceItemId: 'inbox-pdf-1',
      sourceName: 'Invoice.pdf',
      targetParentId: 'folder-9',
    });

    expect(res.mirroredNames).toEqual(['page_002.png']);
    expect(uploadBinaryFragment).toHaveBeenCalledTimes(1);
  });

  it('keine Assets -> kein Upload, leeres Ergebnis', async () => {
    const inboxProvider = fakeProvider({
      itemsById: { 'inbox-pdf-1': fileItem('inbox-pdf-1', 'Invoice.pdf', 'inbox-folder') },
      itemsByFolder: { 'inbox-folder': [] },
    });
    const targetProvider = fakeProvider({ itemsByFolder: {} });
    const uploadBinaryFragment = vi.fn(async () => ({}));
    const targetService = { getBinaryFragments: async () => null, uploadBinaryFragment } as never;

    const res = await mirrorInboxAssetsToTarget({
      inboxProvider,
      targetProvider,
      targetService,
      sourceItemId: 'inbox-pdf-1',
      sourceName: 'Invoice.pdf',
      targetParentId: 'folder-9',
    });

    expect(res.mirroredNames).toEqual([]);
    expect(uploadBinaryFragment).not.toHaveBeenCalled();
  });
});
