import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';
import { selectedFileAtom } from '@/atoms/library-atom';

// Hilfsfunktion für die Dateityp-Erkennung
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'txt':
    case 'doc':
    case 'docx':
      return 'text';
    default:
      return 'unknown';
  }
}

// Re-export für Kompatibilität
export interface SelectedFileState {
  item: StorageItem | null;
  metadata: {
    name: string;
    size: number;
    type: string;
    modified: Date;
    created: Date;
    transcriptionEnabled?: boolean;
  } | null;
}

export interface UseSelectedFileReturn {
  // State
  selected: SelectedFileState;
  
  // Actions
  selectFile: (item: StorageItem | null) => void;
  clearSelection: () => void;
  
  // Computed
  isSelected: boolean;
  parentId: string | null;
  fileName: string | null;
}

export function useSelectedFile(): UseSelectedFileReturn {
  // Verwende nur noch das selectedFileAtom
  const [selectedItem, setSelectedItem] = useAtom(selectedFileAtom);

  // Berechne Metadaten direkt aus dem selectedItem
  const metadata = selectedItem ? {
    name: selectedItem.metadata.name,
    size: selectedItem.metadata.size,
    type: getFileType(selectedItem.metadata.name),
    modified: new Date(selectedItem.metadata.modifiedAt),
    created: new Date(selectedItem.metadata.modifiedAt),
    transcriptionEnabled: selectedItem.metadata.transcriptionTwin !== undefined
  } : null;

  // Kombiniere die States für die Rückgabe
  const selected: SelectedFileState = {
    item: selectedItem,
    metadata
  };

  // Datei auswählen
  const selectFile = useCallback((item: StorageItem | null) => {
    console.log('[useSelectedFile] selectFile aufgerufen mit:', item ? item.metadata.name : 'null');
    setSelectedItem(item);
    console.log('[useSelectedFile] Datei ausgewählt:', item ? {
      name: item.metadata.name,
      id: item.id,
      type: item.type
    } : 'keine');
  }, [setSelectedItem]);

  // Auswahl zurücksetzen
  const clearSelection = useCallback(() => {
    setSelectedItem(null);
  }, [setSelectedItem]);

  // Computed values
  const isSelected = selectedItem !== null;
  const parentId = selectedItem?.parentId || null;
  const fileName = selectedItem?.metadata.name || null;

  return {
    // State
    selected,
    
    // Actions
    selectFile,
    clearSelection,
    
    // Computed
    isSelected,
    parentId,
    fileName
  };
} 