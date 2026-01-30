import { atom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';
// Zentrale Medientyp-Definitionen für Konvertierung
import { getMediaKind, mediaKindToFileCategory, type MediaKind } from '@/lib/media-types';

// Basis-Optionen für alle Medientypen
export interface BaseTransformOptions {
  targetLanguage: string;
  createShadowTwin: boolean;
  fileExtension: string;
  fileName?: string; // Optional für benutzerdefinierte Dateinamen
}

// Spezifische Optionen pro Medientyp
export interface AudioTransformSettings {
  sourceLanguage: string;
  template: string;
}

export interface VideoTransformSettings extends AudioTransformSettings {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
}

// Erweiterte Medientyp-Kategorien für Filter
export type FileCategory = 'all' | 'media' | 'text' | 'documents';

// Medientyp für Batch-Items
export type MediaType = 'audio' | 'video' | 'document' | 'text' | 'unknown';

// Interface für Batch-Items
export interface BatchTranscriptionItem {
  item: StorageItem;
  type: MediaType;
}

// Interface für Batch-Transformations-Items
export interface BatchTransformationItem {
  item: StorageItem;
  type: MediaType;
}

// Progress-Interface für Batch-Operationen
export interface BatchProgress {
  currentItem: number;
  totalItems: number;
  currentFileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

// Result-Interface für Batch-Operationen
export interface BatchResult {
  success: boolean;
  results: Array<{
    item: StorageItem;
    success: boolean;
    error?: string;
  }>;
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

// Atom für die Basis-Transformationsoptionen
export const baseTransformOptionsAtom = atom<BaseTransformOptions>({
  targetLanguage: 'de',
  createShadowTwin: true,
  fileExtension: 'md'
});
baseTransformOptionsAtom.debugLabel = 'baseTransformOptionsAtom';

// Atom für ausgewählte Batch-Items (Transkription)
export const selectedBatchItemsAtom = atom<BatchTranscriptionItem[]>([]);
selectedBatchItemsAtom.debugLabel = 'selectedBatchItemsAtom';

// Atom für ausgewählte Batch-Items (Transformation)
export const selectedTransformationItemsAtom = atom<BatchTransformationItem[]>([]);
selectedTransformationItemsAtom.debugLabel = 'selectedTransformationItemsAtom';

// Atom für den Dialog-Status (Transkription)
export const transcriptionDialogOpenAtom = atom<boolean>(false);
transcriptionDialogOpenAtom.debugLabel = 'transcriptionDialogOpenAtom';

// Atom für den Dialog-Status (Transformation)
export const transformationDialogOpenAtom = atom<boolean>(false);
transformationDialogOpenAtom.debugLabel = 'transformationDialogOpenAtom';

// Atom für den Dialog-Status (Ingestion)
export const ingestionDialogOpenAtom = atom<boolean>(false);
ingestionDialogOpenAtom.debugLabel = 'ingestionDialogOpenAtom';

// Atom für den Verarbeitungsstatus
export const transformProcessingAtom = atom<boolean>(false);
transformProcessingAtom.debugLabel = 'transformProcessingAtom';

// Atom für den aktuellen Dateityp-Filter
export const fileCategoryFilterAtom = atom<FileCategory>('all');
fileCategoryFilterAtom.debugLabel = 'fileCategoryFilterAtom'; 