'use client';

/**
 * TreeItem - Einzelner Eintrag im FileTree.
 *
 * Aus `file-tree.tsx` extrahiert (Welle 3-I, Schritt 4a) zur
 * Reduktion der Datei-Groesse von 619 auf < 500 Zeilen.
 *
 * Verantwortlichkeiten:
 * - Render eines Ordner-Eintrags inklusive Chevron
 * - Klick: Ordner auswaehlen + navigieren
 * - Chevron-Klick: Expand/Collapse, lazy-load von Children
 * - Auto-Scroll, wenn der Eintrag dem aktuellen Folder entspricht
 *
 * Vertrag siehe `.cursor/rules/welle-3-schale-loader-contracts.mdc` §1, §3.
 */

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { StorageItem } from '@/lib/storage/types';
import { cn } from '@/lib/utils';
import {
  expandedFoldersAtom,
  loadedChildrenAtom,
  selectedFileAtom,
  libraryAtom,
} from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { FileLogger, UILogger } from '@/lib/debug/logger';
import { useCallback } from 'react';
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin';

export interface TreeItemProps {
  item: StorageItem;
  level: number;
  /** Drag&Drop-Handler (optional, derzeit ungenutzt — Folge-Welle Welle 3-II) */
  onMoveItem?: (itemId: string, targetFolderId: string) => Promise<void>;
  currentFolderId?: string;
  hideShadowTwinFolders: boolean;
}

export function TreeItem({
  item,
  level,
  onMoveItem,
  currentFolderId,
  hideShadowTwinFolders,
}: TreeItemProps) {
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [loadedChildren, setLoadedChildren] = useAtom(loadedChildrenAtom);
  const libraryState = useAtomValue(libraryAtom);
  const { provider, listItems } = useStorage();
  const navigateToFolder = useFolderNavigation();
  const itemRef = React.useRef<HTMLDivElement>(null);

  // Ordner erweitern: erst Cache pruefen, dann via listItems laden.
  // Toggle-Verhalten: bereits erweiterter Ordner wird zusammengeklappt.
  const handleExpand = useCallback(async (folderId: string) => {
    if (!provider) return;

    try {
      // Ordnerinhalt laden, wenn noch nicht geladen
      if (!loadedChildren[folderId]) {
        // PERFORMANCE-OPTIMIERUNG: Verwende Cache statt API-Call wenn moeglich
        const cachedFolder = libraryState.folderCache?.[folderId];
        if (cachedFolder && cachedFolder.children) {
          setLoadedChildren(prev => ({
            ...prev,
            [folderId]: cachedFolder.children || [],
          }));
          UILogger.debug('FileTree', 'Ordner fuer Expand aus Cache geladen', {
            folderId,
            itemCount: cachedFolder.children.length,
          });
        } else {
          // PERFORMANCE-OPTIMIERUNG: Verwende listItems fuer Deduplizierung
          const items = await listItems(folderId);
          setLoadedChildren(prev => ({
            ...prev,
            [folderId]: items,
          }));
        }
      }

      // Ordner als erweitert markieren (Toggle)
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          newSet.add(folderId);
        }
        return newSet;
      });
    } catch (error) {
      FileLogger.error('FileTree', 'Fehler beim Laden des Ordnerinhalts', error);
    }
  }, [provider, loadedChildren, libraryState.folderCache, listItems, setLoadedChildren, setExpandedFolders]);

  // Element auswaehlen: setzt Auswahl-Atom und navigiert in den Folder.
  const handleSelect = useCallback((selectedItem: StorageItem) => {
    setSelectedFile(selectedItem);
    if (selectedItem.type === 'folder') {
      navigateToFolder(selectedItem.id);
    }
  }, [setSelectedFile, navigateToFolder]);

  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedFile?.id === item.id;
  const isCurrentFolder = currentFolderId === item.id;
  // Children: nur Ordner, gefiltert nach Shadow-Twin-Sichtbarkeit (Helper).
  const children = (loadedChildren[item.id] || []).filter(child => {
    if (child.type !== 'folder') return false;
    const name = child.metadata?.name || '';
    return !hideShadowTwinFolders || !isShadowTwinFolderName(name);
  });

  // Scroll zum aktuellen Ordner, wenn er dieser Item ist.
  React.useEffect(() => {
    if (isCurrentFolder && itemRef.current) {
      // Warte kurz, damit der Tree gerendert ist
      setTimeout(() => {
        try {
          itemRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        } catch (error) {
          // Scroll-Fehler bewusst ignoriert: scrollIntoView kann in alten
          // Browsern oder Test-Umgebungen werfen, ohne dass das Layout bricht.
          // Wir loggen via debug, damit es im Dev-Log sichtbar ist.
          console.debug('[FileTree] Scroll-Fehler ignoriert:', error);
        }
      }, 100);
    }
  }, [isCurrentFolder]);

  return (
    <div
      ref={itemRef}
      data-folder-id={item.id}
      className={cn(
        'px-2 py-1 cursor-pointer hover:bg-accent rounded-md transition-colors',
        isSelected && 'bg-accent',
        isCurrentFolder && 'bg-primary/20'
      )}
    >
      <div
        className="flex items-center gap-2"
        onClick={() => handleSelect(item)}
      >
        {/* Chevron-Button fuer Expand/Collapse */}
        <button
          className="p-0 mr-1 focus:outline-none"
          tabIndex={-1}
          aria-label={isExpanded ? 'Zuklappen' : 'Aufklappen'}
          onClick={e => {
            e.stopPropagation();
            handleExpand(item.id);
          }}
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* Nur Ordnername anzeigen */}
        <span>{item.metadata.name}</span>
      </div>
      {isExpanded && children.map(child => (
        <TreeItem
          key={child.id}
          item={child}
          level={level + 1}
          onMoveItem={onMoveItem}
          currentFolderId={currentFolderId}
          hideShadowTwinFolders={hideShadowTwinFolders}
        />
      ))}
    </div>
  );
}
