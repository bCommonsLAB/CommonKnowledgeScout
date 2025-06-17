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
export type MediaType = 'audio' | 'video' | 'image' | 'document';

// Interface für Batch-Items
export interface BatchItem {
  item: StorageItem;
  type: MediaType;
}

// Hilfsfunktion zum Bestimmen des Medientyps
export function getMediaType(item: StorageItem): MediaType {
  if (item.type !== 'file') return 'document';
  
  const { mimeType } = item.metadata;
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

// Atom für die Basis-Transformationsoptionen
export const baseTransformOptionsAtom = atom<BaseTransformOptions>({
  targetLanguage: 'de',
  createShadowTwin: true,
  fileExtension: 'md'
});
baseTransformOptionsAtom.debugLabel = 'baseTransformOptionsAtom';

// Atom für ausgewählte Batch-Items
export const selectedBatchItemsAtom = atom<BatchItem[]>([]);
selectedBatchItemsAtom.debugLabel = 'selectedBatchItemsAtom';

// Atom für den Dialog-Status
export const transformDialogOpenAtom = atom<boolean>(false);
transformDialogOpenAtom.debugLabel = 'transformDialogOpenAtom';

// Atom für den Verarbeitungsstatus
export const transformProcessingAtom = atom<boolean>(false);
transformProcessingAtom.debugLabel = 'transformProcessingAtom'; 