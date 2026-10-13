/**
 * Formular-Modell der Seite Erweitert · Extraktion (reine Funktionen).
 *
 * Besitzt drei Config-Schluessel: `extractionKnownNames`,
 * `transcriptionLanguages`, `ingestSourceAppendix`.
 * Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles).
 */

import { z } from "zod"
import { parseLanguagesText } from "@/lib/external-jobs/audio-languages"
import type { LibraryConfigPatch } from "./use-library-config-patch"

export const extractionFormSchema = z.object({
  // Eine Zeile pro Name (Form als Text, Persistenz als Array).
  extractionKnownNames: z.string().default(""),
  /** Sprachcodes, durch Komma getrennt (z. B. „de, it"); Pruefung beim Speichern. */
  transcriptionLanguages: z
    .string()
    .refine(
      (value) => parseLanguagesText(value).invalid.length === 0,
      "Nur Sprachcodes mit zwei Buchstaben, durch Komma getrennt (z. B. de, it).",
    )
    .default(""),
  // P6: Voreinstellung „Anhaenge als Text in die Suche". Default AN (Owner 05.10.2026).
  ingestSourceAppendix: z.boolean().default(true),
})

export type ExtractionFormValues = z.infer<typeof extractionFormSchema>

/** Liest die Extraktions-Felder einer Library in die Formularwerte. */
export function readExtractionForm(config: LibraryConfigPatch | undefined): ExtractionFormValues {
  return {
    extractionKnownNames: (config?.extractionKnownNames ?? []).join("\n"),
    transcriptionLanguages: (config?.transcriptionLanguages ?? []).join(", "),
    ingestSourceAppendix: config?.ingestSourceAppendix !== false,
  }
}

/** Schreibt die Formularwerte in die drei Config-Schluessel dieser Seite. */
export function toExtractionConfig(
  data: ExtractionFormValues,
): Pick<LibraryConfigPatch, "extractionKnownNames" | "transcriptionLanguages" | "ingestSourceAppendix"> {
  return {
    extractionKnownNames: data.extractionKnownNames.split(/\r?\n/).map((n) => n.trim()).filter(Boolean),
    transcriptionLanguages: parseLanguagesText(data.transcriptionLanguages).codes,
    ingestSourceAppendix: data.ingestSourceAppendix,
  }
}
