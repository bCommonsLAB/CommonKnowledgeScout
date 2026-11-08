/**
 * @fileoverview Sitzungsnotizen ihren Vorhaben zuordnen (S1).
 *
 * @description
 * Der Vorhabensordner eines Belegs steht nicht im Twin, sondern im Pfad der
 * Quelle: `parentId` zeigt auf den Ordner, der Berichte-Scan (Tiefe ≤ 3)
 * kennt Pfad und Eltern jedes Ordners. Von dort geht es aufwaerts bis zum
 * ersten Vorhaben (BERICHT.md, Selbstdeklaration oder Namensmuster — wie
 * `isVorhaben`). Liegt der Beleg tiefer als der Scan (Ereignisordner), holt
 * `elternVon` die Eltern-Id aus dem Storage; scheitert das, wird es als
 * Hinweis ausgewiesen und der Beleg zaehlt „ohne Vorhaben" — nicht still.
 *
 * @module agent-view/sichten
 */

import { isVorhaben } from '../archive-rules'
import type { ArchiveFolderNode } from '../archive-types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { sitzungAusTransformation, type SitzungsDatensatz } from './sitzungen-types'

/** Schutz gegen Zyklen in fremden Eltern-Ketten. */
const MAX_AUFSTIEG = 30

export interface SitzungenZuordnung {
  sitzungen: SitzungsDatensatz[]
  /** Belege, aus denen kein Datensatz wurde (z. B. ohne Datum). */
  uebersprungen: Array<{ beleg: string; grund: string }>
  /** Eltern-Ketten, die nicht aufloesbar waren — die Belege stehen dann unter „Ohne Vorhaben". */
  hinweise: string[]
}

function istVorhaben(folder: ArchiveFolderNode, muster: RegExp | null): boolean {
  return folder.bericht !== null || isVorhaben(folder, muster)
}

/**
 * Ordnet jede Transformations-Zeile ihrem Vorhaben zu.
 * `elternVon(folderId)` liefert die Eltern-Id eines NICHT gescannten Ordners
 * (null = Wurzel/unbekannt) und darf werfen; der Fehler landet in `hinweise`.
 */
export async function ordneSitzungenZu(args: {
  zeilen: readonly TransformationZeile[]
  folders: readonly ArchiveFolderNode[]
  vorhabenMuster: RegExp | null
  elternVon: (folderId: string) => Promise<string | null>
}): Promise<SitzungenZuordnung> {
  const byId = new Map(args.folders.map((f) => [f.folderId, f]))
  const elternCache = new Map<string, Promise<string | null>>()
  const elternVon = (id: string): Promise<string | null> => {
    const cached = elternCache.get(id)
    if (cached) return cached
    const frisch = args.elternVon(id)
    elternCache.set(id, frisch)
    return frisch
  }

  async function vorhabenFuer(startId: string): Promise<{ pfad: string; folderId: string } | null> {
    let id: string | null = startId
    for (let schritt = 0; id !== null && schritt < MAX_AUFSTIEG; schritt += 1) {
      const folder = byId.get(id)
      if (folder) {
        if (istVorhaben(folder, args.vorhabenMuster)) return { pfad: folder.path, folderId: folder.folderId }
        id = folder.parentFolderId
        continue
      }
      id = await elternVon(id)
    }
    if (id !== null) throw new Error(`Eltern-Kette laenger als ${MAX_AUFSTIEG} Ordner ab ${startId}`)
    return null
  }

  const ergebnis: SitzungenZuordnung = { sitzungen: [], uebersprungen: [], hinweise: [] }
  for (const zeile of args.zeilen) {
    let vorhaben: { pfad: string; folderId: string } | null = null
    if (zeile.parentId === '') {
      ergebnis.hinweise.push(`${zeile.sourceName}: Twin ohne parentId — ohne Vorhaben gefuehrt`)
    } else {
      try {
        vorhaben = await vorhabenFuer(zeile.parentId)
      } catch (error) {
        ergebnis.hinweise.push(
          `${zeile.sourceName}: Ordner ${zeile.parentId} nicht aufloesbar (${error instanceof Error ? error.message : String(error)}) — ohne Vorhaben gefuehrt`,
        )
      }
    }
    const s = sitzungAusTransformation(zeile, vorhaben)
    if (s.ok) ergebnis.sitzungen.push(s.sitzung)
    else ergebnis.uebersprungen.push({ beleg: s.beleg, grund: s.grund })
  }
  return ergebnis
}

/** `elternVon` fuer den echten Storage: Eltern-Id des Ordners, '' (Wurzel) → null. */
export function elternVonProvider(provider: { getItemById(id: string): Promise<{ parentId: string }> }) {
  return async (folderId: string): Promise<string | null> => {
    const item = await provider.getItemById(folderId)
    return item.parentId === '' ? null : item.parentId
  }
}
