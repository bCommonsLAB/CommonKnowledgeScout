'use client';

import * as React from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, breadcrumbItemsAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { useSelectedFile } from '@/hooks/use-selected-file';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const breadcrumbItems = useAtomValue(breadcrumbItemsAtom);
  const { provider, currentLibrary, libraryStatus, lastRequestedLibraryId } = useStorage();
  const { selected } = useSelectedFile();

  const tokenPresent = !!currentLibrary?.config?.accessToken || !!currentLibrary?.config?.refreshToken;

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
    { label: 'Auswahl', value: selected.item?.metadata.name || 'Keine Auswahl' },
    { label: 'Pfad', value: breadcrumbItems.map(item => item.metadata.name).join(' > ') || 'Root' },
  ];

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50",
      "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "border rounded-lg shadow-lg",
      "p-2 text-xs font-mono",
      "max-w-[500px] overflow-hidden"
    )}>
      <div className="space-y-1">
        {debugInfo.map((info, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-muted-foreground min-w-[60px]">{info.label}:</span>
            <span className="truncate">{info.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
} 