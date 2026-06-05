/**
 * @fileoverview Azure-Blob-Implementierung von InboxBlobStore (ADR-0004 II).
 *
 * @description
 * Baut auf derselben Konfiguration/demselben Container wie `AzureStorageService`
 * auf (ein flacher Blob-Store traegt die Inbox aller Libraries). Die Anbindung
 * eines externen Backends (`@azure/storage-blob`) ist gemaess
 * `storage-contracts.mdc` §3 fuer das Storage-Modul erlaubt (analog `webdav`).
 *
 * @module storage/inbox
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { resolveAzureStorageConfig, type AzureStorageConfig } from '@/lib/config/azure-storage';
import type { StorageConfig } from '@/types/library';
import type { InboxBlobStore, InboxBlobEntry, InboxBlobListing } from './inbox-blob-store';

export class AzureInboxBlobStore implements InboxBlobStore {
  private readonly client: BlobServiceClient | null;
  private readonly config: AzureStorageConfig | null;

  /**
   * @param libraryConfig Optional: Library.config — nutzt bei
   *   `ingestionStorage.useCustomConfig` die MongoDB-Werte, sonst Prozess-ENV.
   */
  constructor(libraryConfig?: StorageConfig | null) {
    this.config = resolveAzureStorageConfig(libraryConfig ?? undefined);
    this.client = this.config
      ? BlobServiceClient.fromConnectionString(this.config.connectionString)
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null && !!this.config?.containerName;
  }

  private container(): ContainerClient {
    if (!this.client || !this.config?.containerName) {
      throw new Error('AzureInboxBlobStore: Azure Storage (Inbox) ist nicht konfiguriert');
    }
    return this.client.getContainerClient(this.config.containerName);
  }

  async containerExists(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    return this.container().exists();
  }

  async uploadBuffer(blobPath: string, data: Buffer, contentType: string): Promise<void> {
    await this.container().getBlockBlobClient(blobPath).uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  async downloadBuffer(blobPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const blob = this.container().getBlockBlobClient(blobPath);
    const props = await blob.getProperties(); // wirft bei nicht vorhandenem Blob
    const buffer = await blob.downloadToBuffer();
    return { buffer, contentType: props.contentType ?? 'application/octet-stream' };
  }

  async statBlob(blobPath: string): Promise<InboxBlobEntry | null> {
    try {
      const props = await this.container().getBlockBlobClient(blobPath).getProperties();
      return {
        name: blobPath,
        size: props.contentLength ?? 0,
        contentType: props.contentType,
        lastModified: props.lastModified,
      };
    } catch (error) {
      // Nur "nicht gefunden" weich behandeln; andere Fehler weiterreichen.
      if ((error as { statusCode?: number }).statusCode === 404) return null;
      throw error;
    }
  }

  async listByPrefix(prefix: string): Promise<InboxBlobListing> {
    const files: InboxBlobEntry[] = [];
    const folders: string[] = [];
    for await (const item of this.container().listBlobsByHierarchy('/', { prefix })) {
      if (item.kind === 'prefix') {
        folders.push(item.name);
      } else {
        files.push({
          name: item.name,
          size: item.properties.contentLength ?? 0,
          contentType: item.properties.contentType,
          lastModified: item.properties.lastModified,
        });
      }
    }
    return { files, folders };
  }

  async deleteBlob(blobPath: string): Promise<void> {
    await this.container().getBlockBlobClient(blobPath).delete();
  }

  async deletePrefix(prefix: string): Promise<number> {
    const container = this.container();
    let count = 0;
    for await (const blob of container.listBlobsFlat({ prefix })) {
      await container.getBlockBlobClient(blob.name).delete();
      count++;
    }
    return count;
  }

  getBlobUrl(blobPath: string): string {
    if (!this.config?.baseUrl) {
      throw new Error('AzureInboxBlobStore: baseUrl nicht verfuegbar (nicht konfiguriert)');
    }
    return `${this.config.baseUrl}/${blobPath}`;
  }
}
