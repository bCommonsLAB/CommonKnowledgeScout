/**
 * @fileoverview Hook für das Laden von Migration-Runs und Binary-Fragments.
 *
 * @description
 * Extrahiert aus library-form.tsx (Welle 3-IV-a Modul-Split).
 * Enthält useEffect-basierte Lade-Logik für:
 * - Migration-Runs (wenn isDryRunOpen sich ändert)
 * - BinaryFragments aus MongoDB (wenn ein Run ausgewählt wird)
 *
 * H2-Fix: loadRuns-Catch loggt jetzt den Fehler explizit
 * (no-silent-fallbacks.mdc: leeres catch verboten).
 */

import { useEffect } from "react";
import type { MigrationRun } from "./use-shadow-twin-migration";

/** Typ für ein Binary-Fragment */
export interface BinaryFragment {
  sourceId: string;
  sourceName: string;
  name: string;
  kind: string;
  url?: string;
  hash?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

interface UseShadowTwinAnalysisProps {
  isDryRunOpen: boolean;
  activeLibraryId: string | null | undefined;
  selectedRun: MigrationRun | null;
  setMigrationRuns: (runs: MigrationRun[]) => void;
  setSelectedRunId: (id: string | null) => void;
  setBinaryFragments: (fragments: BinaryFragment[]) => void;
  setLoadingFragments: (v: boolean) => void;
}

/**
 * Hook für das Laden von Migration-Runs aus der API.
 * H2-Fix: Leeres Catch gefüllt mit console.error (no-silent-fallbacks).
 */
export function useMigrationRunsLoader({
  isDryRunOpen,
  activeLibraryId,
  setMigrationRuns,
  setSelectedRunId,
}: Pick<
  UseShadowTwinAnalysisProps,
  "isDryRunOpen" | "activeLibraryId" | "setMigrationRuns" | "setSelectedRunId"
>) {
  useEffect(() => {
    if (!isDryRunOpen || !activeLibraryId) return;

    let cancelled = false;
    async function loadRuns() {
      try {
        const res = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/migrations?limit=10`
        );
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
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
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        if (cancelled) return;
        const runsArray = Array.isArray(json.runs) ? json.runs : [];
        // Filtere Runs ohne params und Dry-Runs heraus
        const runs = runsArray.filter(
          (run): run is typeof run & { params: NonNullable<typeof run.params> } =>
            !!run?.params && !run.params.dryRun
        );
        setMigrationRuns(runs);
        if (runs.length > 0 && runs[0]?.runId) {
          setSelectedRunId(runs[0].runId);
        } else {
          setSelectedRunId(null);
        }
      } catch (err) {
        // H2-Fix: Explizites Logging statt stillem Fallback (no-silent-fallbacks.mdc)
        if (cancelled) return;
        console.error(
          "[LibraryForm] Migration-Runs konnten nicht geladen werden:",
          err
        );
        setMigrationRuns([]);
        setSelectedRunId(null);
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [isDryRunOpen, activeLibraryId, setMigrationRuns, setSelectedRunId]);
}

/**
 * Hook für das Laden von Binary-Fragments aus MongoDB.
 * Reagiert auf Änderungen des ausgewählten Runs.
 */
export function useBinaryFragmentsLoader({
  selectedRun,
  activeLibraryId,
  setBinaryFragments,
  setLoadingFragments,
}: Pick<
  UseShadowTwinAnalysisProps,
  "selectedRun" | "activeLibraryId" | "setBinaryFragments" | "setLoadingFragments"
>) {
  useEffect(() => {
    if (!selectedRun || !activeLibraryId || !selectedRun.report?.upsertedArtifacts) {
      setBinaryFragments([]);
      return;
    }

    let cancelled = false;
    const currentRun = selectedRun;
    async function loadFragments() {
      setLoadingFragments(true);
      try {
        const sourceIds = Array.from(
          new Set(
            (currentRun.report?.upsertedArtifacts ?? [])
              .map((a) => a.sourceId)
              .filter(Boolean)
          )
        );

        if (sourceIds.length === 0) {
          setBinaryFragments([]);
          return;
        }

        const res = await fetch(
          `/api/library/${activeLibraryId}/shadow-twins/binary-fragments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceIds }),
          }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as {
          fragments?: BinaryFragment[];
        };

        if (cancelled) return;
        setBinaryFragments(json.fragments ?? []);
      } catch (error) {
        if (cancelled) return;
        console.error("[LibraryForm] Fehler beim Laden der binaryFragments:", error);
        setBinaryFragments([]);
      } finally {
        if (!cancelled) {
          setLoadingFragments(false);
        }
      }
    }

    void loadFragments();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // selectedRun?.runId statt selectedRun: bewusst — nur bei Run-Wechsel neu laden, nicht bei jedem Objekt-Update
  }, [selectedRun?.runId, activeLibraryId, setBinaryFragments, setLoadingFragments]);
}
