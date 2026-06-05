/**
 * @fileoverview Vertrag fuer den Low-Level-Blob-Zugriff des Inbox-Providers.
 *
 * @description
 * Trennt Provider (StorageProvider-Semantik, virtuelle Ordner) von Store
 * (reine Blob-Leaf-Operationen). Diese Trennung erlaubt Unit-Tests des Providers
 * mit einem In-Memory-Fake ohne echte Azure-Verbindung.
 *
 * @module storage/inbox
 */

/** Metadaten eines einzelnen Blobs. */
export interface InboxBlobEntry {
  /** Absoluter Blob-Name im Container (z.B. "my-lib/inbox/alice/page_001.png"). */
  name: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
}

/** Ergebnis eines hierarchischen Prefix-Listings. */
export interface InboxBlobListing {
  /** Dateien direkt unter dem Prefix. */
  files: InboxBlobEntry[];
  /** Virtuelle Unterordner (absolute Prefixe, enden auf '/'). */
  folders: string[];
}

/**
 * Low-Level-Blob-Operationen, die der Inbox-Provider benoetigt.
 * Bewusst KEINE move/rename-Operationen (Inbox ist content-adressiert).
 */
export interface InboxBlobStore {
  isConfigured(): boolean;
  containerExists(): Promise<boolean>;
  uploadBuffer(blobPath: string, data: Buffer, contentType: string): Promise<void>;
  /** Wirft, wenn der Blob nicht existiert (kein stiller Fallback). */
  downloadBuffer(blobPath: string): Promise<{ buffer: Buffer; contentType: string }>;
  /** Metadaten eines Blobs oder null, wenn er nicht existiert. */
  statBlob(blobPath: string): Promise<InboxBlobEntry | null>;
  /** Hierarchisches Listing (Delimiter '/'): direkte Dateien + virtuelle Ordner. */
  listByPrefix(prefix: string): Promise<InboxBlobListing>;
  deleteBlob(blobPath: string): Promise<void>;
  /** Loescht alle Blobs unter dem Prefix; gibt die Anzahl geloeschter Blobs zurueck. */
  deletePrefix(prefix: string): Promise<number>;
  getBlobUrl(blobPath: string): string;
}
