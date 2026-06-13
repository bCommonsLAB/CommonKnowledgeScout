/**
 * @fileoverview Reine Pfad-/ID-Helfer fuer den Inbox-Blob-Provider (ADR-0004 II).
 *
 * @description
 * Uebersetzt zwischen StorageItem-IDs und Azure-Blob-Pfaden im Inbox-Bereich.
 * Schema (content-adressiert, virtuelle Ordner via Prefix):
 *   {sanitizedLibraryId}/inbox/{username}/{...}
 * Ordner-IDs enden auf '/', Datei-IDs nicht. 'root' ist die Inbox-Wurzel der
 * Library. Keine move/rename-Semantik (siehe inbox-blob-provider). Rein und
 * damit voll unit-testbar.
 *
 * @module storage/inbox
 */

import type { StorageItem } from '../types';
// Der Provider ist seit Welle II-A die einzige Pfad-Autoritaet der Inbox; die
// Capture-Route laedt ueber ihn (uploadInboxBinary) und uebernimmt damit dieselbe
// Sanitisierung — Provider- und Capture-Pfad konvergieren ohne zweiten Helfer.
import { sanitizeLibraryId } from '@/lib/services/azure-storage-service';

/** Pfad-Segment des Inbox-Bereichs. */
const INBOX_SCOPE = 'inbox';

/** Spezial-ID fuer die Inbox-Wurzel einer Library. */
export const INBOX_ROOT_ID = 'root';

const FOLDER_MIME = 'application/folder';
const DEFAULT_FILE_MIME = 'application/octet-stream';
/** Deterministischer "unbekannt"-Zeitstempel fuer virtuelle Ordner. */
const UNKNOWN_DATE = new Date(0);

/** Wurzel-Prefix der Library-Inbox, z.B. "my-lib/inbox/". */
export function buildRootPrefix(libraryId: string): string {
  const lib = sanitizeLibraryId(libraryId);
  if (!lib) throw new Error('inbox-path: libraryId ergibt keinen gueltigen Prefix');
  return `${lib}/${INBOX_SCOPE}/`;
}

/** Ordner-IDs enden auf '/'; 'root' gilt ebenfalls als Ordner. */
export function isFolderId(id: string): boolean {
  return id === INBOX_ROOT_ID || id.endsWith('/');
}

function assertWithinRoot(rootPrefix: string, id: string): void {
  if (!id.startsWith(rootPrefix)) {
    throw new Error(`inbox-path: ID "${id}" liegt ausserhalb der Inbox-Wurzel "${rootPrefix}"`);
  }
}

/** Validiert ein einzelnes Pfad-Segment (Ordner-/Dateiname). */
export function validateSegment(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes('/') || trimmed === '.' || trimmed === '..') {
    throw new Error(`inbox-path: ungueltiger Name "${name}"`);
  }
  return trimmed;
}

/** Ordner-ID/'root' -> Blob-Prefix (zum Listen/Hochladen/Anlegen). */
export function toPrefix(rootPrefix: string, folderId: string): string {
  if (folderId === INBOX_ROOT_ID) return rootPrefix;
  if (!folderId.endsWith('/')) {
    throw new Error(`inbox-path: "${folderId}" ist keine Ordner-ID`);
  }
  assertWithinRoot(rootPrefix, folderId);
  return folderId;
}

/** Datei-ID -> Blob-Name (fuer Binary/Delete/Stat/URL). */
export function toBlobName(rootPrefix: string, fileId: string): string {
  if (fileId === INBOX_ROOT_ID || fileId.endsWith('/')) {
    throw new Error(`inbox-path: "${fileId}" ist keine Datei-ID`);
  }
  assertWithinRoot(rootPrefix, fileId);
  return fileId;
}

export function childFolderId(prefix: string, name: string): string {
  return `${prefix}${validateSegment(name)}/`;
}

export function childBlobName(prefix: string, name: string): string {
  return `${prefix}${validateSegment(name)}`;
}

/** Letztes Pfad-Segment (Ordnername ohne Slash bzw. Dateiname). */
export function segmentName(id: string): string {
  const trimmed = id.endsWith('/') ? id.slice(0, -1) : id;
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

/** Eltern-Ordner-ID; die Wurzel wird als 'root' zurueckgegeben. */
export function parentIdOf(rootPrefix: string, id: string): string {
  const trimmed = id.endsWith('/') ? id.slice(0, -1) : id;
  const idx = trimmed.lastIndexOf('/');
  const parent = idx >= 0 ? trimmed.slice(0, idx + 1) : '';
  if (!parent || parent === rootPrefix) return INBOX_ROOT_ID;
  return parent;
}

/** Pfad relativ zur Inbox-Wurzel, z.B. "/alice/page_001.png". */
export function relativePath(rootPrefix: string, id: string): string {
  if (id === INBOX_ROOT_ID) return '/';
  assertWithinRoot(rootPrefix, id);
  const rest = id.slice(rootPrefix.length);
  const clean = rest.endsWith('/') ? rest.slice(0, -1) : rest;
  return `/${clean}`;
}

export function rootItem(): StorageItem {
  return {
    id: INBOX_ROOT_ID, parentId: '', type: 'folder',
    metadata: { name: INBOX_ROOT_ID, size: 0, modifiedAt: UNKNOWN_DATE, mimeType: FOLDER_MIME },
  };
}

export function folderItem(rootPrefix: string, prefix: string): StorageItem {
  return {
    id: prefix, parentId: parentIdOf(rootPrefix, prefix), type: 'folder',
    metadata: { name: segmentName(prefix), size: 0, modifiedAt: UNKNOWN_DATE, mimeType: FOLDER_MIME },
  };
}

export function fileItem(
  rootPrefix: string,
  name: string,
  size: number,
  contentType?: string,
  lastModified?: Date,
): StorageItem {
  return {
    id: name, parentId: parentIdOf(rootPrefix, name), type: 'file',
    metadata: {
      name: segmentName(name), size,
      modifiedAt: lastModified ?? UNKNOWN_DATE,
      mimeType: contentType ?? DEFAULT_FILE_MIME,
    },
  };
}

/** root + Ordnerkette bis zum Item (Item selbst inkl., wenn es ein Ordner ist). */
export function pathItems(rootPrefix: string, itemId: string): StorageItem[] {
  const items: StorageItem[] = [rootItem()];
  if (itemId === INBOX_ROOT_ID) return items;
  assertWithinRoot(rootPrefix, itemId);
  const rest = itemId.slice(rootPrefix.length);
  const trimmed = rest.endsWith('/') ? rest.slice(0, -1) : rest;
  const segments = trimmed.split('/').filter(Boolean);
  // Bei Dateien das letzte Segment (Dateiname) nicht als Ordner zaehlen.
  const folderCount = itemId.endsWith('/') ? segments.length : segments.length - 1;
  let prefix = rootPrefix;
  for (let i = 0; i < folderCount; i++) {
    prefix = `${prefix}${segments[i]}/`;
    items.push(folderItem(rootPrefix, prefix));
  }
  return items;
}
