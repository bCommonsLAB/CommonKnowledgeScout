/**
 * @fileoverview Unerschlossene Quellen aus dem Archiv-Scan (W1-Nachzug).
 *
 * @description
 * Schliesst die Luecke des Engine-Checks: `run-library-sync` ueberspringt
 * Dateien ohne Mongo-Dokument und ohne adoptierbare Artefakte STILL
 * (`skippedWithoutDoc`, keine Report-Zeile) — fuer die Sync-Engine sind das
 * „gewoehnliche Dateien", fuer die Agentensicht sind es unerschlossene
 * Quellen (F2: `source_without_twin`, Discovery-Regel Contract §2).
 *
 * Was als „Quelle" zaehlt, ist bewusst ENG am Contract §1 („PDF, Audio,
 * Video, DOCX"): Dokument-Endungen aus {@link SOURCE_DOCUMENT_EXTENSIONS}
 * plus Audio/Video nach der Plattform-Klassifikation (`getFileKind` — keine
 * zweite Typenlehre). Markdown/Notizen und Bilder zaehlen NICHT — sonst
 * flutet jede Notiz den Report. Erweiterung der Liste ist eine bewusste
 * Entscheidung (Kandidat fuer ein Library-Config-Feld).
 *
 * Dedup gegen die vorhandenen Pruefmaschinen: Quellen, die die Engine als
 * Report-Zeile fuehrt ODER die ein Mongo-Twin-Dokument haben, beurteilt
 * NICHT diese Regel (Leitprinzip 1: kein drittes Pruefsystem).
 *
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import { getFileKind } from '@/lib/shadow-twin/file-kind'
import type { ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import type { CoverageGap } from './types'

/** Dokument-Endungen, die als erschliessbare Quelle zaehlen (Contract §1). */
export const SOURCE_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx'] as const

function fileExtension(name: string): string {
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === name.length - 1) return ''
  return name.slice(lastDot + 1).toLowerCase()
}

/**
 * Zaehlt die Datei als erschliessbare Quelle? Audio/Video ueber die
 * Plattform-Klassifikation, Dokumente ueber {@link SOURCE_DOCUMENT_EXTENSIONS}.
 */
export function isSourceFile(name: string): boolean {
  const kind = getFileKind(name)
  if (kind === 'audio' || kind === 'video') return true
  return (SOURCE_DOCUMENT_EXTENSIONS as readonly string[]).includes(fileExtension(name))
}

/**
 * `source_without_twin` fuer Quellen, die WEDER die Engine (Report-Zeile)
 * NOCH MongoDB (Twin-Familie) kennt — die stille `skippedWithoutDoc`-Menge
 * des Engine-Laufs, gefiltert auf Quell-Dateitypen.
 */
/**
 * `datei_ohne_endung`: Dateien ganz ohne Endung sind im Archiv fast immer
 * abgeschnittene Sync-Reste (OneDrive kappt lange Namen) — genau das will
 * man gemeldet haben (Cowork-Befund aus dem Pilot). Dotfiles (`.gitignore`)
 * zaehlen nicht: verstecktes Werkzeug, kein Inhalt.
 */
export function filesWithoutExtension(folders: readonly ArchiveFolderNode[]): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const folder of folders) {
    for (const file of folder.files) {
      if (file.name.startsWith('.')) continue
      if (file.name.includes('.')) continue
      gaps.push(
        createGap({
          type: 'datei_ohne_endung',
          scope: 'source',
          targetId: file.fileId,
          targetName: file.name,
          folderId: folder.folderId,
          path: file.path,
          message: 'Datei ohne Endung — vermutlich ein Rest aus einem abgebrochenen Sync',
          detail: 'pruefen, umbenennen oder loeschen; ohne Endung erschliesst die Pipeline nichts',
        }),
      )
    }
  }
  return gaps
}

export function sourcesWithoutTwin(args: {
  folders: readonly ArchiveFolderNode[]
  /** sourceIds mit Report-Zeile im Engine-Check (deren Urteil zaehlt). */
  engineSourceIds: ReadonlySet<string>
  /** sourceIds mit Twin-Dokument in MongoDB. */
  familySourceIds: ReadonlySet<string>
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const folder of args.folders) {
    for (const file of folder.files) {
      if (!isSourceFile(file.name)) continue
      if (args.engineSourceIds.has(file.fileId)) continue
      if (args.familySourceIds.has(file.fileId)) continue
      gaps.push(
        createGap({
          type: 'source_without_twin',
          scope: 'source',
          targetId: file.fileId,
          targetName: file.name,
          folderId: folder.folderId,
          path: file.path,
          message: 'Zu dieser Datei gibt es noch gar nichts: kein Transkript, keine Zusammenfassung',
          detail: `Discovery-Regel: \`_${file.name}/\` fehlt oder ist leer; ueber die Pipeline erschliessen`,
        }),
      )
    }
  }
  return gaps
}
