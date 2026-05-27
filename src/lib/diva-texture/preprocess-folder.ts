/**
 * @fileoverview Preprocess-Kern: Basecolor-Dateien einem Liefersystem-Eintrag
 * zuordnen (Stufe 6 / Performance-Welle).
 *
 * @description
 * Rein deterministische, I/O-freie Planungsfunktion fuer das Preprocess-Skript:
 * nimmt die Dateien eines Ordners + die Sidecar-Eintraege und liefert
 *  - matches:          Basecolor-Datei ↔ Liefersystem-Eintrag (via Matcher),
 *  - unmatchedFiles:   Basecolor-Dateien OHNE Treffer,
 *  - unmatchedEntries: Liefersystem-Eintraege OHNE passende Datei
 *                      (typisch ausgelistete/historische Texturen).
 *
 * Es werden NUR Basecolor-Dateien betrachtet (eine pro Material), damit nicht
 * normal/roughness/metallic-Maps denselben Eintrag mehrfach matchen.
 *
 * KEIN LLM, KEIN Storage-Zugriff, KEINE Seiteneffekte.
 */

import { matchTextureCode } from './match-texture-code'
import type { OptionvalueEntry, SupplierEntry } from './types'

/** Basecolor-/Albedo-Suffixe (das repraesentative Farbbild eines Materials). */
const BASECOLOR_SUFFIX = /[_-](basecolor|base_color|albedo|diffuse|color)$/i

/** Entfernt die Dateiendung (letztes Segment nach dem letzten Punkt). */
function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.slice(0, idx) : name
}

/**
 * Prueft, ob ein Dateiname eine Basecolor-/Albedo-Map ist.
 * @param fileName z.B. "3_ST_2031_0332_basecolor.jpg"
 */
export function isBasecolorFileName(fileName: string): boolean {
  return BASECOLOR_SUFFIX.test(stripExtension(fileName))
}

/** Minimal benoetigte Datei-Informationen (storage-unabhaengig). */
export interface PreprocessFile {
  id: string
  name: string
}

/** Eine zugeordnete Basecolor-Datei. */
export interface PreprocessMatch {
  file: PreprocessFile
  entryKey: string
  entry: OptionvalueEntry
  strategy: string
}

/** Ergebnis der Ordner-Planung. */
export interface FolderPreprocessPlan {
  matches: PreprocessMatch[]
  /** Basecolor-Dateien ohne Liefersystem-Treffer. */
  unmatchedFiles: PreprocessFile[]
  /** Liefersystem-Eintraege, fuer die keine Basecolor-Datei gefunden wurde. */
  unmatchedEntries: SupplierEntry[]
  /** Anzahl betrachteter Basecolor-Dateien (fuer die Legende). */
  basecolorFileCount: number
}

/**
 * Plant die Zuordnung aller Basecolor-Dateien eines Ordners zu den
 * Sidecar-Eintraegen.
 *
 * @param files Alle Dateien des Ordners (Verzeichnisse vorher rausfiltern).
 * @param entries Auf IsTexture==="True" gefilterte Sidecar-Eintraege.
 */
export function buildFolderPreprocessPlan(
  files: PreprocessFile[],
  entries: SupplierEntry[],
): FolderPreprocessPlan {
  const basecolorFiles = files.filter((f) => isBasecolorFileName(f.name))

  const matches: PreprocessMatch[] = []
  const unmatchedFiles: PreprocessFile[] = []
  const matchedEntryKeys = new Set<string>()

  for (const file of basecolorFiles) {
    const result = matchTextureCode(file.name, entries)
    if (result.match) {
      matches.push({
        file,
        entryKey: result.match.entryKey,
        entry: result.match.entry,
        strategy: result.match.strategy,
      })
      matchedEntryKeys.add(result.match.entryKey)
    } else {
      unmatchedFiles.push(file)
    }
  }

  const unmatchedEntries = entries.filter((e) => !matchedEntryKeys.has(e.key))

  return {
    matches,
    unmatchedFiles,
    unmatchedEntries,
    basecolorFileCount: basecolorFiles.length,
  }
}
