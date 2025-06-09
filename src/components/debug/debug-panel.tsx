'use client';

import * as React from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, breadcrumbItemsAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { useSelectedFile } from '@/hooks/use-selected-file';
import { cn } from '@/lib/utils';
import { Bug, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DebugPanel() {
  const [isMinimized, setIsMinimized] = React.useState(false);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const breadcrumbItems = useAtomValue(breadcrumbItemsAtom);
  const { provider, currentLibrary, libraryStatus, lastRequestedLibraryId } = useStorage();
  const { selected } = useSelectedFile();

  // Token-Status aus localStorage prüfen
  const [tokenPresent, setTokenPresent] = React.useState(false);
  
  React.useEffect(() => {
    if (currentLibrary && (currentLibrary.type === 'onedrive' || currentLibrary.type === 'gdrive')) {
      try {
        const localStorageKey = `onedrive_tokens_${currentLibrary.id}`;
        const tokensJson = localStorage.getItem(localStorageKey);
        setTokenPresent(!!tokensJson);
      } catch (error) {
        console.error('[DebugPanel] Fehler beim Prüfen der Tokens:', error);
        setTokenPresent(false);
      }
    } else {
      setTokenPresent(false);
    }
  }, [currentLibrary]);

  // Debug-Ausgabe für die Auswahl
  React.useEffect(() => {
    console.log('[DebugPanel] Selected file:', {
      hasItem: !!selected.item,
      itemName: selected.item?.metadata?.name,
      itemId: selected.item?.id,
      itemType: selected.item?.type,
      fullItem: selected.item
    });
  }, [selected.item]);

  // Debug-Informationen
  const debugInfo = [
    { label: 'Library', value: `${currentLibrary?.label || 'Keine'} (${activeLibraryId})` },
    { label: 'Provider', value: provider?.name || 'Kein Provider' },
    { label: 'Provider-Key', value: currentLibrary?.type || 'Unbekannt' },
    { label: 'Status', value: libraryStatus },
    { label: 'Token vorhanden', value: tokenPresent ? 'Ja' : 'Nein' },
    { label: 'Aktive Library-ID (State)', value: activeLibraryId },
    { label: 'Letzte abgefragte Library-ID', value: lastRequestedLibraryId || 'Keine' },
    { label: 'Auth', value: provider?.getAuthInfo?.() || 'Keine Auth-Info' },
    { label: 'Ordner', value: currentFolderId },
    { label: 'Auswahl', value: selected.item ? `${selected.item.metadata.name} (${selected.item.type})` : 'Keine Auswahl' },
    { label: 'Auswahl-ID', value: selected.item?.id || 'Keine' },
    { label: 'Pfad', value: breadcrumbItems.map(item => item.metadata.name).join(' > ') || 'Root' },
  ];

  // Speichere den minimierten Zustand im localStorage
  React.useEffect(() => {
    const savedState = localStorage.getItem('debug-panel-minimized');
    if (savedState !== null) {
      setIsMinimized(savedState === 'true');
    }
  }, []);

  const toggleMinimized = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('debug-panel-minimized', String(newState));
  };

  if (isMinimized) {
    return (
      <div className={cn(
        "fixed bottom-4 right-4 z-50",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border rounded-lg shadow-lg",
        "p-1"
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMinimized}
          className="h-8 px-2 hover:bg-accent"
          title="Debug Panel maximieren"
        >
          <Bug className="h-4 w-4 mr-1" />
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50",
      "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "border rounded-lg shadow-lg",
      "p-3 text-xs font-mono",
      "max-w-[500px] overflow-hidden"
    )}>
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bug className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Debug Panel</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMinimized}
          className="h-6 w-6 p-0 hover:bg-accent"
          title="Debug Panel minimieren"
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {debugInfo.map((info, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-muted-foreground min-w-[140px] shrink-0">{info.label}:</span>
            <span className="text-foreground break-all">{info.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
} 