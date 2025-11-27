/**
 * @fileoverview Shadow-Twin-Analyse Hook
 * 
 * @description
 * React-Hook für die automatische Shadow-Twin-Analyse aller Dateien im aktuellen Ordner.
 * Führt die Analyse parallel für alle Dateien durch und speichert die Ergebnisse im Atom.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - useShadowTwinAnalysis: Hook für automatische Shadow-Twin-Analyse
 * 
 * @usedIn
 * - src/components/library/file-list.tsx: Verwendet Hook für automatische Analyse
 */

import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { shadowTwinStateAtom, FrontendShadowTwinState } from '@/atoms/shadow-twin-atom';
import { ShadowTwinState } from '@/lib/shadow-twin/shared';
import { analyzeShadowTwin } from '@/lib/shadow-twin/analyze-shadow-twin';
import { FileLogger } from '@/lib/debug/logger';

/**
 * Maximale Anzahl gleichzeitiger Analysen (Batch-Processing)
 */
const MAX_CONCURRENT_ANALYSES = 50;

/**
 * Hook für automatische Shadow-Twin-Analyse aller Dateien im Ordner
 * 
 * @param items Array von StorageItems im aktuellen Ordner
 * @param provider Storage Provider
 * @param forceRefresh Trigger-Wert, der bei Änderung eine Neu-Analyse erzwingt
 * @returns Map von fileId -> ShadowTwinState
 */
export function useShadowTwinAnalysis(
  items: StorageItem[] | null,
  provider: StorageProvider | null,
  forceRefresh?: number
): Map<string, ShadowTwinState> {
  const setShadowTwinState = useSetAtom(shadowTwinStateAtom);
  const previousItemsRef = useRef<Map<string, { modifiedAt?: Date }>>(new Map());
  const isAnalyzingRef = useRef(false);
  const lastForceRefreshRef = useRef(forceRefresh ?? 0);

  useEffect(() => {
    // Prüfe Voraussetzungen
    if (!items || !provider || items.length === 0) {
      setShadowTwinState(new Map());
      return;
    }

    // Verhindere parallele Analysen
    if (isAnalyzingRef.current) {
      return;
    }

    // Filtere nur Dateien (keine Ordner)
    const fileItems = items.filter(item => item.type === 'file');
    
    if (fileItems.length === 0) {
      setShadowTwinState(new Map());
      return;
    }

    // Prüfe, ob eine erzwungene Neu-Analyse angefordert wurde
    const forceRefreshRequested = forceRefresh !== undefined && forceRefresh !== lastForceRefreshRef.current;
    if (forceRefreshRequested) {
      FileLogger.info('useShadowTwinAnalysis', 'Erzwungene Neu-Analyse angefordert', {
        previousTrigger: lastForceRefreshRef.current,
        newTrigger: forceRefresh
      });
      // Setze previousItemsRef zurück, damit alle Dateien neu analysiert werden
      previousItemsRef.current.clear();
      lastForceRefreshRef.current = forceRefresh;
    }

    // PERFORMANCE-OPTIMIERUNG: Debouncing und Lazy Loading
    // Warte 500ms bevor die Analyse startet (Lazy Loading)
    // Dies verhindert unnötige Analysen bei schnellen Ordnerwechseln
    const analysisTimeoutId = setTimeout(() => {
      // Prüfe erneut, ob die Analyse noch benötigt wird
      // (Items könnten sich während der Wartezeit geändert haben)
      if (!items || !provider || items.length === 0) {
        return;
      }

      // Verhindere parallele Analysen (erneut prüfen nach Timeout)
      if (isAnalyzingRef.current) {
        return;
      }

      // WICHTIG: itemsToAnalyze innerhalb des Timeouts berechnen, um aktuelle Items zu verwenden
      // Filtere nur Dateien (keine Ordner) - erneut filtern für aktuelle Items
      const currentFileItems = items.filter(item => item.type === 'file');
      
      if (currentFileItems.length === 0) {
        setShadowTwinState(new Map());
        return;
      }

      // Debug: Logge Start der Analyse
      FileLogger.info('useShadowTwinAnalysis', 'Starte Shadow-Twin-Analyse', {
        totalFiles: currentFileItems.length,
        folderId: items[0]?.parentId
      });

      // Prüfe, ob eine erzwungene Neu-Analyse angefordert wurde (erneut prüfen)
      const currentForceRefreshRequested = forceRefresh !== undefined && forceRefresh !== lastForceRefreshRef.current;
      if (currentForceRefreshRequested) {
        FileLogger.info('useShadowTwinAnalysis', 'Erzwungene Neu-Analyse angefordert (nach Timeout)', {
          previousTrigger: lastForceRefreshRef.current,
          newTrigger: forceRefresh
        });
        previousItemsRef.current.clear();
        lastForceRefreshRef.current = forceRefresh;
      }

      // Performance-Optimierung: Analysiere nur Dateien, die noch nicht analysiert wurden
      // oder deren modifiedAt sich geändert hat (außer bei erzwungener Neu-Analyse)
      const itemsToAnalyze = currentFileItems.filter(item => {
        // Bei erzwungener Neu-Analyse alle Dateien analysieren
        if (currentForceRefreshRequested) {
          return true;
        }
        
        const previous = previousItemsRef.current.get(item.id);
        const currentModifiedAt = item.metadata.modifiedAt;
        
        // Konvertiere modifiedAt zu Date-Objekt für Vergleich
        const currentDate = currentModifiedAt instanceof Date 
          ? currentModifiedAt 
          : (currentModifiedAt ? new Date(currentModifiedAt) : null);
        const previousDate = previous?.modifiedAt instanceof Date
          ? previous.modifiedAt
          : (previous?.modifiedAt ? new Date(previous.modifiedAt) : null);
        
        // Wenn keine vorherige Analyse vorhanden oder modifiedAt hat sich geändert
        if (!previous || !previousDate || !currentDate || previousDate.getTime() !== currentDate.getTime()) {
          return true;
        }
        
        return false;
      });

      if (itemsToAnalyze.length === 0 && !currentForceRefreshRequested) {
        return;
      }

      isAnalyzingRef.current = true;

      // Batch-Processing: Teile in Chunks auf
      const chunks: StorageItem[][] = [];
      for (let i = 0; i < itemsToAnalyze.length; i += MAX_CONCURRENT_ANALYSES) {
        chunks.push(itemsToAnalyze.slice(i, i + MAX_CONCURRENT_ANALYSES));
      }

      // Analysiere Chunks sequenziell, innerhalb jedes Chunks parallel
      const currentState = new Map<string, FrontendShadowTwinState>();

      const processChunk = async (chunk: StorageItem[]): Promise<void> => {
        const analyses = chunk.map(async (item) => {
          try {
            const result = await analyzeShadowTwin(item.id, provider);
            if (result) {
              // analyzeShadowTwin gibt ShadowTwinState zurück, aber mit vollständigen StorageItem-Objekten
              // Daher ist es bereits FrontendShadowTwinState-kompatibel
              return { fileId: item.id, state: result as FrontendShadowTwinState };
            }
            // Kein Shadow-Twin gefunden - kein Log nötig (normaler Fall)
            return null;
          } catch (error) {
            FileLogger.error('useShadowTwinAnalysis', 'Fehler bei Analyse', {
              fileId: item.id,
              fileName: item.metadata.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
          }
        });

        const results = await Promise.all(analyses);
        
        // Füge Ergebnisse zum aktuellen State hinzu
        for (const result of results) {
          if (result) {
            currentState.set(result.fileId, result.state);
            // Aktualisiere previousItemsRef
            // Speichere modifiedAt als Date-Objekt für konsistenten Vergleich
            const baseItemMetadata = result.state.baseItem.metadata;
            const modifiedAt = 'modifiedAt' in baseItemMetadata ? baseItemMetadata.modifiedAt : undefined;
            previousItemsRef.current.set(result.fileId, {
              modifiedAt: modifiedAt instanceof Date ? modifiedAt : (modifiedAt ? new Date(modifiedAt) : undefined)
            });
          }
        }
      };

      // Verarbeite alle Chunks sequenziell
      const processAllChunks = async () => {
        for (const chunk of chunks) {
          await processChunk(chunk);
          // Aktualisiere Atom nach jedem Chunk für bessere UX
          setShadowTwinState(new Map(currentState));
        }
        
        isAnalyzingRef.current = false;
        // Nur loggen wenn Shadow-Twins gefunden wurden oder Fehler aufgetreten sind
        if (currentState.size > 0) {
          FileLogger.info('useShadowTwinAnalysis', 'Shadow-Twin-Analyse abgeschlossen', {
            analyzedCount: currentState.size
          });
        }
      };

      void processAllChunks();
    }, 500); // 500ms Lazy Loading Delay

    // Cleanup: Setze isAnalyzingRef zurück bei Unmount und cancel Timeout
    return () => {
      clearTimeout(analysisTimeoutId);
      isAnalyzingRef.current = false;
    };
  }, [items, provider, setShadowTwinState, forceRefresh]);

  // Gib aktuellen State zurück (wird vom Atom gelesen)
  // Da wir das Atom direkt setzen, können wir hier eine leere Map zurückgeben
  // Die Komponenten sollten das Atom direkt lesen
  return new Map();
}

