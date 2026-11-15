/**
 * @fileoverview Sitzungsnotizen ihren Vorhaben zuordnen (S1/S1b).
 *
 * @description
 * Der Vorhabensordner eines Belegs steht nicht im Twin, sondern im Pfad der
 * Quelle: `parentId` zeigt auf den Ordner, der Berichte-Scan (Tiefe ≤ 3)
 * kennt Pfad und Eltern jedes Ordners. Von dort geht es aufwaerts bis zum
 * ersten Vorhaben (BERICHT.md, Selbstdeklaration oder Namensmuster — wie
 * `isVorhaben`). Liegt der Beleg tiefer als der Scan (Ereignisordner), holt
 * `elternVon` die Eltern-Id aus dem Storage; scheitert das, wird es als
 * Hinweis ausgewiesen und der Beleg zaehlt „ohne Vorhaben" — nicht still.
 * S1b: `vorhaben:` im Beleg-Kopf nennt weitere Vorhaben per ORDNERNAME; sie
 * werden gegen die Vorhaben des Scans aufgeloest (unbekannt oder mehrdeutig
 * → Hinweis, kein Raten).
 * Eintraege im Kopf duerfen Ordnernamen oder library-relative Pfade sein
 * (`vorhabenEintrag`): Pfade werden im Lauf ueber die ganze Library genau
 * verglichen, im Teilbaum (Pfade dort relativ zum Scope) ueber den Namen.
 * Im Teilbaum-Lauf heisst der Wurzelordner des Scans `''` (archive-scan);
 * seinen echten Namen reicht der Aufrufer als `wurzelName` herein. Ohne ihn
 * gilt der Name als unbekannt — kein Vergleich mit `hauptvorhaben` gegen ''
 * (Befund Live-Abnahme R4, 15.11.: 170 Hinweise „liegt in „"").
 *
 * @module agent-view/sichten
 */

import { isVorhaben } from '../archive-rules'
import type { ArchiveFolderNode } from '../archive-types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { belegVorhaben, sitzungAusTransformation, vorhabenEintrag, type SitzungsDatensatz, type VorhabenRef } from './sitzungen-types'

/** Schutz gegen Zyklen in fremden Eltern-Ketten. */
const MAX_AUFSTIEG = 30

export interface SitzungenZuordnung {
  sitzungen: SitzungsDatensatz[]
  /** Belege, aus denen kein Datensatz wurde (z. B. ohne Datum). */
  uebersprungen: Array<{ beleg: string; grund: string }>
  /** Nicht aufloesbare Eltern-Ketten oder Vorhaben-Namen — ausgewiesen, nicht geraten. */
  hinweise: string[]
}

function istVorhaben(folder: ArchiveFolderNode, muster: RegExp | null): boolean {
  return folder.bericht !== null || isVorhaben(folder, muster)
}

/** Ordnername; die Scan-Wurzel (`path === ''`) traegt ihn nicht — dann `wurzelName`, sonst unbekannt (null). */
function ordnerName(f: ArchiveFolderNode, wurzelName: string | undefined): string | null {
  if (f.path !== '') return f.name
  return wurzelName ?? null
}

/** Vorhaben des Scans nach Ordnername (mehrere gleichnamige bleiben als Liste sichtbar). */
function vorhabenNachName(folders: readonly ArchiveFolderNode[], muster: RegExp | null, wurzelName: string | undefined): Map<string, VorhabenRef[]> {
  const byName = new Map<string, VorhabenRef[]>()
  for (const f of folders) {
    const name = ordnerName(f, wurzelName)
    if (name === null || !istVorhaben(f, muster)) continue
    byName.set(name, [...(byName.get(name) ?? []), { pfad: f.path, folderId: f.folderId }])
  }
  return byName
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
  /** Teilbaum-Lauf: echter Name des Scope-Ordners (die Scan-Wurzel heisst ''). */
  wurzelName?: string
}): Promise<SitzungenZuordnung> {
  const byId = new Map(args.folders.map((f) => [f.folderId, f]))
  const byName = vorhabenNachName(args.folders, args.vorhabenMuster, args.wurzelName)
  // Pfade des Scans sind nur im Lauf ueber die ganze Library library-relativ.
  const vollerLauf = args.wurzelName === undefined
  const byPfad = new Map(args.folders.filter((f) => f.path !== '' && istVorhaben(f, args.vorhabenMuster)).map((f) => [f.path, { pfad: f.path, folderId: f.folderId }]))
  const elternCache = new Map<string, Promise<string | null>>()
  const elternVon = (id: string): Promise<string | null> => {
    const cached = elternCache.get(id)
    if (cached) return cached
    const frisch = args.elternVon(id)
    elternCache.set(id, frisch)
    return frisch
  }

  async function vorhabenFuer(startId: string): Promise<VorhabenRef | null> {
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
    let vorhaben: VorhabenRef | null = null
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
    const ablageOrdner = vorhaben !== null ? byId.get(vorhaben.folderId) : undefined
    const ablageName = ablageOrdner !== undefined ? ordnerName(ablageOrdner, args.wurzelName) : null
    const { vorhaben: namen, hauptvorhaben } = belegVorhaben(zeile.sourceFrontmatter?.fields ?? null)
    /** Meint der Kopf-Eintrag das Ablage-Vorhaben? Pfad genau (voller Lauf), sonst der Name. */
    const meintAblage = (eintrag: string): boolean => {
      if (vorhaben === null) return false
      const e = vorhabenEintrag(eintrag)
      if (e.pfad !== null && vollerLauf) return e.pfad === vorhaben.pfad
      return ablageName !== null && e.name === ablageName
    }
    if (hauptvorhaben !== null && ablageName !== null && !meintAblage(hauptvorhaben)) {
      ergebnis.hinweise.push(`${zeile.sourceName}: liegt in „${ablageName}", hauptvorhaben sagt „${hauptvorhaben}" — Ablage gilt`)
    }
    const weitereVorhaben: VorhabenRef[] = []
    for (const eintrag of namen) {
      if (meintAblage(eintrag)) continue
      const e = vorhabenEintrag(eintrag)
      const genau = e.pfad !== null && vollerLauf ? byPfad.get(e.pfad) : undefined
      const treffer = genau !== undefined ? [genau] : e.pfad !== null && vollerLauf ? [] : byName.get(e.name) ?? []
      if (treffer.length === 1) weitereVorhaben.push(treffer[0])
      else if (treffer.length === 0) ergebnis.hinweise.push(`${zeile.sourceName}: Vorhaben „${eintrag}" aus vorhaben: nicht im Scan — Querverweis entfaellt`)
      else ergebnis.hinweise.push(`${zeile.sourceName}: Vorhaben „${eintrag}" ist mehrdeutig (${treffer.map((t) => t.pfad).join(', ')}) — Querverweis entfaellt`)
    }
    const s = sitzungAusTransformation(zeile, { vorhaben, belegOrdnerPfad: byId.get(zeile.parentId)?.path ?? null, weitereVorhaben })
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
