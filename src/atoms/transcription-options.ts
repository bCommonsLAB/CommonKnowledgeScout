/**
 * @fileoverview Auswahl-Atome fuer die Multi-Select-Checkboxen in der Dateiliste.
 *
 * @description
 * Die File-List verteilt markierte Items auf ZWEI globale Jotai-Atome, je
 * nach Medientyp. Dieser Trennschnitt ist historisch gewachsen (Sammel-
 * Transkript fuer Audio/Video, eigene Aktionen fuer Bilder/PDFs) — er ist
 * NICHT offensichtlich am Atom-Namen ablesbar und hat in der DIVA-Texture-
 * Bulk-Dialog-Arbeit (Mai 2026) Verwirrung erzeugt.
 *
 * **Mapping (siehe `mediaKindToMediaType` unten + `isItemSelected` in
 * `file-list.tsx`):**
 *
 *   selectedBatchItemsAtom         ← audio, video
 *   selectedTransformationItemsAtom ← pdf, image, docx, xlsx, pptx, markdown
 *
 * **Konsequenz fuer Konsumenten:** Wer "alle markierten Dateien" lesen
 * will, muss BEIDE Atome lesen und konkatenieren — z.B. der Bulk-Process-
 * Dialog (`pdf-bulk-import-dialog.tsx`). Wer nur Audio/Video-spezifische
 * Aktionen braucht (Sammel-Transkript), liest nur das erste Atom.
 *
 * **Folge-Refactor-Idee:** ein einzelnes `selectedFilesAtom: Set<itemId>`
 * + Helper-Selektoren je Medientyp wuerde das vereinfachen — bis dahin
 * gilt: BEIDE Atome lesen, wenn das Feature alle Medientypen unterstuetzt.
 */
import { atom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';
// Zentrale Medientyp-Definitionen für Konvertierung
import { getMediaKind, mediaKindToFileCategory, type MediaKind } from '@/lib/media-types';

// Erweiterte Medientyp-Kategorien für Filter
export type FileCategory = 'all' | 'media' | 'text' | 'documents';

// Medientyp für Batch-Items
export type MediaType = 'audio' | 'video' | 'document' | 'text' | 'unknown';

// Interface für Batch-Items
export interface BatchTranscriptionItem {
  item: StorageItem;
  type: MediaType;
}

// Interface für Batch-Transformations-Items (Dateiliste: Sammel-Transkript, Bulk-Löschen)
export interface BatchTransformationItem {
  item: StorageItem;
  type: MediaType;
}

/**
 * Konvertiert MediaKind zu MediaType für Batch-Auswahl-UI
 * 
 * MediaType verwendet 'document' und 'text' statt 'pdf', 'image', 'markdown'
 * für die Kategorisierung in der Dateiliste.
 */
function mediaKindToMediaType(kind: MediaKind): MediaType {
  switch (kind) {
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'pdf':
    case 'image':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return 'document';
    case 'markdown':
      return 'text';
    default:
      return 'unknown';
  }
}

/**
 * Bestimmt den Medientyp für Batch-Auswahl-UI
 * 
 * Basiert auf der zentralen getMediaKind Funktion aus media-types.ts
 */
export const getMediaType = (item: StorageItem): MediaType => {
  const kind = getMediaKind(item);
  return mediaKindToMediaType(kind);
};

/**
 * Bestimmt die Dateikategorie für Filter-UI
 * 
 * Basiert auf der zentralen mediaKindToFileCategory Funktion aus media-types.ts
 */
export const getFileCategory = (item: StorageItem): FileCategory => {
  const category = mediaKindToFileCategory(getMediaKind(item));
  // Mapping von CentralFileCategory zu lokaler FileCategory
  // (sind identisch, aber TypeScript braucht explizites Mapping)
  return category as FileCategory;
};

// Auswahl Audio/Video in der Dateiliste (u.a. Sammel-Transkript, Bulk-Löschen; kein Transkriptions-Dialog mehr)
export const selectedBatchItemsAtom = atom<BatchTranscriptionItem[]>([]);
selectedBatchItemsAtom.debugLabel = 'selectedBatchItemsAtom';

export const selectedTransformationItemsAtom = atom<BatchTransformationItem[]>([]);
selectedTransformationItemsAtom.debugLabel = 'selectedTransformationItemsAtom';

// Atom für den aktuellen Dateityp-Filter
export const fileCategoryFilterAtom = atom<FileCategory>('all');
fileCategoryFilterAtom.debugLabel = 'fileCategoryFilterAtom'; 