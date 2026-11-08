/**
 * @fileoverview Sitzungen je Vorhaben gruppieren und sortieren (S1/S1b).
 *
 * @description
 * Eine Sitzung erscheint in ihrem Ablage-Vorhaben und — als Querverweis — in
 * jedem weiteren Vorhaben aus `vorhaben:` des Belegs (Owner 09.11.2026: die
 * Nebenvorhaben-Zeilen der Handbloecke sollen nicht verloren gehen). Der
 * Querverweis traegt `belegAnderswo`, damit der Renderer „Beleg liegt in …"
 * anfuegt. Reihenfolge: Vorhaben in Archiv-Ordnung (Pfad, numerisch),
 * „Ohne Vorhaben" zuletzt, innerhalb chronologisch (aelteste zuerst).
 * Reine Funktionen.
 *
 * @module agent-view/sichten
 */

import type { SitzungsDatensatz } from './sitzungen-types'

export interface SitzungsEintrag {
  sitzung: SitzungsDatensatz
  /** true = Querverweis: der Beleg liegt in einem anderen Ordner (Nebenvorhaben). */
  belegAnderswo: boolean
}

export interface VorhabenGruppe {
  /** null = „Ohne Vorhaben" (immer zuletzt). */
  pfad: string | null
  folderId: string | null
  eintraege: SitzungsEintrag[]
}

/** Chronologisch, aelteste zuerst; gleicher Tag nach Beleg-Name. */
export function sortiereEintraege(eintraege: readonly SitzungsEintrag[]): SitzungsEintrag[] {
  return [...eintraege].sort(
    (a, b) => a.sitzung.datum.localeCompare(b.sitzung.datum) || a.sitzung.belegName.localeCompare(b.sitzung.belegName, 'de'),
  )
}

/** Eintraege eines Vorhabens: Ablage zuerst gedacht, Querverweise dazu, dann chronologisch. */
export function eintraegeFuerVorhaben(sitzungen: readonly SitzungsDatensatz[], folderId: string): SitzungsEintrag[] {
  const eintraege: SitzungsEintrag[] = []
  for (const s of sitzungen) {
    if (s.vorhabenFolderId === folderId) eintraege.push({ sitzung: s, belegAnderswo: false })
    else if (s.weitereVorhaben.some((v) => v.folderId === folderId)) eintraege.push({ sitzung: s, belegAnderswo: true })
  }
  return sortiereEintraege(eintraege)
}

/** Je Vorhaben eine Gruppe in Archiv-Ordnung („9." vor „10."), zuletzt „Ohne Vorhaben". */
export function gruppiereNachVorhaben(sitzungen: readonly SitzungsDatensatz[]): VorhabenGruppe[] {
  const vorhaben = new Map<string, string>()
  for (const s of sitzungen) {
    if (s.vorhabenFolderId !== null && s.vorhabenPfad !== null) vorhaben.set(s.vorhabenFolderId, s.vorhabenPfad)
    for (const v of s.weitereVorhaben) vorhaben.set(v.folderId, v.pfad)
  }
  const gruppen: VorhabenGruppe[] = [...vorhaben.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'de', { numeric: true }))
    .map(([folderId, pfad]) => ({ pfad, folderId, eintraege: eintraegeFuerVorhaben(sitzungen, folderId) }))
  const ohne = sitzungen.filter((s) => s.vorhabenFolderId === null).map((s) => ({ sitzung: s, belegAnderswo: false }))
  if (ohne.length > 0) gruppen.push({ pfad: null, folderId: null, eintraege: sortiereEintraege(ohne) })
  return gruppen
}
