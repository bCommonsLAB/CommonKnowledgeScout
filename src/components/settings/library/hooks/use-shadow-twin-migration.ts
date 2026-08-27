/**
 * @fileoverview Hook fuer die Sprach-Bereinigung der Library-Einstellungen.
 *
 * @description
 * Welle 5d: Der fruehere Migrations-Teil („Aus Dateisystem laden" mit eigenem
 * Migrations-Lauf, Run-Historie, Polling und Abbruch) ist entfallen — der
 * Import faehrt jetzt die Sync-Engine (Preset `import`) und lebt im
 * Reconcile-Panel (shadow-twin-reconcile-panel.tsx). Uebrig bleibt die
 * Sprach-Bereinigung (delete-by-language) fuer die LanguageCleanupSection.
 */

import { useCallback } from "react";
import { toast } from '@ks/ui'

/** Typ fuer das Sprach-Bereinigungsergebnis */
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

/** Props fuer den useShadowTwinMigration Hook */
interface UseShadowTwinMigrationProps {
  activeLibraryId: string | null | undefined;
  langCleanupLang: string;
  setIsLangAnalyzing: (v: boolean) => void;
  setIsLangDeleting: (v: boolean) => void;
  setLangCleanupResult: (result: LangCleanupResult | null) => void;
}

/** Hook fuer die Sprach-Bereinigung (Analyse als Dry-Run oder Loeschen). */
export function useShadowTwinMigration({
  activeLibraryId,
  langCleanupLang,
  setIsLangAnalyzing,
  setIsLangDeleting,
  setLangCleanupResult,
}: UseShadowTwinMigrationProps) {
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

  return { runLanguageCleanup };
}
