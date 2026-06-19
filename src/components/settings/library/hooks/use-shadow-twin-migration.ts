/**
 * @fileoverview Hook für Shadow-Twin-Migration und Storage-Synchronisation.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält alle Callbacks für Shadow-Twin-Migration, Sync und Sprach-Bereinigung.
 *
 * Zuständigkeiten:
 * - runShadowTwinMigration: Liest Artefakte aus dem Dateisystem in den Cache
 * - runDirectionalSync: Sync in eine Richtung (to-storage | to-cache | both)
 * - runLanguageCleanup: Löscht Artefakte einer bestimmten Sprache
 * - loadMigrationRuns: Lädt Migration-Runs aus der API
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";

/** Live-Fortschritt eines Migrations-Laufs (aus den Mongo-Steps abgeleitet). */
export interface MigrationProgress {
  scanned: number;
  total: number;
  upserted: number;
  status: "running" | "completed" | "failed" | "cancelled";
}

/**
 * Leitet aus einem Run-Dokument (inkl. steps) den aktuellen Fortschritt ab.
 * scan_done liefert die Gesamtzahl (total), progress-Steps die laufenden Zähler.
 */
function deriveProgress(run: {
  status: MigrationProgress["status"];
  steps?: Array<{ name: string; meta?: Record<string, unknown> }>;
}): MigrationProgress {
  let scanned = 0;
  let total = 0;
  let upserted = 0;
  for (const step of run.steps ?? []) {
    const meta = step.meta ?? {};
    if (step.name === "scan_done" && typeof meta.files === "number") total = meta.files;
    if (step.name === "progress") {
      if (typeof meta.scanned === "number") scanned = meta.scanned;
      if (typeof meta.total === "number") total = meta.total;
      if (typeof meta.upserted === "number") upserted = meta.upserted;
    }
  }
  return { scanned, total, upserted, status: run.status };
}

/** Typ für einen einzelnen Migration-Run */
export interface MigrationRun {
  runId: string;
  status: "running" | "completed" | "failed";
  params: {
    folderId?: string;
    recursive?: boolean;
    dryRun?: boolean;
    cleanupFilesystem?: boolean;
    limit?: number;
  };
  startedAt: string;
  finishedAt?: string;
  steps?: Array<{ name: string; at: string; meta?: Record<string, unknown> }>;
  report?: {
    upsertedArtifacts?: Array<{
      sourceId: string;
      sourceName: string;
      artifactFileName: string;
      kind: "transcript" | "transformation";
      targetLanguage: string;
      templateName?: string;
      mongoUpserted: boolean;
      blobImages?: number;
      blobErrors?: number;
      binaryFragmentsCount?: number;
      markdownFiles?: number;
      imageFiles?: number;
      audioFiles?: number;
      videoFiles?: number;
      otherFiles?: number;
      filesystemDeleted: boolean;
    }>;
    upsertedArtifactsTruncated?: boolean;
  };
}

/** Typ für den Analysis-Report */
export interface AnalysisReport {
  scanned: number;
  withShadowTwin: number;
  markdownToCache: number;
  markdownToStorage: number;
  imagesWritten: number;
  imagesSkipped: number;
  alreadySynced: number;
  sourceNewer: number;
  errors: number;
}

/** Props für den useShadowTwinMigration Hook */
interface UseShadowTwinMigrationProps {
  activeLibraryId: string | null | undefined;
  dryRunRecursive: boolean;
  dryRunCleanupFilesystem: boolean;
  langCleanupLang: string;
  setDryRunRunning: (v: boolean) => void;
  setDryRunError: (v: string | null) => void;
  setMigrationRuns: (runs: MigrationRun[]) => void;
  setSelectedRunId: (id: string | null) => void;
  setIsSyncRunning: (v: boolean) => void;
  setIsAnalyzing: (v: boolean) => void;
  setAnalysisReport: (report: AnalysisReport | null) => void;
  setIsLangAnalyzing: (v: boolean) => void;
  setIsLangDeleting: (v: boolean) => void;
  setLangCleanupResult: (result: LangCleanupResult | null) => void;
}

/** Typ für das Sprach-Bereinigungsergebnis */
export interface LangCleanupResult {
  dryRun: boolean;
  targetLanguage: string;
  totalArtifacts: number;
  totalFiles: number;
  storageDeleted: number | null;
  affectedFiles: Array<{
    sourceName: string;
    artifacts: Array<{ kind: string; templateName: string | null }>;
  }>;
}

/**
 * Hook für Shadow-Twin-Migration, Sync und Sprach-Bereinigung.
 * Alle API-Callbacks sind stabilisiert via useCallback.
 */
export function useShadowTwinMigration({
  activeLibraryId,
  dryRunRecursive,
  dryRunCleanupFilesystem,
  langCleanupLang,
  setDryRunRunning,
  setDryRunError,
  setMigrationRuns,
  setSelectedRunId,
  setIsSyncRunning,
  setIsAnalyzing,
  setAnalysisReport,
  setIsLangAnalyzing,
  setIsLangDeleting,
  setLangCleanupResult,
}: UseShadowTwinMigrationProps) {
  // Auswahl des zu rekonstruierenden Verzeichnisses (Default: Library-Root).
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("/");
  // Live-Fortschritt + aktuelle Run-ID (für Polling/Abbruch).
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  // Polling-Interval-Handle (wird im finally aufgeräumt).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Setzt das aktuell gewählte Zielverzeichnis (aus dem StorageDirectoryPicker). */
  const setSelectedFolder = useCallback((folderId: string, path: string) => {
    setSelectedFolderId(folderId || "root");
    setSelectedFolderPath(path || "/");
  }, []);

  /**
   * Startet die Migration: Artefakte aus dem Dateisystem in den Cache laden.
   * H2-Fix: Fehler werden geloggt + User via Toast informiert.
   * Pollt während des Laufs den Fortschritt (x/y) über die Run-Status-Route.
   */
  const runShadowTwinMigration = useCallback(async () => {
    if (!activeLibraryId) {
      toast({
        title: "Fehler",
        description: "Keine aktive Library gewählt.",
        variant: "destructive",
      });
      return;
    }

    // Client-seitige Run-ID, damit wir sofort pollen und abbrechen können.
    const runId = crypto.randomUUID();
    setCurrentRunId(runId);
    setIsCancelling(false);
    setMigrationProgress({ scanned: 0, total: 0, upserted: 0, status: "running" });
    setDryRunRunning(true);
    setDryRunError(null);

    // Fortschritt regelmäßig abfragen (Steps werden serverseitig geschrieben).
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/library/${activeLibraryId}/shadow-twins/migrations/${runId}`
          );
          if (!r.ok) return;
          const j = (await r.json()) as {
            run?: { status: MigrationProgress["status"]; steps?: Array<{ name: string; meta?: Record<string, unknown> }> };
          };
          if (j.run) setMigrationProgress(deriveProgress(j.run));
        } catch {
          // Polling-Fehler sind unkritisch – nächster Tick versucht es erneut.
        }
      })();
    }, 2500);

    try {
      const res = await fetch(`/api/library/${activeLibraryId}/shadow-twins/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId || "root",
          recursive: dryRunRecursive,
          dryRun: false,
          cleanupFilesystem: dryRunCleanupFilesystem,
          runId,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        report?: Record<string, unknown>;
        runId?: string;
        status?: MigrationProgress["status"];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      // Nach erfolgreichem Upsert: Migration-Runs neu laden und den neuen Run auswählen
      if (json.runId) {
        const runsRes = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/migrations?limit=10`
        );
        if (runsRes.ok) {
          const runsJson = (await runsRes.json()) as {
            runs?: Array<{
              runId: string;
              status: "running" | "completed" | "failed";
              params?: {
                folderId?: string;
                recursive?: boolean;
                dryRun?: boolean;
                cleanupFilesystem?: boolean;
                limit?: number;
              };
              startedAt: string;
            }>;
          };
          const runsArray = Array.isArray(runsJson.runs) ? runsJson.runs : [];
          // Dry-Runs und Runs ohne params herausfiltern
          const runs = runsArray.filter(
            (run): run is typeof run & { params: NonNullable<typeof run.params> } =>
              !!run?.params && !run.params.dryRun
          );
          setMigrationRuns(runs);
          setSelectedRunId(json.runId as string);
        }
      }
      const wasCancelled = json.status === "cancelled";
      toast({
        title: wasCancelled ? "Import abgebrochen" : "Import abgeschlossen",
        description: wasCancelled
          ? "Der Lauf wurde abgebrochen. Bereits importierte Artefakte bleiben erhalten."
          : "Die Artefakte wurden aus dem Dateisystem in den Cache geladen. Der Report wird in der Tabelle angezeigt.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDryRunError(message);
      toast({
        title: "Import fehlgeschlagen",
        description: message,
        variant: "destructive",
      });
    } finally {
      // Polling stoppen und letzten Fortschritt einmal final aktualisieren.
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setDryRunRunning(false);
      setIsCancelling(false);
    }
  }, [
    activeLibraryId,
    selectedFolderId,
    dryRunRecursive,
    dryRunCleanupFilesystem,
    setDryRunRunning,
    setDryRunError,
    setMigrationRuns,
    setSelectedRunId,
  ]);

  /**
   * Bricht den laufenden Migrations-Lauf kooperativ ab (DELETE auf die Run-Route).
   * Der Server beendet die Schleife sauber; bereits importierte Artefakte bleiben erhalten.
   */
  const cancelMigration = useCallback(async () => {
    if (!activeLibraryId || !currentRunId) return;
    setIsCancelling(true);
    try {
      const res = await fetch(
        `/api/library/${activeLibraryId}/shadow-twins/migrations/${currentRunId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast({
        title: "Abbruch angefordert",
        description: "Der Lauf wird nach dem aktuellen Schritt beendet.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIsCancelling(false);
      toast({ title: "Abbruch fehlgeschlagen", description: message, variant: "destructive" });
    }
  }, [activeLibraryId, currentRunId]);

  /**
   * Sync mit Richtungswahl: Export (to-storage), Import (to-cache), oder bidirektional.
   */
  const runDirectionalSync = useCallback(
    async (direction: "to-storage" | "to-cache" | "both") => {
      if (!activeLibraryId) {
        toast({
          title: "Fehler",
          description: "Keine aktive Bibliothek gewählt.",
          variant: "destructive",
        });
        return;
      }
      setIsSyncRunning(true);
      try {
        const res = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/sync-all`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: "root", recursive: true, direction }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          report?: AnalysisReport;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

        const r = json.report;
        if (r) {
          const parts: string[] = [];
          if (r.markdownToCache > 0) parts.push(`${r.markdownToCache} Markdown → Cache`);
          if (r.markdownToStorage > 0) parts.push(`${r.markdownToStorage} Markdown → Storage`);
          if (r.imagesWritten > 0) parts.push(`${r.imagesWritten} Bilder → Storage`);
          if (r.sourceNewer > 0) parts.push(`${r.sourceNewer} Pipeline nötig`);
          if (r.errors > 0) parts.push(`${r.errors} Fehler`);

          const label =
            direction === "to-storage"
              ? "Export"
              : direction === "to-cache"
              ? "Import"
              : "Sync";
          toast({
            title: parts.length > 0 ? `${label} abgeschlossen` : "Alles synchron",
            description:
              parts.length > 0
                ? parts.join(", ")
                : `${r.scanned} Dateien geprüft, alle synchron.`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({
          title: "Sync fehlgeschlagen",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsSyncRunning(false);
      }
    },
    [activeLibraryId, setIsSyncRunning]
  );

  /**
   * Analyse: DryRun von sync-all — scannt Storage + Cache und zeigt was synchronisiert würde.
   */
  const runAnalysis = useCallback(async () => {
    if (!activeLibraryId) {
      toast({
        title: "Fehler",
        description: "Keine aktive Bibliothek gewählt.",
        variant: "destructive",
      });
      return;
    }
    setIsAnalyzing(true);
    setAnalysisReport(null);
    try {
      const res = await fetch(
        `/api/library/${activeLibraryId}/shadow-twins/sync-all`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId: "root",
            recursive: true,
            dryRun: true,
            direction: "both",
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        report?: AnalysisReport;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      if (json.report) {
        setAnalysisReport(json.report);
      }
      toast({
        title: "Analyse abgeschlossen",
        description: "Storage und Cache wurden verglichen.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Analyse fehlgeschlagen",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeLibraryId, setIsAnalyzing, setAnalysisReport]);

  /**
   * Sprach-Bereinigung: Analyse (Dry-Run) oder tatsächliches Löschen.
   */
  const runLanguageCleanup = useCallback(
    async (dryRun: boolean) => {
      if (!activeLibraryId || !langCleanupLang.trim()) return;

      if (dryRun) setIsLangAnalyzing(true);
      else setIsLangDeleting(true);

      try {
        const res = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/delete-by-language`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetLanguage: langCleanupLang.trim(), dryRun }),
          }
        );
        const json = (await res.json().catch(() => ({}))) as LangCleanupResult & {
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

        setLangCleanupResult(json);

        if (!dryRun) {
          toast({
            title: "Bereinigung abgeschlossen",
            description: `${json.totalArtifacts} Artefakte in ${json.totalFiles} Dateien gelöscht (${json.storageDeleted ?? 0} Dateien aus Storage entfernt).`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast({ title: "Fehler", description: message, variant: "destructive" });
      } finally {
        setIsLangAnalyzing(false);
        setIsLangDeleting(false);
      }
    },
    [
      activeLibraryId,
      langCleanupLang,
      setIsLangAnalyzing,
      setIsLangDeleting,
      setLangCleanupResult,
    ]
  );

  return {
    runShadowTwinMigration,
    runDirectionalSync,
    runAnalysis,
    runLanguageCleanup,
    // Verzeichnis-Auswahl + Live-Fortschritt + Abbruch
    selectedFolderId,
    selectedFolderPath,
    setSelectedFolder,
    migrationProgress,
    currentRunId,
    isCancelling,
    cancelMigration,
  };
}
