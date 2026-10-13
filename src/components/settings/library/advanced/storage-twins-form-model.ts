/**
 * Formular-Modell der Seite Erweitert · Speicher & Twins (reine Funktionen).
 *
 * Besitzt zwei Config-Schluessel: `shadowTwin` (zwei Schalter ausserhalb von
 * react-hook-form, wie bisher) und `scanExcludeGlobs` (Textfeld).
 * Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles).
 */

import { z } from "zod"
import type { LibraryConfigPatch } from "./use-library-config-patch"

export const storageTwinsFormSchema = z.object({
  // Welle 0b: eine Zeile pro Muster (Form als Text, Persistenz als Array)
  scanExcludeGlobs: z.string().default(""),
})

export type StorageTwinsFormValues = z.infer<typeof storageTwinsFormSchema>

/** Die beiden Dateisystem-Schalter der v2-only Runtime (mode/primaryStore sind fix). */
export interface ShadowTwinFlags {
  persistToFilesystem: boolean
  allowFilesystemFallback: boolean
}

/** Gespeicherte Form von `config.shadowTwin` (in der Client-Config nur als `unknown` typisiert). */
interface ShadowTwinConfig extends ShadowTwinFlags {
  mode: "v2"
  primaryStore: "mongo"
}

/** Liest die Schalter aus der Library; fehlende Flags gelten als AN (Bestandsverhalten). */
export function readShadowTwinFlags(config: LibraryConfigPatch | undefined): ShadowTwinFlags {
  const shadowTwin = config?.shadowTwin as Partial<ShadowTwinFlags> | undefined
  return {
    persistToFilesystem: shadowTwin?.persistToFilesystem ?? true,
    allowFilesystemFallback: shadowTwin?.allowFilesystemFallback ?? true,
  }
}

/** Liest das Scan-Ausschluss-Feld einer Library in die Formularwerte. */
export function readStorageTwinsForm(config: LibraryConfigPatch | undefined): StorageTwinsFormValues {
  return { scanExcludeGlobs: (config?.scanExcludeGlobs ?? []).join("\n") }
}

/** Schreibt Formularwerte und Schalter in die beiden Config-Schluessel dieser Seite. */
export function toStorageTwinsConfig(
  data: StorageTwinsFormValues,
  flags: ShadowTwinFlags,
): { scanExcludeGlobs: string[]; shadowTwin: ShadowTwinConfig } {
  return {
    scanExcludeGlobs: data.scanExcludeGlobs.split(/\r?\n/).map((g) => g.trim()).filter(Boolean),
    shadowTwin: {
      // v2-only Runtime: Speichern normalisiert Alt-Configs auf v2/Cache (User-Entscheid 2026-06-12, 04/C1).
      mode: "v2",
      primaryStore: "mongo",
      persistToFilesystem: flags.persistToFilesystem,
      allowFilesystemFallback: flags.allowFilesystemFallback,
    },
  }
}
