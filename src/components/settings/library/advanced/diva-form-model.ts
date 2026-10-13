/**
 * Formular-Modell der Seite Erweitert · DIVA (reine Funktionen).
 *
 * Besitzt drei Config-Schluessel: `analyzeDivaTextureInfo`,
 * `autoApplyConfidenceThreshold`, `divaArchiveDefaults`.
 * Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles).
 */

import { z } from "zod"
import type { LibraryConfigPatch } from "./use-library-config-patch"

export const divaFormSchema = z.object({
  // Transformation: DIVA-Liefersystem-Daten auswerten (DIVA-Info-Tab). Default false.
  analyzeDivaTextureInfo: z.boolean().default(false),
  // Schwellwert fuer die Auto-Uebernahme der Stoffgruppen-Klassifikation (Stufe 4). Bereich [0, 1].
  autoApplyConfidenceThreshold: z.number().min(0).max(1).default(0.9),
  // DIVA-Archive-Defaults fuer das Toolbar-Popover in der Dateiliste.
  divaArchiveFilterMode: z.enum(["all", "with", "without"]).default("all"),
  divaArchiveGroupByAttribute: z.string().default(""),
  divaArchiveExtraColumns: z.array(z.string()).default([]),
})

export type DivaFormValues = z.infer<typeof divaFormSchema>

/** Coerced den Auto-Uebernahme-Schwellwert auf [0, 1]; Default 0.9, wenn nicht gesetzt. */
function coerceAutoApplyConfidenceThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.9
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Liest die DIVA-Felder einer Library in die Formularwerte. Leere oder
 * ungueltige Werte fuehren auf die Form-Defaults ('all' / leer / []) zurueck.
 */
export function readDivaForm(config: LibraryConfigPatch | undefined): DivaFormValues {
  const defaults = config?.divaArchiveDefaults
  const rawFilter = defaults?.filterMode
  return {
    analyzeDivaTextureInfo: config?.analyzeDivaTextureInfo === true,
    autoApplyConfidenceThreshold: coerceAutoApplyConfidenceThreshold(config?.autoApplyConfidenceThreshold),
    divaArchiveFilterMode:
      rawFilter === "with" || rawFilter === "without" || rawFilter === "all" ? rawFilter : "all",
    divaArchiveGroupByAttribute: typeof defaults?.groupByAttribute === "string" ? defaults.groupByAttribute : "",
    divaArchiveExtraColumns: Array.isArray(defaults?.extraColumns)
      ? defaults.extraColumns.filter((c): c is string => typeof c === "string")
      : [],
  }
}

/** Schreibt die Formularwerte in die drei Config-Schluessel dieser Seite. */
export function toDivaConfig(
  data: DivaFormValues,
): Pick<LibraryConfigPatch, "analyzeDivaTextureInfo" | "autoApplyConfidenceThreshold" | "divaArchiveDefaults"> {
  return {
    analyzeDivaTextureInfo: data.analyzeDivaTextureInfo,
    autoApplyConfidenceThreshold: data.autoApplyConfidenceThreshold,
    divaArchiveDefaults: {
      filterMode: data.divaArchiveFilterMode,
      groupByAttribute: data.divaArchiveGroupByAttribute.trim() === "" ? null : data.divaArchiveGroupByAttribute,
      extraColumns: data.divaArchiveExtraColumns,
    },
  }
}
