/**
 * @fileoverview Begleitdokumente eines Berichts: Notizen und Verlaufsdateien
 * (Wunschliste 6, B3 + Teil C) — pur.
 *
 * @description
 * Seit „Bericht = Zustand, Notiz/Verlauf = Verlauf" steht das Detail nicht
 * mehr im `BERICHT.md`, sondern in Dateien, auf die er verweist
 * (`type: notiz` im Ereignisordner, `type: verlauf` in der Vorhabenswurzel).
 * Damit die Regeln das sehen, liest der Scan diese Dateien mit — und NUR
 * diese: Markdown-Dateien, auf die der Bericht per Wikilink oder relativem
 * Link zeigt (Tiefe 1, nicht rekursiv) und die im Teilbaum des Vorhabens
 * liegen. Fremde Vorhaben und Twin-Artefakte bleiben draussen.
 *
 * Diese Datei WAEHLT nur aus (kein I/O); gelesen wird ueber den Port
 * `readDocs` des Coverage-Service.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME, INDEX_FILE_NAME } from './archive-scan'
import type { ArchiveDocEntry, ArchiveFileEntry, ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import { resolveReference, type ReferenceIndex } from './reference-audit'
import { parseReferences, uniqueReferences } from './reference-parser'
import type { CoverageGap } from './types'

/** Kosten-Zaun je Bericht; eine Kappung wird im Ergebnis AUSGEWIESEN. */
export const MAX_BEGLEITDATEIEN_JE_BERICHT = 40

export interface BegleitAuswahl {
  /** Je Ordner-Id (Ordner MIT Bericht) die mitzulesenden Dateien, nach Pfad sortiert. */
  jeOrdner: Map<string, ArchiveFileEntry[]>
  /** Ordner-Ids, deren Auswahl am Zaun gekappt wurde. */
  gekappt: Set<string>
}

/** Waehlt die Dateien aus, die der Scan zusaetzlich liest. */
export function waehleBegleitdateien(args: {
  folders: readonly ArchiveFolderNode[]
  index: ReferenceIndex
}): BegleitAuswahl {
  const dateiNachPfad = new Map<string, ArchiveFileEntry>()
  for (const folder of args.folders) for (const file of folder.files) dateiNachPfad.set(file.path.toLowerCase(), file)

  const jeOrdner = new Map<string, ArchiveFileEntry[]>()
  const gekappt = new Set<string>()
  for (const folder of args.folders) {
    const bericht = folder.bericht
    if (bericht === null) continue
    const prefix = folder.path === '' ? '' : `${folder.path.toLowerCase()}/`
    const gewaehlt = new Map<string, ArchiveFileEntry>()
    for (const ref of uniqueReferences(parseReferences(bericht.body))) {
      const hit = resolveReference(ref.target, bericht.path, args.index)
      if (!hit || hit.kind !== 'file' || !hit.name.toLowerCase().endsWith('.md')) continue
      if (hit.name === BERICHT_FILE_NAME || hit.name === INDEX_FILE_NAME) continue
      if (!hit.path.toLowerCase().startsWith(prefix)) continue
      const file = dateiNachPfad.get(hit.path.toLowerCase())
      if (file) gewaehlt.set(file.fileId, file)
    }
    const sortiert = [...gewaehlt.values()].sort((a, b) => a.path.localeCompare(b.path))
    if (sortiert.length > MAX_BEGLEITDATEIEN_JE_BERICHT) gekappt.add(folder.folderId)
    jeOrdner.set(folder.folderId, sortiert.slice(0, MAX_BEGLEITDATEIEN_JE_BERICHT))
  }
  return { jeOrdner, gekappt }
}

/** Ordnet die gelesenen Dokumente wieder ihren Berichten zu. */
export function ordneBegleitdokumente(
  auswahl: BegleitAuswahl,
  gelesen: readonly ArchiveDocEntry[],
): Map<string, ArchiveDocEntry[]> {
  const nachId = new Map(gelesen.map((doc) => [doc.fileId, doc]))
  const ergebnis = new Map<string, ArchiveDocEntry[]>()
  for (const [folderId, files] of auswahl.jeOrdner) {
    ergebnis.set(folderId, files.map((file) => nachId.get(file.fileId)).filter((doc): doc is ArchiveDocEntry => doc !== undefined))
  }
  return ergebnis
}

/** `type` eines Begleitdokuments (Twin-Contract §3.1); null = kein Feld. */
export function begleitTyp(doc: ArchiveDocEntry): string | null {
  const typ = doc.meta.type
  return typeof typ === 'string' && typ.trim() !== '' ? typ.trim() : null
}

/** Sichtbar statt still: Lesefehler und Kappung der Begleitdokumente als `scan_error`. */
export function begleitLeseBefunde(args: {
  folders: readonly ArchiveFolderNode[]
  gekappt: ReadonlySet<string>
  fehler: ReadonlyArray<{ file: ArchiveFileEntry; error: string }>
  fileIndex: ReadonlyMap<string, { folderId: string }>
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const { file, error } of args.fehler) {
    const ort = args.fileIndex.get(file.fileId)
    if (!ort) continue
    gaps.push(
      createGap({
        type: 'scan_error', scope: 'folder', targetId: file.fileId, targetName: file.name,
        folderId: ort.folderId, path: file.path,
        message: 'Diese Datei, auf die ein Bericht verweist, liess sich nicht lesen',
        detail: error,
      }),
    )
  }
  for (const folder of args.folders) {
    if (!args.gekappt.has(folder.folderId)) continue
    gaps.push(
      createGap({
        type: 'scan_error', scope: 'folder', targetId: folder.folderId, targetName: folder.name || '(Wurzel)',
        folderId: folder.folderId, path: folder.path,
        message: `Der Bericht verweist auf mehr als ${String(MAX_BEGLEITDATEIEN_JE_BERICHT)} Markdown-Dateien — die uebrigen blieben ungelesen`,
      }),
    )
  }
  return gaps
}
