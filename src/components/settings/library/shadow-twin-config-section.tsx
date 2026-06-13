"use client"

/**
 * @fileoverview Shadow-Twin-Konfigurationsbereich für die Library-Einstellungen.
 *
 * @description
 * Seit dem Alt-Logik-Cleanup (2026-06-12, v2-only Runtime) stark gekuerzt:
 * Modus-Anzeige und Primary-Store-Auswahl sind entfernt — es gilt immer
 * v2 mit Cache als primaerem Speicher. Sichtbar bleiben die optionalen
 * Dateisystem-Flags, Strategie-Vorschau, Analyse und Export; Bestands-
 * Libraries mit legacy-Flag erhalten einen Upgrade-Banner.
 *
 * Hinweis: library.type-Branches in Settings sind gemäß storage-abstraction.mdc
 * und welle-3-iv-settings-contracts.mdc §4 explizit erlaubt.
 */

import { Button } from "@/components/ui/button"
import {
  FormDescription,
  FormLabel,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { Search } from "lucide-react"
import { useState } from "react"
import { type Library, type ClientLibrary } from "@/types/library"
import { getMediaStorageStrategy } from "@/lib/shadow-twin/media-storage-strategy"
import type { AnalysisReport } from "./hooks/use-shadow-twin-migration"

interface ShadowTwinConfigSectionProps {
  activeLibraryId: string | null | undefined;
    // ClientLibrary statt Library: library-form.tsx uebergibt ClientLibrary (kein 'transcription'-Feld).
  activeLibrary: ClientLibrary | undefined;
  shadowTwinPersistToFilesystem: boolean;
  setShadowTwinPersistToFilesystem: (v: boolean) => void;
  shadowTwinAllowFilesystemFallback: boolean;
  setShadowTwinAllowFilesystemFallback: (v: boolean) => void;
  azureConfigured: boolean | null;
  isSyncRunning: boolean;
  runDirectionalSync: (direction: "to-storage" | "to-cache" | "both") => Promise<void>;
  isAnalyzing: boolean;
  analysisReport: AnalysisReport | null;
  runAnalysis: () => Promise<void>;
}

/**
 * Section-Komponente: Shadow-Twin-Konfiguration + Strategie-Vorschau + Analyse.
 * Wird nur angezeigt wenn !isNew && activeLibrary vorhanden.
 */
export function ShadowTwinConfigSection({
  activeLibraryId,
  activeLibrary,
  shadowTwinPersistToFilesystem,
  setShadowTwinPersistToFilesystem,
  shadowTwinAllowFilesystemFallback,
  setShadowTwinAllowFilesystemFallback,
  azureConfigured,
  isSyncRunning,
  runDirectionalSync,
  isAnalyzing,
  analysisReport,
  runAnalysis,
}: ShadowTwinConfigSectionProps) {
  const [isUpgradingShadowTwinMode, setIsUpgradingShadowTwinMode] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);

  // Alt-Bestand erkennen: Die Runtime ist v2-only — der Banner erscheint
  // NUR noch, solange eine Bestands-Library das alte legacy-Flag traegt
  // (User-Entscheid 2026-06-12: Alt-Logik entfernen, 04/C1).
  const configMode = (activeLibrary?.config?.shadowTwin as { mode?: unknown } | undefined)?.mode;
  const isLegacy = !justUpgraded && configMode !== "v2";

  /** Upgrade-Handler: Bestands-Library auf v2 heben (setzt nur das Flag) */
  const handleUpgradeToV2 = async () => {
    if (!activeLibraryId) return;

    setIsUpgradingShadowTwinMode(true);
    try {
      const response = await fetch(
        `/api/library/${activeLibraryId}/shadow-twin-mode`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Setzt nur das Konfigurations-Flag, keine Migration/Conversion
          body: JSON.stringify({ mode: "v2" }),
        }
      );

      if (!response.ok) {
        throw new Error("Fehler beim Konvertieren");
      }

      await response.json();
      setJustUpgraded(true);

      toast({
        title: "Shadow-Twin-Modus aktualisiert",
        description:
          "Die Bibliothek ist jetzt auf v2 gestellt (ohne Migration bestehender Artefakte).",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description:
          error instanceof Error ? error.message : "Fehler beim Konvertieren",
        variant: "destructive",
      });
    } finally {
      setIsUpgradingShadowTwinMode(false);
    }
  };

  /** Leitet die Strategie clientseitig aus den Flags + azureConfigured ab (v2: Cache ist primär) */
  const computeStrategy = () => {
    const previewLib = {
      config: {
        shadowTwin: {
          primaryStore: "mongo",
          persistToFilesystem: shadowTwinPersistToFilesystem,
          allowFilesystemFallback: shadowTwinAllowFilesystemFallback,
        },
      },
    } as unknown as Library;
    const azureKnown = typeof azureConfigured === "boolean";
    return azureKnown ? getMediaStorageStrategy(previewLib, azureConfigured!) : null;
  };

  const strategy = computeStrategy();
  const azureKnown = typeof azureConfigured === "boolean";

  const badgeColor =
    strategy?.mode === "azure-only"
      ? "bg-blue-100 text-blue-900 border-blue-300"
      : strategy?.mode === "azure-with-fs-backup"
      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
      : strategy?.mode === "filesystem-only"
      ? "bg-slate-100 text-slate-900 border-slate-300"
      : "bg-red-100 text-red-900 border-red-300";

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Alt-Bestand: Hinweis nur fuer Libraries mit altem legacy-Flag */}
      {isLegacy && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Diese Bibliothek nutzt noch das alte Format (legacy)
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Verarbeitung und Erstellung funktionieren erst nach der Umstellung
            auf v2. Es wird nur das Konfigurations-Flag gesetzt — bestehende
            Artefakte bleiben unverändert.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleUpgradeToV2()}
            disabled={isUpgradingShadowTwinMode}
          >
            {isUpgradingShadowTwinMode ? "Stelle um..." : "Auf v2 umstellen"}
          </Button>
        </div>
      )}

      {/* Dateisystem-Optionen (Artefakte liegen im Cache; Dateisystem optional) */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">Dateisystem-Optionen</h4>
          <p className="text-xs text-muted-foreground">
            Artefakte liegen im Cache. Optional können sie zusätzlich ins
            Dateisystem geschrieben bzw. von dort gelesen werden.
          </p>
        </div>
        <div className="flex items-center justify-between rounded border p-3">
          <div>
            <FormLabel className="text-sm">Persist to Filesystem</FormLabel>
            <FormDescription>Artefakte zusätzlich ins Dateisystem schreiben.</FormDescription>
          </div>
          <Switch
            checked={shadowTwinPersistToFilesystem}
            onCheckedChange={setShadowTwinPersistToFilesystem}
          />
        </div>
        <div className="flex items-center justify-between rounded border p-3">
          <div>
            <FormLabel className="text-sm">Filesystem Fallback</FormLabel>
            <FormDescription>
              Aus dem Dateisystem lesen, wenn kein Cache‑Eintrag vorhanden ist. Standardmäßig
              deaktiviert – nur bei Bedarf aktivieren.
            </FormDescription>
          </div>
          <Switch
            checked={shadowTwinAllowFilesystemFallback}
            onCheckedChange={setShadowTwinAllowFilesystemFallback}
          />
        </div>
      </div>

      {/* Effektive Media-Storage-Strategie */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Effektive Medien‑Speicher‑Strategie</h4>
          {strategy && (
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono ${badgeColor}`}
            >
              {strategy.mode}
            </span>
          )}
        </div>
        {!azureKnown && (
          <p className="text-xs text-muted-foreground">Strategie wird ermittelt…</p>
        )}
        {strategy && (
          <>
            <p className="text-xs text-muted-foreground">{strategy.rationale}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
              <li>
                Schreiben nach Azure:{" "}
                <span className="font-mono">{String(strategy.writeToAzure)}</span>
              </li>
              <li>
                Schreiben ins Filesystem:{" "}
                <span className="font-mono">{String(strategy.writeToFilesystem)}</span>
              </li>
              <li>
                Lese‑Quelle: <span className="font-mono">{strategy.readPreferredSource}</span>
              </li>
              <li>
                Filesystem‑Fallback beim Lesen:{" "}
                <span className="font-mono">{String(strategy.allowFilesystemFallbackOnRead)}</span>
              </li>
              <li>
                Azure konfiguriert:{" "}
                <span className="font-mono">{String(azureConfigured)}</span>
              </li>
            </ul>
            {strategy.mode === "unavailable" && (
              <p className="text-xs font-medium text-red-700">
                Achtung: Bilder können in dieser Konfiguration weder geschrieben noch gelesen werden.
                Bitte Azure konfigurieren oder „Persist to Filesystem&quot; aktivieren.
              </p>
            )}
          </>
        )}
      </div>

      {/* Analyse */}
      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium">Analyse</h4>
            <p className="text-xs text-muted-foreground">
              Vergleicht Storage und Cache und zeigt, was synchronisiert werden müsste – ohne etwas
              zu verändern.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!activeLibraryId || isAnalyzing}
            onClick={() => void runAnalysis()}
          >
            <Search className={`h-4 w-4 mr-2 ${isAnalyzing ? "animate-pulse" : ""}`} />
            {isAnalyzing ? "Analysiert…" : "Analysieren"}
          </Button>
        </div>
        {analysisReport && (
          <div className="mt-2 rounded border p-3 text-xs space-y-2">
            <div className="font-medium">Analyse-Ergebnis</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Dateien im Storage:</span>
              <span className="font-mono">{analysisReport.scanned}</span>
              <span>Davon mit Cache-Eintrag:</span>
              <span className="font-mono">{analysisReport.withShadowTwin}</span>
            </div>
            {(analysisReport.markdownToStorage > 0 || analysisReport.imagesWritten > 0) && (
              <div className="border-t pt-1.5">
                <div className="text-xs font-medium text-muted-foreground mb-0.5">
                  Cache → Dateisystem (Export)
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  {analysisReport.markdownToStorage > 0 && (
                    <>
                      <span>Markdown-Dateien:</span>
                      <span className="font-mono text-green-600">
                        {analysisReport.markdownToStorage}
                      </span>
                    </>
                  )}
                  {analysisReport.imagesWritten > 0 && (
                    <>
                      <span>Bilder:</span>
                      <span className="font-mono text-green-600">
                        {analysisReport.imagesWritten}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            {analysisReport.markdownToCache > 0 && (
              <div className="border-t pt-1.5">
                <div className="text-xs font-medium text-muted-foreground mb-0.5">
                  Dateisystem → Cache (Import)
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span>Markdown-Dateien:</span>
                  <span className="font-mono text-blue-600">
                    {analysisReport.markdownToCache}
                  </span>
                </div>
              </div>
            )}
            {analysisReport.sourceNewer > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground border-t pt-1.5">
                <span>Quelldatei neuer (Pipeline nötig):</span>
                <span className="font-mono text-amber-600">{analysisReport.sourceNewer}</span>
              </div>
            )}
            {analysisReport.errors > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                <span>Fehler:</span>
                <span className="font-mono text-red-600">{analysisReport.errors}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Bereits synchron:</span>
              <span className="font-mono">{analysisReport.alreadySynced}</span>
              {analysisReport.imagesSkipped > 0 && (
                <>
                  <span>Bilder bereits vorhanden:</span>
                  <span className="font-mono">{analysisReport.imagesSkipped}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ins Dateisystem exportieren */}
      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium">Ins Dateisystem exportieren</h4>
            <p className="text-xs text-muted-foreground">
              Schreibt alle Artefakte und Bilder aus dem Cache ins Dateisystem. Geeignet als Backup
              oder für die Einrichtung auf einem neuen System.
            </p>
          </div>
          <ConfirmActionDialog
            title="Alle Artefakte ins Dateisystem exportieren?"
            description="Schreibt alle Artefakte und Bilder aus dem Cache ins Dateisystem. Vorhandene Artefakt-Dateien werden dabei überschrieben."
            confirmLabel="Exportieren"
            onConfirm={() => void runDirectionalSync("to-storage")}
            trigger={
              <Button
                type="button"
                variant="outline"
                disabled={!activeLibraryId || isSyncRunning}
              >
                <Search className={`h-4 w-4 mr-2 ${isSyncRunning ? "animate-spin" : ""}`} />
                {isSyncRunning ? "Exportiert…" : "Exportieren"}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
