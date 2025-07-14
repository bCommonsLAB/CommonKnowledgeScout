import { atom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';

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

// Hilfsfunktion zum Bestimmen des Medientyps
export const getMediaType = (item: StorageItem): MediaType => {
  const mimeType = item.metadata.mimeType.toLowerCase();
  
  // Audio-Dateien
  if (mimeType.startsWith('audio/')) return 'audio';
  
  // Video-Dateien
  if (mimeType.startsWith('video/')) return 'video';
  
  // Bilddateien
  if (mimeType.startsWith('image/')) return 'document';
  
  // Textdateien
  if (mimeType.startsWith('text/') || 
      mimeType === 'application/json' ||
      mimeType === 'application/xml') {
    return 'text';
  }
  
  // Dokumente
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      mimeType === 'application/pdf') {
    return 'document';
  }
  
  // Unbekannte Dateitypen
  return 'unknown';
};

// Hilfsfunktion zum Bestimmen der Dateikategorie
export const getFileCategory = (item: StorageItem): FileCategory => {
  const mediaType = getMediaType(item);
  
  switch (mediaType) {
    case 'audio':
    case 'video':
      return 'media';
    case 'text':
      return 'text';
    case 'document':
      return 'documents';
    default:
      return 'all';
  }
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

// Atom für den Verarbeitungsstatus
export const transformProcessingAtom = atom<boolean>(false);
transformProcessingAtom.debugLabel = 'transformProcessingAtom';

// Atom für den aktuellen Dateityp-Filter
export const fileCategoryFilterAtom = atom<FileCategory>('all');
fileCategoryFilterAtom.debugLabel = 'fileCategoryFilterAtom'; 