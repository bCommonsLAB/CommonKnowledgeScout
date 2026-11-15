/**
 * @fileoverview Eine Listenzeile ihrer Sitzung zuordnen (R2). Reine Funktion.
 *
 * @description
 * Reihenfolge der Wege (Plan §4):
 * 1. `link` — Teil D traegt die volle Kennung `session_…` im Sitzungs-Link.
 * 2. `verweis` — erledigte Zeilen nennen `[[JJJJ-MM-TT Titel]]`; das ist der
 *    Beleg-Name ohne Art-Wort (`Code`/`Chat`) und ohne `.md`.
 * 3. `praefix` — das Export-Kuerzel (8 Zeichen) gegen die Kennungen der Belege;
 *    nur ein eindeutiger Treffer zaehlt.
 * 4. `alt` — nichts davon: die Zeile wird `alt:<Nr>` (mit Kuerzel, falls bekannt).
 * Widersprueche (Verweis und Kuerzel zeigen auf verschiedene Belege, Kuerzel
 * mehrdeutig, erledigt ohne Beleg) werden Hinweise, nie still aufgeloest.
 *
 * @module agent-view/sitzungen-register/import
 */

import { belegKennung, istVolleKennung } from '../ist-beleg'
import type { IstBeleg } from '../types'
import type { ListenEintrag } from './listenzeile-lesen'

export type ZuordnungsWeg = 'link' | 'verweis' | 'praefix' | 'alt'

export interface Zuordnung {
  weg: ZuordnungsWeg
  /** Volle Kennung, wenn bekannt. */
  kennung: string | null
  /** Beleg, wenn gefunden. */
  beleg: IstBeleg | null
  hinweise: string[]
}

const ART_WORT = /^(\d{4}-\d{2}-\d{2}) (?:Code|Chat) /

/** Vergleichsschluessel: Name ohne `.md`, ohne Art-Wort, Leerraum vereinheitlicht. */
export function namensSchluessel(name: string): string {
  return name.replace(/\.md$/i, '').replace(ART_WORT, '$1 ').replace(/\s+/g, ' ').trim().normalize('NFC')
}

export interface BelegIndex {
  nachName: Map<string, IstBeleg[]>
  alle: readonly IstBeleg[]
}

export function belegIndex(belege: readonly IstBeleg[]): BelegIndex {
  const nachName = new Map<string, IstBeleg[]>()
  for (const b of belege) {
    const k = namensSchluessel(b.name)
    nachName.set(k, [...(nachName.get(k) ?? []), b])
  }
  return { nachName, alle: belege }
}

function nachPraefix(index: BelegIndex, praefix: string): IstBeleg[] {
  return index.alle.filter((b) => {
    const k = belegKennung(b)
    return k !== null && k.startsWith(praefix)
  })
}

export function ordneZeileZu(e: ListenEintrag, index: BelegIndex): Zuordnung {
  const hinweise: string[] = []
  if (e.kennungAusLink !== null) {
    return { weg: 'link', kennung: e.kennungAusLink, beleg: index.alle.find((b) => belegKennung(b) === e.kennungAusLink) ?? null, hinweise }
  }

  let beleg: IstBeleg | null = null
  let weg: ZuordnungsWeg = 'alt'
  if (e.belegVerweis !== null) {
    const treffer = index.nachName.get(namensSchluessel(e.belegVerweis)) ?? []
    if (treffer.length === 1) { beleg = treffer[0]; weg = 'verweis' }
    else if (treffer.length > 1) hinweise.push(`Verweis [[${e.belegVerweis}]] passt auf ${treffer.length} Belege`)
    else hinweise.push(`Verweis [[${e.belegVerweis}]]: kein Beleg mit Notiz gefunden`)
  }

  if (e.exportPraefix !== null) {
    const treffer = nachPraefix(index, e.exportPraefix)
    if (beleg !== null && treffer.length > 0 && !treffer.includes(beleg)) {
      hinweise.push(`Kuerzel ${e.exportPraefix} zeigt auf einen anderen Beleg als der Verweis — der Verweis gilt`)
    }
    if (beleg === null && treffer.length === 1) { beleg = treffer[0]; weg = 'praefix' }
    if (beleg === null && treffer.length > 1) hinweise.push(`Kuerzel ${e.exportPraefix} passt auf ${treffer.length} Belege`)
  }

  if (beleg !== null) {
    const k = belegKennung(beleg)
    return { weg, kennung: k !== null && istVolleKennung(k) ? k : null, beleg, hinweise }
  }
  if (e.erledigt && e.ueberspringenGrund === null) hinweise.push('erledigt, aber kein Beleg mit Notiz gefunden')
  return { weg: 'alt', kennung: null, beleg: null, hinweise }
}
