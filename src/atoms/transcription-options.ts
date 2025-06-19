import { atom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';

// Basis-Optionen für alle Medientypen
export interface BaseTransformOptions {
  targetLanguage: string;
  createShadowTwin: boolean;
  fileExtension: string;
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

// Medientyp für Batch-Items
export type MediaType = 'audio' | 'video' | 'document' | 'unknown';

// Interface für Batch-Items
export interface BatchTranscriptionItem {
  item: StorageItem;
  type: MediaType;
}

// Hilfsfunktion zum Bestimmen des Medientyps
export const getMediaType = (item: StorageItem): MediaType => {
  const mimeType = item.metadata.mimeType.toLowerCase();
  
  // Audio-Dateien
  if (mimeType.startsWith('audio/')) return 'audio';
  
  // Video-Dateien
  if (mimeType.startsWith('video/')) return 'video';
  
  // Dokumente
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown') {
    return 'document';
  }
  
  // Unbekannte Dateitypen
  return 'unknown';
};

// Atom für die Basis-Transformationsoptionen
export const baseTransformOptionsAtom = atom<BaseTransformOptions>({
  targetLanguage: 'de',
  createShadowTwin: true,
  fileExtension: 'md'
});
baseTransformOptionsAtom.debugLabel = 'baseTransformOptionsAtom';

// Atom für ausgewählte Batch-Items
export const selectedBatchItemsAtom = atom<BatchTranscriptionItem[]>([]);
selectedBatchItemsAtom.debugLabel = 'selectedBatchItemsAtom';

// Atom für den Dialog-Status
export const transcriptionDialogOpenAtom = atom<boolean>(false);
transcriptionDialogOpenAtom.debugLabel = 'transcriptionDialogOpenAtom';

// Atom für den Verarbeitungsstatus
export const transformProcessingAtom = atom<boolean>(false);
transformProcessingAtom.debugLabel = 'transformProcessingAtom'; 