/**
 * @fileoverview Media-Existence-Validator
 *
 * Pure-Function-Modul. Prueft Medien-Felder im LLM-Frontmatter gegen die
 * Liste tatsaechlich verfuegbarer Medien (Sibling-Files + binaryFragments).
 *
 * Hintergrund: Das LLM erfindet Dateinamen aus Freitext oder uebernimmt
 * Beispieltexte aus Templates. Diese landen unbemerkt im Frontmatter und
 * referenzieren Dateien, die nicht existieren. Verstoss gegen
 * `media-lifecycle.mdc`: "Frontmatter-Felder fuer Medien enthalten
 * ausschliesslich Dateinamen, die sich auf Dateien im selben Verzeichnis
 * oder in `binaryFragments` des Shadow-Twins beziehen."
 *
 * Verhalten (User-Entscheidung 2026-04-30, "set_null + Warning"):
 * - Phantom-Werte werden auf null (String-Feld) bzw. [] (Array-Feld) gesetzt
 * - KEIN Throw / kein Job-Failure
 * - Report wird zurueckgegeben fuer Job-Log (NICHT ins Frontmatter persistiert)
 * - Pipeline laeuft weiter
 *
 * Pure-Function-Constraint: Kein I/O, keine Logger-Calls. Logging passiert beim Aufrufer.
 *
 * @see docs/refactor/cover-image-deterministic-flow/01-analysis.md
 */

import { VIEW_TYPE_REGISTRY, type DetailViewType, type ViewTypeMediaConfig } from '@/lib/detail-view-types/registry'

/**
 * Eintrag in der Liste der real existierenden Medien.
 * Zur Validierung: ein LLM-Wert ist gueltig, wenn er entweder
 * `name` oder `frontmatterRef` exakt entspricht.
 */
export interface AvailableMediaEntry {
  /** Dateiname (kanonisch) — z.B. "dell-optiplex-7060-sff-1665130604.webp" */
  name: string
  /** MIME-Typ — z.B. "image/webp" */
  mimeType: string
  /** Quelle: 'sibling' (Verzeichnis) oder 'fragment' (binaryFragments) */
  source: 'sibling' | 'fragment'
  /**
   * Optionaler Twin-Relativpfad bei Fragmenten — z.B. "_Quelle.pdf/img-0.jpeg".
   * Ermoeglicht eindeutige Referenzen bei Namenskollisionen ueber Quellen hinweg.
   */
  frontmatterRef?: string
}

/**
 * Welche Frontmatter-Felder validiert werden sollen.
 * - String-Felder: einzelner Dateiname (z.B. coverImageUrl)
 * - Array-Felder: Liste von Dateinamen (z.B. galleryImageUrls)
 */
export interface MediaFieldsConfig {
  stringFields: string[]
  arrayFields: string[]
}

/**
 * Diagnose-Report. Wird ins Job-Log geschrieben, NICHT ins Frontmatter.
 */
export interface MediaValidationReport {
  /** Pro Feld: Liste der entfernten (Phantom-)Dateinamen */
  rejected: Record<string, string[]>
  /** Snapshot der verfuegbaren Medien zum Validierungszeitpunkt */
  available: string[]
  /** Zeitstempel der Validierung */
  validatedAt: string
}

/**
 * Ergebnis der Validierung.
 */
export interface MediaValidationResult {
  /** Bereinigtes Frontmatter — Phantome ersetzt durch null/[] */
  cleanedMeta: Record<string, unknown>
  /** Diagnose-Report fuer Aufrufer (Logging) */
  report: MediaValidationReport
  /** True, wenn mindestens ein Wert geaendert wurde */
  hasChanges: boolean
}

/**
 * Leitet aus dem `VIEW_TYPE_REGISTRY` ab, welche Medien-Felder fuer einen
 * gegebenen DetailViewType zu validieren sind.
 *
 * Mapping:
 * - `mediaConfig.coverImage === true` → `coverImageUrl` als String-Feld
 * - `mediaConfig.galleryField.key` → als Array-Feld (z.B. galleryImageUrls)
 * - `mediaConfig.personField.imageKey` → als Array-Feld (z.B. speakers_image_url)
 * - `mediaConfig.attachments === true` → `attachments_url` als Array-Feld
 *
 * Default fuer unbekannte Typen: nur `coverImageUrl` als String-Feld
 * (sicheres Minimum, keine stillen Fallbacks auf andere Felder).
 */
export function buildMediaFieldsConfig(detailViewType: string): MediaFieldsConfig {
  const config = VIEW_TYPE_REGISTRY[detailViewType as DetailViewType]
  if (!config) {
    // Unbekannter ViewType — minimal-sicheres Default
    return { stringFields: ['coverImageUrl'], arrayFields: [] }
  }
  const mediaConfig: ViewTypeMediaConfig = config.mediaConfig
  const stringFields: string[] = []
  const arrayFields: string[] = []

  if (mediaConfig.coverImage) {
    stringFields.push('coverImageUrl')
  }
  if (mediaConfig.galleryField?.key) {
    arrayFields.push(mediaConfig.galleryField.key)
  }
  if (mediaConfig.personField?.imageKey) {
    // personField.imageKey wird im UI als Array behandelt (Index-basiert),
    // auch wenn semantisch oft nur ein Bild drinsteht (z.B. testimonial.author_image_url).
    arrayFields.push(mediaConfig.personField.imageKey)
  }
  if (mediaConfig.attachments) {
    arrayFields.push('attachments_url')
  }
  return { stringFields, arrayFields }
}

/**
 * Pruefe, ob ein einzelner Wert in der `availableMedia`-Liste vorhanden ist.
 *
 * Gueltige Faelle:
 * - exakter Match auf `entry.name`
 * - exakter Match auf `entry.frontmatterRef` (Twin-Relativpfad)
 *
 * Ungueltige Faelle:
 * - absolute URL (http/https/blob:) — Verstoss gegen media-lifecycle.mdc
 * - leerer String / nur Whitespace
 * - kein Match in der Liste
 */
function isAvailable(value: string, availableMedia: AvailableMediaEntry[]): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  // Absolute URLs sind generell verboten (siehe media-lifecycle.mdc)
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return false
  }
  return availableMedia.some(
    entry => entry.name === trimmed || entry.frontmatterRef === trimmed,
  )
}

/**
 * Hauptfunktion: validiere alle konfigurierten Medien-Felder im Frontmatter.
 *
 * Arbeitet kopierbar (immutable) — `meta` wird nicht mutiert.
 *
 * @param meta             Roh-Frontmatter (z.B. aus LLM-Antwort)
 * @param availableMedia   Liste real existierender Medien (Snapshot)
 * @param mediaConfig      Welche Felder zu validieren sind (typischerweise via `buildMediaFieldsConfig`)
 * @returns                Bereinigtes Frontmatter + Diagnose-Report
 */
export function validateMediaExistence(
  meta: Record<string, unknown>,
  availableMedia: AvailableMediaEntry[],
  mediaConfig: MediaFieldsConfig,
): MediaValidationResult {
  const cleanedMeta: Record<string, unknown> = { ...meta }
  const rejected: Record<string, string[]> = {}
  let hasChanges = false

  // String-Felder pruefen
  for (const fieldKey of mediaConfig.stringFields) {
    const raw = cleanedMeta[fieldKey]
    // null / undefined / leerer String — nichts zu pruefen, beibehalten
    if (raw === null || raw === undefined) continue
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (!isAvailable(trimmed, availableMedia)) {
      rejected[fieldKey] = [trimmed]
      cleanedMeta[fieldKey] = null
      hasChanges = true
    }
  }

  // Array-Felder pruefen
  for (const fieldKey of mediaConfig.arrayFields) {
    const raw = cleanedMeta[fieldKey]
    if (raw === null || raw === undefined) continue
    if (!Array.isArray(raw)) continue
    const rejectedEntries: string[] = []
    const validEntries: unknown[] = []
    for (const entry of raw) {
      if (typeof entry !== 'string') {
        // Nicht-Strings unveraendert beibehalten (defensiv — kein Schema-Bruch)
        validEntries.push(entry)
        continue
      }
      const trimmed = entry.trim()
      if (!trimmed) {
        // Leere Strings im Array werden konsistent entfernt (Bereinigung)
        continue
      }
      if (isAvailable(trimmed, availableMedia)) {
        validEntries.push(entry)
      } else {
        rejectedEntries.push(trimmed)
      }
    }
    if (rejectedEntries.length > 0) {
      rejected[fieldKey] = rejectedEntries
      cleanedMeta[fieldKey] = validEntries
      hasChanges = true
    } else if (validEntries.length !== raw.length) {
      // Nur leere Strings entfernt — auch das ist eine Aenderung (aber keine Rejection)
      cleanedMeta[fieldKey] = validEntries
      hasChanges = true
    }
  }

  const report: MediaValidationReport = {
    rejected,
    available: availableMedia.map(e => e.name),
    validatedAt: new Date().toISOString(),
  }

  return { cleanedMeta, report, hasChanges }
}
