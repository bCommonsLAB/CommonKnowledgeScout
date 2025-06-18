'use client';

import * as React from "react";
import { useAtom, useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();

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
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
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
        </div>
      </div>
    </div>
  );
} 