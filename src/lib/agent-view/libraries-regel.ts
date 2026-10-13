/**
 * @fileoverview Regeln zum Feld `libraries:` der Berichte (Wunschliste 8, W8-4) — pur.
 *
 * @description
 * Ein Vorhaben sagt im `BERICHT.md`, welche KnowledgeScout-Libraries zu ihm
 * gehoeren — Flow-Form wie `repo:`, Werte sind Library-Ids oder -Namen:
 *
 * ```yaml
 * libraries: [Dachverband für Soziales – Neuaufbau, 72a883a0-d0d9-45be-8c19-6685c0ad8b95]
 * ```
 *
 * Anlass (Archiv, 13.10.2026): Zwei Tage Arbeit in einer Library standen in
 * keinem Bericht, weil aus „Arbeit in Library X" kein Vorhaben ableitbar war.
 *
 * - `library_ohne_vorhaben` (Library-Ebene, Akteur Cowork, `info`): eine
 *   eigene Library des Users, die in keinem `libraries:` auftaucht — Arbeit,
 *   von der kein Vorhaben erfaehrt. Die gescannte Archiv-Library selbst
 *   zaehlt nicht. Nur im Library-weiten Scan aussagekraeftig: im Teilbaum
 *   fehlen Berichte, die den Eintrag tragen koennten (der Service ruft die
 *   Regel dort nicht).
 * - `library_unbekannt` (Ordner-Ebene, Akteur Cowork, `info`): ein Wert im
 *   `libraries:` eines Berichts, der weder Id noch Name einer Library ist —
 *   genannt, nicht verschluckt (`no-silent-fallbacks`).
 *
 * Namen werden getrimmt und ohne Gross-/Kleinschreibung verglichen; Ids
 * exakt. Reine Funktionen, kein I/O — die Library-Liste kommt ueber einen
 * Port des Scans herein.
 *
 * @module agent-view
 */

import { BERICHT_FILE_NAME } from './archive-scan'
import type { ArchiveFolderNode } from './archive-types'
import { createGap } from './gap-registry'
import { asList } from './sichten/bericht-lesen'
import type { CoverageGap } from './types'

/** Eine Library, wie der Scan sie kennt: Id und Anzeigename. */
export interface LibraryEintrag {
  id: string
  name: string
}

/** Liest `libraries:` aus einem Bericht-Frontmatter (leer = kein Feld). */
export function leseLibrariesFeld(meta: Record<string, unknown>): string[] {
  return asList(meta.libraries)
}

function normalisiereName(name: string): string {
  return name.trim().toLowerCase()
}

/** Findet die Library zu einem Wert aus `libraries:` — per Id, sonst per Name. */
export function findeLibrary(wert: string, libraries: readonly LibraryEintrag[]): LibraryEintrag | null {
  const roh = wert.trim()
  if (roh === '') return null
  const perId = libraries.find((lib) => lib.id === roh)
  if (perId) return perId
  const name = normalisiereName(roh)
  return libraries.find((lib) => normalisiereName(lib.name) === name) ?? null
}

/** Alle Vorhaben (Pfade), die eine Library in `libraries:` nennen. */
export function vorhabenJeLibrary(
  folders: readonly ArchiveFolderNode[],
  libraries: readonly LibraryEintrag[],
): Map<string, string[]> {
  const treffer = new Map<string, string[]>()
  for (const folder of folders) {
    if (folder.bericht === null) continue
    for (const wert of leseLibrariesFeld(folder.bericht.meta)) {
      const lib = findeLibrary(wert, libraries)
      if (lib === null) continue
      const liste = treffer.get(lib.id) ?? []
      if (!liste.includes(folder.path)) liste.push(folder.path)
      treffer.set(lib.id, liste)
    }
  }
  return treffer
}

/**
 * `library_ohne_vorhaben`: EIN Befund je eigener Library, die kein Bericht
 * nennt. Haengt an der Scan-Wurzel (Library-Ebene).
 */
export function checkLibraryOhneVorhaben(args: {
  folders: readonly ArchiveFolderNode[]
  libraries: readonly LibraryEintrag[]
  /** Die gescannte Library selbst — sie ist der Ort der Vorhaben, kein Vorhaben. */
  eigeneLibraryId: string
  rootFolderId: string
}): CoverageGap[] {
  const genannt = vorhabenJeLibrary(args.folders, args.libraries)
  const gaps: CoverageGap[] = []
  for (const lib of [...args.libraries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (lib.id === args.eigeneLibraryId) continue
    if (genannt.has(lib.id)) continue
    gaps.push(
      createGap({
        type: 'library_ohne_vorhaben',
        scope: 'library',
        targetId: lib.id,
        targetName: lib.name,
        folderId: args.rootFolderId,
        path: '',
        message: `Die Library „${lib.name}" steht in keinem BERICHT.md unter libraries: — Arbeit dort erfaehrt kein Vorhaben`,
        detail: `libraryId ${lib.id}; im Bericht des zustaendigen Vorhabens eintragen: libraries: [${lib.name}]`,
      }),
    )
  }
  return gaps
}

/** `library_unbekannt`: EIN Sammelbefund je Bericht mit Werten, die keine Library treffen. */
export function checkLibraryUnbekannt(args: {
  folders: readonly ArchiveFolderNode[]
  libraries: readonly LibraryEintrag[]
}): CoverageGap[] {
  const gaps: CoverageGap[] = []
  for (const folder of args.folders) {
    const bericht = folder.bericht
    if (bericht === null) continue
    const unbekannt = leseLibrariesFeld(bericht.meta).filter((wert) => findeLibrary(wert, args.libraries) === null)
    if (unbekannt.length === 0) continue
    gaps.push(
      createGap({
        type: 'library_unbekannt',
        scope: 'folder',
        folderId: folder.folderId,
        path: folder.path,
        targetId: bericht.fileId,
        targetName: BERICHT_FILE_NAME,
        message: `${String(unbekannt.length)} Wert(e) unter libraries: treffen keine Library des Users (weder Id noch Name)`,
        detail: unbekannt.map((wert) => `„${wert}"`).join(', '),
      }),
    )
  }
  return gaps
}
