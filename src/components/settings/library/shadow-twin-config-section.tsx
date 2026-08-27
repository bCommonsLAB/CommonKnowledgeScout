"use client"

/**
 * @fileoverview Shadow-Twin-Konfigurationsbereich für die Library-Einstellungen.
 *
 * @description
 * Seit dem Alt-Logik-Cleanup (2026-06-12, v2-only Runtime) stark gekuerzt:
 * Modus-Anzeige und Primary-Store-Auswahl sind entfernt — es gilt immer
 * v2 mit Cache als primaerem Speicher. Sichtbar bleiben die optionalen
 * Dateisystem-Flags und die Strategie-Vorschau; Analyse/Export wanderten
 * mit Welle 4 ins Reconcile-Panel (Pruefen & Reparieren). Bestands-
 * Libraries mit legacy-Flag erhalten einen Upgrade-Banner.
 *
 * Hinweis: library.type-Branches in Settings sind gemäß storage-abstraction.mdc
 * und welle-3-iv-settings-contracts.mdc §4 explizit erlaubt.
 */

import { Button, FormDescription, FormLabel, Switch, toast } from '@ks/ui'
import { useState } from "react"
import { type Library, type ClientLibrary } from "@/types/library"
import { getMediaStorageStrategy } from "@/lib/shadow-twin/media-storage-strategy"

interface ShadowTwinConfigSectionProps {
  activeLibraryId: string | null | undefined;
    // ClientLibrary statt Library: library-form.tsx uebergibt ClientLibrary (kein 'transcription'-Feld).
  activeLibrary: ClientLibrary | undefined;
  shadowTwinPersistToFilesystem: boolean;
  setShadowTwinPersistToFilesystem: (v: boolean) => void;
  shadowTwinAllowFilesystemFallback: boolean;
  setShadowTwinAllowFilesystemFallback: (v: boolean) => void;
  azureConfigured: boolean | null;
}

/**
 * Section-Komponente: Shadow-Twin-Konfiguration + Strategie-Vorschau.
 * Analyse/Export sind seit Welle 4 im Reconcile-Panel (Pruefen & Reparieren).
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

  /**
   * Leitet die Strategie clientseitig ab: echte Library-Config, ueberlagert
   * mit den (ggf. ungespeicherten) Schalter-Werten. Kein erfundener
   * primaryStore — das Defaulting kommt aus getShadowTwinConfig und ist
   * damit identisch mit dem, was der Server rechnet.
   */
  const computeStrategy = () => {
    const previewLib = {
      ...activeLibrary,
      config: {
        ...activeLibrary?.config,
        shadowTwin: {
          ...(activeLibrary?.config?.shadowTwin ?? {}),
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

      {/* Analyse und Export sind seit Welle 4 im Panel „Mit Speicher abgleichen"
          (Pruefen & Reparieren) konsolidiert — siehe shadow-twin-reconcile-panel.tsx. */}
    </div>
  );
}
