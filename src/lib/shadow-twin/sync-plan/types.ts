/**
 * @fileoverview Typen der Plan-Schicht fuer die konsolidierte Sync-Engine (Welle 4).
 *
 * @description
 * Eine Engine ersetzt reconcile/sync-all/sync-to-storage/sync-from-storage.
 * Kern-Idee: EIN Plan, zwei Modi — `check` gibt den Plan als Report zurueck,
 * `repair` fuehrt DENSELBEN Plan aus. Statt Richtungen (`to-storage`/`to-cache`)
 * plant die Engine benannte Operationsklassen; Presets (siehe allowed-ops.ts)
 * waehlen daraus die ausfuehrbare Teilmenge.
 *
 * Design: docs/refactor/shadow-twin-sync-konsolidierung/00-design-vorschlag.md §3.
 *
 * @module shadow-twin/sync-plan
 */

/**
 * Operationsklassen der Sync-Engine.
 *
 * - `write-canonical-transcript`: Gewinner-Transkript als kanonische `{base}.md`
 *   in den Storage schreiben (Reconcile-Ergebnis).
 * - `update-mongo-transcript`: Gewinner-Transkript in `artifacts.transcript`
 *   uebernehmen (vollstaendigste Fassung gewinnt).
 * - `update-mongo-transformation`: externe Aenderung einer Transformations-Datei
 *   (bzw. Storage-only-Transformation) nach Mongo uebernehmen.
 * - `mirror-artifact-to-storage`: Transformations-Markdown aus Mongo in den
 *   Storage spiegeln (fehlende Datei ergaenzen oder — `overwrite` — ersetzen).
 * - `mirror-image-to-storage`: `binaryFragments` (Azure) in den Storage spiegeln
 *   (nur Export-Preset).
 * - `register-image-fragments`: `page_*`/`preview_*`-Bilder aus dem Storage als
 *   Mongo-`binaryFragments` registrieren (B1-Reparatur).
 * - `delete-inferior-variant`: strikt unterlegene/redundante Transkript-Variante
 *   loeschen (nur nach persistiertem Gewinner; nie die vollste Kopie).
 * - `delete-dead-page-md`: tote `page_NNN.md` loeschen.
 * - `needs-pipeline`: Quelldatei neuer als Artefakte → nur melden (Report-only).
 * - `conflict`: nicht entscheidbar → nur melden (Report-only).
 */
export type SyncOperationType =
  | 'write-canonical-transcript'
  | 'update-mongo-transcript'
  | 'update-mongo-transformation'
  | 'mirror-artifact-to-storage'
  | 'mirror-image-to-storage'
  | 'register-image-fragments'
  | 'delete-inferior-variant'
  | 'delete-dead-page-md'
  | 'needs-pipeline'
  | 'conflict'

/** Report-only-Operationen: werden geplant und gemeldet, aber NIE ausgefuehrt. */
export const REPORT_ONLY_OPERATION_TYPES: ReadonlySet<SyncOperationType> = new Set([
  'needs-pipeline',
  'conflict',
])

/** Artefakt-Familie, auf die sich eine Operation bezieht. */
export type SyncOperationKind = 'transcript' | 'transformation' | 'image' | 'source'

/**
 * Eine geplante Operation. Traegt alles, was die Ausfuehrung braucht
 * (Inhalt, Datei-Referenzen) UND alles, was der Report braucht (Namen, Notiz).
 */
export interface SyncOperation {
  type: SyncOperationType
  kind: SyncOperationKind
  /** Sprachcode des Artefakts ('' bei sprach-neutralem Transkript/Bildern). */
  targetLanguage: string
  /** PFLICHT bei kind='transformation' (ArtifactKey-Contract). */
  templateName?: string
  /** Betroffener Dateiname (kanonisch bzw. konkrete Storage-Datei). */
  fileName: string
  /** Storage-Datei-Id (Loeschungen, Ueberschreiben bestehender Dateien). */
  fileId?: string
  /** Zu schreibender Markdown-Inhalt (write-/mirror-/update-Operationen). */
  markdown?: string
  /**
   * Nur mirror/write: true = eine bestehende Storage-Datei wird ERSETZT
   * (Mongo neuer bzw. kanonische Datei veraltet), false = nur Fehlendes ergaenzt.
   * Presets wie `auto-sync` erlauben ausschliesslich overwrite=false.
   */
  overwrite?: boolean
  /** Anzahl betroffener Dateien bei Sammel-Operationen (register-image-fragments). */
  count?: number
  /** Quell-URL fuer mirror-image-to-storage (Azure-Blob des Fragments). */
  url?: string
  /** Klartext-Begruendung fuer den Report (Konflikt-Grund, Verweigerung). */
  note?: string
}
