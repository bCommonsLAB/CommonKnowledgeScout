# Analyse der Filelist-Ladung bei Library-Wechsel
_Exported on 8/30/2025 at 11:41:45 GMT+2 from Cursor (1.5.5)_

---

**User**

Wir müssen nochmal die Initialisierung der Library analysieren, wenn wir oben eine Library wechseln. Im Desktop-Modus werden Tree geladen, Fileliste aber nicht. Das heißt, wenn ich die Library wechsle, bleibt die Filelist immer leer. Welche Bedingungen gibt es hier, die die Filelist-Ladung verhindern?

---

**Cursor**

Ich suche jetzt gezielt nach der Lade-Logik für die Filelist und nach Bedingungen beim Library-Wechsel, um zu verstehen, warum im Desktop-Modus nur der Tree lädt. Anschließend prüfe ich Stellen, wo "desktop" oder "library switch" den Zustand beeinflusst.

Ich prüfe jetzt gezielt, wo `currentFolderIdAtom` beim Bibliothekswechsel zurückgesetzt wird und ob Bedingungen wie `lastLoadedFolder !== currentFolderId` oder `libraryStatus !== 'ready'` das Laden blockieren. Danach liste ich alle Guards auf, die den Ladevorgang verhindern.

Ich lese jetzt die relevanten Dateien, um die genauen Guards in `Library.loadItems` und die Provider-Initialisierung zu verifizieren. Danach liste ich die konkreten Bedingungen auf.

Ich habe die relevanten Stellen für die Lade-Guards von FileList und die Abhängigkeiten beim Bibliothekswechsel geprüft. Unten sind alle Bedingungen, die das Laden der FileList verhindern können, mit Codeverweisen.

### Bedingungen, die das Laden der FileList verhindern
- • Anbieter/Status nicht bereit
  - **Blocker**: `!providerInstance` oder `libraryStatus !== 'ready'` → kein Load.
```216:246:src/components/library/library.tsx
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';

if (!isReady) {
  NavigationLogger.debug('Library', 'Waiting for initialization', {
    isFileTreeReady,
    isMobile,
    isTreeVisible,
    hasProvider: !!providerInstance,
    status: libraryStatus
  });
  return;
}

// Nur laden wenn noch nicht geladen
if (lastLoadedFolder !== currentFolderId) {
  UILogger.info('Library', 'Initial load triggered', {
    currentFolderId,
    lastLoadedFolder,
    isMobile,
    isTreeVisible,
    isFileTreeReady,
    tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
  });
  NavigationLogger.info('Library', 'Loading initial items', {
    folderId: currentFolderId
  });
  loadItems();
}
```

- • Desktop-Abhängigkeit vom Tree-Ready
  - **Blocker**: Auf Desktop, wenn der Tree sichtbar ist und `fileTreeReady` noch `false` ist, wird nicht geladen (Mobile unabhängig).
```216:223:src/components/library/library.tsx
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';
```
  - Der Tree setzt bei Bibliothekswechsel `fileTreeReady` bewusst zurück:
```141:147:src/components/library/file-tree.tsx
if (activeLibraryId) {
  setExpandedFolders(new Set(['root']));
  setLoadedChildren({});
  setFileTreeReady(false);
  setSelectedFile(null);
}
```
  - Zusätzlich hat die FileList selbst noch eine Guard (unabhängig vom zentralen Load):
```701:709:src/components/library/file-list.tsx
if (!provider || (!isFileTreeReady && !isMobile)) {
  FileLogger.info('FileList', 'Waiting for provider and FileTree', {
    hasProvider: !!provider,
    isFileTreeReady,
    isMobile
  });
  return;
}
```

- • Doppel-Load-Schutz durch lastLoadedFolder
  - **Blocker**: `lastLoadedFolder === currentFolderId` → der Initial-Load-Effect triggert nicht erneut.
  - Hinweis: Cache-Reset bei „Library-Wechsel“ hängt an `libraryStatus`. Falls dieser nicht wechselt, bleibt `lastLoadedFolder` evtl. identisch:
```248:255:src/components/library/library.tsx
useEffect(() => {
  setLastLoadedFolder(null);
  setLibraryState(state => ({
    ...state,
    folderCache: {}
  }));
}, [libraryStatus, setLibraryState, setLastLoadedFolder]);
```

- • Auth erforderlich (Cloud-Provider)
  - **Blocker**: AUTH_REQUIRED vom Provider → FileList bleibt leer, bis authentifiziert.
```466:477:src/contexts/storage-context.tsx
if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
  setIsAuthRequired(true);
  setAuthProvider(provider.name);
  setLibraryStatus('waitingForAuth');
  throw new StorageError(
    "Nicht authentifiziert. Bitte authentifizieren Sie sich bei " + provider.name + ".",
    "AUTH_REQUIRED",
    provider.id
  );
}
```
  - In `Library.loadItems` wird der Fehler ohne Toast behandelt und die Liste geleert:
```156:199:src/components/library/library.tsx
} catch (error) {
  if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
    StateLogger.info('Library', 'Auth required');
    // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
  } else {
    // ... Fehlerbehandlung mit Toasts ...
  }
  setFolderItems([]);
} finally {
  setLoadingState({ isLoading: false, loadingFolderId: null });
}
```

- • Provider-Library-ID-Mismatch/Providerwechsel in-flight
  - **Symptom**: Wenn Provider-ID ≠ aktuelle Library-ID, wird versucht, den korrekten Provider zu laden; schlägt das fehl, bleiben Items leer.
```433:449:src/contexts/storage-context.tsx
if (provider.id !== currentLibrary.id) {
  // ... correctProvider laden ...
  return await correctProvider.listItemsById(folderId);
}
```

- • FileList-Init beendet, lädt aber nicht selbst
  - Die FileList initialisiert sich, lädt aber nicht eigenständig Items (das passiert zentral in `Library.loadItems`). Wenn eine der obigen Guards greift, bleibt die List leer, auch wenn FileList „initialized“ loggt.
```721:727:src/components/library/file-list.tsx
FileLogger.info('FileList', 'Starting initialization');
// ...
FileLogger.info('FileList', 'Initialization complete');
setIsInitialized(true);
```

Kurze Einordnung:
- Auf Desktop blockiert oft die Tree-Abhängigkeit (Tree sichtbar + `fileTreeReady === false`), bis der Tree seine Root geladen hat. Danach greift der Doppel-Load-Schutz: Wenn `lastLoadedFolder` nicht auf `null` zurückgesetzt wurde, triggert der Initial-Load nicht.
- Bei Cloud-Libraries sorgt AUTH_REQUIRED dafür, dass die List leer bleibt, bis die Auth erfolgt.
- Ein Race um Provider-Wechsel (ID-Mismatch) kann den Load verzögern oder fehlschlagen.

Vorschlag zur Eingrenzung:
- In der Konsole nach „Waiting for initialization“, „Initial load triggered“, „Skipping loadItems - not ready“ und „Auth required“ Ausschau halten.
- Prüfen, ob `lastLoadedFolder` nach Wechsel tatsächlich `null` ist und `fileTreeReady` nach Tree-Root-Load auf `true` geht.

- Wichtigste Guards zusammengefasst:
  - providerInstance fehlt oder libraryStatus ≠ 'ready'
  - Desktop: Tree sichtbar UND fileTreeReady = false
  - lastLoadedFolder === currentFolderId
  - AUTH_REQUIRED
  - Provider-ID ≠ aktuelle Library-ID (Fehler beim Korrektur-Provider)

Ich habe die Lade-Guards identifiziert und die relevanten Codezeilen verlinkt; als Nächstes könnten wir die Logs im Desktop-Modus prüfen, um zu sehen, welcher Guard konkret greift.

- Identifizierte Blocker: Ready-Status/Provider, Tree-Ready (Desktop), Doppel-Load-Schutz, Auth erforderlich, Provider-Mismatch.
- Relevante Stellen: `src/components/library/library.tsx` (Initial-Load), `src/components/library/file-list.tsx` (Init-Guard), `src/components/library/file-tree.tsx` (Reset bei Wechsel), `src/contexts/storage-context.tsx` (AUTH/Mismatch).

```typescriptreact
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';

if (!isReady) {
  NavigationLogger.debug('Library', 'Waiting for initialization', {
    isFileTreeReady,
    isMobile,
    isTreeVisible,
    hasProvider: !!providerInstance,
    status: libraryStatus
  });
  return;
}

// Nur laden wenn noch nicht geladen
if (lastLoadedFolder !== currentFolderId) {
  UILogger.info('Library', 'Initial load triggered', {
    currentFolderId,
    lastLoadedFolder,
    isMobile,
    isTreeVisible,
    isFileTreeReady,
    tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
  });
  NavigationLogger.info('Library', 'Loading initial items', {
    folderId: currentFolderId
  });
  loadItems();
}
```

```typescriptreact
const treeReady = isFileTreeReady || isMobile || !isTreeVisible;
const isReady = treeReady && providerInstance && libraryStatus === 'ready';
```

```typescriptreact
if (activeLibraryId) {
  setExpandedFolders(new Set(['root']));
  setLoadedChildren({});
  setFileTreeReady(false);
  setSelectedFile(null);
}
```

```typescriptreact
if (!provider || (!isFileTreeReady && !isMobile)) {
  FileLogger.info('FileList', 'Waiting for provider and FileTree', {
    hasProvider: !!provider,
    isFileTreeReady,
    isMobile
  });
  return;
}
```

```typescriptreact
useEffect(() => {
  setLastLoadedFolder(null);
  setLibraryState(state => ({
    ...state,
    folderCache: {}
  }));
}, [libraryStatus, setLibraryState, setLastLoadedFolder]);
```

```typescriptreact
if ('isAuthenticated' in provider && typeof provider.isAuthenticated === 'function' && !provider.isAuthenticated()) {
  setIsAuthRequired(true);
  setAuthProvider(provider.name);
  setLibraryStatus('waitingForAuth');
  throw new StorageError(
    "Nicht authentifiziert. Bitte authentifizieren Sie sich bei " + provider.name + ".",
    "AUTH_REQUIRED",
    provider.id
  );
}
```

```typescriptreact
} catch (error) {
  if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
    StateLogger.info('Library', 'Auth required');
    // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
  } else {
    // ... Fehlerbehandlung mit Toasts ...
  }
  setFolderItems([]);
} finally {
  setLoadingState({ isLoading: false, loadingFolderId: null });
}
```

```typescriptreact
if (provider.id !== currentLibrary.id) {
  // ... correctProvider laden ...
  return await correctProvider.listItemsById(folderId);
}
```

```typescriptreact
FileLogger.info('FileList', 'Starting initialization');
// ...
FileLogger.info('FileList', 'Initialization complete');
setIsInitialized(true);
```

---

**User**

Wo werden diese logs gespeichert?
@debug/ @debug/ verwenden wir unseren frontend sichtbaren logger?

---

**Cursor**

Ich prüfe kurz, wo der Log-Store liegt und ob die Logs persistent gespeichert oder nur im Frontend-Atom gehalten werden.

Ich habe die Debug-Komponenten und den Logger gelesen. Kurz: Die Logs sind rein clientseitig im Speicher und werden ins Debug-Panel gestreamt.

### Antwort
- **Speicherort der Logs**: Nur im Frontend-In-Memory via Jotai.
  - `debugStateAtom.logs` hält die letzten Einträge (Standard: max 1000, FIFO-Trim).
```21:26:src/atoms/debug-atom.ts
const initialDebugState: DebugState = {
  logs: [],
  visibleComponents: new Set(['FileTree', 'Breadcrumb', 'FileList']),
  visibleAreas: new Set<'nav' | 'state' | 'file' | 'ui'>(['nav', 'state', 'file']),
  maxLogs: 1000,
};
```
```30:43:src/atoms/debug-atom.ts
export const addLogAtom = atom(
  null,
  (get, set, newLog: Omit<LogEntry, 'id'>) => {
    const debugState = get(debugStateAtom);
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set(debugStateAtom, {
      ...debugState,
      logs: [
        { ...newLog, id },
        ...debugState.logs.slice(0, debugState.maxLogs - 1)
      ]
    });
  }
);
```
- **Konsole**: Zusätzlich Konsolen-Ausgabe nur im Development.
```46:60:src/lib/debug/logger.ts
private static logToConsole(entry: Omit<LogEntry, 'id'>) {
  if (process.env.NODE_ENV === 'development') {
    const icon = entry.level === 'error' ? '🔴' : 
                entry.level === 'warn' ? '⚠️' : 
                entry.level === 'info' ? 'ℹ️' : '🔍';
    const timeOnly = entry.timestamp.split('T')[1];
    console[entry.level](
      `[${timeOnly}][${entry.area.toUpperCase()}:${entry.sequence}][${entry.component}][${entry.level}] ${icon} ${entry.message}`,
      entry.details || ''
    );
  }
}
```
- **Frontend-sichtbarer Logger?** Ja.
  - Alle Logger (`NavigationLogger`, `StateLogger`, `FileLogger`, `UILogger`, `AuthLogger`) rufen intern `subscribeToLogs` auf; `DebugFooter` subscribed und schreibt in `addLogAtom`.
```48:57:src/components/debug/debug-footer.tsx
React.useEffect(() => {
  const unsubscribe = subscribeToLogs((entry) => {
    React.startTransition(() => {
      setAddLog(entry);
    });
  });
  return unsubscribe;
}, [setAddLog]);
```
- **@debug/**: Es gibt kein Alias `@debug`. Wir importieren über `@/lib/debug/logger` (Alias `@` → `src`). Kurz: Wir verwenden unseren frontend-sichtbaren Logger-Stream, keine Persistenz (kein localStorage/Backend). Kopieren geht über „Copy Logs“ im Debug-Panel.

```typescript
const initialDebugState: DebugState = {
  logs: [],
  visibleComponents: new Set(['FileTree', 'Breadcrumb', 'FileList']),
  visibleAreas: new Set<'nav' | 'state' | 'file' | 'ui'>(['nav', 'state', 'file']),
  maxLogs: 1000,
};
```

```typescript
export const addLogAtom = atom(
  null,
  (get, set, newLog: Omit<LogEntry, 'id'>) => {
    const debugState = get(debugStateAtom);
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set(debugStateAtom, {
      ...debugState,
      logs: [
        { ...newLog, id },
        ...debugState.logs.slice(0, debugState.maxLogs - 1)
      ]
    });
  }
);
```

```typescript
private static logToConsole(entry: Omit<LogEntry, 'id'>) {
  if (process.env.NODE_ENV === 'development') {
    const icon = entry.level === 'error' ? '🔴' : 
                entry.level === 'warn' ? '⚠️' : 
                entry.level === 'info' ? 'ℹ️' : '🔍';
    const timeOnly = entry.timestamp.split('T')[1];
    console[entry.level](
      `[${timeOnly}][${entry.area.toUpperCase()}:${entry.sequence}][${entry.component}][${entry.level}] ${icon} ${entry.message}`,
      entry.details || ''
    );
  }
}
```

```typescriptreact
React.useEffect(() => {
  const unsubscribe = subscribeToLogs((entry) => {
    React.startTransition(() => {
      setAddLog(entry);
    });
  });
  return unsubscribe;
}, [setAddLog]);
```

---

**User**

Die FileTree initialisiert ja scheinbar korrekt. Können wir die FileList unabhängig machen vom FileTree? Das einzige Kriterium, ob eine FileListe geladen wird oder nicht, ist dieses State CurrentFolderId. Wenn sich dieser State ändert, sollte die FileListe geladen werden. Ganz unabhängig von anderen Abhängigkeiten. Wenn, dann würden wir den FileState erst updaten, wenn alle Bedienungen erfüllt sind. Und FileTree und FileList sollten ganz unabhängig voneinander rendern.

---

**Cursor**

Ich passe die Lade-Guards an: FileList soll nicht vom FileTree abhängen und Library lädt nur basierend auf Provider/Status und currentFolderId. Ich editiere `src/components/library/library.tsx` und `src/components/library/file-list.tsx`.

Ich werde die Lade-Guards anpassen, sodass die FileList nicht mehr von `fileTreeReady` oder `isTreeVisible` abhängt, und die Initial-Load-Logik in `Library` nur auf `providerInstance`, `libraryStatus === 'ready'` und `currentFolderId` reagiert. Danach prüfe ich die Linter-Warnungen der geänderten Dateien.

Ich starte mit der Entkopplung: 1) Entferne in `FileList` alle Abhängigkeiten von `fileTreeReady` (Guards und Render-Gate), 2) passe in `Library` den Initial-Load an, sodass er nur von `providerInstance`, `libraryStatus === 'ready'` und `currentFolderId` abhängt. Danach prüfe ich Linter-Fehler und führe Tests aus.

Ich beginne mit dem Entfernen der FileTree-Abhängigkeiten in `FileList` und passe dann `Library` an. Danach prüfe ich Linter-Fehler.

```typescriptreact
'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom, 
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
}

// Memoized file icon component
const FileIconComponent = React.memo(function FileIconComponent({ item }: { item: StorageItem }) {
  const mimeType = item.metadata.mimeType || '';
  if (!mimeType) return <File className="h-4 w-4" />;

  if (mimeType.startsWith('video/')) {
    return <FileVideo className="h-4 w-4" />;
  } else if (mimeType.startsWith('audio/')) {
    return <FileAudio className="h-4 w-4" />;
  } else if (mimeType.startsWith('text/')) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
});

// Pure function for file size formatting
const formatFileSize = (size?: number): string => {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

// Funktion zum Formatieren des Datums
const formatDate = (date?: Date): string => {
  if (!date) return '-';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: '2-digit', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Date(date).toLocaleDateString('de-DE', options);
};

// Entfernt: getFileStem Funktion war unbenutzt

// Sortierbare Kopfzelle Komponente
const SortableHeaderCell = React.memo(function SortableHeaderCell({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort
}: {
  label: string,
  field: SortField,
  currentSortField: SortField,
  currentSortOrder: SortOrder,
  onSort: (field: SortField) => void
}) {
  const isActive = currentSortField === field;
  
  return (
    <button 
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      {isActive && (
        currentSortOrder === 'asc' 
          ? <ChevronUp className="h-3 w-3" /> 
          : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  );
});

interface FileRowProps {
  item: StorageItem;
  isSelected: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  systemFolderId?: string;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false,
  systemFolderId
}: FileRowProps) {
  const navigateToFolder = useFolderNavigation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.metadata.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = React.useRef<number>(0);
  
  // Zusätzliche Validierung der Metadaten
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript || (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0),
    modifiedAt: item.metadata?.modifiedAt
  }), [item.metadata, fileGroup]);

  const isTranscribable = React.useMemo(() => {
    const mimeType = metadata.mimeType.toLowerCase();
    const extension = metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  }, [metadata.mimeType, metadata.name]);

  // Memoize the click handler
  const handleClick = React.useCallback(() => {
    if (!isEditing) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Memoize the keydown handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Handler für Transkript-Icon Click
  const handleTranscriptClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transcriptFiles && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcriptFiles[0]); // Nur das erste Transkript anzeigen
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Handler für Transformierte-Datei-Icon Click
  const handleTransformedClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transformed && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transformed);
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Starte Rename-Modus
  const startRename = React.useCallback(() => {
    if (onRename) {
      // Prüfe ob dies eine abhängige Datei ist
      if (fileGroup && (
        (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles[0]?.id === item.id) ||
        (fileGroup.transformed && item.id === fileGroup.transformed.id)
      )) {
        // Dies ist eine abhängige Datei - zeige Hinweis
        toast.info("Hinweis", {
          description: "Bitte benennen Sie die Haupt-Datei um. Abhängige Dateien werden automatisch mit umbenannt."
        });
        return;
      }
      
      setIsEditing(true);
      setEditName(item.metadata.name);
    }
  }, [onRename, item, fileGroup]);

  // Handler für Dateinamen-Click (Doppelklick-Erkennung)
  const handleNameClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 300) {
      // Doppelklick erkannt
      startRename();
    } else {
      // Erster Klick - wähle die Datei aus
      onSelect();
    }
    
    lastClickTimeRef.current = currentTime;
  }, [startRename, onSelect]);

  // Handler für Long-Press (Touch-Geräte)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Starte Long-Press Timer
    longPressTimerRef.current = setTimeout(() => {
      startRename();
    }, 500); // 500ms für Long-Press
  }, [startRename]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Lösche Long-Press Timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = React.useCallback(() => {
    // Bei Bewegung Long-Press abbrechen
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup Timer bei Unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Handler für Rename-Submit
  const handleRenameSubmit = React.useCallback(async () => {
    if (onRename && editName.trim() && editName !== item.metadata.name) {
      try {
        await onRename(item, editName.trim());
      } catch (error) {
        FileLogger.error('FileRow', 'Fehler beim Umbenennen', error);
        // Bei Fehler den ursprünglichen Namen wiederherstellen
        setEditName(item.metadata.name);
      }
    }
    setIsEditing(false);
  }, [onRename, editName, item]);

  // Handler für Rename-Cancel
  const handleRenameCancel = React.useCallback(() => {
    setEditName(item.metadata.name);
    setIsEditing(false);
  }, [item.metadata.name]);

  // Handler für Input-Änderungen
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  // Handler für Input-Keydown
  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Focus Input wenn Edit-Modus aktiviert wird
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handler für Drag Start
  const handleDragStart = React.useCallback((e: React.DragEvent) => {
    // Sammle alle Dateien der Gruppe, die verschoben werden sollen
    const itemsToMove = [];
    
    // Füge das aktuelle Item hinzu
    itemsToMove.push({
      itemId: item.id,
      itemName: item.metadata.name,
      itemType: item.type,
      parentId: item.parentId
    });
    
    // Wenn es eine FileGroup gibt, füge auch die zugehörigen Dateien hinzu
    if (fileGroup) {
      // Prüfe ob das aktuelle Item die Basis-Datei ist
      if (item.id === fileGroup.baseItem?.id) {
        // Füge Transkripte hinzu, falls vorhanden
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0) {
          fileGroup.transcriptFiles.forEach(transcript => {
            itemsToMove.push({
              itemId: transcript.id,
              itemName: transcript.metadata.name,
              itemType: transcript.type,
              parentId: transcript.parentId
            });
          });
        }
        
        // Füge transformierte Datei hinzu, falls vorhanden
        if (fileGroup.transformed) {
          itemsToMove.push({
            itemId: fileGroup.transformed.id,
            itemName: fileGroup.transformed.metadata.name,
            itemType: fileGroup.transformed.type,
            parentId: fileGroup.transformed.parentId
          });
        }
      }
    }
    
    // Setze die Drag-Daten
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      items: itemsToMove,
      isFileGroup: itemsToMove.length > 1
    }));
    
    // Visuelles Feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [item, fileGroup]);

  // Handler für Drag End
  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    // Stelle Opacity wieder her
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  
  // Prüfe ob das Item in einem der beiden Atome ausgewählt ist
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);
  const isInTransformation = selectedTransformationItems.some(transformationItem => transformationItem.item.id === item.id);
  const isInAnyBatch = isInBatch || isInTransformation;

  // Handler für Checkbox-Änderungen
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    const mediaType = getMediaType(item);
    
    if (mediaType === 'audio' || mediaType === 'video') {
      // Für Audio/Video: Transcription-Atom verwenden
      if (checked) {
        setSelectedBatchItems([...selectedBatchItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
      }
    } else if (mediaType === 'text' || mediaType === 'document') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  React.useEffect(() => {
    if (fileGroup) {
      FileLogger.debug('FileRow', 'Transkripte für Zeile', {
        baseItem: fileGroup.baseItem?.metadata.name,
        transcripts: fileGroup.transcriptFiles?.map(t => t.metadata.name)
      });
    }
  }, [fileGroup]);

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm hover:bg-muted/50 flex items-center gap-2 cursor-pointer",
          isSelected && "bg-muted"
        )}
      >
        <FileIconComponent item={item} />
        <span className="truncate flex-1" title={metadata.name}>
          {metadata.name}
        </span>
        {/* Shadow-Twin-Symbole im compact mode */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleTranscriptClick}
          >
            <ScrollText className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Standard-Modus: vollständige Tabellen-Darstellung
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-move",
        isSelected && "bg-muted"
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInAnyBatch}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <FileIconComponent item={item} />
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 py-0 text-xs"
        />
      ) : (
        <span 
          className="text-left truncate cursor-pointer hover:text-primary select-none"
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title="Doppelklick zum Umbenennen"
        >
          {metadata.name}
        </span>
      )}
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatDate(metadata.modifiedAt)}
      </span>
      <div className="flex items-center justify-start gap-1">
        {/* System-Unterordner (z. B. extrahierte Seiten) */}
        {systemFolderId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(systemFolderId);
                  }}
                >
                  <Layers className="h-4 w-4 text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Seiten-Ordner öffnen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Zeige Icons für alle vorhandenen Transkripte */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles.map((transcript) => (
          <TooltipProvider key={transcript.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelatedFile) onSelectRelatedFile(transcript);
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen: {transcript.metadata.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Plus-Symbol nur anzeigen, wenn kein Transkript vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && isTranscribable && !metadata.hasTranscript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  role="button"
                  tabIndex={0}
                  className="h-6 w-6 p-0 inline-flex items-center justify-center hover:bg-muted rounded-sm"
                  onClick={onCreateTranscript}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onCreateTranscript(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript erstellen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {/* Icon für transformierte Datei */}
        {fileGroup?.transformed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTransformedClick}
                >
                  <ScrollText className="h-4 w-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transformierte Datei anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Delete direkt neben Dokument-Icons */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => onDelete(e as React.MouseEvent<HTMLButtonElement>, item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Datei löschen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div />
    </div>
  );
});

interface FileListProps {
  compact?: boolean;
}

export const FileList = React.memo(function FileList({ compact = false }: FileListProps): JSX.Element {
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Entkoppelt: Kein Warten mehr auf FileTree-Status
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();

  // Mobile-Flag lokal bestimmen, damit FileList unabhängig vom Tree laden kann
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  };

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
  // Review-Mode-Atoms
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung - nur auf Provider und Mobile-Flag achten
  React.useEffect(() => {
    if (!provider) {
      FileLogger.info('FileList', 'Waiting for provider');
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized');
        return;
      }

      FileLogger.info('FileList', 'Starting initialization');

      try {
        FileLogger.info('FileList', 'Initialization complete');
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, [provider, isInitialized]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: activeLibraryId,
      activeLibraryIdAtom: activeLibraryId
    });

    // Nur bei tatsächlichem Bibliothekswechsel zurücksetzen
    if (prevLibraryIdRef.current !== null && prevLibraryIdRef.current !== activeLibraryId) {
      setIsInitialized(false);
      setSelectedFile(null);
      setFolderItems([]);
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
      setSelectedShadowTwin(null);
      StateLogger.info('FileList', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
    prevLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setSelectedFile, setFolderItems, setSelectedBatchItems, setSelectedTransformationItems, setSelectedShadowTwin]);

  // Vereinfachte Funktion zum Extrahieren des Basisnamens (ohne Endung, auch für Binärdateien)
  function getBaseName(name: string): string {
    // ShadowTwin: .de.md, .en.md, etc.
    const shadowTwinMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
    if (shadowTwinMatch) return shadowTwinMatch[1];
    // Sonst: alles vor der letzten Endung
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  function isShadowTwin(name: string): boolean {
    // Pattern: name.de.md, name.en.md, etc.
    const shadowTwinPattern = /^(.+)\.(de|en|fr|es|it)\.md$/;
    return shadowTwinPattern.test(name);
  }

  // Gruppiere die Dateien nach Basename
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    for (const item of items) {
      if (item.type !== 'file') continue;
      const base = getBaseName(item.metadata.name);
      if (!groupsMap.has(base)) groupsMap.set(base, []);
      groupsMap.get(base)!.push(item);
    }

    // Schritt 2: Erstelle FileGroups
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      if (mainFile) {
        fileGroupsMap.set(base, {
          baseItem: mainFile,
          transcriptFiles: shadowTwins.length > 0 ? shadowTwins : undefined,
          transformed: undefined
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${base}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    // Debug-Logging für Gruppierung
    FileLogger.debug('FileList', 'Gruppierung Ergebnis (Basename, alle Endungen)', {
      groups: Array.from(fileGroupsMap.entries()).map(([base, group]) => ({
        base,
        baseItem: group.baseItem?.metadata.name,
        transcripts: group.transcriptFiles?.map(t => t.metadata.name)
      }))
    });
    return fileGroupsMap;
  }, [items]);

  // Mapping: Basename -> dot-Systemordner (z. B. ".<basename>")
  const systemFolderByBase = useMemo(() => {
    const map = new Map<string, StorageItem>();
    const items = allItemsInFolder ?? [];
    for (const it of items) {
      if (it.type !== 'folder') continue;
      const name = it.metadata.name;
      if (!name.startsWith('.')) continue;
      const base = name.slice(1);
      if (base) map.set(base, it);
    }
    return map;
  }, [allItemsInFolder]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroups || !fileGroups.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroups ?? new Map()).values())
      .map(group => group.baseItem)
      .filter((item): item is StorageItem => item !== undefined);
    // Je nach Filter unterschiedliche Dateien zählen
    let selectableItems: StorageItem[] = [];
    switch (currentCategoryFilter) {
      case 'media':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedBatchItems.length === selectableItems.length;
      case 'text':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'text';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      case 'documents':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'document';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      default:
        // Bei 'all' prüfen ob alle verfügbaren Dateien ausgewählt sind
        const mediaItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        const textItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'text' || mediaType === 'document');
          } catch {
            return false;
          }
        });
        const allMediaSelected = mediaItems.length === 0 || selectedBatchItems.length === mediaItems.length;
        const allTextSelected = textItems.length === 0 || selectedTransformationItems.length === textItems.length;
        return allMediaSelected && allTextSelected;
    }
  }, [fileGroups, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    FileLogger.debug('FileList', 'handleSelect aufgerufen', {
      itemId: item.id,
      itemName: item.metadata.name,
      groupBase: group?.baseItem?.metadata.name,
      transcriptCount: group?.transcriptFiles?.length ?? 0,
      hasTranscripts: !!(group && group.transcriptFiles && group.transcriptFiles.length > 0)
    });
    
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // Wenn wir im Review-Modus sind und eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // dann automatisch das Shadow-Twin setzen
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      const shadowTwin = group.transcriptFiles[0];
      FileLogger.info('FileList', 'Basis-Datei mit Shadow-Twin ausgewählt', {
        twinId: shadowTwin.id,
        twinName: shadowTwin.metadata.name,
        baseFileId: item.id,
        baseFileName: item.metadata.name
      });
      setSelectedShadowTwin(shadowTwin);
    } else {
      FileLogger.info('FileList', 'Datei ohne Shadow-Twin ausgewählt', {
        itemId: item.id,
        itemName: item.metadata.name,
        groupExists: !!group,
        transcriptCount: group?.transcriptFiles?.length ?? 0
      });
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!items || items.length === 0) return;
    
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      const refreshedItems = await refreshItems(parentId);
      setFolderItems(refreshedItems);
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, setFolderItems]);

  const handleCreateTranscript = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    FileLogger.info('FileList', 'Create transcript for', { fileName: 'TODO' });
    // TODO: Implement transcript creation
  }, []);

  // Entfernt: handleItemSelect war unbenutzt

  // Check if an item is selected (beide Atome prüfen)
  const isItemSelected = useCallback((item: StorageItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'audio' || mediaType === 'video') {
      return selectedBatchItems.some(selected => selected.item.id === item.id);
    } else {
      return selectedTransformationItems.some(selected => selected.item.id === item.id);
    }
  }, [selectedBatchItems, selectedTransformationItems]);

  // Löschfunktion
  const handleDeleteClick = React.useCallback(async (e: React.MouseEvent<HTMLButtonElement>, itemToDelete: StorageItem) => {
    e.stopPropagation();
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(itemToDelete.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      // Bestätigungsnachricht vorbereiten
      let confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" wirklich löschen?`;
      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 || fileGroup.transformed) {
          confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" und alle zugehörigen Dateien wirklich löschen?`;
        }
      }

      // Benutzer um Bestätigung bitten
      if (!window.confirm(confirmMessage)) {
        return;
      }

      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - lösche auch abhängige Dateien
        // Lösche alle Transkripte, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            try {
              await provider.deleteItem(transcript.id);
              FileLogger.info('FileList', 'Transkript gelöscht', {
                transcriptId: transcript.id,
                transcriptName: transcript.metadata.name
              });
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Löschen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht gelöscht werden"
              });
            }
          }
        }

        // Lösche die transformierte Datei, falls vorhanden
        if (fileGroup.transformed) {
          try {
            await provider.deleteItem(fileGroup.transformed.id);
            FileLogger.info('FileList', 'Transformierte Datei gelöscht', {
              transformedId: fileGroup.transformed.id,
              transformedName: fileGroup.transformed.metadata.name
            });
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Löschen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht gelöscht werden"
            });
          }
        }

        // Lösche die Basis-Datei
        await provider.deleteItem(itemToDelete.id);
        toast.success("Dateien gelöscht", {
          description: `${itemToDelete.metadata.name} und zugehörige Dateien wurden gelöscht.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei löschen
        await provider.deleteItem(itemToDelete.id);
        toast.success("Datei gelöscht", {
          description: `${itemToDelete.metadata.name} wurde gelöscht.`
        });
      }

      // Aktualisiere die Dateiliste
      await handleRefresh();

      // Wenn die gelöschte Datei ausgewählt war, Auswahl aufheben
      setSelectedFile(null);
      
      // Aus der Batch-Auswahl entfernen
      setSelectedBatchItems(prev => prev.filter(i => i.item.id !== itemToDelete.id));

    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Löschen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems]);

  const handleRename = React.useCallback(async (item: StorageItem, newName: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(item.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      if (fileGroup && item.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - benenne auch abhängige Dateien um
        const oldStem = getBaseName(item.metadata.name);
        const newStem = getBaseName(newName);
        // Benenne die Basis-Datei um
        await provider.renameItem(item.id, newName);
        // Benenne alle Transkripte um, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            const transcriptName = transcript.metadata.name;
            const newTranscriptName = transcriptName.replace(oldStem, newStem);
            try {
              await provider.renameItem(transcript.id, newTranscriptName);
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Umbenennen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht umbenannt werden"
              });
            }
          }
        }
        // Benenne die transformierte Datei um, falls vorhanden
        if (fileGroup.transformed) {
          const transformedName = fileGroup.transformed.metadata.name;
          const newTransformedName = transformedName.replace(oldStem, newStem);
          try {
            await provider.renameItem(fileGroup.transformed.id, newTransformedName);
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Umbenennen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht umbenannt werden"
            });
          }
        }
        toast.success("Dateien umbenannt", {
          description: `${item.metadata.name} und zugehörige Dateien wurden umbenannt.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei umbenennen
        await provider.renameItem(item.id, newName);
        toast.success("Datei umbenannt", {
          description: `${item.metadata.name} wurde zu ${newName} umbenannt.`
        });
      }
      await handleRefresh();
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Umbenennen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht umbenannt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
      throw error;
    }
  }, [provider, handleRefresh, fileGroups]);

  const handleBatchTranscription = () => {
    if (selectedBatchItems.length > 0) {
      setTranscriptionDialogOpen(true);
    }
  };

  const handleBatchTransformation = () => {
    if (selectedTransformationItems.length > 0) {
      setTransformationDialogOpen(true);
    }
  };

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroups ?? new Map()).values())
        .map(group => group.baseItem)
        .filter((item): item is StorageItem => item !== undefined);
      const selectableItems = mainItems.filter(item => {
        try {
          const mediaType = getMediaType(item);
          // Je nach Filter unterschiedliche Dateien auswählen
          switch (currentCategoryFilter) {
            case 'media':
              return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
            case 'text':
              return item.type === 'file' && mediaType === 'text';
            case 'documents':
              return item.type === 'file' && mediaType === 'document';
            default:
              // Bei 'all' alle Dateien auswählen, die für eine Operation geeignet sind
              return item.type === 'file' && (
                mediaType === 'audio' || 
                mediaType === 'video' || 
                mediaType === 'text' || 
                mediaType === 'document'
              );
          }
        } catch {
          return false;
        }
      });
      StateLogger.info('FileList', 'Selecting all items based on filter', {
        filter: currentCategoryFilter,
        totalItems: items.length,
        selectableCount: selectableItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      // Je nach Filter unterschiedliche Atome verwenden
      if (currentCategoryFilter === 'media') {
        setSelectedBatchItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else if (currentCategoryFilter === 'text') {
        setSelectedTransformationItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else {
        // Bei 'all' oder 'documents' beide Atome füllen
        const mediaItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'audio' || mediaType === 'video';
        });
        const textItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'text' || mediaType === 'document';
        });
        setSelectedBatchItems(mediaItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
        setSelectedTransformationItems(textItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      }
    } else {
      StateLogger.info('FileList', 'Deselecting all items', {
        previouslySelected: selectedBatchItems.length + selectedTransformationItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
    }
  }, [fileGroups, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen
    const timeoutId = setTimeout(() => {
      StateLogger.debug('FileList', 'Render', {
        currentLibraryId: currentLibrary?.id,
        activeLibraryIdAtom: activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  // Entkoppelt: kein Render-Gate mehr basierend auf FileTree

  return (
    <div className="h-full flex flex-col">
      {/* Header - versteckt im compact mode */}
      {!compact && (
        <div className="border-b px-2 py-2 flex items-center justify-between bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Aktualisieren"
              aria-label="Aktualisieren"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            {/* Dateikategorie-Filter (Icon-only Variante) */}
            <FileCategoryFilter iconOnly />

            {/* Batch-Actions als Icons */}
            {selectedBatchItems.length > 0 && (
              <Button size="icon" title="Transkribieren" aria-label="Transkribieren" onClick={handleBatchTranscription}>
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
        <div>
          {/* Table Header - versteckt im compact mode */}
          {!compact && (
            <div className="sticky top-0 bg-background border-b">
              <div className="grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div className="w-6 flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Alle auswählen"
                  />
                </div>
                <div className="w-6" />
                <SortableHeaderCell
                  label="Name"
                  field="name"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Größe"
                  field="size"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Geändert"
                  field="date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <div />
              </div>
            </div>
          )}

          {/* Folder Rows (oberhalb der Dateien, unabhängig von Datei-Gruppierung) */}
          {folders.length > 0 && (
            <div className="divide-y">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id);
                  }}
                  className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
                >
                  <div />
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-left truncate select-none">{folder.metadata.name}</span>
                  <span className="text-muted-foreground" />
                  <span className="text-muted-foreground" />
                  <div />
                </div>
              ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroups ?? new Map()).values())
              .map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // System-Unterordner-Id, wenn ein ".<basename>"-Folder existiert
                const systemFolder = systemFolderByBase.get(getBaseName(item.metadata.name));
                const systemFolderId = systemFolder?.id;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleSelect(item, group)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                    systemFolderId={systemFolderId}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 
```

Ich passe jetzt `src/components/library/library.tsx` an, um den Initial-Load nicht mehr an `fileTreeReady` oder Tree-Visibility zu koppeln, und danach prüfe ich Linter-Fehler für die geänderten Dateien.

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => m.FilePreview), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Lade Vorschau...
    </div>
  )
})
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
export function Library() {
  // Performance-Messung für Kaltstart (nur Client)
  const startupT0Ref = React.useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  
  // Review-Mode Atoms
  const [isReviewMode] = useAtom(reviewModeAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus,
    currentLibrary
  } = useStorage();
  const { toast } = useToast();
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        setFolderItems(cachedItems);
        setLastLoadedFolder(currentFolderId);
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);
      
      // Update Cache und State
      if (currentFolderId !== 'root') {
        const newFolderCache = { ...libraryState.folderCache };
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
          StateLogger.info('Library', 'Updating folder cache', {
            folderId: currentFolderId,
            itemCount: items.length,
            cacheSize: Object.keys(newFolderCache).length
          });
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
        }
      }
      
      setFolderItems(items);
      setLastLoadedFolder(currentFolderId);
      
      StateLogger.info('Library', 'Items loaded successfully', {
        folderId: currentFolderId,
        itemCount: items.length,
        fileCount: items.filter(i => i.type === 'file').length,
        folderCount: items.filter(i => i.type === 'folder').length,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else {
        StateLogger.error('Library', 'Failed to load items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          folderId: currentFolderId,
          libraryId: currentLibrary?.id,
          libraryPath: currentLibrary?.path
        });
        
        // Benutzerfreundliche Fehlermeldung anzeigen
        let errorMessage = 'Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          if (error.message.includes('Nicht authentifiziert')) {
            errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher.';
          } else if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Dateien. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine aktive Bibliothek')) {
            errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Toast-Nachricht anzeigen
        toast({
          title: "Fehler beim Laden der Dateien",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setFolderItems([]);
    } finally {
      setLoadingState({ isLoading: false, loadingFolderId: null });
    }
  }, [
    currentFolderId,
    lastLoadedFolder,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState,
    toast,
    currentLibrary
  ]);

  // Effect für Initial-Load (entkoppelt vom FileTree)
  useEffect(() => {
    const isReady = !!providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId) {
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, loadItems]);

  // Reset Cache wenn sich die Library ändert
  useEffect(() => {
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
  }, [libraryStatus, setLibraryState, setLastLoadedFolder]);

  // Manuelle Cache-Clear-Funktion für Review-Modus
  const clearCache = useCallback(() => {
    StateLogger.info('Library', 'Manually clearing cache for review mode');
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
    setFolderItems([]);
  }, [setLibraryState, setLastLoadedFolder, setFolderItems]);

  // Reset selectedShadowTwin wenn Review-Modus verlassen wird
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedShadowTwin(null);
    }
  }, [isReviewMode, setSelectedShadowTwin]);

  // ENTFERNT: Der folgende useEffect war problematisch und hat das Shadow-Twin 
  // bei jedem Klick zurückgesetzt, auch wenn die Datei ein Shadow-Twin hat.
  // Die Shadow-Twin-Logik wird bereits korrekt in der FileList-Komponente 
  // in der handleSelect-Funktion behandelt.

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    );
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LibraryHeader
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
        onClearCache={clearCache}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review-Layout: 3 Panels ohne FileTree - FileList (compact) | FilePreview (Basis-Datei) | FilePreview (Shadow-Twin)
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={20} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={true} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedFile ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedFile}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Basis) onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
                    if (libraryState.folderCache?.[folderId]) {
                      const cachedFolder = libraryState.folderCache[folderId];
                      if (cachedFolder) {
                        setLibraryState(state => ({
                          ...state,
                          folderCache: {
                            ...(state.folderCache || {}),
                            [folderId]: {
                              ...cachedFolder,
                              children: items
                            }
                          }
                        }));
                      }
                    }
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Keine Datei ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedShadowTwin}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                      StateLogger.info('Library', 'FilePreview (Shadow-Twin) onRefreshFolder aufgerufen', {
                        folderId,
                        itemsCount: items.length,
                        hasSelectFile: !!selectFileAfterRefresh
                      });
                      
                      // Aktualisiere die Dateiliste
                      setFolderItems(items);
                      
                      // Aktualisiere den Cache
                      if (libraryState.folderCache?.[folderId]) {
                        const cachedFolder = libraryState.folderCache[folderId];
                        if (cachedFolder) {
                          setLibraryState(state => ({
                            ...state,
                            folderCache: {
                              ...(state.folderCache || {}),
                              [folderId]: {
                                ...cachedFolder,
                                children: items
                              }
                            }
                          }));
                        }
                      }
                      
                      // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                      if (selectFileAfterRefresh) {
                        StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                          fileId: selectFileAfterRefresh.id,
                          fileName: selectFileAfterRefresh.metadata.name
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Kein Shadow-Twin ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          // Normal-Layout (Desktop) oder alternierendes Mobile-Layout
          <div className="relative h-full">
            {/* Floating toggle handle - nur Desktop */}
            <button
              type="button"
              onClick={() => setIsTreeVisible(v => !v)}
              className="hidden lg:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full border bg-background/80 shadow-sm hover:bg-background"
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
            >
              {isTreeVisible ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isMobile ? (
              mobileView === 'list' ? (
                <div className="h-full overflow-auto flex flex-col">
                  <FileList />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-background">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      onClick={() => {
                        setMobileView('list');
                        setSelectedShadowTwin(null);
                        setSelectedFile(null);
                        loadItems();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </button>
                    <div className="text-sm text-muted-foreground truncate">
                      {selectedFile?.metadata.name}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        setFolderItems(items);
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: { ...cachedFolder, children: items }
                              }
                            }));
                          }
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="library-panels">
                {isTreeVisible && (
                  <>
                    <ResizablePanel id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full relative flex flex-col">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        
                        // Aktualisiere die Dateiliste
                        setFolderItems(items);
                        
                        // Aktualisiere den Cache
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: {
                                  ...cachedFolder,
                                  children: items
                                }
                              }
                            }));
                          }
                        }
                        
                        if (selectFileAfterRefresh) {
                          StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                            fileId: selectFileAfterRefresh.id,
                            fileName: selectFileAfterRefresh.metadata.name
                          });
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
      <TransformationDialog 
        onRefreshFolder={(folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => {
          StateLogger.info('Library', 'TransformationDialog onRefreshFolder aufgerufen', {
            folderId,
            itemsCount: items.length,
            hasSelectFile: !!selectFileAfterRefresh
          });
          
          // Aktualisiere die Dateiliste
          setFolderItems(items);
          
          // Aktualisiere den Cache
          if (libraryState.folderCache?.[folderId]) {
            const cachedFolder = libraryState.folderCache[folderId];
            if (cachedFolder) {
              setLibraryState(state => ({
                ...state,
                folderCache: {
                  ...(state.folderCache || {}),
                  [folderId]: {
                    ...cachedFolder,
                    children: items
                  }
                }
              }));
            }
          }
          
          // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
          if (selectFileAfterRefresh) {
            StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
              fileId: selectFileAfterRefresh.id,
              fileName: selectFileAfterRefresh.metadata.name
            });
          }
        }}
      />
    </div>
  );
}
```

Kurzupdate: Ich habe FileList vom FileTree entkoppelt und den Initial-Load nur von Provider/Status/FolderId abhängig gemacht. Jetzt lade ich die Liste, sobald sich `currentFolderId` ändert, unabhängig vom Tree.

Analyse und Änderungen:
- FileList: Alle Guards und Render-Gates bzgl. `fileTreeReady` entfernt. Initialisierung wartet nur noch auf `provider`.
- Library: Initial-Load-Gate vereinfacht. Keine Abhängigkeit mehr von `fileTreeReady`, `isTreeVisible` oder `isMobile`. Trigger nur, wenn `providerInstance` existiert und `libraryStatus === 'ready'`, und wenn `lastLoadedFolder !== currentFolderId`.
- Linter: Grün für beide geänderten Dateien.

Tests, die du manuell prüfen solltest:
- Desktop: Library wechseln, `currentFolderId` sollte auf root gehen und FileList laden (auch wenn Tree noch lädt/versteckt ist).
- Ordner im Tree klicken (ändert `currentFolderId`): FileList lädt neu.
- Mobile: Verhalten bleibt erwartungskonform; FileList lädt nach Folder-Wechsel sofort.

- Geänderte Dateien:
  - `src/components/library/file-list.tsx`: Tree-Ready-Abhängigkeit entfernt; Render-Gate eliminiert.
  - `src/components/library/library.tsx`: Initial-Load-Gate nur Provider/Status/FolderId; weniger Log-Details.

Wenn du magst, kann ich optional ein Event-Log hinzufügen, das explizit anzeigt: „FolderId changed → loadItems()“ für bessere Nachvollziehbarkeit im Debug-Panel.

---

**User**

Aber wenn ich oben die library wechsle, bleibt fileliste leer:
hier die logs:
{
  "timestamp": "2025-08-26T09:55:33.655Z",
  "system": {
    "library": {
      "Library": "Archiv Peter (502a1384-553b-493e-bc66-75d48345b47e)",
      "Provider": "Local Filesystem",
      "Provider-Key": "local",
      "Status": "ready",
      "Token vorhanden": "Nein",
      "Aktive Library-ID": "502a1384-553b-493e-bc66-75d48345b47e",
      "Auth": "Keine Auth-Info",
      "Ordner": "root"
    }
  },
  "visibleComponents": [
    "FileTree",
    "Breadcrumb",
    "FileList",
    "LocalStorageProvider",
    "LibrarySwitcher"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file",
    "ui"
  ],
  "duplicates": [
    "FileList:Render",
    "FileList:Already initialized",
    "FileTree:Starting root load"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T09:55:26.832Z",
      "area": "state",
      "sequence": 80,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 46,
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126832-ngtkx1apb",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.820Z",
      "area": "ui",
      "sequence": 34,
      "component": "Breadcrumb",
      "level": "info",
      "message": "Auto-scroll completed",
      "details": {
        "duration": "117.80ms",
        "finalScrollLeft": 0,
        "pathDepth": 1
      },
      "id": "1756202126821-4dxqrskrs",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.807Z",
      "area": "state",
      "sequence": 79,
      "component": "LocalStorageProvider",
      "level": "info",
      "message": "🔐 AUTH: API call successful",
      "details": {
        "itemCount": 8,
        "folderId": "root",
        "libraryId": "Fosdem"
      },
      "id": "1756202126807-omfe908w7",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.764Z",
      "area": "state",
      "sequence": 78,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126768-8nzh9ku4g",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.755Z",
      "area": "file",
      "sequence": 54,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756202126765-83nhir4mx",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.755Z",
      "area": "state",
      "sequence": 77,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=502a1384-553b-493e-bc66-75d48345b47e&email=***"
      },
      "id": "1756202126765-5mdwlqqk6",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.755Z",
      "area": "ui",
      "sequence": 33,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756202126765-3xffvq5i6",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.733Z",
      "area": "file",
      "sequence": 53,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756202126765-wbc5qx8il",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.731Z",
      "area": "file",
      "sequence": 52,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756202126764-8um0ks3w3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.731Z",
      "area": "file",
      "sequence": 51,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756202126764-jiupmd2n2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.730Z",
      "area": "state",
      "sequence": 76,
      "component": "LocalStorageProvider",
      "level": "debug",
      "message": "🔐 AUTH: Starting listItemsById API call",
      "details": {
        "folderId": "root",
        "libraryId": "Fosdem",
        "hasUserEmail": true,
        "userEmail": "peter.aichner@...",
        "url": "/api/storage/filesystem?action=list&fileId=root&libraryId=Fosdem&email=***"
      },
      "id": "1756202126764-xtsgihpeq",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.730Z",
      "area": "ui",
      "sequence": 32,
      "component": "FileTree",
      "level": "info",
      "message": "Starting root load",
      "details": {
        "hasProvider": true,
        "isReady": false
      },
      "id": "1756202126764-azayinkof",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.720Z",
      "area": "file",
      "sequence": 50,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756202126764-urkddhuyu",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.711Z",
      "area": "state",
      "sequence": 75,
      "component": "FileList",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126764-q8vasziyx",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.711Z",
      "area": "state",
      "sequence": 74,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126764-g1dc1jmk1",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T09:55:26.711Z",
      "area": "file",
      "sequence": 49,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126764-lggjiym3h",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.711Z",
      "area": "ui",
      "sequence": 31,
      "component": "Breadcrumb",
      "level": "debug",
      "message": "Starting auto-scroll",
      "details": {
        "pathDepth": 1,
        "currentScrollLeft": 0,
        "targetScrollLeft": 81,
        "activeLibrary": "Archiv Peter"
      },
      "id": "1756202126764-i6nq63awq",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.672Z",
      "area": "state",
      "sequence": 73,
      "component": "LibrarySwitcher",
      "level": "info",
      "message": "Bibliothek geändert zu",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126758-3j8jrazua",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T09:55:26.672Z",
      "area": "state",
      "sequence": 72,
      "component": "LibrarySwitcher",
      "level": "debug",
      "message": "Speichere activeLibraryId im localStorage",
      "details": {
        "value": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756202126758-ph7os64cd",
      "remarks": "",
      "isDuplicate": false
    }
  ]
}

---

**Cursor**

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => m.FilePreview), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Lade Vorschau...
    </div>
  )
})
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
export function Library() {
  // Performance-Messung für Kaltstart (nur Client)
  const startupT0Ref = React.useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // Review-Mode Atoms
  const [isReviewMode] = useAtom(reviewModeAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus,
    currentLibrary
  } = useStorage();
  const { toast } = useToast();
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        setFolderItems(cachedItems);
        setLastLoadedFolder(currentFolderId);
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);
      
      // Update Cache und State
      if (currentFolderId !== 'root') {
        const newFolderCache = { ...libraryState.folderCache };
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
          StateLogger.info('Library', 'Updating folder cache', {
            folderId: currentFolderId,
            itemCount: items.length,
            cacheSize: Object.keys(newFolderCache).length
          });
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
        }
      }
      
      setFolderItems(items);
      setLastLoadedFolder(currentFolderId);
      
      StateLogger.info('Library', 'Items loaded successfully', {
        folderId: currentFolderId,
        itemCount: items.length,
        fileCount: items.filter(i => i.type === 'file').length,
        folderCount: items.filter(i => i.type === 'folder').length,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else {
        StateLogger.error('Library', 'Failed to load items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          folderId: currentFolderId,
          libraryId: currentLibrary?.id,
          libraryPath: currentLibrary?.path
        });
        
        // Benutzerfreundliche Fehlermeldung anzeigen
        let errorMessage = 'Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          if (error.message.includes('Nicht authentifiziert')) {
            errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher.';
          } else if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Dateien. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine aktive Bibliothek')) {
            errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Toast-Nachricht anzeigen
        toast({
          title: "Fehler beim Laden der Dateien",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setFolderItems([]);
    } finally {
      setLoadingState({ isLoading: false, loadingFolderId: null });
    }
  }, [
    currentFolderId,
    lastLoadedFolder,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState,
    toast,
    currentLibrary
  ]);

  // Effect für Initial-Load (entkoppelt vom FileTree)
  useEffect(() => {
    const isReady = !!providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId) {
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, loadItems]);

  // Zusätzlicher Reset bei Bibliothekswechsel (robust gegen Status-Race)
  useEffect(() => {
    if (!activeLibraryId) return;
    StateLogger.info('Library', 'Active library changed - reset initial load state', {
      activeLibraryId,
      currentFolderId
    });
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

  // Reset Cache wenn sich die Library ändert
  useEffect(() => {
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
  }, [libraryStatus, setLibraryState, setLastLoadedFolder]);

  // Manuelle Cache-Clear-Funktion für Review-Modus
  const clearCache = useCallback(() => {
    StateLogger.info('Library', 'Manually clearing cache for review mode');
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
    setFolderItems([]);
  }, [setLibraryState, setLastLoadedFolder, setFolderItems]);

  // Reset selectedShadowTwin wenn Review-Modus verlassen wird
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedShadowTwin(null);
    }
  }, [isReviewMode, setSelectedShadowTwin]);

  // ENTFERNT: Der folgende useEffect war problematisch und hat das Shadow-Twin 
  // bei jedem Klick zurückgesetzt, auch wenn die Datei ein Shadow-Twin hat.
  // Die Shadow-Twin-Logik wird bereits korrekt in der FileList-Komponente 
  // in der handleSelect-Funktion behandelt.

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    );
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LibraryHeader
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
        onClearCache={clearCache}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review-Layout: 3 Panels ohne FileTree - FileList (compact) | FilePreview (Basis-Datei) | FilePreview (Shadow-Twin)
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={20} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={true} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedFile ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedFile}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Basis) onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
                    if (libraryState.folderCache?.[folderId]) {
                      const cachedFolder = libraryState.folderCache[folderId];
                      if (cachedFolder) {
                        setLibraryState(state => ({
                          ...state,
                          folderCache: {
                            ...(state.folderCache || {}),
                            [folderId]: {
                              ...cachedFolder,
                              children: items
                            }
                          }
                        }));
                      }
                    }
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Keine Datei ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedShadowTwin}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                      StateLogger.info('Library', 'FilePreview (Shadow-Twin) onRefreshFolder aufgerufen', {
                        folderId,
                        itemsCount: items.length,
                        hasSelectFile: !!selectFileAfterRefresh
                      });
                      
                      // Aktualisiere die Dateiliste
                      setFolderItems(items);
                      
                      // Aktualisiere den Cache
                      if (libraryState.folderCache?.[folderId]) {
                        const cachedFolder = libraryState.folderCache[folderId];
                        if (cachedFolder) {
                          setLibraryState(state => ({
                            ...state,
                            folderCache: {
                              ...(state.folderCache || {}),
                              [folderId]: {
                                ...cachedFolder,
                                children: items
                              }
                            }
                          }));
                        }
                      }
                      
                      // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                      if (selectFileAfterRefresh) {
                        StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                          fileId: selectFileAfterRefresh.id,
                          fileName: selectFileAfterRefresh.metadata.name
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Kein Shadow-Twin ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          // Normal-Layout (Desktop) oder alternierendes Mobile-Layout
          <div className="relative h-full">
            {/* Floating toggle handle - nur Desktop */}
            <button
              type="button"
              onClick={() => setIsTreeVisible(v => !v)}
              className="hidden lg:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full border bg-background/80 shadow-sm hover:bg-background"
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
            >
              {isTreeVisible ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isMobile ? (
              mobileView === 'list' ? (
                <div className="h-full overflow-auto flex flex-col">
                  <FileList />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-background">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      onClick={() => {
                        setMobileView('list');
                        setSelectedShadowTwin(null);
                        setSelectedFile(null);
                        loadItems();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </button>
                    <div className="text-sm text-muted-foreground truncate">
                      {selectedFile?.metadata.name}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        setFolderItems(items);
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: { ...cachedFolder, children: items }
                              }
                            }));
                          }
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="library-panels">
                {isTreeVisible && (
                  <>
                    <ResizablePanel id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full relative flex flex-col">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        
                        // Aktualisiere die Dateiliste
                        setFolderItems(items);
                        
                        // Aktualisiere den Cache
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: {
                                  ...cachedFolder,
                                  children: items
                                }
                              }
                            }));
                          }
                        }
                        
                        if (selectFileAfterRefresh) {
                          StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                            fileId: selectFileAfterRefresh.id,
                            fileName: selectFileAfterRefresh.metadata.name
                          });
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
      <TransformationDialog 
        onRefreshFolder={(folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => {
          StateLogger.info('Library', 'TransformationDialog onRefreshFolder aufgerufen', {
            folderId,
            itemsCount: items.length,
            hasSelectFile: !!selectFileAfterRefresh
          });
          
          // Aktualisiere die Dateiliste
          setFolderItems(items);
          
          // Aktualisiere den Cache
          if (libraryState.folderCache?.[folderId]) {
            const cachedFolder = libraryState.folderCache[folderId];
            if (cachedFolder) {
              setLibraryState(state => ({
                ...state,
                folderCache: {
                  ...(state.folderCache || {}),
                  [folderId]: {
                    ...cachedFolder,
                    children: items
                  }
                }
              }));
            }
          }
          
          // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
          if (selectFileAfterRefresh) {
            StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
              fileId: selectFileAfterRefresh.id,
              fileName: selectFileAfterRefresh.metadata.name
            });
          }
        }}
      />
    </div>
  );
}
```

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => m.FilePreview), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Lade Vorschau...
    </div>
  )
})
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
export function Library() {
  // Performance-Messung für Kaltstart (nur Client)
  const startupT0Ref = React.useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // Review-Mode Atoms
  const [isReviewMode] = useAtom(reviewModeAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus,
    currentLibrary
  } = useStorage();
  const { toast } = useToast();
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        setFolderItems(cachedItems);
        setLastLoadedFolder(currentFolderId);
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);
      
      // Update Cache und State
      if (currentFolderId !== 'root') {
        const newFolderCache = { ...libraryState.folderCache };
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
          StateLogger.info('Library', 'Updating folder cache', {
            folderId: currentFolderId,
            itemCount: items.length,
            cacheSize: Object.keys(newFolderCache).length
          });
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
        }
      }
      
      setFolderItems(items);
      setLastLoadedFolder(currentFolderId);
      
      StateLogger.info('Library', 'Items loaded successfully', {
        folderId: currentFolderId,
        itemCount: items.length,
        fileCount: items.filter(i => i.type === 'file').length,
        folderCount: items.filter(i => i.type === 'folder').length,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else {
        StateLogger.error('Library', 'Failed to load items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          folderId: currentFolderId,
          libraryId: currentLibrary?.id,
          libraryPath: currentLibrary?.path
        });
        
        // Benutzerfreundliche Fehlermeldung anzeigen
        let errorMessage = 'Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          if (error.message.includes('Nicht authentifiziert')) {
            errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher.';
          } else if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Dateien. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine aktive Bibliothek')) {
            errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Toast-Nachricht anzeigen
        toast({
          title: "Fehler beim Laden der Dateien",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setFolderItems([]);
    } finally {
      setLoadingState({ isLoading: false, loadingFolderId: null });
    }
  }, [
    currentFolderId,
    lastLoadedFolder,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState,
    toast,
    currentLibrary
  ]);

  // Effect für Initial-Load (entkoppelt vom FileTree)
  useEffect(() => {
    const isReady = !!providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId) {
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

  // Zusätzlicher Reset bei Bibliothekswechsel (robust gegen Status-Race)
  useEffect(() => {
    if (!activeLibraryId) return;
    StateLogger.info('Library', 'Active library changed - reset initial load state', {
      activeLibraryId,
      currentFolderId
    });
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
    // Nach dem Reset sofort neu laden, sobald bereit
    if (providerInstance && libraryStatus === 'ready') {
      NavigationLogger.info('Library', 'Active library changed - triggering load after reset', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

  // Reset Cache wenn sich die Library ändert
  useEffect(() => {
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
  }, [libraryStatus, setLibraryState, setLastLoadedFolder]);

  // Manuelle Cache-Clear-Funktion für Review-Modus
  const clearCache = useCallback(() => {
    StateLogger.info('Library', 'Manually clearing cache for review mode');
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
    setFolderItems([]);
  }, [setLibraryState, setLastLoadedFolder, setFolderItems]);

  // Reset selectedShadowTwin wenn Review-Modus verlassen wird
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedShadowTwin(null);
    }
  }, [isReviewMode, setSelectedShadowTwin]);

  // ENTFERNT: Der folgende useEffect war problematisch und hat das Shadow-Twin 
  // bei jedem Klick zurückgesetzt, auch wenn die Datei ein Shadow-Twin hat.
  // Die Shadow-Twin-Logik wird bereits korrekt in der FileList-Komponente 
  // in der handleSelect-Funktion behandelt.

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    );
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LibraryHeader
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
        onClearCache={clearCache}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review-Layout: 3 Panels ohne FileTree - FileList (compact) | FilePreview (Basis-Datei) | FilePreview (Shadow-Twin)
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={20} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={true} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedFile ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedFile}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Basis) onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
                    if (libraryState.folderCache?.[folderId]) {
                      const cachedFolder = libraryState.folderCache[folderId];
                      if (cachedFolder) {
                        setLibraryState(state => ({
                          ...state,
                          folderCache: {
                            ...(state.folderCache || {}),
                            [folderId]: {
                              ...cachedFolder,
                              children: items
                            }
                          }
                        }));
                      }
                    }
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Keine Datei ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedShadowTwin}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                      StateLogger.info('Library', 'FilePreview (Shadow-Twin) onRefreshFolder aufgerufen', {
                        folderId,
                        itemsCount: items.length,
                        hasSelectFile: !!selectFileAfterRefresh
                      });
                      
                      // Aktualisiere die Dateiliste
                      setFolderItems(items);
                      
                      // Aktualisiere den Cache
                      if (libraryState.folderCache?.[folderId]) {
                        const cachedFolder = libraryState.folderCache[folderId];
                        if (cachedFolder) {
                          setLibraryState(state => ({
                            ...state,
                            folderCache: {
                              ...(state.folderCache || {}),
                              [folderId]: {
                                ...cachedFolder,
                                children: items
                              }
                            }
                          }));
                        }
                      }
                      
                      // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                      if (selectFileAfterRefresh) {
                        StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                          fileId: selectFileAfterRefresh.id,
                          fileName: selectFileAfterRefresh.metadata.name
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Kein Shadow-Twin ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          // Normal-Layout (Desktop) oder alternierendes Mobile-Layout
          <div className="relative h-full">
            {/* Floating toggle handle - nur Desktop */}
            <button
              type="button"
              onClick={() => setIsTreeVisible(v => !v)}
              className="hidden lg:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full border bg-background/80 shadow-sm hover:bg-background"
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
            >
              {isTreeVisible ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isMobile ? (
              mobileView === 'list' ? (
                <div className="h-full overflow-auto flex flex-col">
                  <FileList />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-background">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      onClick={() => {
                        setMobileView('list');
                        setSelectedShadowTwin(null);
                        setSelectedFile(null);
                        loadItems();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </button>
                    <div className="text-sm text-muted-foreground truncate">
                      {selectedFile?.metadata.name}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        setFolderItems(items);
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: { ...cachedFolder, children: items }
                              }
                            }));
                          }
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="library-panels">
                {isTreeVisible && (
                  <>
                    <ResizablePanel id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full relative flex flex-col">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        
                        // Aktualisiere die Dateiliste
                        setFolderItems(items);
                        
                        // Aktualisiere den Cache
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: {
                                  ...cachedFolder,
                                  children: items
                                }
                              }
                            }));
                          }
                        }
                        
                        if (selectFileAfterRefresh) {
                          StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                            fileId: selectFileAfterRefresh.id,
                            fileName: selectFileAfterRefresh.metadata.name
                          });
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
      <TransformationDialog 
        onRefreshFolder={(folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => {
          StateLogger.info('Library', 'TransformationDialog onRefreshFolder aufgerufen', {
            folderId,
            itemsCount: items.length,
            hasSelectFile: !!selectFileAfterRefresh
          });
          
          // Aktualisiere die Dateiliste
          setFolderItems(items);
          
          // Aktualisiere den Cache
          if (libraryState.folderCache?.[folderId]) {
            const cachedFolder = libraryState.folderCache[folderId];
            if (cachedFolder) {
              setLibraryState(state => ({
                ...state,
                folderCache: {
                  ...(state.folderCache || {}),
                  [folderId]: {
                    ...cachedFolder,
                    children: items
                  }
                }
              }));
            }
          }
          
          // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
          if (selectFileAfterRefresh) {
            StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
              fileId: selectFileAfterRefresh.id,
              fileName: selectFileAfterRefresh.metadata.name
            });
          }
        }}
      />
    </div>
  );
}
```

Kurzes Update: Ich habe FileList vollständig von `fileTreeReady` entkoppelt und zusätzlich einen robusten Reset/Reload bei Bibliothekswechsel in `Library` ergänzt. Jetzt lädt die Liste rein auf Basis von `providerInstance`, `libraryStatus === 'ready'` und `currentFolderId`. Linter ist grün.

Beobachtung aus deinen Logs:
- FileList meldet „Already initialized“ und rendert, aber es gibt keinen „Initial load triggered“ aus `Library`. Ursache: `lastLoadedFolder === currentFolderId` oder der Reload nach Library-Wechsel wurde nicht getriggert.
- Der zusätzliche Effect in `Library` setzt bei Wechsel `lastLoadedFolder` auf `null`, leert `folderItems` und triggert sofort `loadItems()` sobald Provider/Status bereit sind.

Was ich geändert habe:
- in `src/components/library/file-list.tsx`
  - alle Guards gegen `fileTreeReady` und das Render-Gate entfernt.
  - Init wartet nur noch auf `provider`.
- in `src/components/library/library.tsx`
  - Initial-Load-Gate: nur `providerInstance && libraryStatus === 'ready'`.
  - Dependency um `activeLibraryId` ergänzt.
  - Neuer Effect bei `activeLibraryId`-Wechsel: setzt `lastLoadedFolder=null`, leert `folderItems`, leert `folderCache` und ruft `loadItems()` auf, wenn bereit.

Bitte einmal den Wechsel reproduzieren:
- Library umschalten → im Debug-Panel sollten nun Logs erscheinen:
  - Library: „Active library changed - reset initial load state“
  - Library: „Active library changed - triggering load after reset“
  - Library: „Initial load triggered“ gefolgt von „Fetching/Using cached items“.

Falls es immer noch leer bleibt, brauche ich die nächsten 3 Logs nach dem Wechsel aus dem Debug-Panel. Dann prüfe ich, ob `listItems(root)` evtl. fehlschlägt oder ein Cache-Short-Circuit greift.

---

**User**

jetzt funktionierts, aber kann es sein dass die liste bei librarywechsel 2 x initialisiert wird?
Kurz sieht man eine andere liste
{
  "timestamp": "2025-08-26T10:16:16.983Z",
  "system": {
    "library": {
      "Library": "Archiv Peter (502a1384-553b-493e-bc66-75d48345b47e)",
      "Provider": "Local Filesystem",
      "Provider-Key": "local",
      "Status": "ready",
      "Token vorhanden": "Nein",
      "Aktive Library-ID": "502a1384-553b-493e-bc66-75d48345b47e",
      "Auth": "Keine Auth-Info",
      "Ordner": "root"
    }
  },
  "visibleComponents": [
    "FileTree",
    "Breadcrumb",
    "FileList"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file"
  ],
  "duplicates": [
    "FileList:Render",
    "FileList:Already initialized"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T10:16:14.338Z",
      "area": "file",
      "sequence": 392,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "20250227_BesprechungMonica",
            "baseItem": "20250227_BesprechungMonica.docx"
          },
          {
            "base": "ACHTUNG1",
            "baseItem": "ACHTUNG1.docx"
          },
          {
            "base": "Aufstellung_ehrenamtliche_Taetigkeit_2024_Aichner",
            "baseItem": "Aufstellung_ehrenamtliche_Taetigkeit_2024_Aichner.odt"
          },
          {
            "base": "Dokument (1)",
            "baseItem": "Dokument (1).docx"
          },
          {
            "base": "Dokument (2)",
            "baseItem": "Dokument (2).docx"
          },
          {
            "base": "Dokument",
            "baseItem": "Dokument.docx"
          },
          {
            "base": "Jahresmitgliedschaft 2025 für",
            "baseItem": "Jahresmitgliedschaft 2025 für.docx"
          },
          {
            "base": "Know-How-Scout",
            "baseItem": "Know-How-Scout.pptx"
          },
          {
            "base": "konzept Newsletter",
            "baseItem": "konzept Newsletter.docx"
          },
          {
            "base": "Mappe",
            "baseItem": "Mappe.xlsx"
          },
          {
            "base": "Peter Aichner",
            "baseItem": "Peter Aichner.docx"
          },
          {
            "base": "Pm mit Ai",
            "baseItem": "Pm mit Ai.m4a"
          },
          {
            "base": "Präsentation2",
            "baseItem": "Präsentation2.pptx"
          }
        ]
      },
      "id": "1756203374363-0ntna6z3r",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.194Z",
      "area": "file",
      "sequence": 369,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "01 - Unbekannte Interpet - Unbekannte Titel",
            "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
            "transcripts": [
              "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
            ]
          },
          {
            "base": "20250421_125103",
            "baseItem": "20250421_125103.jpg"
          },
          {
            "base": "Asana Tickets mit Billomat Aufträge verbinden",
            "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
            "transcripts": [
              "Asana Tickets mit Billomat Aufträge verbinden.de.md"
            ]
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0.exe",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
          },
          {
            "base": "Computergestütztes Denken",
            "baseItem": "Computergestütztes Denken.md"
          },
          {
            "base": "DeepSeek in der Praxis-Analyse _ heise online",
            "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
          },
          {
            "base": "Diva Shoplösungen.Besprechung__shadow_RGl2YSBTaG9wbMO2c3VuZ2VuLkJlc3ByZWNodW5nLmRlLm1k",
            "baseItem": "Diva Shoplösungen.Besprechung.de.md"
          },
          {
            "base": "Diva Shoplösungen",
            "baseItem": "Diva Shoplösungen.m4a",
            "transcripts": [
              "Diva Shoplösungen.de.md"
            ]
          },
          {
            "base": "Diva Shoplösungen(1)",
            "baseItem": "Diva Shoplösungen(1).md"
          },
          {
            "base": "IMG-20250503-WA0004",
            "baseItem": "IMG-20250503-WA0004.jpg"
          },
          {
            "base": "Kombinierte_Transformation_2025-07-06T16-55-52",
            "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
          },
          {
            "base": "Paul Lindberg",
            "baseItem": "Paul Lindberg.md"
          },
          {
            "base": "Präsentation Innovationsabteilung_09.07.2025",
            "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung",
            "baseItem": "Präsentation Innovationsabteilung.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung2",
            "baseItem": "Präsentation Innovationsabteilung2.pptx"
          },
          {
            "base": "Präsentation Knowledge Scout NOI Developers Thursday",
            "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
          },
          {
            "base": "Prioritäten Mai",
            "baseItem": "Prioritäten Mai.md"
          },
          {
            "base": "Quartalssitzung",
            "baseItem": "Quartalssitzung.m4a"
          },
          {
            "base": "Swiss Goverment Cloud",
            "baseItem": "Swiss Goverment Cloud.docx"
          },
          {
            "base": "This Simple AI-powered Python Script will Completely Change How You Work",
            "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
          },
          {
            "base": "Transcript Quartalssitzung",
            "baseItem": "Transcript Quartalssitzung.m4a"
          }
        ]
      },
      "id": "1756203374267-q9nkrxdi0",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.145Z",
      "area": "state",
      "sequence": 113,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756203374152-czc4a1nmg",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:16:14.119Z",
      "area": "file",
      "sequence": 368,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756203374145-0i9gz6lqj",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:16:14.096Z",
      "area": "file",
      "sequence": 367,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756203374145-dly1mhftm",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:16:14.089Z",
      "area": "file",
      "sequence": 366,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756203374145-nqi00ta5i",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.089Z",
      "area": "file",
      "sequence": 365,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756203374145-beqascrlv",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.078Z",
      "area": "file",
      "sequence": 364,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756203374145-0sxc6hlzg",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.069Z",
      "area": "state",
      "sequence": 110,
      "component": "FileList",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756203374145-19tufjr54",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:16:14.069Z",
      "area": "state",
      "sequence": 109,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "502a1384-553b-493e-bc66-75d48345b47e",
        "activeLibraryIdAtom": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756203374145-r2l8tc90w",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:16:14.069Z",
      "area": "file",
      "sequence": 363,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "502a1384-553b-493e-bc66-75d48345b47e"
      },
      "id": "1756203374145-zyaodgfrn",
      "remarks": "",
      "isDuplicate": false
    }
  ]
}

---

**Cursor**

Ich setze jetzt eine kleine Verbesserung um: Beim Bibliothekswechsel leere ich sofort `folderItems` und resette `lastLoadedFolder`/`currentFolderId` direkt im `LibrarySwitcher`, um das kurze Anzeigen der alten Liste zu verhindern. Danach prüfe ich den Linter.

```typescriptreact
"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom, folderItemsAtom, lastLoadedFolderAtom, librariesAtom } from "@/atoms/library-atom"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { createLibraryAtom } from "@/atoms/create-library-atom"
import { StateLogger } from "@/lib/debug/logger"

interface LibrarySwitcherProps {
  isCollapsed?: boolean;
  onLibraryChange?: (libraryId: string) => void;
}

export function LibrarySwitcher({ 
  isCollapsed = false, 
  onLibraryChange
}: LibrarySwitcherProps) {
  const router = useRouter();
  const [libraries] = useAtom(librariesAtom)
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  const [, setCurrentFolderId] = useAtom(currentFolderIdAtom)
  const [, setFolderItems] = useAtom(folderItemsAtom)
  const [, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom)
  const [, setCreateLibrary] = useAtom(createLibraryAtom)
  
  const currentLibrary = libraries.find(lib => lib.id === activeLibraryId) || activeLibrary;
  const safeLibraries = React.useMemo(() => {
    return (libraries || []).filter(lib => typeof lib.id === 'string' && lib.id.trim() !== '');
  }, [libraries]);
  
  const handleLibraryChange = (value: string) => {
    // Wenn der spezielle Wert für "Neue Bibliothek erstellen" ausgewählt wurde
    if (value === "new-library") {
      // Setze den globalen Zustand, dass eine neue Bibliothek erstellt werden soll
      setCreateLibrary(true);
      
      // Navigiere zur Einstellungsseite
      router.push("/settings");
      return;
    }
    
    // Bei Auswahl einer regulären Bibliothek den createLibrary-Zustand zurücksetzen
    setCreateLibrary(false);
    
    // Normale Bibliotheksauswahl
    if (onLibraryChange) {
      onLibraryChange(value)
    }
    
    // Speichere die aktive Library-ID im localStorage
    StateLogger.debug('LibrarySwitcher', 'Speichere activeLibraryId im localStorage', { value });
    try {
      localStorage.setItem('activeLibraryId', value)
    } catch {
      // Ignoriere Storage-Fehler still, UI-State bleibt konsistent
    }

    // Sofortiger UI-Reset, um alte Liste zu vermeiden
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')

    // Aktualisiere das Atom
    setActiveLibraryId(value);
    StateLogger.info('LibrarySwitcher', 'Bibliothek geändert zu', { libraryId: value });
  }

  return (
    <Select 
      value={activeLibraryId} 
      onValueChange={handleLibraryChange}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
        aria-label="Bibliothek auswählen"
      >
        <SelectValue placeholder="Bibliothek auswählen">
          {currentLibrary?.icon}
          <span className={cn("ml-2", isCollapsed && "hidden")}>
            {currentLibrary?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Bibliotheken</SelectLabel>
          {safeLibraries.map((library) => (
            <SelectItem key={library.id} value={library.id}>
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                {library.icon}
                {library.label}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        
        {/* Trennlinie und Eintrag zum Erstellen einer neuen Bibliothek */}
        <SelectSeparator className="my-2" />
        <SelectItem value="new-library">
          <div className="flex items-center gap-3 text-primary">
            <Plus className="h-4 w-4" />
            Neue Bibliothek erstellen
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
} 
```

Kurzupdate: Ja, man sah kurz zwei Zustände. Ursache: Beim Wechsel hat FileList einmal mit alten `folderItems` gerendert, bevor der Reset/Reload griff.

Fix umgesetzt:
- `LibrarySwitcher.handleLibraryChange` leert jetzt sofort `folderItems`, setzt `lastLoadedFolder = null` und `currentFolderId = 'root'`, bevor `activeLibraryId` gesetzt wird. So gibt es keine Zwischenanzeige der alten Liste mehr.
- `Library` triggert beim Bibliothekswechsel weiterhin den Reset und lädt danach; die beiden Maßnahmen sind idempotent.

Files geändert:
- `src/components/library/library-switcher.tsx`: UI-Reset vor `setActiveLibraryId`.
- `src/components/library/library.tsx`: zusätzlicher Reload bei aktivem Provider nach Reset bleibt bestehen.

Bitte kurz testen: Library wechseln und beobachten, ob es noch ein Flackern oder „falsche Liste“ gibt. Wenn ja, hänge mir die nächsten Logs an, dann nehme ich ein Debounce von 0ms auf den Reload, um die Reihenfolge strikt zu halten.

---

**User**

man sieht bei librarywechsel immer noch 2 reloads, einaml die alte Liste nochmal und einmal die neue liste.
{
  "timestamp": "2025-08-26T10:23:58.007Z",
  "system": {
    "library": {
      "Library": "Fosdem 2025 (Fosdem)",
      "Provider": "Local Filesystem",
      "Provider-Key": "local",
      "Status": "ready",
      "Token vorhanden": "Nein",
      "Aktive Library-ID": "Fosdem",
      "Auth": "Keine Auth-Info",
      "Ordner": "root"
    }
  },
  "visibleComponents": [
    "FileTree",
    "Breadcrumb",
    "FileList",
    "LibrarySwitcher",
    "Library",
    "FileRow"
  ],
  "visibleAreas": [
    "nav",
    "state",
    "file"
  ],
  "duplicates": [
    "Library:Items loaded successfully",
    "FileList:Render",
    "Library:Fetching items from provider",
    "Library:Loading initial items",
    "FileList:Already initialized",
    "FileList:Gruppierung Ergebnis (Basename, alle Endungen)"
  ],
  "errors": 0,
  "logs": [
    {
      "timestamp": "2025-08-26T10:23:51.001Z",
      "area": "file",
      "sequence": 156,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "hello.mp4"
      },
      "id": "1756203831012-wyq3hgrwg",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:51.001Z",
      "area": "file",
      "sequence": 155,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250202_222433.jpg"
      },
      "id": "1756203831012-dk7kzbed3",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:51.001Z",
      "area": "file",
      "sequence": 154,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250202_222408.jpg"
      },
      "id": "1756203831012-m81srdu5x",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:51.001Z",
      "area": "file",
      "sequence": 153,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250201_180254.jpg"
      },
      "id": "1756203831012-99vy3cwfn",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:51.001Z",
      "area": "file",
      "sequence": 152,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "1 - FOSDEM links.md"
      },
      "id": "1756203831012-cm25lcxvo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.993Z",
      "area": "file",
      "sequence": 151,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "1 - FOSDEM links",
            "baseItem": "1 - FOSDEM links.md"
          },
          {
            "base": "20250201_180254",
            "baseItem": "20250201_180254.jpg"
          },
          {
            "base": "20250202_222408",
            "baseItem": "20250202_222408.jpg"
          },
          {
            "base": "20250202_222433",
            "baseItem": "20250202_222433.jpg"
          },
          {
            "base": "hello",
            "baseItem": "hello.mp4"
          }
        ]
      },
      "id": "1756203831012-6551pbv85",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.980Z",
      "area": "state",
      "sequence": 82,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 8,
        "fileCount": 5,
        "folderCount": 3,
        "tSinceMountMs": 20890.5
      },
      "id": "1756203830986-32d5cgxnt",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.980Z",
      "area": "state",
      "sequence": 81,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 8,
        "fileCount": 5,
        "folderCount": 3,
        "tSinceMountMs": 20890.4
      },
      "id": "1756203830986-gq2k9418v",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.980Z",
      "area": "state",
      "sequence": 80,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 8,
        "fileCount": 5,
        "folderCount": 3,
        "tSinceMountMs": 20890.4
      },
      "id": "1756203830986-hxqmzwv8b",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.980Z",
      "area": "state",
      "sequence": 79,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 8,
        "fileCount": 5,
        "folderCount": 3,
        "tSinceMountMs": 20890.4
      },
      "id": "1756203830986-ywqqtqzj4",
      "remarks": "Duplicate (3x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 150,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Transcript Quartalssitzung.m4a"
      },
      "id": "1756203830974-bjkc7jgvf",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 149,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
      },
      "id": "1756203830974-y6un0q47o",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 148,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Swiss Goverment Cloud.docx"
      },
      "id": "1756203830974-gkoyce6uv",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 147,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Quartalssitzung.m4a"
      },
      "id": "1756203830974-rygjskqz0",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 146,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Prioritäten Mai.md"
      },
      "id": "1756203830973-11r4cvu35",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 145,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
      },
      "id": "1756203830973-v1o0mpqhl",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 144,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung2.pptx"
      },
      "id": "1756203830973-0xq4wcf1w",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 143,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung.pptx"
      },
      "id": "1756203830973-d2mck8pnr",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 142,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
      },
      "id": "1756203830973-co4ygibmm",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 141,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Paul Lindberg.md"
      },
      "id": "1756203830973-6tt9jwo08",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 140,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
      },
      "id": "1756203830973-vnp8fblvo",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 139,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "IMG-20250503-WA0004.jpg"
      },
      "id": "1756203830973-w993bj23g",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 138,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen(1).md"
      },
      "id": "1756203830973-g14k3h1y2",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 137,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.m4a",
        "transcripts": [
          "Diva Shoplösungen.de.md"
        ]
      },
      "id": "1756203830973-zcw90owrm",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 136,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Diva Shoplösungen.Besprechung.de.md"
      },
      "id": "1756203830973-xwgu49do6",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 135,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
      },
      "id": "1756203830973-ztk5xh7g4",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 134,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Computergestütztes Denken.md"
      },
      "id": "1756203830973-okzh8dx6g",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 133,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
      },
      "id": "1756203830973-whth50u4d",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 132,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
      },
      "id": "1756203830973-c5wx84a86",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 131,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
        "transcripts": [
          "Asana Tickets mit Billomat Aufträge verbinden.de.md"
        ]
      },
      "id": "1756203830973-cgv2xzw7l",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 130,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "20250421_125103.jpg"
      },
      "id": "1756203830973-mdgw5j03a",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.932Z",
      "area": "file",
      "sequence": 129,
      "component": "FileRow",
      "level": "debug",
      "message": "Transkripte für Zeile",
      "details": {
        "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
        "transcripts": [
          "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
        ]
      },
      "id": "1756203830973-w4cq63u9o",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.890Z",
      "area": "file",
      "sequence": 128,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": [
          {
            "base": "01 - Unbekannte Interpet - Unbekannte Titel",
            "baseItem": "01 - Unbekannte Interpet - Unbekannte Titel.mp3",
            "transcripts": [
              "01 - Unbekannte Interpet - Unbekannte Titel.de.md"
            ]
          },
          {
            "base": "20250421_125103",
            "baseItem": "20250421_125103.jpg"
          },
          {
            "base": "Asana Tickets mit Billomat Aufträge verbinden",
            "baseItem": "Asana Tickets mit Billomat Aufträge verbinden.m4a",
            "transcripts": [
              "Asana Tickets mit Billomat Aufträge verbinden.de.md"
            ]
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe"
          },
          {
            "base": "Common Knowledge Scout (Offline) Setup 1.0.0.exe",
            "baseItem": "Common Knowledge Scout (Offline) Setup 1.0.0.exe.blockmap"
          },
          {
            "base": "Computergestütztes Denken",
            "baseItem": "Computergestütztes Denken.md"
          },
          {
            "base": "DeepSeek in der Praxis-Analyse _ heise online",
            "baseItem": "DeepSeek in der Praxis-Analyse _ heise online.pdf"
          },
          {
            "base": "Diva Shoplösungen.Besprechung__shadow_RGl2YSBTaG9wbMO2c3VuZ2VuLkJlc3ByZWNodW5nLmRlLm1k",
            "baseItem": "Diva Shoplösungen.Besprechung.de.md"
          },
          {
            "base": "Diva Shoplösungen",
            "baseItem": "Diva Shoplösungen.m4a",
            "transcripts": [
              "Diva Shoplösungen.de.md"
            ]
          },
          {
            "base": "Diva Shoplösungen(1)",
            "baseItem": "Diva Shoplösungen(1).md"
          },
          {
            "base": "IMG-20250503-WA0004",
            "baseItem": "IMG-20250503-WA0004.jpg"
          },
          {
            "base": "Kombinierte_Transformation_2025-07-06T16-55-52",
            "baseItem": "Kombinierte_Transformation_2025-07-06T16-55-52.md"
          },
          {
            "base": "Paul Lindberg",
            "baseItem": "Paul Lindberg.md"
          },
          {
            "base": "Präsentation Innovationsabteilung_09.07.2025",
            "baseItem": "Präsentation Innovationsabteilung_09.07.2025.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung",
            "baseItem": "Präsentation Innovationsabteilung.pptx"
          },
          {
            "base": "Präsentation Innovationsabteilung2",
            "baseItem": "Präsentation Innovationsabteilung2.pptx"
          },
          {
            "base": "Präsentation Knowledge Scout NOI Developers Thursday",
            "baseItem": "Präsentation Knowledge Scout NOI Developers Thursday.pptx"
          },
          {
            "base": "Prioritäten Mai",
            "baseItem": "Prioritäten Mai.md"
          },
          {
            "base": "Quartalssitzung",
            "baseItem": "Quartalssitzung.m4a"
          },
          {
            "base": "Swiss Goverment Cloud",
            "baseItem": "Swiss Goverment Cloud.docx"
          },
          {
            "base": "This Simple AI-powered Python Script will Completely Change How You Work",
            "baseItem": "This Simple AI-powered Python Script will Completely Change How You Work.md"
          },
          {
            "base": "Transcript Quartalssitzung",
            "baseItem": "Transcript Quartalssitzung.m4a"
          }
        ]
      },
      "id": "1756203830973-lrr9u65dk",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.881Z",
      "area": "state",
      "sequence": 77,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 20791.6
      },
      "id": "1756203830882-13tkpshpf",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.881Z",
      "area": "state",
      "sequence": 76,
      "component": "Library",
      "level": "info",
      "message": "Items loaded successfully",
      "details": {
        "folderId": "root",
        "itemCount": 46,
        "fileCount": 26,
        "folderCount": 20,
        "tSinceMountMs": 20791.6
      },
      "id": "1756203830882-dpxi33kot",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.856Z",
      "area": "state",
      "sequence": 74,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "Fosdem",
        "activeLibraryIdAtom": "Fosdem"
      },
      "id": "1756203830862-z7b8d3g79",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.842Z",
      "area": "nav",
      "sequence": 57,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830857-dzzzzgcbe",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.842Z",
      "area": "nav",
      "sequence": 56,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830857-w6x5qdiif",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.831Z",
      "area": "nav",
      "sequence": 55,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830857-38hixjq98",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.831Z",
      "area": "nav",
      "sequence": 54,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830857-kekf3olcq",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.831Z",
      "area": "file",
      "sequence": 127,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756203830856-ja9wbqfnq",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.820Z",
      "area": "nav",
      "sequence": 53,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830856-nncquvzzz",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.819Z",
      "area": "nav",
      "sequence": 52,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830856-2ei9etjpz",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.808Z",
      "area": "file",
      "sequence": 126,
      "component": "FileList",
      "level": "debug",
      "message": "Already initialized",
      "details": {},
      "id": "1756203830856-3iz31ebps",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.801Z",
      "area": "nav",
      "sequence": 51,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830856-ujqhjry7p",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.801Z",
      "area": "nav",
      "sequence": 50,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830856-xjv96aj4r",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.801Z",
      "area": "file",
      "sequence": 125,
      "component": "FileList",
      "level": "info",
      "message": "Initialization complete",
      "details": {},
      "id": "1756203830856-1xcrp3zdy",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.801Z",
      "area": "file",
      "sequence": 124,
      "component": "FileList",
      "level": "info",
      "message": "Starting initialization",
      "details": {},
      "id": "1756203830856-ruwtszuhf",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.791Z",
      "area": "file",
      "sequence": 123,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756203830856-sbrolvy56",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.782Z",
      "area": "nav",
      "sequence": 49,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830856-ibba16slv",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.782Z",
      "area": "nav",
      "sequence": 48,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - triggering load after reset",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830856-muucp9lmt",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "state",
      "sequence": 72,
      "component": "Library",
      "level": "info",
      "message": "Active library changed - reset initial load state",
      "details": {
        "activeLibraryId": "Fosdem",
        "currentFolderId": "root"
      },
      "id": "1756203830856-cp1knraqi",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "nav",
      "sequence": 47,
      "component": "Library",
      "level": "info",
      "message": "Fetching items from provider",
      "details": {
        "folderId": "root",
        "cacheHit": false
      },
      "id": "1756203830856-wopsp68fh",
      "remarks": "Duplicate (6x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "nav",
      "sequence": 46,
      "component": "Library",
      "level": "info",
      "message": "Loading initial items",
      "details": {
        "folderId": "root"
      },
      "id": "1756203830856-vhb2es8f5",
      "remarks": "Duplicate (5x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "state",
      "sequence": 70,
      "component": "FileList",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "Fosdem"
      },
      "id": "1756203830856-qtulbwj0h",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "state",
      "sequence": 69,
      "component": "FileList",
      "level": "debug",
      "message": "Render",
      "details": {
        "currentLibraryId": "Fosdem",
        "activeLibraryIdAtom": "Fosdem"
      },
      "id": "1756203830856-zf8sbpx37",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.781Z",
      "area": "file",
      "sequence": 122,
      "component": "FileTree",
      "level": "info",
      "message": "Bibliothek gewechselt - State zurückgesetzt",
      "details": {
        "libraryId": "Fosdem"
      },
      "id": "1756203830856-vf8uxyjbu",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.758Z",
      "area": "file",
      "sequence": 121,
      "component": "FileList",
      "level": "debug",
      "message": "Gruppierung Ergebnis (Basename, alle Endungen)",
      "details": {
        "groups": []
      },
      "id": "1756203830850-fudly8tui",
      "remarks": "Duplicate (2x)",
      "isDuplicate": true
    },
    {
      "timestamp": "2025-08-26T10:23:50.740Z",
      "area": "state",
      "sequence": 68,
      "component": "LibrarySwitcher",
      "level": "info",
      "message": "Bibliothek geändert zu",
      "details": {
        "libraryId": "Fosdem"
      },
      "id": "1756203830850-ka9o309vj",
      "remarks": "",
      "isDuplicate": false
    },
    {
      "timestamp": "2025-08-26T10:23:50.739Z",
      "area": "state",
      "sequence": 67,
      "component": "LibrarySwitcher",
      "level": "debug",
      "message": "Speichere activeLibraryId im localStorage",
      "details": {
        "value": "Fosdem"
      },
      "id": "1756203830850-y0aqa02r7",
      "remarks": "",
      "isDuplicate": false
    }
  ]
}

---

**Cursor**

Ich verhindere jetzt doppelte Loads beim Bibliothekswechsel: 1) entferne den unmittelbaren loadItems()-Aufruf im `Library`-Effect auf `activeLibraryId`, 2) füge einen Reentrancy-Guard via Ref hinzu, damit parallele/mehrfache Triggers im Initial-Load-Effekt ignoriert werden. Danach prüfe ich den Linter.

```typescriptreact
"use client"

import * as React from "react"
import { useCallback, useEffect } from "react"
import { useAtom, useAtomValue } from "jotai"

import { LibraryHeader } from "./library-header"
import { FileTree } from "./file-tree"
import { FileList } from "./file-list"
import dynamic from 'next/dynamic'
const FilePreviewLazy = dynamic(() => import('./file-preview').then(m => m.FilePreview), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Lade Vorschau...
    </div>
  )
})
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { 
  libraryAtom, 
  folderItemsAtom,
  loadingStateAtom,
  lastLoadedFolderAtom,
  currentFolderIdAtom,
  reviewModeAtom,
  selectedFileAtom,
  selectedShadowTwinAtom
} from "@/atoms/library-atom"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage, isStorageError } from "@/contexts/storage-context"
import { TranscriptionDialog } from "./transcription-dialog"
import { TransformationDialog } from "./transformation-dialog"
import { StorageItem } from "@/lib/storage/types"
import { NavigationLogger, StateLogger, UILogger } from "@/lib/debug/logger"
import { Breadcrumb } from "./breadcrumb"
import { useToast } from "@/components/ui/use-toast"
import { ChevronLeft, ChevronRight } from "lucide-react"
export function Library() {
  // Performance-Messung für Kaltstart (nur Client)
  const startupT0Ref = React.useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  // Globale Atoms
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const [, setLoadingState] = useAtom(loadingStateAtom);
  const [lastLoadedFolder, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [libraryState, setLibraryState] = useAtom(libraryAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // Review-Mode Atoms
  const [isReviewMode] = useAtom(reviewModeAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedShadowTwin, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);
  
  // Storage Context
  const { 
    provider: providerInstance, 
    error: storageError, 
    listItems,
    libraryStatus,
    currentLibrary
  } = useStorage();
  const { toast } = useToast();
  const [isTreeVisible, setIsTreeVisible] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [mobileView, setMobileView] = React.useState<'list' | 'preview'>('list');
  const loadInFlightRef = React.useRef<boolean>(false);

  // Mobile: Tree standardmäßig ausblenden, Desktop: anzeigen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop ab 1024px, Mobile darunter
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      setIsMobile(matches);
      setIsTreeVisible(!matches);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-View Wechsellogik: bei Dateiauswahl zur Vorschau wechseln
  React.useEffect(() => {
    if (!isMobile) return;
    if (selectedFile) setMobileView('preview');
  }, [isMobile, selectedFile]);

  // Optimierter loadItems mit Cache-Check
  const loadItems = useCallback(async () => {
    if (loadInFlightRef.current) {
      NavigationLogger.debug('Library', 'Skip loadItems - load already in flight');
      return;
    }
    if (!providerInstance || libraryStatus !== 'ready') {
      NavigationLogger.debug('Library', 'Skipping loadItems - not ready', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    loadInFlightRef.current = true;
    setLoadingState({ isLoading: true, loadingFolderId: currentFolderId });

    try {
      // Prüfe Cache zuerst
      if (libraryState.folderCache?.[currentFolderId]?.children) {
        const cachedItems = libraryState.folderCache[currentFolderId].children;
        NavigationLogger.info('Library', 'Using cached items', {
          folderId: currentFolderId,
          itemCount: cachedItems.length,
          cacheHit: true
        });
        setFolderItems(cachedItems);
        setLastLoadedFolder(currentFolderId);
        return;
      }

      NavigationLogger.info('Library', 'Fetching items from provider', {
        folderId: currentFolderId,
        cacheHit: false
      });
      
      const items = await listItems(currentFolderId);
      
      // Update Cache und State
      if (currentFolderId !== 'root') {
        const newFolderCache = { ...libraryState.folderCache };
        const parent = newFolderCache[currentFolderId];
        if (parent) {
          newFolderCache[currentFolderId] = {
            ...parent,
            children: items
          };
          StateLogger.info('Library', 'Updating folder cache', {
            folderId: currentFolderId,
            itemCount: items.length,
            cacheSize: Object.keys(newFolderCache).length
          });
          setLibraryState(state => ({
            ...state,
            folderCache: newFolderCache
          }));
        }
      }
      
      setFolderItems(items);
      setLastLoadedFolder(currentFolderId);
      
      StateLogger.info('Library', 'Items loaded successfully', {
        folderId: currentFolderId,
        itemCount: items.length,
        fileCount: items.filter(i => i.type === 'file').length,
        folderCount: items.filter(i => i.type === 'folder').length,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      
    } catch (error) {
      if (isStorageError(error) && error.code === 'AUTH_REQUIRED') {
        StateLogger.info('Library', 'Auth required');
        // Keine Fehlermeldung für AUTH_REQUIRED anzeigen
      } else {
        StateLogger.error('Library', 'Failed to load items', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
          } : error,
          folderId: currentFolderId,
          libraryId: currentLibrary?.id,
          libraryPath: currentLibrary?.path
        });
        
        // Benutzerfreundliche Fehlermeldung anzeigen
        let errorMessage = 'Fehler beim Laden der Dateien';
        
        if (error instanceof Error) {
          if (error.message.includes('Nicht authentifiziert')) {
            errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher.';
          } else if (error.message.includes('Bibliothek nicht gefunden')) {
            errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
          } else if (error.message.includes('Server-Fehler')) {
            errorMessage = 'Server-Fehler beim Laden der Dateien. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
          } else if (error.message.includes('Keine aktive Bibliothek')) {
            errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
          } else {
            errorMessage = error.message;
          }
        }
        
        // Toast-Nachricht anzeigen
        toast({
          title: "Fehler beim Laden der Dateien",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setFolderItems([]);
    } finally {
      setLoadingState({ isLoading: false, loadingFolderId: null });
      loadInFlightRef.current = false;
    }
  }, [
    currentFolderId,
    lastLoadedFolder,
    listItems,
    libraryState.folderCache,
    providerInstance,
    libraryStatus,
    setLibraryState,
    setFolderItems,
    setLastLoadedFolder,
    setLoadingState,
    toast,
    currentLibrary
  ]);

  // Effect für Initial-Load (entkoppelt vom FileTree)
  useEffect(() => {
    const isReady = !!providerInstance && libraryStatus === 'ready';
    
    if (!isReady) {
      NavigationLogger.debug('Library', 'Waiting for initialization', {
        hasProvider: !!providerInstance,
        status: libraryStatus
      });
      return;
    }

    // Nur laden wenn noch nicht geladen
    if (lastLoadedFolder !== currentFolderId && !loadInFlightRef.current) {
      UILogger.info('Library', 'Initial load triggered', {
        currentFolderId,
        lastLoadedFolder,
        tSinceMountMs: startupT0Ref.current ? Number((performance.now() - startupT0Ref.current).toFixed(1)) : undefined
      });
      NavigationLogger.info('Library', 'Loading initial items', {
        folderId: currentFolderId
      });
      loadItems();
    }
  }, [providerInstance, libraryStatus, currentFolderId, lastLoadedFolder, activeLibraryId, loadItems]);

  // Zusätzlicher Reset bei Bibliothekswechsel (robust gegen Status-Race)
  useEffect(() => {
    if (!activeLibraryId) return;
    StateLogger.info('Library', 'Active library changed - reset initial load state', {
      activeLibraryId,
      currentFolderId
    });
    setLastLoadedFolder(null);
    setFolderItems([]);
    setLibraryState(state => ({ ...state, folderCache: {} }));
  }, [activeLibraryId, setLastLoadedFolder, setFolderItems, setLibraryState, currentFolderId]);

  // Reset Cache wenn sich die Library ändert
  useEffect(() => {
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
  }, [libraryStatus, setLibraryState, setLastLoadedFolder]);

  // Manuelle Cache-Clear-Funktion für Review-Modus
  const clearCache = useCallback(() => {
    StateLogger.info('Library', 'Manually clearing cache for review mode');
    setLastLoadedFolder(null);
    setLibraryState(state => ({
      ...state,
      folderCache: {}
    }));
    setFolderItems([]);
  }, [setLibraryState, setLastLoadedFolder, setFolderItems]);

  // Reset selectedShadowTwin wenn Review-Modus verlassen wird
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedShadowTwin(null);
    }
  }, [isReviewMode, setSelectedShadowTwin]);

  // ENTFERNT: Der folgende useEffect war problematisch und hat das Shadow-Twin 
  // bei jedem Klick zurückgesetzt, auch wenn die Datei ein Shadow-Twin hat.
  // Die Shadow-Twin-Logik wird bereits korrekt in der FileList-Komponente 
  // in der handleSelect-Funktion behandelt.

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    );
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LibraryHeader
        provider={providerInstance}
        error={storageError}
        onUploadComplete={loadItems}
        onClearCache={clearCache}
      >
        <Breadcrumb />
      </LibraryHeader>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {isReviewMode ? (
          // Review-Layout: 3 Panels ohne FileTree - FileList (compact) | FilePreview (Basis-Datei) | FilePreview (Shadow-Twin)
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={20} className="min-h-0">
              <div className="h-full overflow-auto flex flex-col">
                <FileList compact={true} />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedFile ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedFile}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                    StateLogger.info('Library', 'FilePreview (Basis) onRefreshFolder aufgerufen', {
                      folderId,
                      itemsCount: items.length,
                      hasSelectFile: !!selectFileAfterRefresh
                    });
                    
                    // Aktualisiere die Dateiliste
                    setFolderItems(items);
                    
                    // Aktualisiere den Cache
                    if (libraryState.folderCache?.[folderId]) {
                      const cachedFolder = libraryState.folderCache[folderId];
                      if (cachedFolder) {
                        setLibraryState(state => ({
                          ...state,
                          folderCache: {
                            ...(state.folderCache || {}),
                            [folderId]: {
                              ...cachedFolder,
                              children: items
                            }
                          }
                        }));
                      }
                    }
                    
                    // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                    if (selectFileAfterRefresh) {
                      StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                        fileId: selectFileAfterRefresh.id,
                        fileName: selectFileAfterRefresh.metadata.name
                      });
                    }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Keine Datei ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={37.5} minSize={30} className="min-h-0">
              <div className="h-full relative flex flex-col">
                {selectedShadowTwin ? (
                  <FilePreviewLazy
                    provider={providerInstance}
                    file={selectedShadowTwin}
                    onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                      StateLogger.info('Library', 'FilePreview (Shadow-Twin) onRefreshFolder aufgerufen', {
                        folderId,
                        itemsCount: items.length,
                        hasSelectFile: !!selectFileAfterRefresh
                      });
                      
                      // Aktualisiere die Dateiliste
                      setFolderItems(items);
                      
                      // Aktualisiere den Cache
                      if (libraryState.folderCache?.[folderId]) {
                        const cachedFolder = libraryState.folderCache[folderId];
                        if (cachedFolder) {
                          setLibraryState(state => ({
                            ...state,
                            folderCache: {
                              ...(state.folderCache || {}),
                              [folderId]: {
                                ...cachedFolder,
                                children: items
                              }
                            }
                          }));
                        }
                      }
                      
                      // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
                      if (selectFileAfterRefresh) {
                        StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                          fileId: selectFileAfterRefresh.id,
                          fileName: selectFileAfterRefresh.metadata.name
                        });
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Kein Shadow-Twin ausgewählt</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          // Normal-Layout (Desktop) oder alternierendes Mobile-Layout
          <div className="relative h-full">
            {/* Floating toggle handle - nur Desktop */}
            <button
              type="button"
              onClick={() => setIsTreeVisible(v => !v)}
              className="hidden lg:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full border bg-background/80 shadow-sm hover:bg-background"
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
            >
              {isTreeVisible ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isMobile ? (
              mobileView === 'list' ? (
                <div className="h-full overflow-auto flex flex-col">
                  <FileList />
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-background">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      onClick={() => {
                        setMobileView('list');
                        setSelectedShadowTwin(null);
                        setSelectedFile(null);
                        loadItems();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </button>
                    <div className="text-sm text-muted-foreground truncate">
                      {selectedFile?.metadata.name}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        setFolderItems(items);
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: { ...cachedFolder, children: items }
                              }
                            }));
                          }
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full" autoSaveId="library-panels">
                {isTreeVisible && (
                  <>
                    <ResizablePanel id="tree" defaultSize={20} minSize={15} className="min-h-0">
                      <div className="h-full overflow-auto flex flex-col">
                        <FileTree />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel id="list" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full overflow-auto flex flex-col">
                    <FileList />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="preview" defaultSize={isTreeVisible ? 40 : 50} className="min-h-0">
                  <div className="h-full relative flex flex-col">
                    {selectedFile ? (
                      <FilePreviewLazy
                        provider={providerInstance}
                        onRefreshFolder={(folderId, items, selectFileAfterRefresh) => {
                        StateLogger.info('Library', 'FilePreview onRefreshFolder aufgerufen', {
                          folderId,
                          itemsCount: items.length,
                          hasSelectFile: !!selectFileAfterRefresh
                        });
                        
                        // Aktualisiere die Dateiliste
                        setFolderItems(items);
                        
                        // Aktualisiere den Cache
                        if (libraryState.folderCache?.[folderId]) {
                          const cachedFolder = libraryState.folderCache[folderId];
                          if (cachedFolder) {
                            setLibraryState(state => ({
                              ...state,
                              folderCache: {
                                ...(state.folderCache || {}),
                                [folderId]: {
                                  ...cachedFolder,
                                  children: items
                                }
                              }
                            }));
                          }
                        }
                        
                        if (selectFileAfterRefresh) {
                          StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
                            fileId: selectFileAfterRefresh.id,
                            fileName: selectFileAfterRefresh.metadata.name
                          });
                        }
                        }}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p>Keine Datei ausgewählt</p>
                      </div>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
      
      {/* Dialoge */}
      <TranscriptionDialog />
      <TransformationDialog 
        onRefreshFolder={(folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => {
          StateLogger.info('Library', 'TransformationDialog onRefreshFolder aufgerufen', {
            folderId,
            itemsCount: items.length,
            hasSelectFile: !!selectFileAfterRefresh
          });
          
          // Aktualisiere die Dateiliste
          setFolderItems(items);
          
          // Aktualisiere den Cache
          if (libraryState.folderCache?.[folderId]) {
            const cachedFolder = libraryState.folderCache[folderId];
            if (cachedFolder) {
              setLibraryState(state => ({
                ...state,
                folderCache: {
                  ...(state.folderCache || {}),
                  [folderId]: {
                    ...cachedFolder,
                    children: items
                  }
                }
              }));
            }
          }
          
          // Wenn eine Datei ausgewählt werden soll (nach dem Speichern)
          if (selectFileAfterRefresh) {
            StateLogger.info('Library', 'Wähle gespeicherte Datei aus', {
              fileId: selectFileAfterRefresh.id,
              fileName: selectFileAfterRefresh.metadata.name
            });
          }
        }}
      />
    </div>
  );
}
```

Kurzupdate: Ich habe die Doppel-Initialisierung beim Bibliothekswechsel unterbunden.

Änderungen:
- `src/components/library/library.tsx`
  - Reentrancy-Guard `loadInFlightRef` in `loadItems()` eingeführt.
  - Initial-Load-Effect lädt nur, wenn kein Load in-flight ist.
  - Sofortiger Reload im Library-Wechsel-Effect entfernt; nur Reset bleibt, Load übernimmt der Initial-Load-Effect.
- `src/components/library/library-switcher.tsx` bleibt mit dem sofortigen UI-Reset (leere Liste, `currentFolderId='root'`, `lastLoadedFolder=null`).

Erwartetes Verhalten:
- Beim Wechsel wird die alte Liste nicht mehr kurz angezeigt.
- Es gibt nur noch einen „Loading initial items“/„Items loaded successfully“-Zyklus.
- Keine mehrfachen „Fetching items from provider“-Logs für denselben Ordner zeitgleich.

Bitte noch einmal Library wechseln und schauen, ob die Duplikate in den Logs verschwinden.

---

**User**

Der Librarywechsel landet bei mobile Ansicht im Menü, in diesem Hamburger Menü. Das möchte ich nicht. Es sollte immer oben sichtbar bleiben. Es ist ja genügend Platz. Rechtsbündig, links neben dem Profil-Icon. Und vielleicht könnt ihr das trotzdem ein bisschen schmälern.

---

**Cursor**

Ich suche die Header-Komponente, um den `LibrarySwitcher` dauerhaft in die Topbar zu verschieben und zu stylen. Danach passe ich Layout und Responsive-Regeln an.

```typescriptreact
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { Moon, Sun, Settings, Plus, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { useAtom } from "jotai"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { libraryAtom } from "@/atoms/library-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


// Öffentliche Navigationselemente (immer sichtbar)
const publicNavItems = [
  {
    name: "Home",
    href: "/",
  },
  {
    name: "Docs",
    href: "/docs/index.html",
  },
];

// Geschützte Navigationselemente (nur für angemeldete Benutzer)
const protectedNavItems = [
  {
    name: "Bibliothek",
    href: "/library",
  },
  {
    name: "Templates",
    href: "/templates",
  },
  {
    name: "Event-Monitor",
    href: "/event-monitor",
  },
  {
    name: "Session-Manager",
    href: "/session-manager",
  },
];

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
  // Statt Events verwenden wir Jotai
  const [libraryContext] = useAtom(libraryAtom)
  const { libraries } = libraryContext
  


  const [open, setOpen] = React.useState(false)

  return (
    <>
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          {/* Hamburger links, bis <lg sichtbar */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden mr-2" aria-label="Menü">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Menü</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {publicNavItems.concat(protectedNavItems).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      pathname === item.href ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="pt-3 border-t" />
                {/* Settings + Dark Mode im Menü */}
                <SignedIn>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => { setOpen(false); router.push('/settings') }}
                    >
                      <Settings className="h-4 w-4 mr-2" /> Einstellungen
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    >
                      <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span className="ml-6">Dark Mode</span>
                    </Button>
                  </div>
                </SignedIn>
              </div>
            </SheetContent>
          </Sheet>

          <ScrollArea className="max-w-[600px] lg:max-w-none hidden lg:block">
            <div className="flex items-center space-x-4">
              {/* Öffentliche Navigationselemente - immer sichtbar */}
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Geschützte Navigationselemente - nur für angemeldete Benutzer */}
              <SignedIn>
                {protectedNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                      pathname === item.href
                        ? "bg-muted text-primary"
                        : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </SignedIn>
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
          <div className="ml-auto flex items-center space-x-2">
            {/* Bibliotheks-Switcher - immer sichtbar, rechtsbündig */}
            <SignedIn>
              {libraries.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-[160px] sm:w-[180px] md:w-[200px]">
                    <LibrarySwitcher />
                  </div>
                  
                  {/* Zahnrad-Symbol für Einstellungen */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push('/settings')}
                          className={cn(
                            "rounded-full",
                            pathname?.startsWith('/settings') && "bg-muted"
                          )}
                        >
                          <Settings className="h-[1.2rem] w-[1.2rem]" />
                          <span className="sr-only">Bibliothekseinstellungen</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bibliothekseinstellungen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                /* Neue Bibliothek Button für Benutzer ohne Bibliotheken */
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={() => router.push('/settings?newUser=true')}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Neue Bibliothek
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Erste Bibliothek erstellen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Zahnrad-Symbol für Einstellungen */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push('/settings')}
                          className={cn(
                            "rounded-full",
                            pathname?.startsWith('/settings') && "bg-muted"
                          )}
                        >
                          <Settings className="h-[1.2rem] w-[1.2rem]" />
                          <span className="sr-only">Bibliothekseinstellungen</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bibliothekseinstellungen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </SignedIn>
            
            {/* Theme Toggle nur Desktop */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="default" size="sm">
                  Anmelden
                </Button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>


    </>
  )
} 
```

Kurzupdate: Ich habe den Library-Switcher fix rechts in die Topbar verschoben und ihn schmaler gemacht. Er erscheint nun nicht mehr im Hamburger-Menü auf Mobile.

Was geändert wurde:
- `src/components/top-nav.tsx`
  - LibrarySwitcher ist jetzt immer sichtbar rechts neben den Icons.
  - Breite responsiv reduziert: `w-[160px] sm:w-[180px] md:w-[200px]`.
  - Aus dem Sheet/Hamburger-Menü entfernt, dort bleiben nur Einstellungen und Dark-Mode.

Bitte kurz auf Mobile/Tablet/Desktop prüfen:
- Switcher oben rechts sichtbar.
- Keine Duplikate im Menü.
- Dropdown funktioniert, keine Layout-Überläufe.

Wenn du ihn noch schmaler wünschst, kann ich auf `w-[140px]` runtergehen oder das `SelectTrigger`-Label stärker truncaten.

---

**User**

können wir diese fehler beheben?

---

**Cursor**

```typescriptreact
'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom, 
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
}

// Memoized file icon component
const FileIconComponent = React.memo(function FileIconComponent({ item }: { item: StorageItem }) {
  const mimeType = item.metadata.mimeType || '';
  if (!mimeType) return <File className="h-4 w-4" />;

  if (mimeType.startsWith('video/')) {
    return <FileVideo className="h-4 w-4" />;
  } else if (mimeType.startsWith('audio/')) {
    return <FileAudio className="h-4 w-4" />;
  } else if (mimeType.startsWith('text/')) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
});

// Pure function for file size formatting
const formatFileSize = (size?: number): string => {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

// Funktion zum Formatieren des Datums
const formatDate = (date?: Date): string => {
  if (!date) return '-';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: '2-digit', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Date(date).toLocaleDateString('de-DE', options);
};

// Entfernt: getFileStem Funktion war unbenutzt

// Sortierbare Kopfzelle Komponente
const SortableHeaderCell = React.memo(function SortableHeaderCell({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort
}: {
  label: string,
  field: SortField,
  currentSortField: SortField,
  currentSortOrder: SortOrder,
  onSort: (field: SortField) => void
}) {
  const isActive = currentSortField === field;
  
  return (
    <button 
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      {isActive && (
        currentSortOrder === 'asc' 
          ? <ChevronUp className="h-3 w-3" /> 
          : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  );
});

interface FileRowProps {
  item: StorageItem;
  isSelected: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  systemFolderId?: string;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false,
  systemFolderId
}: FileRowProps) {
  const navigateToFolder = useFolderNavigation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.metadata.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = React.useRef<number>(0);
  
  // Zusätzliche Validierung der Metadaten
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript || (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0),
    modifiedAt: item.metadata?.modifiedAt
  }), [item.metadata, fileGroup]);

  const isTranscribable = React.useMemo(() => {
    const mimeType = metadata.mimeType.toLowerCase();
    const extension = metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  }, [metadata.mimeType, metadata.name]);

  // Memoize the click handler
  const handleClick = React.useCallback(() => {
    if (!isEditing) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Memoize the keydown handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Handler für Transkript-Icon Click
  const handleTranscriptClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transcriptFiles && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcriptFiles[0]); // Nur das erste Transkript anzeigen
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Handler für Transformierte-Datei-Icon Click
  const handleTransformedClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transformed && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transformed);
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Starte Rename-Modus
  const startRename = React.useCallback(() => {
    if (onRename) {
      // Prüfe ob dies eine abhängige Datei ist
      if (fileGroup && (
        (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles[0]?.id === item.id) ||
        (fileGroup.transformed && item.id === fileGroup.transformed.id)
      )) {
        // Dies ist eine abhängige Datei - zeige Hinweis
        toast.info("Hinweis", {
          description: "Bitte benennen Sie die Haupt-Datei um. Abhängige Dateien werden automatisch mit umbenannt."
        });
        return;
      }
      
      setIsEditing(true);
      setEditName(item.metadata.name);
    }
  }, [onRename, item, fileGroup]);

  // Handler für Dateinamen-Click (Doppelklick-Erkennung)
  const handleNameClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 300) {
      // Doppelklick erkannt
      startRename();
    } else {
      // Erster Klick - wähle die Datei aus
      onSelect();
    }
    
    lastClickTimeRef.current = currentTime;
  }, [startRename, onSelect]);

  // Handler für Long-Press (Touch-Geräte)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Starte Long-Press Timer
    longPressTimerRef.current = setTimeout(() => {
      startRename();
    }, 500); // 500ms für Long-Press
  }, [startRename]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Lösche Long-Press Timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = React.useCallback(() => {
    // Bei Bewegung Long-Press abbrechen
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup Timer bei Unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Handler für Rename-Submit
  const handleRenameSubmit = React.useCallback(async () => {
    if (onRename && editName.trim() && editName !== item.metadata.name) {
      try {
        await onRename(item, editName.trim());
      } catch (error) {
        FileLogger.error('FileRow', 'Fehler beim Umbenennen', error);
        // Bei Fehler den ursprünglichen Namen wiederherstellen
        setEditName(item.metadata.name);
      }
    }
    setIsEditing(false);
  }, [onRename, editName, item]);

  // Handler für Rename-Cancel
  const handleRenameCancel = React.useCallback(() => {
    setEditName(item.metadata.name);
    setIsEditing(false);
  }, [item.metadata.name]);

  // Handler für Input-Änderungen
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  // Handler für Input-Keydown
  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Focus Input wenn Edit-Modus aktiviert wird
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handler für Drag Start
  const handleDragStart = React.useCallback((e: React.DragEvent) => {
    // Sammle alle Dateien der Gruppe, die verschoben werden sollen
    const itemsToMove = [];
    
    // Füge das aktuelle Item hinzu
    itemsToMove.push({
      itemId: item.id,
      itemName: item.metadata.name,
      itemType: item.type,
      parentId: item.parentId
    });
    
    // Wenn es eine FileGroup gibt, füge auch die zugehörigen Dateien hinzu
    if (fileGroup) {
      // Prüfe ob das aktuelle Item die Basis-Datei ist
      if (item.id === fileGroup.baseItem?.id) {
        // Füge Transkripte hinzu, falls vorhanden
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0) {
          fileGroup.transcriptFiles.forEach(transcript => {
            itemsToMove.push({
              itemId: transcript.id,
              itemName: transcript.metadata.name,
              itemType: transcript.type,
              parentId: transcript.parentId
            });
          });
        }
        
        // Füge transformierte Datei hinzu, falls vorhanden
        if (fileGroup.transformed) {
          itemsToMove.push({
            itemId: fileGroup.transformed.id,
            itemName: fileGroup.transformed.metadata.name,
            itemType: fileGroup.transformed.type,
            parentId: fileGroup.transformed.parentId
          });
        }
      }
    }
    
    // Setze die Drag-Daten
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      items: itemsToMove,
      isFileGroup: itemsToMove.length > 1
    }));
    
    // Visuelles Feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [item, fileGroup]);

  // Handler für Drag End
  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    // Stelle Opacity wieder her
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  
  // Prüfe ob das Item in einem der beiden Atome ausgewählt ist
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);
  const isInTransformation = selectedTransformationItems.some(transformationItem => transformationItem.item.id === item.id);
  const isInAnyBatch = isInBatch || isInTransformation;

  // Handler für Checkbox-Änderungen
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    const mediaType = getMediaType(item);
    
    if (mediaType === 'audio' || mediaType === 'video') {
      // Für Audio/Video: Transcription-Atom verwenden
      if (checked) {
        setSelectedBatchItems([...selectedBatchItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
      }
    } else if (mediaType === 'text' || mediaType === 'document') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  React.useEffect(() => {
    if (fileGroup) {
      FileLogger.debug('FileRow', 'Transkripte für Zeile', {
        baseItem: fileGroup.baseItem?.metadata.name,
        transcripts: fileGroup.transcriptFiles?.map(t => t.metadata.name)
      });
    }
  }, [fileGroup]);

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm hover:bg-muted/50 flex items-center gap-2 cursor-pointer",
          isSelected && "bg-muted"
        )}
      >
        <FileIconComponent item={item} />
        <span className="truncate flex-1" title={metadata.name}>
          {metadata.name}
        </span>
        {/* Shadow-Twin-Symbole im compact mode */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleTranscriptClick}
          >
            <ScrollText className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Standard-Modus: vollständige Tabellen-Darstellung
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-move",
        isSelected && "bg-muted"
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInAnyBatch}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <FileIconComponent item={item} />
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 py-0 text-xs"
        />
      ) : (
        <span 
          className="text-left truncate cursor-pointer hover:text-primary select-none"
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title="Doppelklick zum Umbenennen"
        >
          {metadata.name}
        </span>
      )}
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatDate(metadata.modifiedAt)}
      </span>
      <div className="flex items-center justify-start gap-1">
        {/* System-Unterordner (z. B. extrahierte Seiten) */}
        {systemFolderId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(systemFolderId);
                  }}
                >
                  <Layers className="h-4 w-4 text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Seiten-Ordner öffnen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Zeige Icons für alle vorhandenen Transkripte */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles.map((transcript) => (
          <TooltipProvider key={transcript.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelatedFile) onSelectRelatedFile(transcript);
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen: {transcript.metadata.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Plus-Symbol nur anzeigen, wenn kein Transkript vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && isTranscribable && !metadata.hasTranscript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  role="button"
                  tabIndex={0}
                  className="h-6 w-6 p-0 inline-flex items-center justify-center hover:bg-muted rounded-sm"
                  onClick={onCreateTranscript}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onCreateTranscript(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript erstellen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {/* Icon für transformierte Datei */}
        {fileGroup?.transformed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTransformedClick}
                >
                  <ScrollText className="h-4 w-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transformierte Datei anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Delete direkt neben Dokument-Icons */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => onDelete(e as React.MouseEvent<HTMLButtonElement>, item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Datei löschen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div />
    </div>
  );
});

interface FileListProps {
  compact?: boolean;
}

export const FileList = React.memo(function FileList({ compact = false }: FileListProps): JSX.Element {
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Entkoppelt: Kein Warten mehr auf FileTree-Status
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();

  // Mobile-Flag lokal bestimmen, damit FileList unabhängig vom Tree laden kann
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  };

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
  // Review-Mode-Atoms
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung - nur auf Provider und Mobile-Flag achten
  React.useEffect(() => {
    if (!provider) {
      FileLogger.info('FileList', 'Waiting for provider');
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized');
        return;
      }

      FileLogger.info('FileList', 'Starting initialization');

      try {
        FileLogger.info('FileList', 'Initialization complete');
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, [provider, isInitialized]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: activeLibraryId,
      activeLibraryIdAtom: activeLibraryId
    });

    // Nur bei tatsächlichem Bibliothekswechsel zurücksetzen
    if (prevLibraryIdRef.current !== null && prevLibraryIdRef.current !== activeLibraryId) {
      setIsInitialized(false);
      setSelectedFile(null);
      setFolderItems([]);
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
      setSelectedShadowTwin(null);
      StateLogger.info('FileList', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
    prevLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setSelectedFile, setFolderItems, setSelectedBatchItems, setSelectedTransformationItems, setSelectedShadowTwin]);

  // Vereinfachte Funktion zum Extrahieren des Basisnamens (ohne Endung, auch für Binärdateien)
  function getBaseName(name: string): string {
    // ShadowTwin: .de.md, .en.md, etc.
    const shadowTwinMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
    if (shadowTwinMatch) return shadowTwinMatch[1];
    // Sonst: alles vor der letzten Endung
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  function isShadowTwin(name: string): boolean {
    // Pattern: name.de.md, name.en.md, etc.
    const shadowTwinPattern = /^(.+)\.(de|en|fr|es|it)\.md$/;
    return shadowTwinPattern.test(name);
  }

  // Gruppiere die Dateien nach Basename
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    for (const item of items) {
      if (item.type !== 'file') continue;
      const base = getBaseName(item.metadata.name);
      if (!groupsMap.has(base)) groupsMap.set(base, []);
      groupsMap.get(base)!.push(item);
    }

    // Schritt 2: Erstelle FileGroups
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      if (mainFile) {
        fileGroupsMap.set(base, {
          baseItem: mainFile,
          transcriptFiles: shadowTwins.length > 0 ? shadowTwins : undefined,
          transformed: undefined
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${base}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    // Debug-Logging für Gruppierung
    FileLogger.debug('FileList', 'Gruppierung Ergebnis (Basename, alle Endungen)', {
      groups: Array.from(fileGroupsMap.entries()).map(([base, group]) => ({
        base,
        baseItem: group.baseItem?.metadata.name,
        transcripts: group.transcriptFiles?.map(t => t.metadata.name)
      }))
    });
    return fileGroupsMap;
  }, [items]);

  // Mapping: Basename -> dot-Systemordner (z. B. ".<basename>")
  const systemFolderByBase = useMemo(() => {
    const map = new Map<string, StorageItem>();
    const items = allItemsInFolder ?? [];
    for (const it of items) {
      if (it.type !== 'folder') continue;
      const name = it.metadata.name;
      if (!name.startsWith('.')) continue;
      const base = name.slice(1);
      if (base) map.set(base, it);
    }
    return map;
  }, [allItemsInFolder]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroups || !fileGroups.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroups ?? new Map()).values())
      .map(group => group.baseItem)
      .filter((item): item is StorageItem => item !== undefined);
    // Je nach Filter unterschiedliche Dateien zählen
    let selectableItems: StorageItem[] = [];
    switch (currentCategoryFilter) {
      case 'media':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedBatchItems.length === selectableItems.length;
      case 'text':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'text';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      case 'documents':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'document';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      default:
        // Bei 'all' prüfen ob alle verfügbaren Dateien ausgewählt sind
        const mediaItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        const textItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'text' || mediaType === 'document');
          } catch {
            return false;
          }
        });
        const allMediaSelected = mediaItems.length === 0 || selectedBatchItems.length === mediaItems.length;
        const allTextSelected = textItems.length === 0 || selectedTransformationItems.length === textItems.length;
        return allMediaSelected && allTextSelected;
    }
  }, [fileGroups, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    FileLogger.debug('FileList', 'handleSelect aufgerufen', {
      itemId: item.id,
      itemName: item.metadata.name,
      groupBase: group?.baseItem?.metadata.name,
      transcriptCount: group?.transcriptFiles?.length ?? 0,
      hasTranscripts: !!(group && group.transcriptFiles && group.transcriptFiles.length > 0)
    });
    
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // Wenn wir im Review-Modus sind und eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // dann automatisch das Shadow-Twin setzen
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      const shadowTwin = group.transcriptFiles[0];
      FileLogger.info('FileList', 'Basis-Datei mit Shadow-Twin ausgewählt', {
        twinId: shadowTwin.id,
        twinName: shadowTwin.metadata.name,
        baseFileId: item.id,
        baseFileName: item.metadata.name
      });
      setSelectedShadowTwin(shadowTwin);
    } else {
      FileLogger.info('FileList', 'Datei ohne Shadow-Twin ausgewählt', {
        itemId: item.id,
        itemName: item.metadata.name,
        groupExists: !!group,
        transcriptCount: group?.transcriptFiles?.length ?? 0
      });
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!items || items.length === 0) return;
    
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      const refreshedItems = await refreshItems(parentId);
      setFolderItems(refreshedItems);
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, setFolderItems]);

  const handleCreateTranscript = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    FileLogger.info('FileList', 'Create transcript for', { fileName: 'TODO' });
    // TODO: Implement transcript creation
  }, []);

  // Entfernt: handleItemSelect war unbenutzt

  // Check if an item is selected (beide Atome prüfen)
  const isItemSelected = useCallback((item: StorageItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'audio' || mediaType === 'video') {
      return selectedBatchItems.some(selected => selected.item.id === item.id);
    } else {
      return selectedTransformationItems.some(selected => selected.item.id === item.id);
    }
  }, [selectedBatchItems, selectedTransformationItems]);

  // Löschfunktion
  const handleDeleteClick = React.useCallback(async (e: React.MouseEvent<HTMLButtonElement>, itemToDelete: StorageItem) => {
    e.stopPropagation();
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(itemToDelete.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      // Bestätigungsnachricht vorbereiten
      let confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" wirklich löschen?`;
      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 || fileGroup.transformed) {
          confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" und alle zugehörigen Dateien wirklich löschen?`;
        }
      }

      // Benutzer um Bestätigung bitten
      if (!window.confirm(confirmMessage)) {
        return;
      }

      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - lösche auch abhängige Dateien
        // Lösche alle Transkripte, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            try {
              await provider.deleteItem(transcript.id);
              FileLogger.info('FileList', 'Transkript gelöscht', {
                transcriptId: transcript.id,
                transcriptName: transcript.metadata.name
              });
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Löschen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht gelöscht werden"
              });
            }
          }
        }

        // Lösche die transformierte Datei, falls vorhanden
        if (fileGroup.transformed) {
          try {
            await provider.deleteItem(fileGroup.transformed.id);
            FileLogger.info('FileList', 'Transformierte Datei gelöscht', {
              transformedId: fileGroup.transformed.id,
              transformedName: fileGroup.transformed.metadata.name
            });
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Löschen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht gelöscht werden"
            });
          }
        }

        // Lösche die Basis-Datei
        await provider.deleteItem(itemToDelete.id);
        toast.success("Dateien gelöscht", {
          description: `${itemToDelete.metadata.name} und zugehörige Dateien wurden gelöscht.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei löschen
        await provider.deleteItem(itemToDelete.id);
        toast.success("Datei gelöscht", {
          description: `${itemToDelete.metadata.name} wurde gelöscht.`
        });
      }

      // Aktualisiere die Dateiliste
      await handleRefresh();

      // Wenn die gelöschte Datei ausgewählt war, Auswahl aufheben
      setSelectedFile(null);
      
      // Aus der Batch-Auswahl entfernen
      setSelectedBatchItems(prev => prev.filter(i => i.item.id !== itemToDelete.id));

    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Löschen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems]);

  const handleRename = React.useCallback(async (item: StorageItem, newName: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(item.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      if (fileGroup && item.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - benenne auch abhängige Dateien um
        const oldStem = getBaseName(item.metadata.name);
        const newStem = getBaseName(newName);
        // Benenne die Basis-Datei um
        await provider.renameItem(item.id, newName);
        // Benenne alle Transkripte um, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            const transcriptName = transcript.metadata.name;
            const newTranscriptName = transcriptName.replace(oldStem, newStem);
            try {
              await provider.renameItem(transcript.id, newTranscriptName);
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Umbenennen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht umbenannt werden"
              });
            }
          }
        }
        // Benenne die transformierte Datei um, falls vorhanden
        if (fileGroup.transformed) {
          const transformedName = fileGroup.transformed.metadata.name;
          const newTransformedName = transformedName.replace(oldStem, newStem);
          try {
            await provider.renameItem(fileGroup.transformed.id, newTransformedName);
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Umbenennen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht umbenannt werden"
            });
          }
        }
        toast.success("Dateien umbenannt", {
          description: `${item.metadata.name} und zugehörige Dateien wurden umbenannt.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei umbenennen
        await provider.renameItem(item.id, newName);
        toast.success("Datei umbenannt", {
          description: `${item.metadata.name} wurde zu ${newName} umbenannt.`
        });
      }
      await handleRefresh();
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Umbenennen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht umbenannt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
      throw error;
    }
  }, [provider, handleRefresh, fileGroups]);

  const handleBatchTranscription = () => {
    if (selectedBatchItems.length > 0) {
      setTranscriptionDialogOpen(true);
    }
  };

  const handleBatchTransformation = () => {
    if (selectedTransformationItems.length > 0) {
      setTransformationDialogOpen(true);
    }
  };

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroups ?? new Map()).values())
        .map(group => group.baseItem)
        .filter((item): item is StorageItem => item !== undefined);
      const selectableItems = mainItems.filter(item => {
        try {
          const mediaType = getMediaType(item);
          // Je nach Filter unterschiedliche Dateien auswählen
          switch (currentCategoryFilter) {
            case 'media':
              return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
            case 'text':
              return item.type === 'file' && mediaType === 'text';
            case 'documents':
              return item.type === 'file' && mediaType === 'document';
            default:
              // Bei 'all' alle Dateien auswählen, die für eine Operation geeignet sind
              return item.type === 'file' && (
                mediaType === 'audio' || 
                mediaType === 'video' || 
                mediaType === 'text' || 
                mediaType === 'document'
              );
          }
        } catch {
          return false;
        }
      });
      StateLogger.info('FileList', 'Selecting all items based on filter', {
        filter: currentCategoryFilter,
        totalItems: items.length,
        selectableCount: selectableItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      // Je nach Filter unterschiedliche Atome verwenden
      if (currentCategoryFilter === 'media') {
        setSelectedBatchItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else if (currentCategoryFilter === 'text') {
        setSelectedTransformationItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else {
        // Bei 'all' oder 'documents' beide Atome füllen
        const mediaItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'audio' || mediaType === 'video';
        });
        const textItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'text' || mediaType === 'document';
        });
        setSelectedBatchItems(mediaItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
        setSelectedTransformationItems(textItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      }
    } else {
      StateLogger.info('FileList', 'Deselecting all items', {
        previouslySelected: selectedBatchItems.length + selectedTransformationItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
    }
  }, [fileGroups, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen
    const timeoutId = setTimeout(() => {
      StateLogger.debug('FileList', 'Render', {
        currentLibraryId: currentLibrary?.id,
        activeLibraryIdAtom: activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  // Entkoppelt: kein Render-Gate mehr basierend auf FileTree

  return (
    <div className="h-full flex flex-col">
      {/* Header - versteckt im compact mode */}
      {!compact && (
        <div className="border-b px-2 py-2 flex items-center justify-between bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Aktualisieren"
              aria-label="Aktualisieren"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            {/* Dateikategorie-Filter (Icon-only Variante) */}
            <FileCategoryFilter iconOnly />

            {/* Batch-Actions als Icons */}
            {selectedBatchItems.length > 0 && (
              <Button size="icon" title="Transkribieren" aria-label="Transkribieren" onClick={handleBatchTranscription}>
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
        <div>
          {/* Table Header - versteckt im compact mode */}
          {!compact && (
            <div className="sticky top-0 bg-background border-b">
              <div className="grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div className="w-6 flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Alle auswählen"
                  />
                </div>
                <div className="w-6" />
                <SortableHeaderCell
                  label="Name"
                  field="name"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Größe"
                  field="size"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Geändert"
                  field="date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <div />
              </div>
            </div>
          )}

          {/* Folder Rows (oberhalb der Dateien, unabhängig von Datei-Gruppierung) */}
          {folders.length > 0 && (
            <div className="divide-y">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id);
                  }}
                  className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
                >
                  <div />
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-left truncate select-none">{folder.metadata.name}</span>
                  <span className="text-muted-foreground" />
                  <span className="text-muted-foreground" />
                  <div />
                </div>
              ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroups ?? new Map()).values())
              .map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // System-Unterordner-Id, wenn ein ".<basename>"-Folder existiert
                const systemFolder = systemFolderByBase.get(getBaseName(item.metadata.name));
                const systemFolderId = systemFolder?.id;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleSelect(item, group)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                    systemFolderId={systemFolderId}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 
```

```typescriptreact
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, AlertTriangle, Clock, FileCheck, FileX, Files, BookOpenText, Filter } from 'lucide-react'; // 🆕 Filter Icon hinzugefügt
import BatchList from '@/components/event-monitor/batch-list';
import { Batch, Job, JobStatus } from '@/types/event-job';
import JobDetailsPanel from '@/components/event-monitor/job-details-panel';
import BatchArchiveDialog from '@/components/event-monitor/batch-archive-dialog';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { createAllTrackSummaries, SecretaryServiceError } from '@/lib/secretary/client';
import { useAtom } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { selectedEventAtom } from '@/atoms/event-filter-atom'; // 🆕 Event-Filter Atom
import { LANGUAGE_MAP, TEMPLATE_MAP } from '@/lib/secretary/constants';
import EventFilterDropdown from '@/components/event-monitor/event-filter-dropdown';
// JobArchiveTest entfernt - wird durch Job-spezifische Download-Buttons ersetzt

export default function EventMonitorPage() {
  const [currentTracks, setCurrentTracks] = useState<Batch[]>([]);
  const [archiveTracks, setArchiveTracks] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('current');
  const [error, setError] = useState<string | null>(null);
  
  // Job-Details Panel Zustand
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Multi-Batch-Archivierung Zustand
  const [multiBatchArchiveDialogOpen, setMultiBatchArchiveDialogOpen] = useState(false);
  const [multiBatchArchiveJobs, setMultiBatchArchiveJobs] = useState<Job[]>([]);
  
  // Statistiken
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsCompleted, setStatsCompleted] = useState(0);
  const [statsFailed, setStatsFailed] = useState(0);
  
  // Sprachauswahl-Dialog
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("de");
  // Template-Dialog für Zusammenfassungen
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("track_eco_social");
  const [summarizing, setSummarizing] = useState(false);
  
  // Verwende useAtom statt useAtomValue für activeLibraryIdAtom
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);
  const [selectedEvent] = useAtom(selectedEventAtom); // 🆕 Event-Filter State
  
  // Debug-Logging für die aktive Bibliothek
  useEffect(() => {
    console.log('EventMonitor: Aktive Bibliothek:', activeLibraryId || 'keine');
  }, [activeLibraryId]);
  
  const router = useRouter();
  
  // URL für API-Aufrufe erweitern
  const buildApiUrl = useCallback((baseUrl: string, archived: boolean) => {
    const params = new URLSearchParams();
    params.set('archived', archived.toString());
    
    if (selectedEvent) {
      params.set('event', selectedEvent);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }, [selectedEvent]);

  const loadCurrentTracks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      
      const url = buildApiUrl('/api/event-job/batches', false);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentTracks(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der Tracks:', data.message);
        setError(data.message || 'Fehler beim Laden der Tracks');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tracks:', error);
      setError('Fehler beim Laden der Tracks');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [buildApiUrl]);
  
  const loadArchiveTracks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setArchiveLoading(true);
      }
      
      const url = buildApiUrl('/api/event-job/batches', true);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setArchiveTracks(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der archivierten Tracks:', data.message);
        setError(data.message || 'Fehler beim Laden der archivierten Tracks');
      }
    } catch (error) {
      console.error('Fehler beim Laden der archivierten Tracks:', error);
      setError('Fehler beim Laden der archivierten Tracks');
    } finally {
      if (showLoader) {
        setArchiveLoading(false);
      }
    }
  }, [buildApiUrl]);
  
  // Laufende Tracks laden
  useEffect(() => {
    loadCurrentTracks();
    
    // Auto-Refresh Timer einrichten
    let intervalId: NodeJS.Timeout | undefined = undefined;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (activeTab === 'current') {
          loadCurrentTracks(false);
        } else if (activeTab === 'archive') {
          loadArchiveTracks(false);
        }
      }, 10000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, activeTab, selectedEvent, loadArchiveTracks, loadCurrentTracks]); // Dependencies ergänzt
  
  // Statistiken berechnen
  useEffect(() => {
    // Berechnung der Statistiken aus den aktuellen Tracks
    let total = 0;
    let completed = 0;
    let failed = 0;
    
    currentTracks.forEach(track => {
      total += track.total_jobs || 0;
      completed += track.completed_jobs || 0;
      failed += track.failed_jobs || 0;
    });
    
    setStatsTotal(total);
    setStatsCompleted(completed);
    setStatsFailed(failed);
  }, [currentTracks]);
  
  async function handleTabChange(value: string) {
    setActiveTab(value);
    
    if (value === 'archive' && archiveTracks.length === 0) {
      loadArchiveTracks();
    }
  }
  
  async function handleFailAllBatches() {
    if (!window.confirm('Sind Sie sicher, dass Sie alle aktuellen Tracks auf "failed" setzen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/event-job/batches/fail-all', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ confirm: true })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        // Neu laden um Änderungen zu sehen
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Tracks auf Failed:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }
  
  async function handlePendingAllBatches() {
    // Sprachauswahl-Dialog öffnen statt direkter Bestätigung
    setLanguageDialogOpen(true);
  }
  
  async function confirmPendingAll() {
    try {
      setLoading(true);
      setLanguageDialogOpen(false);
      
      const response = await fetch('/api/event-job/batches/pending-all', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          confirm: true,
          targetLanguage: selectedLanguage
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Tracks auf Pending:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSummarizeAllBatches() {
    // Template-Auswahl-Dialog öffnen
    setSummaryDialogOpen(true);
  }
  
  async function confirmSummarizeAll() {
    try {
      // Prüfe ob eine Bibliotheks-ID vorhanden ist
      if (!activeLibraryId) {
        alert('Keine aktive Bibliothek ausgewählt. Bitte wählen Sie zuerst eine Bibliothek aus.');
        setSummaryDialogOpen(false);
        return;
      }
      
      setSummarizing(true);
      setSummaryDialogOpen(false);
      
      console.log('Erstelle Zusammenfassungen für alle Tracks...');
      console.log('Hinweis: Die API verwendet die Track-Namen (nicht die vollständigen Batch-Namen)');
      
      // Verwende die aktive Bibliotheks-ID aus dem Atom-State
      const data = await createAllTrackSummaries(
        selectedLanguage,
        activeLibraryId,
        selectedTemplate,
        false // useCache
      ) as { status: string; summary?: { successful_tracks: number; failed_tracks: number }; error?: { message: string } };
      
      if (data.status === 'success') {
        alert(`Erfolgreich: ${data.summary?.successful_tracks ?? 0} Tracks zusammengefasst, ${data.summary?.failed_tracks ?? 0} fehlgeschlagen.`);
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.error?.message || 'Unbekannter Fehler bei der Erstellung der Zusammenfassungen'}`);
      }
    } catch (error) {
      console.error('Fehler bei der Erstellung der Zusammenfassungen:', error);
      if (error instanceof SecretaryServiceError) {
        alert(`Secretary Service Fehler: ${error.message}`);
      } else {
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setSummarizing(false);
    }
  }
  
  const handleJobDetailsPanelChange = (open: boolean) => {
    setJobDetailsOpen(open);
    if (!open) {
      // Nach dem Schließen den ausgewählten Job zurücksetzen
      setSelectedJobId(null);
    }
  };

  // Multi-Batch-Archivierung: Alle Jobs aus gefilterten Batches laden
  const handleArchiveAllFilteredBatches = async () => {
    if (!selectedEvent) {
      alert('Kein Event gefiltert. Bitte filtern Sie zuerst nach einem Event.');
      return;
    }

    if (currentTracks.length === 0) {
      alert('Keine Batches zum Archivieren gefunden.');
      return;
    }

    try {
      // Alle Jobs aus allen gefilterten Batches laden
      const allJobs: Job[] = [];
      
      for (const batch of currentTracks) {
        try {
          const response = await fetch(`/api/event-job/batches/${batch.batch_id}/jobs?limit=1000`);
          const data = await response.json();
          
          if (data.status === 'success') {
            const batchJobs = data.data.jobs || [];
            // Nur COMPLETED Jobs mit Archiven
            const completedJobsWithArchives = batchJobs.filter((job: Job) => 
              job.status === JobStatus.COMPLETED && job.results?.archive_data
            );
            allJobs.push(...completedJobsWithArchives);
          }
        } catch (error) {
          console.error(`Fehler beim Laden der Jobs für Batch ${batch.batch_id}:`, error);
        }
      }

      console.log(`[Multi-Batch Archive] Gefundene Jobs:`, {
        totalBatches: currentTracks.length,
        totalJobs: allJobs.length,
        jobsWithArchives: allJobs.filter(job => job.results?.archive_data).length
      });

      setMultiBatchArchiveJobs(allJobs);
      setMultiBatchArchiveDialogOpen(true);

    } catch (error) {
      console.error('Fehler beim Laden der Jobs für Multi-Batch-Archivierung:', error);
      alert('Fehler beim Laden der Jobs. Bitte versuchen Sie es erneut.');
    } finally {
      // Loading state removed
    }
  };

  // Multi-Batch-Archivierung abgeschlossen
  const handleMultiBatchArchiveComplete = (result: { 
    success: Array<{ jobId: string; sessionName: string; filesCreated: number; markdownPath: string; assetsPath: string }>; 
    failed: Array<{ jobId: string; sessionName: string; error: string }>; 
    totalFiles: number 
  }) => {
    setMultiBatchArchiveDialogOpen(false);
    setMultiBatchArchiveJobs([]);
    
    // Erfolgs-Toast oder Notification
    if (result.success.length > 0) {
      const successMessage = `${result.success.length} Sessions erfolgreich in Library gespeichert. ${result.totalFiles} Dateien erstellt.`;
      if (result.failed.length > 0) {
        alert(`${successMessage}\n\n${result.failed.length} Session(s) fehlgeschlagen: ${result.failed.map(f => f.sessionName).join(', ')}`);
      } else {
        alert(successMessage);
      }
    } else if (result.failed.length > 0) {
      alert(`Alle ${result.failed.length} Sessions sind fehlgeschlagen: ${result.failed.map(f => f.error).join(', ')}`);
    } else {
      alert('Keine Sessions gefunden zum Verarbeiten.');
    }
  };
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Event-Track-Monitor</h1>
          
          {/* 🆕 Event-Filter Dropdown */}
          <EventFilterDropdown 
            className="border-l pl-4 pr-4"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => router.push('/event-monitor/create-batch')} 
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Track erstellen
          </Button>
          
          <Button 
            onClick={handleFailAllBatches} 
            variant="destructive" 
            size="sm"
            disabled={loading}
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Alle auf Failed
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
            onClick={handlePendingAllBatches}
            disabled={loading}
          >
            <Clock className="w-4 h-4 mr-2" /> Alle auf Pending
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={handleSummarizeAllBatches}
            disabled={loading || summarizing || !activeLibraryId}
            title={!activeLibraryId ? "Bitte wählen Sie zuerst eine Bibliothek aus" : "Zusammenfassung für alle Tracks erstellen"}
          >
            {summarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpenText className="w-4 h-4 mr-2" />} Alle zusammenfassen
          </Button>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Auto-Refresh (10s)</span>
            </label>
            
            <Button 
              onClick={() => activeTab === 'current' ? loadCurrentTracks() : loadArchiveTracks()} 
              variant="outline" 
              size="sm" 
              disabled={loading || archiveLoading}
            >
              {(loading || archiveLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Event-Filter Status anzeigen */}
      {selectedEvent && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-800 dark:text-blue-300">
              Gefiltert nach Event: <strong>{selectedEvent}</strong>
            </span>
          </div>
        </div>
      )}
      
      {/* Statistiken */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            <Files className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Gesamt</div>
            <div className="text-2xl font-bold">{statsTotal}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Erfolgreich</div>
            <div className="text-2xl font-bold">{statsCompleted}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <FileX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Fehlerhaft</div>
            <div className="text-2xl font-bold">{statsFailed}</div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* Archive-Test-Komponente entfernt - Download-Buttons sind jetzt direkt bei den Jobs integriert */}
      
      <Tabs 
        defaultValue="current" 
        onValueChange={handleTabChange}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="current">
            Aktuelle Tracks 
            <span className="ml-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {currentTracks.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="archive">
            Archiv
            {archiveTracks.length > 0 && (
              <span className="ml-2 bg-gray-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {archiveTracks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : currentTracks.length > 0 ? (
            <BatchList 
              batches={currentTracks} 
              onRefresh={loadCurrentTracks}
              selectedEvent={selectedEvent || undefined}
              onArchiveAllBatches={handleArchiveAllFilteredBatches}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine aktuellen Tracks gefunden.</p>
              <Button 
                onClick={() => router.push('/event-monitor/create-batch')} 
                variant="outline" 
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" /> Ersten Track erstellen
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="archive" className="space-y-4">
          {archiveLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : archiveTracks.length > 0 ? (
            <BatchList 
              batches={archiveTracks} 
              onRefresh={loadArchiveTracks} 
              isArchive={true}
              selectedEvent={selectedEvent || undefined}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine archivierten Tracks gefunden.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Job-Details Seitenleiste */}
      <JobDetailsPanel 
        isOpen={jobDetailsOpen} 
        onOpenChange={handleJobDetailsPanelChange} 
        jobId={selectedJobId}
        onRefresh={() => activeTab === 'current' ? loadCurrentTracks() : loadArchiveTracks()}
      />
      
      {/* Sprachauswahl-Dialog */}
      <Dialog 
        open={languageDialogOpen} 
        onOpenChange={(open) => {
          if (!loading) setLanguageDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zielsprache auswählen</DialogTitle>
            <DialogDescription>
              Wählen Sie die Zielsprache, die für alle Jobs gesetzt werden soll.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="language-select" className="mb-2 block">Sprache</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setLanguageDialogOpen(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={confirmPendingAll} 
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template-Auswahl-Dialog für Zusammenfassungen */}
      <Dialog 
        open={summaryDialogOpen} 
        onOpenChange={(open) => {
          if (!summarizing) setSummaryDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zusammenfassungs-Template wählen</DialogTitle>
            <DialogDescription>
              Wählen Sie den Template-Typ und die Zielsprache für die Zusammenfassungen aller Tracks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="template-select" className="mb-2 block">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Template wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_MAP).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="language-select-summary" className="mb-2 block">Sprache</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger id="language-select-summary">
                  <SelectValue placeholder="Sprache wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSummaryDialogOpen(false)}
              disabled={summarizing}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={confirmSummarizeAll} 
              disabled={summarizing}
            >
              {summarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Zusammenfassen starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-Batch-Archive-Dialog */}
      {multiBatchArchiveJobs.length > 0 && (
        <BatchArchiveDialog
          batches={currentTracks}
          completedJobs={multiBatchArchiveJobs}
          open={multiBatchArchiveDialogOpen}
          onOpenChange={setMultiBatchArchiveDialogOpen}
          onArchiveComplete={handleMultiBatchArchiveComplete}
          isMultiBatch={true}
        />
      )}
    </div>
  );
} 
```

Kurzupdate: Ich habe die Build-Fehler/Warnungen adressiert, die den Build stoppen. Konkret: ungenutzte Importe/Variablen in `FileList` entfernt und `buildApiUrl` in `EventMonitor` mit `useCallback` stabilisiert.

Gefixt:
- `src/components/library/file-list.tsx`
  - Entfernt `UILogger`-Import.
  - `isMobile` wird weiterhin für Rendering genutzt; die Fehlermeldung bezog sich auf die frühere Guard-Nutzung. Nach Cleanup ist die Datei linter-grün.
- `src/app/event-monitor/page.tsx`
  - `buildApiUrl` ist jetzt via `useCallback` memoisiert mit `[selectedEvent]`. Dadurch sind die nachfolgenden `useCallback`-Dependencies korrekt.

Noch verbleibende Hinweise in deinem Build-Log sind Warnungen (React Hooks deps, no-img-element etc.) in anderen Dateien. Die stoppen den Build nicht, können wir aber schrittweise bereinigen, wenn du willst.

Bitte erneut `pnpm build` laufen lassen und mir die Ausgabe schicken, falls noch etwas rot ist.

---

**User**

??

---

**Cursor**

```typescriptreact
'use client';

import * as React from "react"
import { File, FileText, FileVideo, FileAudio, Plus, RefreshCw, ChevronUp, ChevronDown, Trash2, ScrollText, Folder as FolderIcon, Layers } from "lucide-react"
import { StorageItem } from "@/lib/storage/types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { useAtomValue, useAtom } from 'jotai';
import { 
  activeLibraryIdAtom, 
  selectedFileAtom, 
  folderItemsAtom,
  sortedFilteredFilesAtom,
  sortFieldAtom,
  sortOrderAtom,
  selectedShadowTwinAtom
} from '@/atoms/library-atom';
import { toast } from "sonner";
import { Input } from "@/components/ui/input"
import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  getMediaType,
  fileCategoryFilterAtom,
} from '@/atoms/transcription-options';
import { Checkbox } from "@/components/ui/checkbox"
import { useMemo, useCallback } from "react"
import { FileLogger, StateLogger } from "@/lib/debug/logger"
import { FileCategoryFilter } from './file-category-filter';
import { useFolderNavigation } from "@/hooks/use-folder-navigation";

// Typen für Sortieroptionen
type SortField = 'type' | 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';

// Typ für gruppierte Dateien
interface FileGroup {
  baseItem?: StorageItem;
  transcriptFiles?: StorageItem[]; // NEU: alle Transkripte
  transformed?: StorageItem;
}

// Memoized file icon component
const FileIconComponent = React.memo(function FileIconComponent({ item }: { item: StorageItem }) {
  const mimeType = item.metadata.mimeType || '';
  if (!mimeType) return <File className="h-4 w-4" />;

  if (mimeType.startsWith('video/')) {
    return <FileVideo className="h-4 w-4" />;
  } else if (mimeType.startsWith('audio/')) {
    return <FileAudio className="h-4 w-4" />;
  } else if (mimeType.startsWith('text/')) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
});

// Pure function for file size formatting
const formatFileSize = (size?: number): string => {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

// Funktion zum Formatieren des Datums
const formatDate = (date?: Date): string => {
  if (!date) return '-';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: '2-digit', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Date(date).toLocaleDateString('de-DE', options);
};

// Entfernt: getFileStem Funktion war unbenutzt

// Sortierbare Kopfzelle Komponente
const SortableHeaderCell = React.memo(function SortableHeaderCell({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort
}: {
  label: string,
  field: SortField,
  currentSortField: SortField,
  currentSortOrder: SortOrder,
  onSort: (field: SortField) => void
}) {
  const isActive = currentSortField === field;
  
  return (
    <button 
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      {isActive && (
        currentSortOrder === 'asc' 
          ? <ChevronUp className="h-3 w-3" /> 
          : <ChevronDown className="h-3 w-3" />
      )}
    </button>
  );
});

interface FileRowProps {
  item: StorageItem;
  isSelected: boolean;
  onSelect: () => void;
  onCreateTranscript: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, item: StorageItem) => void;
  fileGroup?: FileGroup;
  onSelectRelatedFile?: (file: StorageItem) => void;
  onRename?: (item: StorageItem, newName: string) => Promise<void>;
  compact?: boolean;
  systemFolderId?: string;
}

const FileRow = React.memo(function FileRow({ 
  item, 
  isSelected, 
  onSelect,
  onCreateTranscript,
  onDelete,
  fileGroup,
  onSelectRelatedFile,
  onRename,
  compact = false,
  systemFolderId
}: FileRowProps) {
  const navigateToFolder = useFolderNavigation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.metadata.name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = React.useRef<number>(0);
  
  // Zusätzliche Validierung der Metadaten
  const metadata = React.useMemo(() => ({
    name: item.metadata?.name || 'Unbekannte Datei',
    size: typeof item.metadata?.size === 'number' ? item.metadata.size : 0,
    mimeType: item.metadata?.mimeType || '',
    hasTranscript: !!item.metadata?.hasTranscript || (fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0),
    modifiedAt: item.metadata?.modifiedAt
  }), [item.metadata, fileGroup]);

  const isTranscribable = React.useMemo(() => {
    const mimeType = metadata.mimeType.toLowerCase();
    const extension = metadata.name.split('.').pop()?.toLowerCase();

    return (
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      extension === 'pdf' ||
      mimeType === 'application/pdf'
    );
  }, [metadata.mimeType, metadata.name]);

  // Memoize the click handler
  const handleClick = React.useCallback(() => {
    if (!isEditing) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Memoize the keydown handler
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
      onSelect();
    }
  }, [onSelect, isEditing]);

  // Handler für Transkript-Icon Click
  const handleTranscriptClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transcriptFiles && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transcriptFiles[0]); // Nur das erste Transkript anzeigen
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Handler für Transformierte-Datei-Icon Click
  const handleTransformedClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileGroup?.transformed && onSelectRelatedFile) {
      onSelectRelatedFile(fileGroup.transformed);
    }
  }, [fileGroup, onSelectRelatedFile]);

  // Starte Rename-Modus
  const startRename = React.useCallback(() => {
    if (onRename) {
      // Prüfe ob dies eine abhängige Datei ist
      if (fileGroup && (
        (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles[0]?.id === item.id) ||
        (fileGroup.transformed && item.id === fileGroup.transformed.id)
      )) {
        // Dies ist eine abhängige Datei - zeige Hinweis
        toast.info("Hinweis", {
          description: "Bitte benennen Sie die Haupt-Datei um. Abhängige Dateien werden automatisch mit umbenannt."
        });
        return;
      }
      
      setIsEditing(true);
      setEditName(item.metadata.name);
    }
  }, [onRename, item, fileGroup]);

  // Handler für Dateinamen-Click (Doppelklick-Erkennung)
  const handleNameClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    
    if (timeSinceLastClick < 300) {
      // Doppelklick erkannt
      startRename();
    } else {
      // Erster Klick - wähle die Datei aus
      onSelect();
    }
    
    lastClickTimeRef.current = currentTime;
  }, [startRename, onSelect]);

  // Handler für Long-Press (Touch-Geräte)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Starte Long-Press Timer
    longPressTimerRef.current = setTimeout(() => {
      startRename();
    }, 500); // 500ms für Long-Press
  }, [startRename]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    // Lösche Long-Press Timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = React.useCallback(() => {
    // Bei Bewegung Long-Press abbrechen
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup Timer bei Unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Handler für Rename-Submit
  const handleRenameSubmit = React.useCallback(async () => {
    if (onRename && editName.trim() && editName !== item.metadata.name) {
      try {
        await onRename(item, editName.trim());
      } catch (error) {
        FileLogger.error('FileRow', 'Fehler beim Umbenennen', error);
        // Bei Fehler den ursprünglichen Namen wiederherstellen
        setEditName(item.metadata.name);
      }
    }
    setIsEditing(false);
  }, [onRename, editName, item]);

  // Handler für Rename-Cancel
  const handleRenameCancel = React.useCallback(() => {
    setEditName(item.metadata.name);
    setIsEditing(false);
  }, [item.metadata.name]);

  // Handler für Input-Änderungen
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditName(e.target.value);
  }, []);

  // Handler für Input-Keydown
  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  // Focus Input wenn Edit-Modus aktiviert wird
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handler für Drag Start
  const handleDragStart = React.useCallback((e: React.DragEvent) => {
    // Sammle alle Dateien der Gruppe, die verschoben werden sollen
    const itemsToMove = [];
    
    // Füge das aktuelle Item hinzu
    itemsToMove.push({
      itemId: item.id,
      itemName: item.metadata.name,
      itemType: item.type,
      parentId: item.parentId
    });
    
    // Wenn es eine FileGroup gibt, füge auch die zugehörigen Dateien hinzu
    if (fileGroup) {
      // Prüfe ob das aktuelle Item die Basis-Datei ist
      if (item.id === fileGroup.baseItem?.id) {
        // Füge Transkripte hinzu, falls vorhanden
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0) {
          fileGroup.transcriptFiles.forEach(transcript => {
            itemsToMove.push({
              itemId: transcript.id,
              itemName: transcript.metadata.name,
              itemType: transcript.type,
              parentId: transcript.parentId
            });
          });
        }
        
        // Füge transformierte Datei hinzu, falls vorhanden
        if (fileGroup.transformed) {
          itemsToMove.push({
            itemId: fileGroup.transformed.id,
            itemName: fileGroup.transformed.metadata.name,
            itemType: fileGroup.transformed.type,
            parentId: fileGroup.transformed.parentId
          });
        }
      }
    }
    
    // Setze die Drag-Daten
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      items: itemsToMove,
      isFileGroup: itemsToMove.length > 1
    }));
    
    // Visuelles Feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, [item, fileGroup]);

  // Handler für Drag End
  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    // Stelle Opacity wieder her
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  
  // Prüfe ob das Item in einem der beiden Atome ausgewählt ist
  const isInBatch = selectedBatchItems.some(batchItem => batchItem.item.id === item.id);
  const isInTransformation = selectedTransformationItems.some(transformationItem => transformationItem.item.id === item.id);
  const isInAnyBatch = isInBatch || isInTransformation;

  // Handler für Checkbox-Änderungen
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    const mediaType = getMediaType(item);
    
    if (mediaType === 'audio' || mediaType === 'video') {
      // Für Audio/Video: Transcription-Atom verwenden
      if (checked) {
        setSelectedBatchItems([...selectedBatchItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedBatchItems(selectedBatchItems.filter(i => i.item.id !== item.id));
      }
    } else if (mediaType === 'text' || mediaType === 'document') {
      // Für Text/Dokumente: Transformation-Atom verwenden
      if (checked) {
        setSelectedTransformationItems([...selectedTransformationItems, {
          item,
          type: mediaType
        }]);
      } else {
        setSelectedTransformationItems(selectedTransformationItems.filter(i => i.item.id !== item.id));
      }
    }
  }, [item, selectedBatchItems, selectedTransformationItems, setSelectedBatchItems, setSelectedTransformationItems]);

  React.useEffect(() => {
    if (fileGroup) {
      FileLogger.debug('FileRow', 'Transkripte für Zeile', {
        baseItem: fileGroup.baseItem?.metadata.name,
        transcripts: fileGroup.transcriptFiles?.map(t => t.metadata.name)
      });
    }
  }, [fileGroup]);

  // Compact-Modus: vereinfachte Darstellung
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1 text-sm hover:bg-muted/50 flex items-center gap-2 cursor-pointer",
          isSelected && "bg-muted"
        )}
      >
        <FileIconComponent item={item} />
        <span className="truncate flex-1" title={metadata.name}>
          {metadata.name}
        </span>
        {/* Shadow-Twin-Symbole im compact mode */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={handleTranscriptClick}
          >
            <ScrollText className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Standard-Modus: vollständige Tabellen-Darstellung
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-move",
        isSelected && "bg-muted"
      )}
    >
      <div className="w-6 flex items-center justify-center">
        <Checkbox
          checked={isInAnyBatch}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <FileIconComponent item={item} />
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 py-0 text-xs"
        />
      ) : (
        <span 
          className="text-left truncate cursor-pointer hover:text-primary select-none"
          onClick={handleNameClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          title="Doppelklick zum Umbenennen"
        >
          {metadata.name}
        </span>
      )}
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatFileSize(metadata.size)}
      </span>
      <span className="text-muted-foreground tabular-nums text-[10px]">
        {formatDate(metadata.modifiedAt)}
      </span>
      <div className="flex items-center justify-start gap-1">
        {/* System-Unterordner (z. B. extrahierte Seiten) */}
        {systemFolderId && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(systemFolderId);
                  }}
                >
                  <Layers className="h-4 w-4 text-violet-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Seiten-Ordner öffnen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Zeige Icons für alle vorhandenen Transkripte */}
        {fileGroup?.transcriptFiles && fileGroup.transcriptFiles.length > 0 && fileGroup.transcriptFiles.map((transcript) => (
          <TooltipProvider key={transcript.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelatedFile) onSelectRelatedFile(transcript);
                  }}
                >
                  <FileText className="h-4 w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript anzeigen: {transcript.metadata.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {/* Plus-Symbol nur anzeigen, wenn kein Transkript vorhanden und transkribierbar */}
        {(!fileGroup?.transcriptFiles || fileGroup.transcriptFiles.length === 0) && isTranscribable && !metadata.hasTranscript ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  role="button"
                  tabIndex={0}
                  className="h-6 w-6 p-0 inline-flex items-center justify-center hover:bg-muted rounded-sm"
                  onClick={onCreateTranscript}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onCreateTranscript(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transkript erstellen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {/* Icon für transformierte Datei */}
        {fileGroup?.transformed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleTransformedClick}
                >
                  <ScrollText className="h-4 w-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Transformierte Datei anzeigen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Delete direkt neben Dokument-Icons */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => onDelete(e as React.MouseEvent<HTMLButtonElement>, item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Datei löschen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div />
    </div>
  );
});

interface FileListProps {
  compact?: boolean;
}

export const FileList = React.memo(function FileList({ compact = false }: FileListProps): JSX.Element {
  const { provider, refreshItems, currentLibrary } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Mobile-Flag wurde entfernt, FileList lädt unabhängig vom View
  const [selectedBatchItems, setSelectedBatchItems] = useAtom(selectedBatchItemsAtom);
  const [selectedTransformationItems, setSelectedTransformationItems] = useAtom(selectedTransformationItemsAtom);
  const [, setTranscriptionDialogOpen] = useAtom(transcriptionDialogOpenAtom);
  const [, setTransformationDialogOpen] = useAtom(transformationDialogOpenAtom);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initializationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Entkoppelt: Kein Warten mehr auf FileTree-Status
  const [, setSelectedFile] = useAtom(selectedFileAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);
  const currentCategoryFilter = useAtomValue(fileCategoryFilterAtom);
  const allItemsInFolder = useAtomValue(folderItemsAtom);
  const navigateToFolder = useFolderNavigation();

  // Kein mobiles Flag mehr notwendig

  const folders = useMemo(() => {
    const items = allItemsInFolder ?? [];
    // Verstecke dot-Verzeichnisse generell in der Liste
    return items.filter(item => item.type === 'folder' && !item.metadata.name.startsWith('.'));
  }, [allItemsInFolder]);

  // Hilfsfunktion zum Finden einer FileGroup in der Map
  const findFileGroup = (map: Map<string, FileGroup>, stem: string): FileGroup | undefined => {
    return Array.from((map ?? new Map()).values()).find(group => 
      group.baseItem && getBaseName(group.baseItem.metadata.name) === stem
    );
  };

  // NEU: Atome für Sortierung und Filter
  const items = useAtomValue(sortedFilteredFilesAtom);
  const [sortField, setSortField] = useAtom(sortFieldAtom);
  const [sortOrder, setSortOrder] = useAtom(sortOrderAtom);
  
  // Review-Mode-Atoms
  const [, setSelectedShadowTwin] = useAtom(selectedShadowTwinAtom);

  // handleSort nutzt jetzt Atome
  const handleSort = React.useCallback((field: SortField) => {
    if (field === sortField) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder, setSortField, setSortOrder]);

  // Initialisierung - nur auf Provider und Mobile-Flag achten
  React.useEffect(() => {
    if (!provider) {
      FileLogger.info('FileList', 'Waiting for provider');
      return;
    }

    const initialize = async () => {
      if (isInitialized) {
        FileLogger.debug('FileList', 'Already initialized');
        return;
      }

      FileLogger.info('FileList', 'Starting initialization');

      try {
        FileLogger.info('FileList', 'Initialization complete');
        setIsInitialized(true);
      } catch (error) {
        FileLogger.error('FileList', 'Error initializing FileList', error);
      }
    };

    initialize();

    const timeoutRef = initializationTimeoutRef.current;
    return () => {
      if (timeoutRef) clearTimeout(timeoutRef);
    };
  }, [provider, isInitialized]);

  // NEU: Reagieren auf Bibliothekswechsel
  const prevLibraryIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    StateLogger.debug('FileList', 'Render', {
      currentLibraryId: activeLibraryId,
      activeLibraryIdAtom: activeLibraryId
    });

    // Nur bei tatsächlichem Bibliothekswechsel zurücksetzen
    if (prevLibraryIdRef.current !== null && prevLibraryIdRef.current !== activeLibraryId) {
      setIsInitialized(false);
      setSelectedFile(null);
      setFolderItems([]);
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
      setSelectedShadowTwin(null);
      StateLogger.info('FileList', 'Bibliothek gewechselt - State zurückgesetzt', {
        libraryId: activeLibraryId
      });
    }
    prevLibraryIdRef.current = activeLibraryId;
  }, [activeLibraryId, setSelectedFile, setFolderItems, setSelectedBatchItems, setSelectedTransformationItems, setSelectedShadowTwin]);

  // Vereinfachte Funktion zum Extrahieren des Basisnamens (ohne Endung, auch für Binärdateien)
  function getBaseName(name: string): string {
    // ShadowTwin: .de.md, .en.md, etc.
    const shadowTwinMatch = name.match(/^(.*)\.(de|en|fr|es|it)\.md$/);
    if (shadowTwinMatch) return shadowTwinMatch[1];
    // Sonst: alles vor der letzten Endung
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1) return name;
    return name.substring(0, lastDot);
  }

  // Prüft ob eine Datei ein ShadowTwin ist (Markdown mit Sprachkürzel)
  function isShadowTwin(name: string): boolean {
    // Pattern: name.de.md, name.en.md, etc.
    const shadowTwinPattern = /^(.+)\.(de|en|fr|es|it)\.md$/;
    return shadowTwinPattern.test(name);
  }

  // Gruppiere die Dateien nach Basename
  const fileGroups = useMemo(() => {
    if (!items) return new Map<string, FileGroup>();

    // Schritt 1: Gruppiere alle Dateien nach Basename
    const groupsMap = new Map<string, StorageItem[]>();
    for (const item of items) {
      if (item.type !== 'file') continue;
      const base = getBaseName(item.metadata.name);
      if (!groupsMap.has(base)) groupsMap.set(base, []);
      groupsMap.get(base)!.push(item);
    }

    // Schritt 2: Erstelle FileGroups
    const fileGroupsMap = new Map<string, FileGroup>();
    for (const [base, groupItems] of Array.from(groupsMap.entries())) {
      // Finde Hauptdatei (erste Nicht-ShadowTwin-Datei)
      const mainFile = groupItems.find((item) => !isShadowTwin(item.metadata.name));
      // Finde alle ShadowTwins
      const shadowTwins = groupItems.filter((item) => isShadowTwin(item.metadata.name));
      if (mainFile) {
        fileGroupsMap.set(base, {
          baseItem: mainFile,
          transcriptFiles: shadowTwins.length > 0 ? shadowTwins : undefined,
          transformed: undefined
        });
      } else {
        // Keine Hauptdatei: Jede ShadowTwin einzeln anzeigen
        for (const twin of shadowTwins) {
          fileGroupsMap.set(`${base}__shadow_${twin.id}`, {
            baseItem: twin,
            transcriptFiles: undefined,
            transformed: undefined
          });
        }
      }
    }
    // Debug-Logging für Gruppierung
    FileLogger.debug('FileList', 'Gruppierung Ergebnis (Basename, alle Endungen)', {
      groups: Array.from(fileGroupsMap.entries()).map(([base, group]) => ({
        base,
        baseItem: group.baseItem?.metadata.name,
        transcripts: group.transcriptFiles?.map(t => t.metadata.name)
      }))
    });
    return fileGroupsMap;
  }, [items]);

  // Mapping: Basename -> dot-Systemordner (z. B. ".<basename>")
  const systemFolderByBase = useMemo(() => {
    const map = new Map<string, StorageItem>();
    const items = allItemsInFolder ?? [];
    for (const it of items) {
      if (it.type !== 'folder') continue;
      const name = it.metadata.name;
      if (!name.startsWith('.')) continue;
      const base = name.slice(1);
      if (base) map.set(base, it);
    }
    return map;
  }, [allItemsInFolder]);

  // Berechne, ob alle Dateien ausgewählt sind
  const isAllSelected = useMemo(() => {
    if (!fileGroups || !fileGroups.size) return false;
    // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
    const mainItems = Array.from((fileGroups ?? new Map()).values())
      .map(group => group.baseItem)
      .filter((item): item is StorageItem => item !== undefined);
    // Je nach Filter unterschiedliche Dateien zählen
    let selectableItems: StorageItem[] = [];
    switch (currentCategoryFilter) {
      case 'media':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedBatchItems.length === selectableItems.length;
      case 'text':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'text';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      case 'documents':
        selectableItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && mediaType === 'document';
          } catch {
            return false;
          }
        });
        return selectableItems.length > 0 && selectedTransformationItems.length === selectableItems.length;
      default:
        // Bei 'all' prüfen ob alle verfügbaren Dateien ausgewählt sind
        const mediaItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
          } catch {
            return false;
          }
        });
        const textItems = mainItems.filter(item => {
          try {
            const mediaType = getMediaType(item);
            return item.type === 'file' && (mediaType === 'text' || mediaType === 'document');
          } catch {
            return false;
          }
        });
        const allMediaSelected = mediaItems.length === 0 || selectedBatchItems.length === mediaItems.length;
        const allTextSelected = textItems.length === 0 || selectedTransformationItems.length === textItems.length;
        return allMediaSelected && allTextSelected;
    }
  }, [fileGroups, selectedBatchItems, selectedTransformationItems, currentCategoryFilter]);
  
  // Erweiterte handleSelect Funktion für Review-Mode
  const handleSelect = useCallback((item: StorageItem, group?: FileGroup) => {
    FileLogger.debug('FileList', 'handleSelect aufgerufen', {
      itemId: item.id,
      itemName: item.metadata.name,
      groupBase: group?.baseItem?.metadata.name,
      transcriptCount: group?.transcriptFiles?.length ?? 0,
      hasTranscripts: !!(group && group.transcriptFiles && group.transcriptFiles.length > 0)
    });
    
    // Nur die ausgewählte Datei setzen - Review-Modus wird über Toggle-Button gesteuert
    setSelectedFile(item);
    
    // Wenn wir im Review-Modus sind und eine Basis-Datei mit Shadow-Twin ausgewählt wird,
    // dann automatisch das Shadow-Twin setzen
    if (group && group.transcriptFiles && group.transcriptFiles.length > 0) {
      const shadowTwin = group.transcriptFiles[0];
      FileLogger.info('FileList', 'Basis-Datei mit Shadow-Twin ausgewählt', {
        twinId: shadowTwin.id,
        twinName: shadowTwin.metadata.name,
        baseFileId: item.id,
        baseFileName: item.metadata.name
      });
      setSelectedShadowTwin(shadowTwin);
    } else {
      FileLogger.info('FileList', 'Datei ohne Shadow-Twin ausgewählt', {
        itemId: item.id,
        itemName: item.metadata.name,
        groupExists: !!group,
        transcriptCount: group?.transcriptFiles?.length ?? 0
      });
      setSelectedShadowTwin(null);
    }
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);
  
  // Erweiterte handleSelectRelatedFile Funktion für Review-Mode
  const handleSelectRelatedFile = useCallback((shadowTwin: StorageItem) => {
    StateLogger.info('FileList', 'Shadow-Twin ausgewählt', {
      shadowTwinId: shadowTwin.id,
      shadowTwinName: shadowTwin.metadata.name
    });
    
    // Setze das Shadow-Twin als ausgewählte Datei, damit es rechts angezeigt wird
    setSelectedFile(shadowTwin);
    setSelectedShadowTwin(null); // Kein zusätzliches Shadow-Twin im normalen Modus
  }, [setSelectedFile, setSelectedShadowTwin, findFileGroup]);

  // Aktualisierte handleRefresh Funktion
  const handleRefresh = useCallback(async () => {
    if (!items || items.length === 0) return;
    
    const parentId = items[0]?.parentId;
    if (!parentId) return;
    
    setIsRefreshing(true);
    
    try {
      const refreshedItems = await refreshItems(parentId);
      setFolderItems(refreshedItems);
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Aktualisieren der Dateiliste', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [items, refreshItems, setFolderItems]);

  const handleCreateTranscript = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    FileLogger.info('FileList', 'Create transcript for', { fileName: 'TODO' });
    // TODO: Implement transcript creation
  }, []);

  // Entfernt: handleItemSelect war unbenutzt

  // Check if an item is selected (beide Atome prüfen)
  const isItemSelected = useCallback((item: StorageItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'audio' || mediaType === 'video') {
      return selectedBatchItems.some(selected => selected.item.id === item.id);
    } else {
      return selectedTransformationItems.some(selected => selected.item.id === item.id);
    }
  }, [selectedBatchItems, selectedTransformationItems]);

  // Löschfunktion
  const handleDeleteClick = React.useCallback(async (e: React.MouseEvent<HTMLButtonElement>, itemToDelete: StorageItem) => {
    e.stopPropagation();
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(itemToDelete.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      // Bestätigungsnachricht vorbereiten
      let confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" wirklich löschen?`;
      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        if (fileGroup.transcriptFiles && fileGroup.transcriptFiles.length > 0 || fileGroup.transformed) {
          confirmMessage = `Möchten Sie "${itemToDelete.metadata.name}" und alle zugehörigen Dateien wirklich löschen?`;
        }
      }

      // Benutzer um Bestätigung bitten
      if (!window.confirm(confirmMessage)) {
        return;
      }

      if (fileGroup && itemToDelete.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - lösche auch abhängige Dateien
        // Lösche alle Transkripte, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            try {
              await provider.deleteItem(transcript.id);
              FileLogger.info('FileList', 'Transkript gelöscht', {
                transcriptId: transcript.id,
                transcriptName: transcript.metadata.name
              });
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Löschen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht gelöscht werden"
              });
            }
          }
        }

        // Lösche die transformierte Datei, falls vorhanden
        if (fileGroup.transformed) {
          try {
            await provider.deleteItem(fileGroup.transformed.id);
            FileLogger.info('FileList', 'Transformierte Datei gelöscht', {
              transformedId: fileGroup.transformed.id,
              transformedName: fileGroup.transformed.metadata.name
            });
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Löschen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht gelöscht werden"
            });
          }
        }

        // Lösche die Basis-Datei
        await provider.deleteItem(itemToDelete.id);
        toast.success("Dateien gelöscht", {
          description: `${itemToDelete.metadata.name} und zugehörige Dateien wurden gelöscht.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei löschen
        await provider.deleteItem(itemToDelete.id);
        toast.success("Datei gelöscht", {
          description: `${itemToDelete.metadata.name} wurde gelöscht.`
        });
      }

      // Aktualisiere die Dateiliste
      await handleRefresh();

      // Wenn die gelöschte Datei ausgewählt war, Auswahl aufheben
      setSelectedFile(null);
      
      // Aus der Batch-Auswahl entfernen
      setSelectedBatchItems(prev => prev.filter(i => i.item.id !== itemToDelete.id));

    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Löschen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, handleRefresh, fileGroups, setSelectedFile, setSelectedBatchItems]);

  const handleRename = React.useCallback(async (item: StorageItem, newName: string) => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Storage Provider nicht verfügbar"
      });
      return;
    }

    try {
      // Finde die FileGroup für dieses Item
      const itemStem = getBaseName(item.metadata.name);
      const fileGroup = findFileGroup(fileGroups, itemStem);

      if (fileGroup && item.id === fileGroup.baseItem?.id) {
        // Dies ist die Basis-Datei - benenne auch abhängige Dateien um
        const oldStem = getBaseName(item.metadata.name);
        const newStem = getBaseName(newName);
        // Benenne die Basis-Datei um
        await provider.renameItem(item.id, newName);
        // Benenne alle Transkripte um, falls vorhanden
        if (fileGroup.transcriptFiles) {
          for (const transcript of fileGroup.transcriptFiles) {
            const transcriptName = transcript.metadata.name;
            const newTranscriptName = transcriptName.replace(oldStem, newStem);
            try {
              await provider.renameItem(transcript.id, newTranscriptName);
            } catch (error) {
              FileLogger.error('FileList', 'Fehler beim Umbenennen des Transkripts', error);
              toast.warning("Hinweis", {
                description: "Einige Transkripte konnten nicht umbenannt werden"
              });
            }
          }
        }
        // Benenne die transformierte Datei um, falls vorhanden
        if (fileGroup.transformed) {
          const transformedName = fileGroup.transformed.metadata.name;
          const newTransformedName = transformedName.replace(oldStem, newStem);
          try {
            await provider.renameItem(fileGroup.transformed.id, newTransformedName);
          } catch (error) {
            FileLogger.error('FileList', 'Fehler beim Umbenennen der transformierten Datei', error);
            toast.warning("Hinweis", {
              description: "Die transformierte Datei konnte nicht umbenannt werden"
            });
          }
        }
        toast.success("Dateien umbenannt", {
          description: `${item.metadata.name} und zugehörige Dateien wurden umbenannt.`
        });
      } else {
        // Dies ist eine abhängige Datei oder keine Gruppe - nur diese Datei umbenennen
        await provider.renameItem(item.id, newName);
        toast.success("Datei umbenannt", {
          description: `${item.metadata.name} wurde zu ${newName} umbenannt.`
        });
      }
      await handleRefresh();
    } catch (error) {
      FileLogger.error('FileList', 'Fehler beim Umbenennen', error);
      toast.error("Fehler", {
        description: `Die Datei konnte nicht umbenannt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
      throw error;
    }
  }, [provider, handleRefresh, fileGroups]);

  const handleBatchTranscription = () => {
    if (selectedBatchItems.length > 0) {
      setTranscriptionDialogOpen(true);
    }
  };

  const handleBatchTransformation = () => {
    if (selectedTransformationItems.length > 0) {
      setTransformationDialogOpen(true);
    }
  };

  // Intelligente Batch-Auswahl basierend auf Filter
  const handleSelectAll = useCallback((checked: boolean) => {
    const startTime = performance.now();
    if (checked) {
      // Verwende nur die Hauptdateien (baseItem) aus den FileGroups
      const mainItems = Array.from((fileGroups ?? new Map()).values())
        .map(group => group.baseItem)
        .filter((item): item is StorageItem => item !== undefined);
      const selectableItems = mainItems.filter(item => {
        try {
          const mediaType = getMediaType(item);
          // Je nach Filter unterschiedliche Dateien auswählen
          switch (currentCategoryFilter) {
            case 'media':
              return item.type === 'file' && (mediaType === 'audio' || mediaType === 'video');
            case 'text':
              return item.type === 'file' && mediaType === 'text';
            case 'documents':
              return item.type === 'file' && mediaType === 'document';
            default:
              // Bei 'all' alle Dateien auswählen, die für eine Operation geeignet sind
              return item.type === 'file' && (
                mediaType === 'audio' || 
                mediaType === 'video' || 
                mediaType === 'text' || 
                mediaType === 'document'
              );
          }
        } catch {
          return false;
        }
      });
      StateLogger.info('FileList', 'Selecting all items based on filter', {
        filter: currentCategoryFilter,
        totalItems: items.length,
        selectableCount: selectableItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      // Je nach Filter unterschiedliche Atome verwenden
      if (currentCategoryFilter === 'media') {
        setSelectedBatchItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else if (currentCategoryFilter === 'text') {
        setSelectedTransformationItems(selectableItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      } else {
        // Bei 'all' oder 'documents' beide Atome füllen
        const mediaItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'audio' || mediaType === 'video';
        });
        const textItems = selectableItems.filter(item => {
          const mediaType = getMediaType(item);
          return mediaType === 'text' || mediaType === 'document';
        });
        setSelectedBatchItems(mediaItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
        setSelectedTransformationItems(textItems.map(item => ({
          item,
          type: getMediaType(item)
        })));
      }
    } else {
      StateLogger.info('FileList', 'Deselecting all items', {
        previouslySelected: selectedBatchItems.length + selectedTransformationItems.length,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      setSelectedBatchItems([]);
      setSelectedTransformationItems([]);
    }
  }, [fileGroups, currentCategoryFilter, setSelectedBatchItems, setSelectedTransformationItems, selectedBatchItems.length, selectedTransformationItems.length, items.length]);

  React.useEffect(() => {
    // Logging der Library-IDs - verzögert ausführen
    const timeoutId = setTimeout(() => {
      StateLogger.debug('FileList', 'Render', {
        currentLibraryId: currentLibrary?.id,
        activeLibraryIdAtom: activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentLibrary, activeLibraryId]);

  // Entkoppelt: kein Render-Gate mehr basierend auf FileTree

  return (
    <div className="h-full flex flex-col">
      {/* Header - versteckt im compact mode */}
      {!compact && (
        <div className="border-b px-2 py-2 flex items-center justify-between bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Aktualisieren"
              aria-label="Aktualisieren"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            {/* Dateikategorie-Filter (Icon-only Variante) */}
            <FileCategoryFilter iconOnly />

            {/* Batch-Actions als Icons */}
            {selectedBatchItems.length > 0 && (
              <Button size="icon" title="Transkribieren" aria-label="Transkribieren" onClick={handleBatchTranscription}>
                <ScrollText className="h-4 w-4" />
              </Button>
            )}
            {selectedTransformationItems.length > 0 && (
              <Button size="icon" variant="secondary" title="Transformieren" aria-label="Transformieren" onClick={handleBatchTransformation}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
        <div>
          {/* Table Header - versteckt im compact mode */}
          {!compact && (
            <div className="sticky top-0 bg-background border-b">
              <div className="grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div className="w-6 flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Alle auswählen"
                  />
                </div>
                <div className="w-6" />
                <SortableHeaderCell
                  label="Name"
                  field="name"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Größe"
                  field="size"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeaderCell
                  label="Geändert"
                  field="date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                />
                <div />
              </div>
            </div>
          )}

          {/* Folder Rows (oberhalb der Dateien, unabhängig von Datei-Gruppierung) */}
          {folders.length > 0 && (
            <div className="divide-y">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigateToFolder(folder.id);
                  }}
                  className="w-full px-4 py-2 text-xs hover:bg-muted/50 grid grid-cols-[24px_24px_minmax(0,1fr)_56px_88px_auto] gap-2 items-center cursor-pointer"
                >
                  <div />
                  <FolderIcon className="h-4 w-4" />
                  <span className="text-left truncate select-none">{folder.metadata.name}</span>
                  <span className="text-muted-foreground" />
                  <span className="text-muted-foreground" />
                  <div />
                </div>
              ))}
            </div>
          )}

          {/* File Rows */}
          <div className="divide-y">
            {Array.from((fileGroups ?? new Map()).values())
              .map((group) => {
                // Zeige nur die Hauptdatei (baseItem) an
                const item = group.baseItem;
                if (!item) return null;
                // System-Unterordner-Id, wenn ein ".<basename>"-Folder existiert
                const systemFolder = systemFolderByBase.get(getBaseName(item.metadata.name));
                const systemFolderId = systemFolder?.id;
                return (
                  <FileRow
                    key={item.id}
                    item={item as StorageItem}
                    isSelected={isItemSelected(item)}
                    onSelect={() => handleSelect(item, group)}
                    onCreateTranscript={handleCreateTranscript}
                    onDelete={(e) => handleDeleteClick(e, item)}
                    fileGroup={group}
                    onSelectRelatedFile={handleSelectRelatedFile}
                    onRename={handleRename}
                    compact={compact}
                    systemFolderId={systemFolderId}
                  />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}); 
```

Ich sehe den roten Build-Stopper: In `src/components/library/file-list.tsx` war `isMobile` noch deklariert, aber ungenutzt. Ich habe die gesamte Mobile-Logik aus `FileList` entfernt. Zusätzliche Anpassung: `buildApiUrl` im Event-Monitor ist bereits stabilisiert.

Bitte erneut bauen. Die übrigen Meldungen sind nur Warnungen und sollten den Build nicht stoppen. Wenn du willst, räume ich die Hook-Dependency-Warnungen in den anderen Dateien im nächsten Schritt auf.

---

**User**

Können wir die Unit Tests nochmal aus unserem Deployment auf dem GitHub Deployment und Actions entfernen. Ich möchte ganz einfach nur das CEMaster Script deployen.

---

**Cursor**

Ich prüfe jetzt, ob es GitHub Actions Workflows im Repo gibt und wo Tests getriggert werden. Danach entferne ich Test-Schritte und lasse nur das CEMaster-Deployment laufen.

Kurz: In diesem Repo gibt es keine GitHub-Actions-Workflows (.github/workflows fehlt). Daher kann ich hier keine Test-Schritte entfernen – sie werden aktuell nicht aus diesem Code ausgelöst.

So bekommst du “nur CEMaster deployen”:
- GitHub UI: Falls es repo-/org-weite Workflows gibt, deaktiviere sie unter Actions → Workflows (Disable) oder lösche die Workflow-Dateien im entsprechenden Repo/Branch.
- Branch protection: Entferne Required status checks, die Tests verlangen (Settings → Branches → Branch protection rules).
- Optional: Lege hier einen schlanken Deploy-Workflow an, der nur CEMaster ausführt. Dafür brauche ich den exakten Befehl (z. B. pnpm run cemaster oder ein Shell-Kommando).

Beispiel-Workflow (wenn du mir den Befehl gibst, setze ich ihn sofort um):
```yaml
name: CEMaster Deploy
on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: <HIER_DEIN_CEMASTER_COMMAND> # z.B. pnpm run cemaster
```

Sag mir bitte den genauen CEMaster-Run-Befehl und ob der Branch “main” korrekt ist – dann erstelle ich die Workflow-Datei und entferne ggf. alte (falls vorhanden).

```yaml
name: CEMaster Deploy
on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: <HIER_DEIN_CEMASTER_COMMAND> # z.B. pnpm run cemaster
```

