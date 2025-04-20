import { useCallback, useState } from 'react';
import { StorageItem } from '@/lib/storage/types';

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

export interface SelectedFileState {
  // Aktuelle Datei
  item: StorageItem | null;
  
  // Pfad zur Datei
  breadcrumb: {
    items: StorageItem[];
    currentId: string;
  };
  
  // Metadaten
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

const initialState: SelectedFileState = {
  item: null,
  breadcrumb: {
    items: [],
    currentId: 'root'
  },
  metadata: null
};

export function useSelectedFile(): UseSelectedFileReturn {
  const [selected, setSelected] = useState<SelectedFileState>(initialState);

  // Datei auswählen
  const selectFile = useCallback((item: StorageItem | null) => {
    if (!item) {
      setSelected(initialState);
      return;
    }

    setSelected(prev => ({
      ...prev,
      item,
      metadata: {
        name: item.metadata.name,
        size: item.metadata.size,
        type: getFileType(item.metadata.name),
        modified: new Date(item.metadata.modifiedAt),
        created: new Date(item.metadata.modifiedAt),
        transcriptionEnabled: item.metadata.transcriptionTwin !== undefined
      }
    }));
  }, []);

  // Breadcrumb aktualisieren
  const updateBreadcrumb = useCallback((items: StorageItem[], currentId: string) => {
    console.log('useSelectedFile: updateBreadcrumb', { 
      itemsCount: items.length, 
      items: items.map(item => item.metadata.name).join('/'),
      currentId,
      action: 'START'
    });
    
    // Nicht aktualisieren, wenn leere Items übergeben werden und wir uns nicht im Root-Verzeichnis befinden
    // Dies verhindert, dass der Breadcrumb unbeabsichtigt zurückgesetzt wird
    if (items.length === 0 && currentId !== 'root' && selected.breadcrumb.items.length > 0) {
      console.warn('useSelectedFile: Versuch, Breadcrumb mit leeren Items zu setzen wurde verhindert', {
        currentId,
        existingItems: selected.breadcrumb.items.length
      });
      return;
    }
    
    setSelected(prev => {
      // Wenn der Breadcrumb identisch ist, keine Aktualisierung durchführen
      if (prev.breadcrumb.currentId === currentId && 
          prev.breadcrumb.items.length === items.length && 
          JSON.stringify(prev.breadcrumb.items.map(i => i.id)) === JSON.stringify(items.map(i => i.id))) {
        console.log('useSelectedFile: Breadcrumb unverändert, keine Aktualisierung');
        return prev;
      }
      
      console.log('useSelectedFile: Breadcrumb aktualisiert', {
        prevItems: prev.breadcrumb.items.length,
        newItems: items.length,
        prevId: prev.breadcrumb.currentId,
        newId: currentId
      });
      
      return {
        ...prev,
        breadcrumb: {
          items,
          currentId
        }
      };
    });
  }, [selected.breadcrumb.items]);

  // Auswahl zurücksetzen
  const clearSelection = useCallback(() => {
    setSelected(initialState);
  }, []);

  // Computed values
  const isSelected = selected.item !== null;
  const parentId = selected.item?.parentId || null;
  const fileName = selected.item?.metadata.name || null;

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