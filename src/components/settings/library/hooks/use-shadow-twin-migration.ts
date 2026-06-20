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

import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Ob der "Aus Dateisystem laden"-Dialog offen ist (für Resume eines laufenden Laufs). */
  isDryRunOpen: boolean;
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
  isDryRunOpen,
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
  // Polling-Interval-Handle (lebt unabhängig vom POST, bis der Lauf terminal ist).
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Run-ID, die der Poller/das Refokus-Event aktuell beobachtet (null = kein aktiver Lauf).
  const activeRunIdRef = useRef<string | null>(null);
  // Verhindert doppelte Finalisierung/Toast (POST-Erfolg UND Poller könnten beide auslösen).
  const finalizedRunRef = useRef<string | null>(null);

  /** Setzt das aktuell gewählte Zielverzeichnis (aus dem StorageDirectoryPicker). */
  const setSelectedFolder = useCallback((folderId: string, path: string) => {
    setSelectedFolderId(folderId || "root");
    setSelectedFolderPath(path || "/");
  }, []);

  /**
   * Lädt die Migration-Runs neu und wählt den angegebenen Lauf aus.
   * Wird nach Abschluss eines Laufs aufgerufen, damit der Report sofort sichtbar ist.
   */
  const refreshRuns = useCallback(
    async (selectRunId: string) => {
      if (!activeLibraryId) return;
      try {
        const runsRes = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/migrations?limit=10`
        );
        if (!runsRes.ok) return;
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
        // Dry-Runs und Runs ohne params herausfiltern (wie im initialen Loader).
        const runs = runsArray.filter(
          (run): run is typeof run & { params: NonNullable<typeof run.params> } =>
            !!run?.params && !run.params.dryRun
        );
        setMigrationRuns(runs);
        setSelectedRunId(selectRunId);
      } catch (err) {
        console.error("[LibraryForm] Runs-Refresh fehlgeschlagen:", err);
      }
    },
    [activeLibraryId, setMigrationRuns, setSelectedRunId]
  );

  /** Stoppt das Polling und räumt den Interval-Handle auf. */
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * Finalisiert einen Lauf GENAU EINMAL: Polling stoppen, UI zurücksetzen,
   * Runs neu laden und passenden Toast zeigen. Wird ausgelöst, sobald der
   * Server-Status terminal ist (completed/failed/cancelled).
   */
  const finalizeRun = useCallback(
    (runId: string, status: MigrationProgress["status"]) => {
      if (finalizedRunRef.current === runId) return;
      finalizedRunRef.current = runId;
      stopPolling();
      activeRunIdRef.current = null;
      setDryRunRunning(false);
      setIsCancelling(false);
      void refreshRuns(runId);
      if (status === "failed") {
        toast({
          title: "Import fehlgeschlagen",
          description: "Der Lauf wurde mit Fehlern beendet. Details stehen im Report.",
          variant: "destructive",
        });
      } else if (status === "cancelled") {
        toast({
          title: "Import abgebrochen",
          description:
            "Der Lauf wurde abgebrochen. Bereits importierte Artefakte bleiben erhalten.",
        });
      } else {
        toast({
          title: "Import abgeschlossen",
          description:
            "Die Artefakte wurden aus dem Dateisystem in den Cache geladen. Der Report wird in der Tabelle angezeigt.",
        });
      }
    },
    [stopPolling, refreshRuns, setDryRunRunning]
  );

  /**
   * Fragt den Run-Status EINMAL ab, aktualisiert den Fortschritt und
   * finalisiert bei Endzustand. Fehler sind unkritisch (nächster Tick).
   */
  const pollRunOnce = useCallback(
    async (runId: string) => {
      if (!activeLibraryId) return;
      try {
        const r = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/migrations/${runId}`
        );
        if (!r.ok) return;
        const j = (await r.json()) as {
          run?: {
            status: MigrationProgress["status"];
            steps?: Array<{ name: string; meta?: Record<string, unknown> }>;
          };
        };
        if (!j.run) return;
        const derived = deriveProgress(j.run);
        setMigrationProgress(derived);
        if (derived.status !== "running") finalizeRun(runId, derived.status);
      } catch {
        // Polling-Fehler sind unkritisch – nächster Tick versucht es erneut.
      }
    },
    [activeLibraryId, finalizeRun]
  );

  /** Startet das Polling für einen Lauf (idempotent, 2,5s-Intervall). */
  const startPolling = useCallback(
    (runId: string) => {
      activeRunIdRef.current = runId;
      finalizedRunRef.current = null;
      stopPolling();
      pollRef.current = setInterval(() => {
        void pollRunOnce(runId);
      }, 2500);
    },
    [pollRunOnce, stopPolling]
  );

  /**
   * Startet die Migration: Artefakte aus dem Dateisystem in den Cache laden.
   *
   * Robustheit (Variante B): Das Polling läuft UNABHÄNGIG vom langen POST und
   * finalisiert erst beim terminalen Server-Status. So bleibt die Anzeige korrekt,
   * selbst wenn der POST von einem Proxy gekappt wird oder der Tab zwischendurch
   * schläft. Echte Server-Fehler (HTTP 4xx/5xx mit JSON) werden sofort gemeldet;
   * Netzwerk-/Timeout-Abbrüche überlässt der Client dem Poller.
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

    // Poller starten — er besitzt ab jetzt die Finalisierung (Toast + UI-Reset).
    startPolling(runId);

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
        runId?: string;
        status?: MigrationProgress["status"];
        error?: string;
      };

      if (!res.ok) {
        // Echter Server-Fehler (z.B. 400 "Mongo inaktiv"): sofort als Fehler beenden.
        // finalizedRunRef setzen, damit der Poller nicht zusätzlich finalisiert.
        finalizedRunRef.current = runId;
        stopPolling();
        activeRunIdRef.current = null;
        const message = json.error ?? `HTTP ${res.status}`;
        setDryRunError(message);
        setDryRunRunning(false);
        setIsCancelling(false);
        toast({ title: "Import fehlgeschlagen", description: message, variant: "destructive" });
        return;
      }

      // Erfolg: Der POST hat das Endergebnis geliefert. Sofort einmal pollen,
      // damit der Endzustand ohne Warten auf den nächsten Tick finalisiert wird.
      await pollRunOnce(runId);
    } catch (error) {
      // Netzwerk-/Timeout-Abbruch (z.B. Proxy kappt den langen POST): NICHT als
      // Fehlschlag werten — der Server kann noch laufen. Der Poller ermittelt den
      // Endzustand. Ein sofortiger Poll aktualisiert den Status direkt.
      console.warn("[LibraryForm] Migration-POST unterbrochen, Polling übernimmt:", error);
      await pollRunOnce(runId);
    }
  }, [
    activeLibraryId,
    selectedFolderId,
    dryRunRecursive,
    dryRunCleanupFilesystem,
    startPolling,
    pollRunOnce,
    stopPolling,
    setDryRunRunning,
    setDryRunError,
  ]);

  // Aufräumen beim Unmount: laufendes Polling stoppen (kein Memory-Leak).
  useEffect(() => stopPolling, [stopPolling]);

  // Bei Tab-Refokus sofort den Status abfragen (Hintergrund-Timer sind gedrosselt).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && activeRunIdRef.current) {
        void pollRunOnce(activeRunIdRef.current);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pollRunOnce]);

  // Versöhnung beim Öffnen: Falls der jüngste Lauf noch läuft, Anzeige + Polling
  // wieder aufnehmen (deckt Reload während eines Laufs / Wiederkehr nach Schlaf ab).
  useEffect(() => {
    if (!isDryRunOpen || !activeLibraryId) return;
    if (pollRef.current) return; // bereits am Pollen (laufende Session)
    let cancelled = false;
    async function resumeIfRunning() {
      try {
        const res = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/migrations?limit=1`
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          runs?: Array<{
            runId: string;
            status: MigrationProgress["status"];
            params?: { dryRun?: boolean };
          }>;
        };
        const latest = (json.runs ?? [])[0];
        if (cancelled || !latest) return;
        if (latest.status === "running" && !latest.params?.dryRun) {
          setCurrentRunId(latest.runId);
          setDryRunRunning(true);
          startPolling(latest.runId);
          void pollRunOnce(latest.runId); // sofort echte Steps holen
        }
      } catch (err) {
        console.error("[LibraryForm] Resume-Check fehlgeschlagen:", err);
      }
    }
    void resumeIfRunning();
    return () => {
      cancelled = true;
    };
  }, [isDryRunOpen, activeLibraryId, startPolling, pollRunOnce, setDryRunRunning]);

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
