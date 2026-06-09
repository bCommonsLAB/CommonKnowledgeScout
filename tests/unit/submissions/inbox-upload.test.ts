/**
 * Tests fuer `uploadInboxBinary` (ADR-0004 II, Welle II-A).
 *
 * Beweist die Pfad-Konvergenz: der Upload laeuft ueber den ECHTEN
 * `InboxBlobProvider` (gegen einen In-Memory-Fake-Store) und landet content-
 * adressiert unter `{libraryId}/inbox/{username}/{hash}.{ext}`. Die zurueck-
 * gegebene `SubmissionBinaryRef` traegt Hash, Provider-URL und Original-Name.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { InboxBlobProvider } from '@/lib/storage/inbox/inbox-blob-provider';
import type {
  InboxBlobStore,
  InboxBlobEntry,
  InboxBlobListing,
} from '@/lib/storage/inbox/inbox-blob-store';
import { uploadInboxBinary } from '@/lib/submissions/inbox-upload';
import { calculateImageHash } from '@/lib/services/azure-storage-service';

class FakeInboxBlobStore implements InboxBlobStore {
  blobs = new Map<string, { buffer: Buffer; contentType: string }>();
  isConfigured(): boolean {
    return true;
  }
  async containerExists(): Promise<boolean> {
    return true;
  }
  async uploadBuffer(blobPath: string, data: Buffer, contentType: string): Promise<void> {
    this.blobs.set(blobPath, { buffer: Buffer.from(data), contentType });
  }
  async downloadBuffer(blobPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const b = this.blobs.get(blobPath);
    if (!b) throw new Error(`fake: blob nicht gefunden: ${blobPath}`);
    return { buffer: b.buffer, contentType: b.contentType };
  }
  async statBlob(blobPath: string): Promise<InboxBlobEntry | null> {
    const b = this.blobs.get(blobPath);
    return b ? { name: blobPath, size: b.buffer.length, contentType: b.contentType } : null;
  }
  async listByPrefix(): Promise<InboxBlobListing> {
    return { files: [], folders: [] };
  }
  async deleteBlob(): Promise<void> {}
  async deletePrefix(): Promise<number> {
    return 0;
  }
  getBlobUrl(blobPath: string): string {
    return `https://fake.blob/${blobPath}`;
  }
}

const LIB = 'lib1';
let store: FakeInboxBlobStore;
let provider: InboxBlobProvider;

beforeEach(() => {
  store = new FakeInboxBlobStore();
  provider = new InboxBlobProvider(LIB, store);
});

function fileOf(name: string, content: string, type: string): File {
  return new File([Buffer.from(content)], name, { type });
}

describe('uploadInboxBinary', () => {
  it('legt den Blob content-adressiert unter {lib}/inbox/{username}/{hash}.{ext} ab', async () => {
    const file = fileOf('Quelle.pdf', '%PDF-1.4 hallo', 'application/pdf');
    const hash = calculateImageHash(Buffer.from('%PDF-1.4 hallo'));
    const expectedPath = `${LIB}/inbox/alice/${hash}.pdf`;

    const ref = await uploadInboxBinary(provider, 'alice', file);

    expect([...store.blobs.keys()]).toEqual([expectedPath]);
    expect(ref).toEqual({
      hash,
      url: `https://fake.blob/${expectedPath}`,
      fileName: 'Quelle.pdf',
      contentType: 'application/pdf',
      size: Buffer.from('%PDF-1.4 hallo').length,
    });
  });

  it('faellt ohne Endung auf den reinen Hash zurueck und behaelt den MIME-Type', async () => {
    const file = fileOf('noext', 'data', 'application/octet-stream');
    const hash = calculateImageHash(Buffer.from('data'));

    const ref = await uploadInboxBinary(provider, 'bob', file);

    expect([...store.blobs.keys()]).toEqual([`${LIB}/inbox/bob/${hash}`]);
    expect(ref.hash).toBe(hash);
    expect(ref.fileName).toBe('noext');
  });

  it('dedupliziert gleichen Inhalt im selben {username}-Ordner (content-addressed)', async () => {
    await uploadInboxBinary(provider, 'alice', fileOf('a.pdf', 'same', 'application/pdf'));
    await uploadInboxBinary(provider, 'alice', fileOf('b.pdf', 'same', 'application/pdf'));
    // Gleicher Hash + gleiche Endung -> ein Blob (Dedup), nicht zwei.
    expect(store.blobs.size).toBe(1);
  });
});
