/**
 * @fileoverview Shadow-Twin-Analyse Hook
 * 
 * @description
 * React-Hook für die automatische Shadow-Twin-Analyse aller Dateien im aktuellen Ordner.
 * Nutzt jetzt die Bulk-API für optimierte Performance (ein Request statt viele einzelne).
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
import { StorageItem } from '@/lib/storage/types';
import { shadowTwinStateAtom, FrontendShadowTwinState } from '@/atoms/shadow-twin-atom';
import { ShadowTwinState } from '@/lib/shadow-twin/shared';
import { batchResolveArtifactsClient } from '@/lib/shadow-twin/artifact-client';
import { FileLogger } from '@/lib/debug/logger';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';

/**
 * Hook für automatische Shadow-Twin-Analyse aller Dateien im Ordner
 * 
 * Nutzt jetzt die Bulk-API für optimierte Performance (ein Request statt viele einzelne).
 * 
 * @param items Array von StorageItems im aktuellen Ordner
 * @param provider Storage Provider (wird nicht mehr direkt verwendet, nur für Kompatibilität)
 * @param forceRefresh Trigger-Wert, der bei Änderung eine Neu-Analyse erzwingt
 * @returns Map von fileId -> ShadowTwinState (leer, da State über Atom verwaltet wird)
 */
export function useShadowTwinAnalysis(
  items: StorageItem[] | null,
  provider: unknown, // Wird nicht mehr verwendet, aber für Kompatibilität behalten
  forceRefresh?: number
): Map<string, ShadowTwinState> {
  const setShadowTwinState = useSetAtom(shadowTwinStateAtom);
  const libraryId = useAtomValue(activeLibraryIdAtom);
  const previousItemsRef = useRef<Map<string, { modifiedAt?: Date }>>(new Map());
  const isAnalyzingRef = useRef(false);
  const lastForceRefreshRef = useRef(forceRefresh ?? 0);

  useEffect(() => {
    // Prüfe Voraussetzungen
    if (!items || !libraryId || items.length === 0) {
      if (!libraryId) {
        FileLogger.warn('useShadowTwinAnalysis', 'libraryId fehlt, überspringe Analyse', {
          hasItems: !!items,
          itemsLength: items?.length,
        });
      }
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
    // Warte 2000ms bevor die Analyse startet (Lazy Loading)
    // Dies verhindert unnötige Analysen bei schnellen Ordnerwechseln
    // UND gibt der UI Zeit, zuerst zu rendern, bevor die Analyse startet
    // WICHTIG: Die Dateiliste sollte sofort sichtbar sein, Shadow-Twin-Icons können später erscheinen
    const analysisTimeoutId = setTimeout(() => {
      // Prüfe erneut, ob die Analyse noch benötigt wird
      // (Items könnten sich während der Wartezeit geändert haben)
      if (!items || !libraryId || items.length === 0) {
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

      // Nutze Bulk-API für optimierte Performance
      const processBulkAnalysis = async () => {
        try {
          // Bereite Sources für Bulk-API vor
          // WICHTIG: Filtere Items ohne parentId (könnte bei Root-Items vorkommen)
          const sources = itemsToAnalyze
            .filter(item => item.parentId) // Nur Items mit parentId
            .map(item => ({
              sourceId: item.id,
              sourceName: item.metadata.name,
              parentId: item.parentId!,
              targetLanguage: 'de', // Standard-Sprache
            }));

          if (sources.length === 0) {
            FileLogger.debug('useShadowTwinAnalysis', 'Keine gültigen Sources für Bulk-API', {
              totalItems: itemsToAnalyze.length,
            });
            isAnalyzingRef.current = false;
            return;
          }

          // Führe zwei Bulk-Calls durch:
          // 1. Transformation (bevorzugt)
          // 2. Transcript (Fallback)
          const [transformationResults, transcriptResults] = await Promise.all([
            batchResolveArtifactsClient({
              libraryId,
              sources,
              preferredKind: 'transformation',
            }),
            batchResolveArtifactsClient({
              libraryId,
              sources,
              preferredKind: 'transcript',
            }),
          ]);

          // Konvertiere ResolvedArtifactWithItem-Ergebnisse zu ShadowTwinState.
          // WICHTIG: Wir schreiben **für alle Dateien** einen Eintrag (auch wenn keine Artefakte existieren),
          // damit UI/Debug sauber zwischen "checked but empty" vs. "not analyzed yet" unterscheiden kann.
          const analyzedAt = Date.now()
          const currentFileById = new Map<string, StorageItem>()
          for (const it of currentFileItems) currentFileById.set(it.id, it)

          setShadowTwinState((prev) => {
            const next = new Map<string, FrontendShadowTwinState>()

            // Nur States für aktuelle Folder-Files behalten/aktualisieren.
            for (const it of currentFileItems) {
              const prevState = prev.get(it.id)
              next.set(it.id, {
                ...prevState,
                baseItem: it,
                analysisTimestamp: prevState?.analysisTimestamp ?? analyzedAt,
              })
            }

            for (const it of itemsToAnalyze) {
              const transformation = transformationResults.get(it.id)
              const transcript = transcriptResults.get(it.id)
              const hasArtifacts = Boolean(transformation || transcript)

              const transformed =
                transformation?.kind === 'transformation' && transformation.item ? transformation.item : undefined
              const transcriptFiles =
                transcript?.kind === 'transcript' && transcript.item ? [transcript.item] : undefined
              const shadowTwinFolderId = transformation?.shadowTwinFolderId || transcript?.shadowTwinFolderId

              const merged: FrontendShadowTwinState = {
                baseItem: it,
                transformed,
                transcriptFiles,
                shadowTwinFolderId,
                analysisTimestamp: analyzedAt,
                processingStatus: hasArtifacts ? 'ready' : 'pending',
              }

              next.set(it.id, merged)

              // Aktualisiere previousItemsRef (auch wenn keine Artefakte existieren)
              const modifiedAt = it.metadata.modifiedAt
              previousItemsRef.current.set(it.id, {
                modifiedAt: modifiedAt instanceof Date ? modifiedAt : (modifiedAt ? new Date(modifiedAt) : undefined),
              })
            }

            return next
          })
          
          isAnalyzingRef.current = false;
          
          // Nur loggen wenn Shadow-Twins gefunden wurden
          if (itemsToAnalyze.length > 0) {
            FileLogger.info('useShadowTwinAnalysis', 'Shadow-Twin-Analyse abgeschlossen (Bulk-API)', {
              analyzedCount: itemsToAnalyze.length,
              totalFiles: itemsToAnalyze.length,
            });
          }
        } catch (error) {
          isAnalyzingRef.current = false;
          FileLogger.error('useShadowTwinAnalysis', 'Fehler bei Bulk-Analyse', {
            error: error instanceof Error ? error.message : 'Unknown error',
            totalFiles: itemsToAnalyze.length,
          });
        }
      };

      void processBulkAnalysis();
    }, 2000); // 2000ms Lazy Loading Delay - gibt UI Zeit zuerst zu rendern, Shadow-Twin-Icons erscheinen später

    // Cleanup: Setze isAnalyzingRef zurück bei Unmount und cancel Timeout
    return () => {
      clearTimeout(analysisTimeoutId);
      isAnalyzingRef.current = false;
    };
  }, [items, libraryId, setShadowTwinState, forceRefresh]);

  // Gib aktuellen State zurück (wird vom Atom gelesen)
  // Da wir das Atom direkt setzen, können wir hier eine leere Map zurückgeben
  // Die Komponenten sollten das Atom direkt lesen
  return new Map();
}

