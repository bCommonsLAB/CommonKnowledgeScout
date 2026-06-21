/**
 * Tests fuer die reine Publikations-Logik (ADR-0004 §E3, W5) mit Fake-Provider
 * + Fake-Ingestion. Drei DoD-Faelle: Erfolg / Token weg / Speicher offline.
 * Zusaetzlich: fehlendes Ziel (kein Silent Fallback) + Idempotenz.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  promoteSubmission,
  type MirrorAssetsArgs,
  type PromotionProvider,
  type WriteTranscriptArtifactArgs,
} from '@/lib/submissions/promotion';
import { StorageError, type StorageItem } from '@/lib/storage/types';
import type { SubmissionBinaryRef, WizardSubmission } from '@/types/wizard-submission';

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

function folderItem(id: string, name: string, parentId = 'root'): StorageItem {
  return {
    id,
    parentId,
    type: 'folder',
    metadata: { name, size: 0, modifiedAt: new Date(0), mimeType: 'inode/directory' },
  };
}

/** Standard-`createFolder`-Fake: liefert einen Inbox-Ordner; wird in den meisten
 *  Tests nicht aufgerufen (explizites `folder-9`), muss aber den Vertrag erfuellen. */
function noopCreateFolder() {
  return vi.fn(async (_parentId: string, name: string) => folderItem('inbox-new', name));
}

describe('promoteSubmission', () => {
  it('Erfolg: schreibt Markdown in den Zielordner + ingestet + liefert savedItemId', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({ ok: true }));
    const provider: PromotionProvider = { uploadFile, listItemsById, createFolder: noopCreateFolder() };

    const result = await promoteSubmission({
      submission: baseSubmission(),
      provider,
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    // Explizit gewaehlter Ordner (`folder-9`): ID bekannt, Name bewusst undefined.
    expect(result).toEqual({
      savedItemId: 'new-1',
      fileName: 'mein-titel.md',
      alreadyPresent: false,
      targetFolderId: 'folder-9',
      targetFolderName: undefined,
      copiedOriginalNames: [],
    });

    // Datei in den Zielordner geschrieben.
    expect(uploadFile).toHaveBeenCalledTimes(1);
    const [folderId, file] = uploadFile.mock.calls[0];
    expect(folderId).toBe('folder-9');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('mein-titel.md');
    expect(file.type).toBe('text/markdown');
    const written = await file.text();
    expect(written).toContain('title: "Mein Titel"');
    // System-Felder werden deterministisch ins Frontmatter erzwungen (Variante A).
    expect(written).toContain('docType: "testimonial"');
    expect(written).toContain('detailViewType: "testimonial"');
    expect(written).toContain('# Body');

    // Ingestion mit derselben Datei-ID + Markdown + flacher Meta (inkl. System-Felder).
    expect(upsertMarkdown).toHaveBeenCalledTimes(1);
    const [u, lib, fileId, fileName, md, meta] = upsertMarkdown.mock.calls[0];
    expect(u).toBe('rev@example.com');
    expect(lib).toBe('lib-1');
    expect(fileId).toBe('new-1');
    expect(fileName).toBe('mein-titel.md');
    expect(md).toContain('# Body');
    expect(meta).toEqual({ title: 'Mein Titel', docType: 'testimonial', detailViewType: 'testimonial' });
  });

  it('Variante A: erzwingt detailViewType/docType auch wenn sie in metadata fehlen (Event -> session, nicht "book")', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const provider: PromotionProvider = { uploadFile, listItemsById, createFolder: noopCreateFolder() };

    // Reale Bug-Lage: docType=event, detailViewType=session als Top-Level-Felder,
    // aber metadata enthaelt KEINS davon (hardcodierte Felder fehlen nach Analyse).
    await promoteSubmission({
      submission: baseSubmission({
        docType: 'event',
        detailViewType: 'session',
        metadata: { title: 'Mein Event' },
      }),
      provider,
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    const written = await uploadFile.mock.calls[0][1].text();
    expect(written).toContain('docType: "event"');
    expect(written).toContain('detailViewType: "session"');
    const meta = upsertMarkdown.mock.calls[0][5];
    expect(meta).toMatchObject({ docType: 'event', detailViewType: 'session' });
  });

  it('Variante A: ein abweichender metadata-Wert wird vom Top-Level-System-Feld ueberschrieben', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const provider: PromotionProvider = { uploadFile, listItemsById, createFolder: noopCreateFolder() };

    // metadata.detailViewType ist falsch (z.B. LLM-Leak "video") -> Top-Level gewinnt.
    await promoteSubmission({
      submission: baseSubmission({
        docType: 'event',
        detailViewType: 'session',
        metadata: { title: 'Mein Event', detailViewType: 'video' },
      }),
      provider,
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    const written = await uploadFile.mock.calls[0][1].text();
    expect(written).toContain('detailViewType: "session"');
    expect(written).not.toContain('detailViewType: "video"');
  });

  it('expliziter Ordner: loest den Anzeigenamen via getItemById auf (keine rohe fileId)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const getItemById = vi.fn(async (id: string) => folderItem(id, 'Mein Zielordner'));
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission({ target: { folderId: 'folder-9' } }),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder(), getItemById },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(getItemById).toHaveBeenCalledWith('folder-9');
    expect(result.targetFolderId).toBe('folder-9');
    expect(result.targetFolderName).toBe('Mein Zielordner');
  });

  it('expliziter Ordner ohne getItemById: Name bleibt undefined (UI faellt auf ID zurueck)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('new-1', file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission({ target: { folderId: 'folder-9' } }),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(result.targetFolderId).toBe('folder-9');
    expect(result.targetFolderName).toBeUndefined();
  });

  it('Token weg: StorageError(AUTH_ERROR) -> wirft, nichts ingestet', async () => {
    const uploadFile = vi.fn(async () => {
      throw new StorageError('Zugriff verweigert', 'AUTH_ERROR', 'onedrive');
    });
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));

    await expect(
      promoteSubmission({ submission: baseSubmission(), provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() }, upsertMarkdown, userEmail: 'rev@example.com' }),
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
      promoteSubmission({ submission: baseSubmission(), provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() }, upsertMarkdown, userEmail: 'rev@example.com' }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(upsertMarkdown).not.toHaveBeenCalled();
  });

  it('kein Ziel gewaehlt: legt Standard-Ordner "inbox" an (find-or-create) und schreibt dort hinein', async () => {
    const uploadFile = vi.fn(async (folderId: string, file: File) => ({ ...fileItem('new-1', file.name), parentId: folderId }));
    // Root ist leer -> der inbox-Ordner muss neu angelegt werden.
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const createFolder = vi.fn(async (_parentId: string, name: string) => folderItem('inbox-1', name));
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission({ target: {} }),
      provider: { uploadFile, listItemsById, createFolder },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    // Inbox-Ordner unter Root angelegt + Datei dort abgelegt (nicht im Root).
    expect(createFolder).toHaveBeenCalledWith('root', 'inbox');
    expect(uploadFile.mock.calls[0][0]).toBe('inbox-1');
    expect(result.savedItemId).toBe('new-1');
    // Realer Zielordner wird fuer die Summary zurueckgereicht (ID + Anzeigename).
    expect(result.targetFolderId).toBe('inbox-1');
    expect(result.targetFolderName).toBe('inbox');
  });

  it('kein Ziel gewaehlt: vorhandenen "inbox"-Ordner wiederverwenden (kein erneutes Anlegen)', async () => {
    const uploadFile = vi.fn(async (folderId: string, file: File) => ({ ...fileItem('new-2', file.name), parentId: folderId }));
    // Root enthaelt bereits einen inbox-Ordner -> wiederverwenden.
    const listItemsById = vi.fn(async () => [folderItem('inbox-existing', 'inbox')]);
    const createFolder = vi.fn(async (_parentId: string, name: string) => folderItem('should-not-create', name));
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission({ target: {} }),
      provider: { uploadFile, listItemsById, createFolder },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(createFolder).not.toHaveBeenCalled();
    expect(uploadFile.mock.calls[0][0]).toBe('inbox-existing');
    expect(result.savedItemId).toBe('new-2');
    // Vorhandener inbox-Ordner wird mit ID + Anzeigename zurueckgereicht.
    expect(result.targetFolderId).toBe('inbox-existing');
    expect(result.targetFolderName).toBe('inbox');
  });

  it('idempotent: vorhandene Zieldatei wird wiederverwendet (kein Upload), aber sicher erneut ingestet', async () => {
    const uploadFile = vi.fn(async () => fileItem('should-not-be-used', 'x'));
    const listItemsById = vi.fn(async () => [fileItem('existing-7', 'mein-titel.md')]);
    const upsertMarkdown = vi.fn(async () => ({}));

    const result = await promoteSubmission({
      submission: baseSubmission(),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
    });

    expect(result).toMatchObject({ savedItemId: 'existing-7', fileName: 'mein-titel.md', alreadyPresent: true });
    expect(uploadFile).not.toHaveBeenCalled();
    expect(upsertMarkdown).toHaveBeenCalledTimes(1);
    expect(upsertMarkdown.mock.calls[0][2]).toBe('existing-7');
  });

  // ---- Befund B: Original(e) aus der Inbox zusaetzlich ins Ziel kopieren ----

  function pdfRef(over: Partial<SubmissionBinaryRef> = {}): SubmissionBinaryRef {
    return {
      hash: 'abc123',
      url: 'https://inbox.example/blob/abc123',
      fileName: 'Invoice.pdf',
      contentType: 'application/pdf',
      itemId: 'inbox-pdf-1',
      ...over,
    };
  }

  it('Befund B: kopiert das hochgeladene Original zusaetzlich in den Zielordner', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF-BYTES'], { type: 'application/pdf' }));

    const result = await promoteSubmission({
      submission: baseSubmission({ binaryRefs: [pdfRef()] }),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
      loadOriginal,
    });

    // Markdown + Original wurden hochgeladen (zwei Uploads).
    expect(uploadFile).toHaveBeenCalledTimes(2);
    const pdfCall = uploadFile.mock.calls.find(([, f]) => f.name === 'Invoice.pdf');
    expect(pdfCall).toBeDefined();
    expect(pdfCall?.[0]).toBe('folder-9');
    expect(pdfCall?.[1].type).toBe('application/pdf');
    expect(loadOriginal).toHaveBeenCalledTimes(1);
    expect(result.copiedOriginalNames).toEqual(['Invoice.pdf']);
  });

  it('Befund B idempotent: bereits vorhandenes Original wird nicht erneut kopiert', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    // Original liegt bereits im Ziel, Markdown noch nicht.
    const listItemsById = vi.fn(async () => [fileItem('pdf-existing', 'Invoice.pdf')]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['x'], { type: 'application/pdf' }));

    const result = await promoteSubmission({
      submission: baseSubmission({ binaryRefs: [pdfRef()] }),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
      loadOriginal,
    });

    // Nur das Markdown wurde geschrieben, das Original nicht erneut.
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0][1].name).toBe('mein-titel.md');
    expect(loadOriginal).not.toHaveBeenCalled();
    expect(result.copiedOriginalNames).toEqual([]);
  });

  it('Befund B: Ref ohne itemId -> Loader wirft (kein stiller Fallback)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    // Simuliert die Loader-Logik aus promote-actions: ohne itemId -> Fehler.
    const loadOriginal = vi.fn(async (ref: SubmissionBinaryRef) => {
      if (!ref.itemId) throw new Error(`kein itemId (${ref.fileName})`);
      return new Blob(['x']);
    });

    await expect(
      promoteSubmission({
        submission: baseSubmission({ binaryRefs: [pdfRef({ itemId: undefined })] }),
        provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
        upsertMarkdown,
        userEmail: 'rev@example.com',
        loadOriginal,
      }),
    ).rejects.toThrow(/kein itemId/);
  });

  // ---- Befund B2a: transcript-only (docType=transcript) ----
  // Ausnahmefall „Nur importieren und transkribieren": nur Extract — Original ins
  // Ziel + Transkript als Shadow-Twin der Quelle. KEIN Standalone-MD, KEIN Ingest.

  function transcriptSub(over: Partial<WizardSubmission> = {}): WizardSubmission {
    return baseSubmission({
      docType: 'transcript',
      detailViewType: 'session',
      markdownBody: '--- Seite 1 ---\nInhalt des Transkripts.',
      binaryRefs: [pdfRef()],
      target: { folderId: 'folder-9' },
      ...over,
    });
  }

  it('B2a: legt Transkript als Shadow-Twin der Ziel-PDF ab (kein Standalone-MD, kein Ingest)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF'], { type: 'application/pdf' }));
    const writeTranscriptArtifact = vi.fn(async (_args: WriteTranscriptArtifactArgs) => ({
      artifactId: 'art-1',
      artifactName: 'Invoice.de.md',
    }));

    const result = await promoteSubmission({
      submission: transcriptSub(),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
      loadOriginal,
      writeTranscriptArtifact,
    });

    // Nur das Original (PDF) wurde kopiert — KEIN Standalone-Markdown.
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0][1].name).toBe('Invoice.pdf');
    // Kein RAG-Ingest im Ausnahmefall.
    expect(upsertMarkdown).not.toHaveBeenCalled();
    // Transkript als Shadow-Twin der kopierten PDF (sourceId = Ziel-Item-ID).
    expect(writeTranscriptArtifact).toHaveBeenCalledTimes(1);
    const args = writeTranscriptArtifact.mock.calls[0][0];
    expect(args.sourceName).toBe('Invoice.pdf');
    expect(args.sourceId).toBe('id-Invoice.pdf');
    expect(args.parentId).toBe('folder-9');
    expect(args.targetLanguage).toBe('de');
    expect(args.markdown).toContain('Transkripts');
    expect(result).toMatchObject({
      savedItemId: 'art-1',
      fileName: 'Invoice.de.md',
      targetFolderId: 'folder-9',
      copiedOriginalNames: ['Invoice.pdf'],
    });
  });

  // ---- Befund B2d: Extract-Assets (Bilder) ins Ziel spiegeln ----

  it('B2d: spiegelt die Extract-Assets ueber die injizierte mirrorAssets-Fn und reicht die Namen durch', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF'], { type: 'application/pdf' }));
    const writeTranscriptArtifact = vi.fn(async (_args: WriteTranscriptArtifactArgs) => ({
      artifactId: 'art-1',
      artifactName: 'Invoice.de.md',
    }));
    const mirrorAssets = vi.fn(async (_args: MirrorAssetsArgs) => ({
      mirroredNames: ['page_001.png', 'page_002.png'],
    }));

    const result = await promoteSubmission({
      submission: transcriptSub(),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
      loadOriginal,
      writeTranscriptArtifact,
      mirrorAssets,
    });

    // Anker = dieselbe Ziel-PDF wie beim Transkript; Inbox-Quelle = original Ref.
    expect(mirrorAssets).toHaveBeenCalledTimes(1);
    const args = mirrorAssets.mock.calls[0][0];
    expect(args.targetSourceId).toBe('id-Invoice.pdf');
    expect(args.parentId).toBe('folder-9');
    expect(args.sourceRef.itemId).toBe('inbox-pdf-1');
    expect(args.sourceRef.fileName).toBe('Invoice.pdf');
    expect(result.mirroredAssetNames).toEqual(['page_001.png', 'page_002.png']);
  });

  it('B2d: ohne mirrorAssets bleiben Original + Transkript unberuehrt (leere Asset-Liste)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF'], { type: 'application/pdf' }));
    const writeTranscriptArtifact = vi.fn(async (_args: WriteTranscriptArtifactArgs) => ({
      artifactId: 'art-1',
      artifactName: 'Invoice.de.md',
    }));

    const result = await promoteSubmission({
      submission: transcriptSub(),
      provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
      upsertMarkdown,
      userEmail: 'rev@example.com',
      loadOriginal,
      writeTranscriptArtifact,
    });

    expect(result.mirroredAssetNames).toEqual([]);
    expect(writeTranscriptArtifact).toHaveBeenCalledTimes(1);
  });

  it('B2a: wirft, wenn writeTranscriptArtifact fehlt (kein stiller Fallback)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF']));

    await expect(
      promoteSubmission({
        submission: transcriptSub(),
        provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
        upsertMarkdown,
        userEmail: 'rev@example.com',
        loadOriginal,
      }),
    ).rejects.toThrow(/writeTranscriptArtifact/);
  });

  it('B2a: wirft bei leerem Transkript (kein stiller Teilzustand)', async () => {
    const uploadFile = vi.fn(async (_folderId: string, file: File) => fileItem('id-' + file.name, file.name));
    const listItemsById = vi.fn(async () => [] as StorageItem[]);
    const upsertMarkdown = vi.fn(async () => ({}));
    const loadOriginal = vi.fn(async () => new Blob(['PDF']));
    const writeTranscriptArtifact = vi.fn(async (_args: WriteTranscriptArtifactArgs) => ({
      artifactId: 'a',
      artifactName: 'n',
    }));

    await expect(
      promoteSubmission({
        submission: transcriptSub({ markdownBody: '   ' }),
        provider: { uploadFile, listItemsById, createFolder: noopCreateFolder() },
        upsertMarkdown,
        userEmail: 'rev@example.com',
        loadOriginal,
        writeTranscriptArtifact,
      }),
    ).rejects.toThrow(/leeres Transkript/);
    expect(writeTranscriptArtifact).not.toHaveBeenCalled();
  });
});
