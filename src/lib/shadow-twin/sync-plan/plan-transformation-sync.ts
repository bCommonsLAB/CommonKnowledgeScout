/**
 * @fileoverview Reine Plan-Logik fuer EIN Transformations-Artefakt (Template × Sprache).
 *
 * @description
 * Transformationen haben — anders als Transkripte — keine Varianten: pro
 * (Template × Sprache) gibt es genau EINEN kanonischen Dateinamen, also nur
 * Mongo-Record vs. genau eine Storage-Datei. Entscheidungsregel (Design §4.2,
 * User-Entscheid 2026-08-07): **erst Inhalt, dann Uhr, sonst Konflikt**:
 *
 * 1. Inhalt (normalisiert) identisch → `synced`, nichts tun.
 * 2. Nur eine Seite hat Inhalt → die nicht-leere Seite gewinnt
 *    (leeres Markdown wird NIE als Gewinner akzeptiert).
 * 3. Beide haben verschiedenen Inhalt → neuere Seite gewinnt (±Toleranz),
 *    denn externe Edits im Storage sind ein legitimer Workflow.
 * 4. Timestamps fehlen oder liegen innerhalb der Toleranz → `conflict`:
 *    melden, nichts anfassen (kein stilles „Mongo gewinnt").
 *
 * Reine Funktion, kein I/O — unit-testbar (Konflikt-Matrix).
 *
 * @module shadow-twin/sync-plan
 */

import type { SyncOperation } from './types'

/** Timestamp-Toleranz (Mongo- und Storage-Write liegen leicht auseinander). */
export const TIMESTAMP_TOLERANCE_MS = 5_000

export interface TransformationSyncInput {
  templateName: string
  targetLanguage: string
  /** Kanonischer Dateiname (`{base}.{template}.{lang}.md`), vom Aufrufer via buildArtifactName. */
  fileName: string
  /** Mongo-Record (null, wenn das Artefakt nur im Storage existiert). */
  mongo: { markdown: string; updatedAt: Date | null } | null
  /** Storage-Datei (null, wenn keine Datei existiert). */
  storage: { fileId: string; name: string; markdown: string; modifiedAt: Date | null } | null
}

export type TransformationSyncStatus =
  | 'synced'
  | 'mirror-to-storage'
  | 'update-mongo'
  | 'conflict'
  | 'invalid-empty'

export interface TransformationSyncPlan {
  templateName: string
  targetLanguage: string
  fileName: string
  status: TransformationSyncStatus
  /** Auszufuehrende bzw. zu meldende Operation (null bei synced/invalid-empty). */
  operation: SyncOperation | null
  /** Klartext fuer den Report (Konflikt-Grund, Verweigerung bei leerem Inhalt). */
  note?: string
}

/** Normalisiert Inhalt fuer den Gleichheits-Vergleich (CRLF + Rand-Whitespace). */
function normalize(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').trim()
}

/** Plant den Abgleich EINES Transformations-Artefakts (siehe Datei-Kommentar). */
export function planTransformationSync(
  input: TransformationSyncInput,
  toleranceMs: number = TIMESTAMP_TOLERANCE_MS,
): TransformationSyncPlan {
  const { templateName, targetLanguage, fileName, mongo, storage } = input
  if (!templateName) throw new Error('planTransformationSync: templateName ist Pflicht (ArtifactKey-Contract)')

  const base = { templateName, targetLanguage, fileName }
  const opBase = { kind: 'transformation' as const, targetLanguage, templateName }
  const mongoContent = normalize(mongo?.markdown ?? '')
  const storageContent = normalize(storage?.markdown ?? '')

  // Beide Seiten leer/fehlend: nichts, womit sich arbeiten laesst → laut melden.
  if (!mongoContent && !storageContent) {
    return { ...base, status: 'invalid-empty', operation: null, note: 'Beide Seiten leer oder fehlend — nichts zu synchronisieren' }
  }

  // Nur Mongo hat Inhalt → in den Storage spiegeln. Eine existierende (leere)
  // Storage-Datei wird dabei ersetzt (leer verliert immer).
  if (mongoContent && !storageContent) {
    return {
      ...base,
      status: 'mirror-to-storage',
      operation: {
        ...opBase, type: 'mirror-artifact-to-storage', fileName,
        fileId: storage?.fileId, markdown: mongoContent, overwrite: !!storage,
      },
    }
  }

  // Ab hier hat der Storage Inhalt → die Datei existiert zwingend.
  // (Expliziter Guard statt Non-Null-Assertion.)
  if (!storage) {
    throw new Error('planTransformationSync: Storage-Inhalt ohne Storage-Datei — ungueltige Eingabe')
  }

  // Nur Storage hat Inhalt → nach Mongo uebernehmen (Storage-only-Artefakt
  // adoptieren bzw. kaputten leeren Mongo-Record ersetzen).
  if (!mongoContent) {
    return {
      ...base,
      status: 'update-mongo',
      operation: { ...opBase, type: 'update-mongo-transformation', fileName: storage.name, fileId: storage.fileId, markdown: storageContent },
    }
  }

  // Beide haben Inhalt.
  if (mongoContent === storageContent) {
    return { ...base, status: 'synced', operation: null }
  }

  // Verschiedener Inhalt → Uhr entscheidet (nur bei beidseitig vorhandenen Timestamps).
  const mongoTime = mongo?.updatedAt?.getTime()
  const storageTime = storage.modifiedAt?.getTime()
  if (typeof mongoTime === 'number' && typeof storageTime === 'number') {
    const diffMs = storageTime - mongoTime
    if (diffMs > toleranceMs) {
      return {
        ...base,
        status: 'update-mongo',
        operation: { ...opBase, type: 'update-mongo-transformation', fileName: storage.name, fileId: storage.fileId, markdown: storageContent },
      }
    }
    if (diffMs < -toleranceMs) {
      return {
        ...base,
        status: 'mirror-to-storage',
        operation: { ...opBase, type: 'mirror-artifact-to-storage', fileName, fileId: storage.fileId, markdown: mongoContent, overwrite: true },
      }
    }
  }

  // Unentscheidbar: Inhalt verschieden, aber Uhr fehlt oder innerhalb der Toleranz.
  const note = typeof mongoTime === 'number' && typeof storageTime === 'number'
    ? 'Inhalt verschieden, Zeitstempel innerhalb der Toleranz — manuell pruefen'
    : 'Inhalt verschieden, Zeitstempel unvollstaendig — manuell pruefen'
  return {
    ...base,
    status: 'conflict',
    operation: { ...opBase, type: 'conflict', fileName, fileId: storage?.fileId, note },
    note,
  }
}
