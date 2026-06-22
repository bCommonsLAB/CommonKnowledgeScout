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
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom';
import { shadowTwinImportActivityAtom, type ShadowTwinImportActivity } from '@/atoms/shadow-twin-atom';
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';
import { isMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id';
import { toast } from 'sonner';

/**
 * Importiert im Storage gefundene Shadow-Twin-Artefakte in die MongoDB der
 * aktiven Library (Rekonstruktion). Sichtbar via Aktivitaets-Atom + Toast.
 *
 * Nutzt den bestehenden, getesteten Reconstruct-Endpunkt. Laeuft nur einmal
 * pro Ordner: nach dem Import liefert der Server Mongo-Artefakte (virtuelle IDs),
 * sodass kein erneuter Import getriggert wird.
 */
async function importStorageArtifacts(
  libraryId: string,
  targets: Array<{ sourceId: string; parentId: string }>,
  setActivity: (value: ShadowTwinImportActivity) => void,
): Promise<void> {
  const total = targets.length
  setActivity({ active: true, total, done: 0 })
  let imported = 0
  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconstruct`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId: target.sourceId, parentId: target.parentId }),
          },
        )
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { reconstructed?: number } | null
          if (data && typeof data.reconstructed === 'number') imported += data.reconstructed
        }
      } catch (err) {
        // Einzel-Fehler darf den Gesamt-Import nicht abbrechen.
        FileLogger.warn('useShadowTwinAnalysis', 'Storage-Import einer Quelle fehlgeschlagen', {
          sourceId: target.sourceId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      setActivity({ active: true, total, done: i + 1 })
    }
    if (imported > 0) {
      toast.success('Artefakte aus Speicher importiert', {
        description: `${imported} Artefakt${imported > 1 ? 'e' : ''} in den Cache uebernommen.`,
      })
    }
  } finally {
    setActivity({ active: false, total: 0, done: 0 })
  }
}

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
  const setImportActivity = useSetAtom(shadowTwinImportActivityAtom);
  const libraryId = useAtomValue(activeLibraryIdAtom);
  const libraries = useAtomValue(librariesAtom);
  
  // Ermittle, ob Binary-Uploads möglich sind (basierend auf Library-Konfiguration)
  // MongoDB-Modus: Binary-Uploads sind immer möglich (Upload geht nach Azure)
  // Filesystem-Modus: Binary-Uploads benötigen ein shadowTwinFolderId
  const activeLibrary = libraries.find(lib => lib.id === libraryId);
  // Prüfe Shadow-Twin-Konfiguration (shadowTwin ist Teil von StorageConfig, nicht ClientLibrary)
  const shadowTwinConfig = activeLibrary?.config?.shadowTwin as { primaryStore?: 'filesystem' | 'mongo' } | undefined;
  const isMongoMode = shadowTwinConfig?.primaryStore === 'mongo';

  // Effektive Zielsprache der Library bestimmen (statt hardcodiert 'de').
  // Priorität: Verarbeitung (secretaryService) → Story (chat) → globaler Default.
  // Grund: Artefakt-Dateinamen tragen die Sprache (z.B. "...en.md"); ohne die
  // richtige Sprache findet der Resolver englische Artefakte nicht.
  const effectiveTargetLanguage =
    activeLibrary?.config?.secretaryService?.targetLanguage ||
    activeLibrary?.config?.chat?.targetLanguage ||
    TARGET_LANGUAGE_DEFAULT;
  
  const previousItemsRef = useRef<Map<string, { modifiedAt?: Date; parentId?: string }>>(new Map());
  const isAnalyzingRef = useRef(false);
  const lastForceRefreshRef = useRef(forceRefresh ?? 0);
  const previousParentIdRef = useRef<string | null>(null);

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
      previousParentIdRef.current = null;
      return;
    }

    // Filtere nur Dateien (keine Ordner)
    const fileItems = items.filter(item => item.type === 'file');
    
    if (fileItems.length === 0) {
      setShadowTwinState(new Map());
      previousParentIdRef.current = null;
      return;
    }

    // WICHTIG: Prüfe ob sich der Ordner geändert hat (parentId der ersten Datei)
    // Wenn ja, Cache und State sofort zurücksetzen, damit alle Dateien neu analysiert werden
    const currentParentId = fileItems[0]?.parentId || null;
    const parentIdChanged = previousParentIdRef.current !== null && 
                            previousParentIdRef.current !== currentParentId;
    
    if (parentIdChanged) {
      FileLogger.info('useShadowTwinAnalysis', 'Ordnerwechsel erkannt - Cache und State zurücksetzen', {
        previousParentId: previousParentIdRef.current,
        currentParentId,
        fileCount: fileItems.length,
      });
      previousItemsRef.current.clear();
      // Setze State sofort zurück, damit alte Einträge entfernt werden
      // Dies stellt sicher, dass beim Ordnerwechsel keine alten Icons angezeigt werden
      setShadowTwinState((prev) => {
        const next = new Map<string, FrontendShadowTwinState>();
        // Nur States für Dateien im aktuellen Ordner behalten
        const currentFileIds = new Set(fileItems.map(it => it.id));
        for (const [fileId, state] of prev.entries()) {
          if (currentFileIds.has(fileId)) {
            next.set(fileId, state);
          }
        }
        return next;
      });
    }
    
    previousParentIdRef.current = currentParentId;

    // Verhindere parallele Analysen
    if (isAnalyzingRef.current) {
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
      // oder deren modifiedAt/parentId sich geändert hat (außer bei erzwungener Neu-Analyse)
      const itemsToAnalyze = currentFileItems.filter(item => {
        // Bei erzwungener Neu-Analyse alle Dateien analysieren
        if (currentForceRefreshRequested) {
          return true;
        }
        
        const previous = previousItemsRef.current.get(item.id);
        const currentModifiedAt = item.metadata.modifiedAt;
        const currentParentId = item.parentId;
        
        // Prüfe ob parentId sich geändert hat (Datei wurde in anderen Ordner verschoben)
        if (previous && previous.parentId && previous.parentId !== currentParentId) {
          return true; // parentId geändert = neu analysieren
        }
        
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
              // Library-Zielsprache statt hardcodiert 'de' (siehe effectiveTargetLanguage oben)
              targetLanguage: effectiveTargetLanguage,
            }));

          if (sources.length === 0) {
            FileLogger.debug('useShadowTwinAnalysis', 'Keine gültigen Sources für Bulk-API', {
              totalItems: itemsToAnalyze.length,
            });
            isAnalyzingRef.current = false;
            return;
          }

          // OPTIMIERUNG: Ein einziger Bulk-Call für beide Artefakt-Typen + Ingestion-Status + ListMeta
          const allResults = await batchResolveArtifactsClient({
            libraryId,
            sources,
            preferredKind: 'transformation',
            includeBoth: true, // Lade sowohl Transformation als auch Transcript
            includeIngestionStatus: true, // Lade auch Ingestion-Status
            includeListMeta: true, // Titel, Nummer, coverImageUrl für Dateiliste (Mongo-Pfad)
          });
          
          // Extrahiere Ergebnisse aus dem kombinierten Response
          const transformationResults = allResults.artifacts || new Map();
          const transcriptResults = allResults.transcripts || new Map();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _ingestionStatusMap = allResults.ingestionStatus || new Map();

          // Konvertiere ResolvedArtifactWithItem-Ergebnisse zu ShadowTwinState.
          // WICHTIG: Wir schreiben **für alle Dateien** einen Eintrag (auch wenn keine Artefakte existieren),
          // damit UI/Debug sauber zwischen "checked but empty" vs. "not analyzed yet" unterscheiden kann.
          const analyzedAt = Date.now()
          const currentFileById = new Map<string, StorageItem>()
          for (const it of currentFileItems) currentFileById.set(it.id, it)

          // Storage-Import-Kandidaten sammeln:
          // Im Mongo-Modus liefert der Server fuer Mongo-Artefakte virtuelle IDs.
          // Hat ein gefundenes Artefakt dagegen eine ECHTE Storage-ID, stammt es aus
          // dem Filesystem-Fallback (z.B. parallele Installation) und ist noch NICHT
          // in der MongoDB DIESER Library. Solche Quellen importieren wir sichtbar.
          const storageImportTargets: Array<{ sourceId: string; parentId: string }> = []

          setShadowTwinState((prev) => {
            const next = new Map<string, FrontendShadowTwinState>()

            // WICHTIG: Nur States für aktuelle Folder-Files behalten/aktualisieren.
            // Entferne alle Einträge, die nicht mehr im aktuellen Ordner sind.
            // Dies stellt sicher, dass beim Ordnerwechsel alte Einträge entfernt werden.
            const currentFileIds = new Set(currentFileItems.map(it => it.id));
            
            // Initialisiere States für alle aktuellen Dateien (auch wenn sie noch nicht analysiert wurden)
            for (const it of currentFileItems) {
              const prevState = prev.get(it.id)
              // Nur State behalten, wenn die Datei noch in der aktuellen Liste ist
              if (currentFileIds.has(it.id)) {
                next.set(it.id, {
                  ...prevState,
                  baseItem: it,
                  analysisTimestamp: prevState?.analysisTimestamp ?? analyzedAt,
                })
              }
            }

            // DIAGNOSE: Zeigt API-Ergebnis für jedes Item
            FileLogger.info('useShadowTwinAnalysis', 'Batch-Resolve Ergebnis', {
              transformationResultsSize: transformationResults.size,
              transcriptResultsSize: transcriptResults.size,
              transformationKeys: Array.from(transformationResults.keys()),
              itemIds: itemsToAnalyze.map(it => it.id),
            });

            for (const it of itemsToAnalyze) {
              const transformation = transformationResults.get(it.id)
              const transcript = transcriptResults.get(it.id)
              const ingestionStatus = allResults.ingestionStatus?.get(it.id)
              const listMeta = allResults.listMeta?.get(it.id)
              const hasArtifacts = Boolean(transformation || transcript)

              const transformed =
                transformation?.kind === 'transformation' && transformation.item ? transformation.item : undefined
              const transcriptFiles =
                transcript?.kind === 'transcript' && transcript.item ? [transcript.item] : undefined

              // DIAGNOSE: Für Dateien mit Artefakten oder ohne, logge Details
              if (!transformed && !transcriptFiles) {
                FileLogger.debug('useShadowTwinAnalysis', 'Kein Artefakt fuer Item', {
                  itemId: it.id,
                  itemName: it.metadata.name,
                  transformationRaw: transformation ? { kind: transformation.kind, hasItem: !!transformation.item } : null,
                  transcriptRaw: transcript ? { kind: transcript.kind, hasItem: !!transcript.item } : null,
                });
              }
              const shadowTwinFolderId = transformation?.shadowTwinFolderId || transcript?.shadowTwinFolderId

              // Storage-Fund erkennen: echte Storage-ID (keine virtuelle Mongo-ID).
              if (isMongoMode && it.parentId) {
                const foundFromStorage =
                  (transformation?.item && !isMongoShadowTwinId(transformation.item.id)) ||
                  (transcript?.item && !isMongoShadowTwinId(transcript.item.id))
                if (foundFromStorage) {
                  storageImportTargets.push({ sourceId: it.id, parentId: it.parentId })
                }
              }

              // Binary-Uploads sind möglich wenn:
              // - MongoDB-Modus aktiv ist (Upload geht direkt nach Azure), ODER
              // - Ein shadowTwinFolderId vorhanden ist (Filesystem-Modus)
              const binaryUploadEnabled = isMongoMode || Boolean(shadowTwinFolderId)
              
              const merged: FrontendShadowTwinState = {
                baseItem: it,
                transformed,
                transcriptFiles,
                shadowTwinFolderId,
                analysisTimestamp: analyzedAt,
                processingStatus: hasArtifacts ? 'ready' : 'pending',
                // Speichere Ingestion-Status für Status-Anzeige
                ingestionStatus: ingestionStatus ? {
                  exists: ingestionStatus.exists,
                  chunkCount: ingestionStatus.chunkCount,
                  chaptersCount: ingestionStatus.chaptersCount,
                } : undefined,
                // Metadaten für Dateiliste (Titel, Nummer, Cover) – nur bei Mongo-Pfad gefüllt
                listMeta: listMeta && (listMeta.title || listMeta.number || listMeta.coverImageUrl || listMeta.coverThumbnailUrl) ? listMeta : undefined,
                // Binary-Upload-Fähigkeit (abstrahiert Storage-Implementierung)
                binaryUploadEnabled,
              }

              next.set(it.id, merged)

              // Aktualisiere previousItemsRef (auch wenn keine Artefakte existieren)
              // Speichere auch parentId, um Ordnerwechsel zu erkennen
              const modifiedAt = it.metadata.modifiedAt
              previousItemsRef.current.set(it.id, {
                modifiedAt: modifiedAt instanceof Date ? modifiedAt : (modifiedAt ? new Date(modifiedAt) : undefined),
                parentId: it.parentId,
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

          // Sichtbarer Storage-Import: gefundene Artefakte in MongoDB nachfuehren,
          // damit sie persistent sind (Folgeaufrufe ohne FS-Scan) und der Anwender
          // sieht, dass gerade importiert wird (Aktivitaets-Indikator + Toast).
          if (libraryId && storageImportTargets.length > 0) {
            void importStorageArtifacts(libraryId, storageImportTargets, setImportActivity)
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
    }, 500); // 500ms Lazy Loading Delay - gibt UI Zeit zuerst zu rendern, Shadow-Twin-Icons erscheinen später

    // Cleanup: Setze isAnalyzingRef zurück bei Unmount und cancel Timeout
    // WICHTIG: Beim Ordnerwechsel wird der Timeout gecancelt und der State bereinigt
    return () => {
      clearTimeout(analysisTimeoutId);
      isAnalyzingRef.current = false;
      // Wenn items sich ändert (z.B. Ordnerwechsel), bereinige State für nicht mehr vorhandene Dateien
      if (items && items.length > 0) {
        const currentFileIds = new Set(items.filter(item => item.type === 'file').map(it => it.id));
        setShadowTwinState((prev) => {
          const next = new Map<string, FrontendShadowTwinState>();
          for (const [fileId, state] of prev.entries()) {
            if (currentFileIds.has(fileId)) {
              next.set(fileId, state);
            }
          }
          return next;
        });
      }
    };
  }, [items, libraryId, setShadowTwinState, forceRefresh]);

  // Gib aktuellen State zurück (wird vom Atom gelesen)
  // Da wir das Atom direkt setzen, können wir hier eine leere Map zurückgeben
  // Die Komponenten sollten das Atom direkt lesen
  return new Map();
}

