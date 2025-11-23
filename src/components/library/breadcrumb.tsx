'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Star, StarOff } from "lucide-react";

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();

  const [favoritesOpen, setFavoritesOpen] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Array<{ id: string; name: string; label: string }>>([]);

  // Favoriten laden bei Wechsel der aktiven Library oder Provider-Verfügbarkeit
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!provider || !activeLibrary?.id) return;
        const data = await loadFavorites(provider, activeLibrary.id);
        if (cancelled) return;
        const list = (data.favorites || []).map(f => ({
          id: f.id,
          name: f.name,
          label: Array.isArray(f.path) && f.path.length > 0 ? f.path.join(' / ') : f.name,
        }));
        setFavorites(list);
      } catch {
        // Ignoriere Ladefehler still
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [provider, activeLibrary?.id]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  // Aktuellen Folder für Star-Button ermitteln
  const currentFolder = React.useMemo(() => (
    currentFolderId === 'root' ? null : currentPath.find(item => item.id === currentFolderId) || null
  ), [currentFolderId, currentPath]);

  const isCurrentFavorite = React.useMemo(() => (
    !!currentFolder && favorites.some(f => f.id === currentFolder.id)
  ), [currentFolder, favorites]);

  async function handleToggleFavorite() {
    if (!provider || !activeLibrary?.id || !currentFolder) return;
    const updated = await toggleFavorite(provider, activeLibrary.id, currentFolder);
    const list = (updated.favorites || []).map(f => ({
      id: f.id,
      name: f.name,
      label: Array.isArray(f.path) && f.path.length > 0 ? f.path.join(' / ') : f.name,
    }));
    setFavorites(list);
  }

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        {/* Favoriten-Dropdown Trigger links vor dem Breadcrumb */}
        <DropdownMenu open={favoritesOpen} onOpenChange={setFavoritesOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Favoriten öffnen"
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            >
              {favoritesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[260px]">
            {favorites.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Keine Favoriten vorhanden</div>
            ) : favorites.map(f => (
              <DropdownMenuItem key={f.id} onClick={() => navigateToFolder(f.id)} className="text-sm">
                <div className="truncate" title={f.label}>{f.label}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
          {/* Favoriten-Star am Ende des Breadcrumbs */}
          <span className="text-muted-foreground flex-shrink-0">/</span>
          <button
            disabled={!currentFolder || !provider || !activeLibrary?.id}
            onClick={handleToggleFavorite}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded",
              currentFolder ? "hover:bg-muted" : "opacity-50 cursor-not-allowed"
            )}
            aria-label={isCurrentFavorite ? "Favorit entfernen" : "Als Favorit speichern"}
            title={isCurrentFavorite ? "Favorit entfernen" : "Als Favorit speichern"}
          >
            {isCurrentFavorite ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
} 