/**
 * Unit-Tests: InboxBlobProvider gegen einen In-Memory-Fake-Store (ADR-0004 II).
 *
 * Prueft die StorageProvider-Semantik des duennen Inbox-Providers:
 * - virtueller createFolder + uploadFile + getBinary-Roundtrip
 * - hierarchisches Listing (virtuelle Ordner via Prefix)
 * - move/rename WERFEN (content-adressiert, no-silent-fallbacks)
 * - delete (Datei + Prefix), getItemById fuer fehlende Datei wirft NOT_FOUND
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { InboxBlobProvider } from '@/lib/storage/inbox/inbox-blob-provider';
import type {
  InboxBlobStore,
  InboxBlobEntry,
  InboxBlobListing,
} from '@/lib/storage/inbox/inbox-blob-store';
import { StorageError } from '@/lib/storage/types';

class FakeInboxBlobStore implements InboxBlobStore {
  private blobs = new Map<string, { buffer: Buffer; contentType: string; lastModified: Date }>();
  configured = true;

  isConfigured(): boolean {
    return this.configured;
  }
  async containerExists(): Promise<boolean> {
    return this.configured;
  }
  async uploadBuffer(blobPath: string, data: Buffer, contentType: string): Promise<void> {
    this.blobs.set(blobPath, { buffer: Buffer.from(data), contentType, lastModified: new Date() });
  }
  async downloadBuffer(blobPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const b = this.blobs.get(blobPath);
    if (!b) throw new Error(`fake: blob nicht gefunden: ${blobPath}`);
    return { buffer: b.buffer, contentType: b.contentType };
  }
  async statBlob(blobPath: string): Promise<InboxBlobEntry | null> {
    const b = this.blobs.get(blobPath);
    return b
      ? { name: blobPath, size: b.buffer.length, contentType: b.contentType, lastModified: b.lastModified }
      : null;
  }
  async listByPrefix(prefix: string): Promise<InboxBlobListing> {
    const files: InboxBlobEntry[] = [];
    const folderSet = new Set<string>();
    for (const [name, b] of this.blobs) {
      if (!name.startsWith(prefix)) continue;
      const rest = name.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash >= 0) folderSet.add(prefix + rest.slice(0, slash + 1));
      else files.push({ name, size: b.buffer.length, contentType: b.contentType, lastModified: b.lastModified });
    }
    return { files, folders: [...folderSet] };
  }
  async deleteBlob(blobPath: string): Promise<void> {
    if (!this.blobs.delete(blobPath)) throw new Error(`fake: blob nicht gefunden: ${blobPath}`);
  }
  async deletePrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const key of [...this.blobs.keys()]) {
      if (key.startsWith(prefix)) {
        this.blobs.delete(key);
        n++;
      }
    }
    return n;
  }
  getBlobUrl(blobPath: string): string {
    return `https://fake.blob/${blobPath}`;
  }
}

const LIB = 'lib1';
const ROOT = 'lib1/inbox/';
let store: FakeInboxBlobStore;
let provider: InboxBlobProvider;

beforeEach(() => {
  store = new FakeInboxBlobStore();
  provider = new InboxBlobProvider(LIB, store);
});

function fileOf(name: string, content: string, type = 'text/plain'): File {
  return new File([Buffer.from(content)], name, { type });
}

describe('InboxBlobProvider: Identitaet + Konfiguration', () => {
  it('name/id und isAuthenticated spiegeln den Store', () => {
    expect(provider.name).toBe('Inbox (Azure Blob)');
    expect(provider.id).toBe(LIB);
    expect(provider.isAuthenticated()).toBe(true);
  });

  it('validateConfiguration meldet fehlende Konfiguration', async () => {
    store.configured = false;
    expect(await provider.validateConfiguration()).toMatchObject({ isValid: false });
  });
});

describe('InboxBlobProvider: createFolder ist virtuell', () => {
  it('legt keinen Marker-Blob an (Wurzel bleibt leer)', async () => {
    const folder = await provider.createFolder('root', 'alice');
    expect(folder).toMatchObject({ id: `${ROOT}alice/`, type: 'folder' });
    expect(await provider.listItemsById('root')).toEqual([]);
  });
});

describe('InboxBlobProvider: upload/list/getBinary-Roundtrip', () => {
  it('schreibt in den Ordner-Prefix und liest die Bytes zurueck', async () => {
    const folder = await provider.createFolder('root', 'alice');
    const item = await provider.uploadFile(folder.id, fileOf('note.txt', 'hello'));

    expect(item).toMatchObject({ id: `${ROOT}alice/note.txt`, type: 'file' });
    expect(item.metadata).toMatchObject({ name: 'note.txt', size: 5, mimeType: 'text/plain' });

    const binary = await provider.getBinary(item.id);
    expect(binary.mimeType).toBe('text/plain');
    expect(Buffer.from(await binary.blob.arrayBuffer()).toString('utf8')).toBe('hello');
  });

  it('listet virtuelle Ordner an der Wurzel und Dateien im Ordner', async () => {
    const folder = await provider.createFolder('root', 'alice');
    await provider.uploadFile(folder.id, fileOf('note.txt', 'hello'));

    const rootListing = await provider.listItemsById('root');
    expect(rootListing).toEqual([
      expect.objectContaining({ id: `${ROOT}alice/`, type: 'folder' }),
    ]);

    const folderListing = await provider.listItemsById(folder.id);
    expect(folderListing).toEqual([
      expect.objectContaining({ id: `${ROOT}alice/note.txt`, type: 'file' }),
    ]);
  });
});

describe('InboxBlobProvider: getItemById', () => {
  it('liefert root, virtuelle Ordner und existierende Dateien', async () => {
    const folder = await provider.createFolder('root', 'alice');
    const item = await provider.uploadFile(folder.id, fileOf('note.txt', 'hello'));

    expect(await provider.getItemById('root')).toMatchObject({ id: 'root', type: 'folder' });
    expect(await provider.getItemById(folder.id)).toMatchObject({ id: folder.id, type: 'folder' });
    expect(await provider.getItemById(item.id)).toMatchObject({ id: item.id, type: 'file', metadata: { size: 5 } });
  });

  it('wirft NOT_FOUND fuer eine fehlende Datei', async () => {
    await expect(provider.getItemById(`${ROOT}alice/missing.txt`)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'NOT_FOUND',
    });
  });
});

describe('InboxBlobProvider: delete', () => {
  it('loescht eine Datei und einen ganzen Ordner-Prefix', async () => {
    const folder = await provider.createFolder('root', 'alice');
    const a = await provider.uploadFile(folder.id, fileOf('a.txt', 'a'));
    await provider.uploadFile(folder.id, fileOf('b.txt', 'b'));

    await provider.deleteItem(a.id);
    expect((await provider.listItemsById(folder.id)).map((i) => i.id)).toEqual([`${ROOT}alice/b.txt`]);

    await provider.deleteItem(folder.id);
    expect(await provider.listItemsById('root')).toEqual([]);
  });
});

describe('InboxBlobProvider: nicht unterstuetzte Operationen WERFEN', () => {
  it('moveItem und renameItem werfen StorageError NOT_SUPPORTED', async () => {
    await expect(provider.moveItem()).rejects.toMatchObject({ name: 'StorageError', code: 'NOT_SUPPORTED' });
    await expect(provider.renameItem()).rejects.toBeInstanceOf(StorageError);
  });
});

describe('InboxBlobProvider: URLs + Pfad', () => {
  it('getStreamingUrl/getDownloadUrl liefern die Blob-URL', async () => {
    const folder = await provider.createFolder('root', 'alice');
    const item = await provider.uploadFile(folder.id, fileOf('note.txt', 'hello'));
    expect(await provider.getStreamingUrl(item.id)).toBe(`https://fake.blob/${ROOT}alice/note.txt`);
    expect(await provider.getDownloadUrl(item.id)).toBe(`https://fake.blob/${ROOT}alice/note.txt`);
  });

  it('getPathById ist root-relativ', async () => {
    expect(await provider.getPathById(`${ROOT}alice/note.txt`)).toBe('/alice/note.txt');
  });
});
