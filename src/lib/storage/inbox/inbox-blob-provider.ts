/**
 * @fileoverview InboxBlobProvider — duenner StorageProvider fuer die Inbox (ADR-0004 II).
 *
 * @description
 * Content-adressierter Blob-Bereich `{libraryId}/inbox/{username}/...` mit
 * virtuellen Ordnern via Prefix. Bewusst OHNE move/rename — Inbox-Blobs sind bis
 * zur Promotion (W5) unveraenderlich; diese Methoden WERFEN typisiert
 * (no-silent-fallbacks). `createFolder` ist virtuell (legt nur eine Prefix-ID an),
 * damit die bestehende Transform-Pipeline (Shadow-Twin-Ordner) unveraendert ueber
 * die Inbox laufen kann (verifiziert: transform-service ruft createFolder+uploadFile,
 * aber kein move/rename).
 *
 * Nur Server-Kontext (kein Client-Proxy). Schreibt NIE in das Owner-Archiv.
 *
 * @module storage/inbox
 */

import {
  StorageProvider,
  StorageItem,
  StorageValidationResult,
  StorageError,
} from '../types';
import type { InboxBlobStore } from './inbox-blob-store';
import * as P from './inbox-path';

export class InboxBlobProvider implements StorageProvider {
  private readonly libraryId: string;
  private readonly store: InboxBlobStore;
  private readonly rootPrefix: string;

  constructor(libraryId: string, store: InboxBlobStore) {
    this.libraryId = libraryId;
    this.store = store;
    this.rootPrefix = P.buildRootPrefix(libraryId);
  }

  get name(): string {
    return 'Inbox (Azure Blob)';
  }

  get id(): string {
    return this.libraryId;
  }

  isAuthenticated(): boolean {
    // Connection-String-basiert (kein OAuth-Token-Problem — Inbox-Vorteil).
    return this.store.isConfigured();
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    if (!this.store.isConfigured()) {
      return { isValid: false, error: 'Azure Storage (Inbox) ist nicht konfiguriert.' };
    }
    const exists = await this.store.containerExists();
    return exists
      ? { isValid: true }
      : { isValid: false, error: 'Inbox-Container existiert nicht.' };
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    const prefix = P.toPrefix(this.rootPrefix, folderId);
    const { files, folders } = await this.store.listByPrefix(prefix);
    const folderItems = folders.map((f) => P.folderItem(this.rootPrefix, f));
    const fileItems = files.map((b) =>
      P.fileItem(this.rootPrefix, b.name, b.size, b.contentType, b.lastModified),
    );
    return [...folderItems, ...fileItems];
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    if (itemId === P.INBOX_ROOT_ID) return P.rootItem();
    if (P.isFolderId(itemId)) {
      P.toPrefix(this.rootPrefix, itemId); // validiert Zugehoerigkeit zur Inbox
      return P.folderItem(this.rootPrefix, itemId);
    }
    const blobName = P.toBlobName(this.rootPrefix, itemId);
    const entry = await this.store.statBlob(blobName);
    if (!entry) {
      throw new StorageError(`Inbox-Datei nicht gefunden: ${itemId}`, 'NOT_FOUND', 'inbox');
    }
    return P.fileItem(this.rootPrefix, entry.name, entry.size, entry.contentType, entry.lastModified);
  }

  /** Virtueller Ordner: liefert nur die Prefix-ID (kein Marker-Blob), idempotent. */
  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const prefix = P.toPrefix(this.rootPrefix, parentId);
    const folderId = P.childFolderId(prefix, name);
    return P.folderItem(this.rootPrefix, folderId);
  }

  async deleteItem(itemId: string): Promise<void> {
    if (itemId === P.INBOX_ROOT_ID) {
      throw new StorageError('Die Inbox-Wurzel kann nicht geloescht werden.', 'INVALID_ARGUMENT', 'inbox');
    }
    if (P.isFolderId(itemId)) {
      await this.store.deletePrefix(P.toPrefix(this.rootPrefix, itemId));
      return;
    }
    await this.store.deleteBlob(P.toBlobName(this.rootPrefix, itemId));
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    const prefix = P.toPrefix(this.rootPrefix, parentId);
    const blobName = P.childBlobName(prefix, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';
    await this.store.uploadBuffer(blobName, buffer, contentType);
    return P.fileItem(this.rootPrefix, blobName, buffer.length, contentType, new Date());
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const blobName = P.toBlobName(this.rootPrefix, fileId);
    const { buffer, contentType } = await this.store.downloadBuffer(blobName);
    return { blob: new Blob([buffer], { type: contentType }), mimeType: contentType };
  }

  async getPathById(itemId: string): Promise<string> {
    return P.relativePath(this.rootPrefix, itemId);
  }

  async getPathItemsById(itemId: string): Promise<StorageItem[]> {
    return P.pathItems(this.rootPrefix, itemId);
  }

  async getStreamingUrl(itemId: string): Promise<string> {
    const blobName = P.toBlobName(this.rootPrefix, itemId);
    return this.store.getBlobUrl(blobName);
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    return this.getStreamingUrl(itemId);
  }

  // --- Bewusst NICHT unterstuetzt: Inbox ist content-adressiert/unveraenderlich ---
  // (Signaturen ohne Parameter sind zulaessig: TS erlaubt schmalere Implementierungen.)

  async moveItem(): Promise<void> {
    throw new StorageError(
      'moveItem wird im content-adressierten Inbox-Provider nicht unterstuetzt.',
      'NOT_SUPPORTED',
      'inbox',
    );
  }

  async renameItem(): Promise<StorageItem> {
    throw new StorageError(
      'renameItem wird im content-adressierten Inbox-Provider nicht unterstuetzt.',
      'NOT_SUPPORTED',
      'inbox',
    );
  }
}
