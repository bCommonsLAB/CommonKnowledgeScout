/**
 * @fileoverview Inbox-Binaer-Upload ueber den InboxBlobProvider (ADR-0004 II, Welle II-A).
 *
 * @description
 * Laedt eine Binaerquelle content-adressiert in den Inbox-Bereich
 * `{libraryId}/inbox/{username}/{hash}.{ext}` — und zwar ueber das
 * `StorageProvider`-Interface, NICHT direkt via `AzureStorageService`. Damit ist
 * der Provider die einzige Pfad-Autoritaet: Capture- und Provider-Pfad
 * konvergieren automatisch (kein zweiter, parallel gepflegter Pfad-Helfer).
 *
 * Invariante (ADR-0004): Die Erfassung beruehrt NIE den Ziel-Provider — der
 * `provider` ist hier immer der Inbox-Provider (siehe `getInboxProvider`).
 *
 * @see src/lib/storage/inbox/inbox-provider-entry.ts
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module lib/submissions
 */

import { calculateImageHash } from '@/lib/services/azure-storage-service';
import { buildInboxBinaryRef, extractFileExtension } from '@/lib/submissions/inbox-blob';
import { INBOX_ROOT_ID } from '@/lib/storage/inbox/inbox-path';
import type { StorageProvider } from '@/lib/storage/types';
import type { SubmissionBinaryRef } from '@/types/wizard-submission';

/**
 * Laedt `file` content-adressiert in den `{username}`-Ordner des Inbox-Providers
 * und liefert die `SubmissionBinaryRef` (Hash/URL/Name) fuer die Submission.
 *
 * Der virtuelle `{username}`-Ordner wird idempotent angelegt; der Blob wird unter
 * `{hash}.{ext}` abgelegt (Dedup je Ordner). Die URL kommt aus dem Provider
 * (`getStreamingUrl`), nicht aus einem separaten Pfad-Helfer.
 */
export async function uploadInboxBinary(
  provider: StorageProvider,
  username: string,
  file: File,
): Promise<SubmissionBinaryRef> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = calculateImageHash(buffer);
  const extension = extractFileExtension(file.name);
  const contentType = file.type || 'application/octet-stream';
  // Content-adressierter Blob-Name (ohne Endung: nur der Hash).
  const blobName = extension ? `${hash}.${extension}` : hash;

  // Virtuellen {username}-Ordner anlegen (idempotent) und content-adressiert hochladen.
  const folder = await provider.createFolder(INBOX_ROOT_ID, username);
  const stored = new File([buffer], blobName, { type: contentType });
  const item = await provider.uploadFile(folder.id, stored);
  const url = await provider.getStreamingUrl(item.id);

  return buildInboxBinaryRef({
    hash,
    url,
    // Original-Dateiname fuer Anzeige/Promotion behalten (nicht der Hash-Name).
    fileName: file.name,
    contentType,
    size: buffer.length,
  });
}
