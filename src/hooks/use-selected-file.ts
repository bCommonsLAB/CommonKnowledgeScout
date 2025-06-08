import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { StorageItem } from '@/lib/storage/types';
import { 
  selectedFileAtom, 
  selectedFileBreadcrumbAtom, 
  selectedFileMetadataAtom 
} from '@/atoms/library-atom';

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
  breadcrumb: {
    items: StorageItem[];
    currentId: string;
  };
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
  updateBreadcrumb: (items: StorageItem[], currentId: string) => void;
  clearSelection: () => void;
  
  // Computed
  isSelected: boolean;
  parentId: string | null;
  fileName: string | null;
}

export function useSelectedFile(): UseSelectedFileReturn {
  // Verwende die globalen Atoms aus library-atom.ts
  const [selectedItem, setSelectedItem] = useAtom(selectedFileAtom);
  const [breadcrumb, setBreadcrumb] = useAtom(selectedFileBreadcrumbAtom);
  const [metadata, setMetadata] = useAtom(selectedFileMetadataAtom);

  // Kombiniere die States für die Rückgabe
  const selected: SelectedFileState = {
    item: selectedItem,
    breadcrumb,
    metadata
  };

  // Datei auswählen
  const selectFile = useCallback((item: StorageItem | null) => {
    console.log('[useSelectedFile] selectFile aufgerufen mit:', item ? item.metadata.name : 'null');
    
    if (!item) {
      setSelectedItem(null);
      setMetadata(null);
      return;
    }

    setSelectedItem(item);
    setMetadata({
      name: item.metadata.name,
      size: item.metadata.size,
      type: getFileType(item.metadata.name),
      modified: new Date(item.metadata.modifiedAt),
      created: new Date(item.metadata.modifiedAt),
      transcriptionEnabled: item.metadata.transcriptionTwin !== undefined
    });
    
    console.log('[useSelectedFile] Datei ausgewählt:', {
      name: item.metadata.name,
      id: item.id,
      type: item.type
    });
  }, [setSelectedItem, setMetadata]);

  // Breadcrumb aktualisieren
  const updateBreadcrumb = useCallback((items: StorageItem[], currentId: string) => {
    console.log('useSelectedFile: updateBreadcrumb', { 
      itemsCount: items.length, 
      items: items.map(item => item.metadata.name).join('/'),
      currentId,
      action: 'START'
    });
    
    // Nicht aktualisieren, wenn leere Items übergeben werden und wir uns nicht im Root-Verzeichnis befinden
    if (items.length === 0 && currentId !== 'root' && breadcrumb.items.length > 0) {
      console.warn('useSelectedFile: Versuch, Breadcrumb mit leeren Items zu setzen wurde verhindert', {
        currentId,
        existingItems: breadcrumb.items.length
      });
      return;
    }
    
    // Wenn der Breadcrumb identisch ist, keine Aktualisierung durchführen
    if (breadcrumb.currentId === currentId && 
        breadcrumb.items.length === items.length && 
        JSON.stringify(breadcrumb.items.map(i => i.id)) === JSON.stringify(items.map(i => i.id))) {
      console.log('useSelectedFile: Breadcrumb unverändert, keine Aktualisierung');
      return;
    }
    
    console.log('useSelectedFile: Breadcrumb aktualisiert', {
      prevItems: breadcrumb.items.length,
      newItems: items.length,
      prevId: breadcrumb.currentId,
      newId: currentId
    });
    
    setBreadcrumb({
      items,
      currentId
    });
  }, [breadcrumb, setBreadcrumb]);

  // Auswahl zurücksetzen
  const clearSelection = useCallback(() => {
    setSelectedItem(null);
    setMetadata(null);
    setBreadcrumb({
      items: [],
      currentId: 'root'
    });
  }, [setSelectedItem, setMetadata, setBreadcrumb]);

  // Computed values
  const isSelected = selectedItem !== null;
  const parentId = selectedItem?.parentId || null;
  const fileName = selectedItem?.metadata.name || null;

  return {
    // State
    selected,
    
    // Actions
    selectFile,
    updateBreadcrumb,
    clearSelection,
    
    // Computed
    isSelected,
    parentId,
    fileName
  };
} 