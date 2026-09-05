/**
 * @fileoverview Zyklus-Board (F1b): Soll/Ist je Vorhaben als Kartenliste.
 *
 * @description
 * Zweite Darstellung neben dem Baum: alle Vorhaben nach `bearbeitungsstand`.
 * Jede Karte zeigt den ERKLAERTEN Stand (Soll-Buch) und den BERECHNETEN
 * Befund (Ist-Buch) — inklusive Widerspruchszustand („abgenommen, aber nicht
 * mehr aktuell"), ohne dass eine Datei angefasst wird.
 *
 * Reine Funktion, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import { isVorhaben } from './archive-rules'
import { asList, asString, projektAusBericht, titelLesen } from './sichten/bericht-lesen'
import type { CoverageGap, CoverageTreeNode, VorhabenCard } from './types'

function flatten(nodes: readonly CoverageTreeNode[], into: Map<string, CoverageTreeNode>): void {
  for (const node of nodes) {
    into.set(node.folderId, node)
    flatten(node.children, into)
  }
}

/**
 * Kleinst-Skalare des Berichts fuer die Karte (F9, Werkbank W1) — aus den beim
 * Scan OHNEHIN gelesenen Contract-Dateien, via `titelLesen`/`asString`/`asList`
 * (kein zweiter Parser). `themen` folgt F12: `BERICHT.md` ist fuehrend; das
 * `_INDEX.md` zaehlt nur fuer Vorhaben OHNE Bericht.
 */
type BerichtFelder = Pick<
  VorhabenCard,
  | 'berichtTitel' | 'berichtFileId' | 'berichtModifiedAt' | 'berichtStatus' | 'themen'
  | 'berichtRolle' | 'berichtLetzteAktivitaet' | 'berichtNaechsterTermin'
  | 'berichtTerminFixiert' | 'berichtOffenePunkte' | 'berichtOffeneAnzahl'
>

/** Wie viele offene Punkte die Karte traegt — `AKTUELL.md` zeigt dieselben zwei. */
export const AKTUELL_PUNKTE_AUF_KARTE = 2

/** Leerwerte der A7-Felder: gesetzt, aber leer — nicht „fehlt" (alter Report). */
function ohneAktuellFelder(): Pick<
  VorhabenCard,
  'berichtRolle' | 'berichtLetzteAktivitaet' | 'berichtNaechsterTermin'
  | 'berichtTerminFixiert' | 'berichtOffenePunkte' | 'berichtOffeneAnzahl'
> {
  return {
    berichtRolle: null,
    berichtLetzteAktivitaet: null,
    berichtNaechsterTermin: null,
    berichtTerminFixiert: true,
    berichtOffenePunkte: [],
    berichtOffeneAnzahl: 0,
  }
}

function berichtFelder(folder: ArchiveFolderNode): BerichtFelder {
  const bericht = folder.bericht
  if (bericht === null) {
    return {
      berichtTitel: null,
      berichtFileId: null,
      berichtModifiedAt: null,
      berichtStatus: null,
      themen: asList(folder.index?.meta.themen),
      ...ohneAktuellFelder(),
    }
  }
  // A7: dieselben Leser wie der Sichten-Export (`projektAusBericht`) — kein
  // zweiter Parser fuer dieselben Felder. null = Bericht OHNE Frontmatter;
  // dann bleiben die Termin-/Rollen-Felder leer, der Titel kommt trotzdem.
  const projekt = projektAusBericht(folder)
  const schritte = projekt?.schritte ?? []
  return {
    berichtTitel: titelLesen(bericht.body),
    berichtFileId: bericht.fileId,
    berichtModifiedAt: bericht.modifiedAt,
    berichtStatus: asString(bericht.meta.status),
    themen: asList(bericht.meta.themen),
    berichtRolle: projekt?.rolle ?? null,
    berichtLetzteAktivitaet: projekt?.letzteAktivitaet ?? null,
    berichtNaechsterTermin: projekt?.naechsterTermin ?? null,
    berichtTerminFixiert: projekt?.terminFixiert ?? true,
    berichtOffenePunkte: schritte.slice(0, AKTUELL_PUNKTE_AUF_KARTE),
    berichtOffeneAnzahl: schritte.length,
  }
}

/** true, wenn die Karte aus einem gespeicherten Report vor Werkbank-W1 stammt (Felder fehlen). */
export function karteOhneWerkbankFelder(card: VorhabenCard): boolean {
  return card.ampel === undefined || card.themen === undefined
}

/** true, wenn die Karte aus einem Report vor Welle A7 stammt (Aktuell-Felder fehlen). */
export function karteOhneAktuellFelder(card: VorhabenCard): boolean {
  return card.berichtOffenePunkte === undefined || card.berichtTerminFixiert === undefined
}

/** Baut die Karten des Zyklus-Boards aus Baum + Ordnerliste. */
export function buildVorhabenCards(args: {
  folders: readonly ArchiveFolderNode[]
  tree: readonly CoverageTreeNode[]
  gaps: readonly CoverageGap[]
  vorhabenPattern: RegExp | null
  /**
   * Ordner-Id der BIBLIOTHEKS-Wurzel (null bei Teilbaum-Scans). Die Wurzel
   * ist kein Vorhaben (Entscheid 2026-08-19: sie braucht keinen BERICHT) —
   * ihre Karte wuerde nur alle Befunde der Library doppeln.
   */
  libraryRootFolderId: string | null
}): VorhabenCard[] {
  const nodes = new Map<string, CoverageTreeNode>()
  flatten(args.tree, nodes)
  const widerspruch = new Set(
    args.gaps.filter((gap) => gap.type === 'stand_widerspruch').map((gap) => gap.folderId),
  )

  const cards: VorhabenCard[] = []
  for (const folder of args.folders) {
    if (folder.folderId === args.libraryRootFolderId) continue
    if (!isVorhaben(folder, args.vorhabenPattern)) continue
    const node = nodes.get(folder.folderId)
    if (!node) throw new Error(`Vorhaben ohne Baumknoten: ${folder.folderId}`)
    cards.push({
      folderId: node.folderId,
      name: node.name || '(Wurzel)',
      path: node.path,
      bearbeitungsstand: node.bearbeitungsstand,
      bearbeitungsstandSeit: node.bearbeitungsstandSeit,
      hasBericht: node.hasBericht,
      totalGaps: node.totalGaps,
      gapsByActor: { ...node.gapsByActor },
      gapsByType: { ...node.gapsByType },
      widerspruch: widerspruch.has(node.folderId),
      // Werkbank W1 (F9): Ampel vom Baumknoten uebernommen, Bericht-Skalare
      // aus den beim Scan gelesenen Contract-Dateien.
      ampel: node.ampel,
      // A6: die gepflegten Themen kommen IMMER aus dem _INDEX.md (`themen:`)
      // — unabhaengig vom Bericht; leer = sichtbar „Ohne Thema".
      gepflegteThemen: asList(folder.index?.meta.themen),
      ...berichtFelder(folder),
    })
  }

  return cards.sort((a, b) => a.path.localeCompare(b.path))
}
