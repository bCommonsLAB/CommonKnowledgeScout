/**
 * Tests fuer die reine Publikations-Logik (ADR-0004 §E3, W5) mit Fake-Provider
 * + Fake-Ingestion. Drei DoD-Faelle: Erfolg / Token weg / Speicher offline.
 * Zusaetzlich: fehlendes Ziel (kein Silent Fallback) + Idempotenz.
 */

import { describe, it, expect, vi } from 'vitest';
import { promoteSubmission, type PromotionProvider } from '@/lib/submissions/promotion';
import { PromotionTargetMissingError } from '@/lib/submissions/promotion-errors';
import { StorageError, type StorageItem } from '@/lib/storage/types';
import type { WizardSubmission } from '@/types/wizard-submission';

function baseSubmission(over: Partial<WizardSubmission> = {}): WizardSubmission {
  return {
    id: 'sub-1',
    libraryId: 'lib-1',
    status: 'publishing',
    createdBy: 'anna@example.com',
    createdByRole: 'contributor',
    wizardId: 'w1',
    docType: 'testimonial',
    detailViewType: 'testimonial',
    metadata: { title: 'Mein Titel' },
    markdownBody: '# Body\n\nInhalt.',
    binaryRefs: [],
    confidence: {},
    target: { folderId: 'folder-9' },
    review: {},
    events: [],
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
    version: 1,
    ...over,
  };
}

function fileItem(id: string, name: string): StorageItem {
  return {
    id,
    parentId: 'folder-9',
    type: 'file',
    metadata: { name, size: 0, modifiedAt: new Date(0), mimeType: 'text/markdown' },
  };
}

describe('promoteSubmission', () => {
  it('Erfolg: schreibt Markdown in den Zielordner + ingestet + liefert savedItemId', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({ ok: true }));
    const provider: PromotionProvider = { uploadFile, listItemsById };

    const result = await promoteSubmission({
      submission: baseSubmission(),
      provider,
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(result).toEqual({ savedItemId: 'new-1', fileName: 'mein-titel.md', alreadyPresent: false });

    // Datei in den Zielordner geschrieben.
    expect(uploadFile).toHaveBeenCalledTimes(1);
    const [folderId, file] = uploadFile.mock.calls[0];
    expect(folderId).toBe('folder-9');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('mein-titel.md');
    expect(file.type).toBe('text/markdown');
    const written = await file.text();
    expect(written).toContain('title: "Mein Titel"');
    expect(written).toContain('# Body');

    // Ingestion mit derselben Datei-ID + Markdown + flacher Meta.
    expect(upsertMarkdown).toHaveBeenCalledTimes(1);
    const [u, lib, fileId, fileName, md, meta] = upsertMarkdown.mock.calls[0];
    expect(u).toBe('rev@example.com');
    expect(lib).toBe('lib-1');
    expect(fileId).toBe('new-1');
    expect(fileName).toBe('mein-titel.md');
    expect(md).toContain('# Body');
    expect(meta).toEqual({ title: 'Mein Titel' });
  });

  it('Token weg: StorageError(AUTH_ERROR) -> wirft, nichts ingestet', async () => {
    const uploadFile = vi.fn(async () => {
      throw new StorageError('Zugriff verweigert', 'AUTH_ERROR', 'onedrive');
    });
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));

    await expect(
      promoteSubmission({ submission: baseSubmission(), provider: { uploadFile, listItemsById }, upsertMarkdown, userEmail: 'rev@example.com' }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(upsertMarkdown).not.toHaveBeenCalled();
  });

  it('Speicher offline: StorageError(NETWORK_ERROR) -> wirft, nichts geschrieben/ingestet', async () => {
    const uploadFile = vi.fn(async () => fileItem('x', 'x'));
    const listItemsById = vi.fn(async () => {
      throw new StorageError('Netzwerkfehler', 'NETWORK_ERROR', 'onedrive');
    });
    const upsertMarkdown = vi.fn(async () => ({}));

    await expect(
      promoteSubmission({ submission: baseSubmission(), provider: { uploadFile, listItemsById }, upsertMarkdown, userEmail: 'rev@example.com' }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(upsertMarkdown).not.toHaveBeenCalled();
  });

  it('fehlendes Ziel (target.folderId) -> PromotionTargetMissingError, kein Schreiben (kein Silent Fallback)', async () => {
    const uploadFile = vi.fn(async () => fileItem('x', 'x'));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));

    await expect(
      promoteSubmission({ submission: baseSubmission({ target: {} }), provider: { uploadFile, listItemsById }, upsertMarkdown, userEmail: 'rev@example.com' }),
    ).rejects.toBeInstanceOf(PromotionTargetMissingError);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(listItemsById).not.toHaveBeenCalled();
    expect(upsertMarkdown).not.toHaveBeenCalled();
  });

  it('idempotent: vorhandene Zieldatei wird wiederverwendet (kein Upload), aber sicher erneut ingestet', async () => {
    const uploadFile = vi.fn(async () => fileItem('should-not-be-used', 'x'));
    const listItemsById = vi.fn(async () => [fileItem('existing-7', 'mein-titel.md')]);
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission(),
      provider: { uploadFile, listItemsById },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(result).toMatchObject({ savedItemId: 'existing-7', fileName: 'mein-titel.md', alreadyPresent: true });
    expect(uploadFile).not.toHaveBeenCalled();
    expect(upsertMarkdown).toHaveBeenCalledTimes(1);
    expect(upsertMarkdown.mock.calls[0][2]).toBe('existing-7');
  });
});
