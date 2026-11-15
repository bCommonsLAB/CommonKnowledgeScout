/**
 * @fileoverview Gruppen der Liste im Reiter „Sitzungen" (Register, Welle R3). Reine Funktionen.
 *
 * @description
 * Eine flache Tabelle waere endlos (Plan §5), darum wird gruppiert:
 * - `bereich`: Bereich → Vorhaben. Den Ort kennt eine Zeile aus dem
 *   Ablage-Cache der Sichten-Laeufe (`vorhabenPfad`). Ohne Cache zaehlt der
 *   Vorhaben-Vorschlag (z. B. aus der Arbeitsliste) — sichtbar als
 *   „vorgeschlagen", nie als festgestellter Ort; den Bereich dazu nennt nur ein
 *   Vorhaben, dessen Ort eine andere Zeile schon kennt (eindeutig). Was sich
 *   so nicht einordnen laesst, steht in benannten Sammelgruppen am Ende.
 * - `werkzeug`: je Quelle eine Gruppe.
 * - `hinweis`: je Auffaelligkeits-Grund eine Gruppe; auch leere Gruppen
 *   erscheinen („0 ist auch eine Auskunft"). Eine Zeile kann in mehreren stehen.
 *
 * @module agent-view/sitzungen-register
 */

import { AUFFAELLIG_GRUENDE, AUFFAELLIG_NAMEN, auffaelligGruende } from './reiter-sicht'
import { QUELLE_NAMEN } from './reiter-texte'
import { SITZUNGS_QUELLEN, type SitzungsQuelle, type SitzungsSicht } from './types'

export const REITER_GRUPPIERUNGEN = ['bereich', 'werkzeug', 'hinweis'] as const
export type ReiterGruppierung = (typeof REITER_GRUPPIERUNGEN)[number]

export const OHNE_VORHABEN = 'Beleg ohne Vorhaben'
export const BEREICH_UNBEKANNT = 'Vorgeschlagen, Bereich offen'
export const NICHT_BESTIMMT = 'Vorhaben noch nicht bestimmt'
const SAMMEL_REIHENFOLGE = [OHNE_VORHABEN, BEREICH_UNBEKANNT, NICHT_BESTIMMT]

export interface ReiterGruppe {
  schluessel: string
  name: string
  /** Zeilen direkt in dieser Gruppe (ohne Untergruppen). */
  zeilen: SitzungsSicht[]
  untergruppen: ReiterGruppe[]
  /** Alle Zeilen samt Untergruppen. */
  anzahl: number
  /** Zeilen, deren Ort nur ein Vorschlag ist. */
  vorgeschlagen: number
  /** Sammelgruppe (kein echter Bereich) — steht am Ende. */
  sammel: boolean
}

export interface ZeilenOrt {
  bereich: string
  vorhaben: string | null
  vorgeschlagen: boolean
  sammel: boolean
}

/** Ordnername des Vorhabens → Bereich, aus allen Zeilen mit bekanntem Ort; mehrdeutige Namen fehlen. */
export function bereichJeVorhaben(zeilen: readonly SitzungsSicht[]): Map<string, string> {
  const gesehen = new Map<string, Set<string>>()
  for (const z of zeilen) {
    const teile = z.vorhabenPfad?.split('/') ?? []
    if (teile.length < 2) continue
    const name = teile[teile.length - 1]
    gesehen.set(name, (gesehen.get(name) ?? new Set()).add(teile[0]))
  }
  return new Map([...gesehen].filter(([, b]) => b.size === 1).map(([n, b]) => [n, [...b][0]]))
}

export function ortDerZeile(z: SitzungsSicht, bereiche: ReadonlyMap<string, string>): ZeilenOrt {
  if (z.vorhabenBestimmt) {
    if (z.vorhabenPfad === null) return { bereich: OHNE_VORHABEN, vorhaben: null, vorgeschlagen: false, sammel: true }
    const [bereich, ...rest] = z.vorhabenPfad.split('/')
    return { bereich, vorhaben: rest.length > 0 ? rest[rest.length - 1] : null, vorgeschlagen: false, sammel: false }
  }
  if (z.vorhabenVorschlag !== null) {
    const bereich = bereiche.get(z.vorhabenVorschlag.ordner)
    return { bereich: bereich ?? BEREICH_UNBEKANNT, vorhaben: z.vorhabenVorschlag.ordner, vorgeschlagen: true, sammel: bereich === undefined }
  }
  return { bereich: NICHT_BESTIMMT, vorhaben: null, vorgeschlagen: false, sammel: true }
}

function neueGruppe(schluessel: string, name: string, sammel: boolean): ReiterGruppe {
  return { schluessel, name, zeilen: [], untergruppen: [], anzahl: 0, vorgeschlagen: 0, sammel }
}

const nachName = (a: ReiterGruppe, b: ReiterGruppe) => a.name.localeCompare(b.name, 'de', { numeric: true })

function nachBereich(zeilen: readonly SitzungsSicht[], alle: readonly SitzungsSicht[]): ReiterGruppe[] {
  const bereiche = bereichJeVorhaben(alle)
  const gruppen = new Map<string, ReiterGruppe>()
  for (const z of zeilen) {
    const ort = ortDerZeile(z, bereiche)
    const g = gruppen.get(ort.bereich) ?? neueGruppe(`b:${ort.bereich}`, ort.bereich, ort.sammel)
    gruppen.set(ort.bereich, g)
    g.anzahl += 1
    if (ort.vorgeschlagen) g.vorgeschlagen += 1
    if (ort.vorhaben === null) { g.zeilen.push(z); continue }
    let u = g.untergruppen.find((x) => x.name === ort.vorhaben)
    if (!u) { u = neueGruppe(`${g.schluessel}/${ort.vorhaben}`, ort.vorhaben, false); g.untergruppen.push(u) }
    u.zeilen.push(z)
    u.anzahl += 1
    if (ort.vorgeschlagen) u.vorgeschlagen += 1
  }
  for (const g of gruppen.values()) g.untergruppen.sort(nachName)
  const echt = [...gruppen.values()].filter((g) => !g.sammel).sort(nachName)
  const sammel = SAMMEL_REIHENFOLGE.map((n) => gruppen.get(n)).filter((g): g is ReiterGruppe => g !== undefined)
  return [...echt, ...sammel]
}

function nachWerkzeug(zeilen: readonly SitzungsSicht[]): ReiterGruppe[] {
  const schluessel: Array<SitzungsQuelle | null> = [...SITZUNGS_QUELLEN, null]
  return schluessel
    .map((q) => {
      const g = neueGruppe(`w:${q ?? 'unbekannt'}`, QUELLE_NAMEN[q ?? 'unbekannt'], q === null)
      g.zeilen = zeilen.filter((z) => z.quelle === q)
      g.anzahl = g.zeilen.length
      return g
    })
    .filter((g) => g.anzahl > 0)
}

function nachHinweis(zeilen: readonly SitzungsSicht[], jetzt: Date): ReiterGruppe[] {
  const gruende = new Map(zeilen.map((z) => [z.registerId, auffaelligGruende(z, jetzt)]))
  return AUFFAELLIG_GRUENDE.map((grund) => {
    const g = neueGruppe(`h:${grund}`, AUFFAELLIG_NAMEN[grund], false)
    g.zeilen = zeilen.filter((z) => gruende.get(z.registerId)?.includes(grund) === true)
    g.anzahl = g.zeilen.length
    return g
  })
}

/** `alle`: alle Zeilen des Registers (fuer die Bereich-Zuordnung von Vorschlaegen), nicht nur die gefilterten. */
export function gruppiere(args: {
  zeilen: readonly SitzungsSicht[]
  alle: readonly SitzungsSicht[]
  gruppierung: ReiterGruppierung
  jetzt: Date
}): ReiterGruppe[] {
  switch (args.gruppierung) {
    case 'bereich':
      return nachBereich(args.zeilen, args.alle)
    case 'werkzeug':
      return nachWerkzeug(args.zeilen)
    case 'hinweis':
      return nachHinweis(args.zeilen, args.jetzt)
  }
}

/** Ordnernamen der Vorhaben, die das Register kennt (Ablage-Cache und Vorschlaege) — Auswahl fuer „Vorhaben vorschlagen". */
export function bekannteVorhaben(zeilen: readonly SitzungsSicht[]): string[] {
  const namen = new Set<string>()
  for (const z of zeilen) {
    const teile = z.vorhabenPfad?.split('/') ?? []
    if (teile.length >= 2) namen.add(teile[teile.length - 1])
    if (z.vorhabenVorschlag !== null) namen.add(z.vorhabenVorschlag.ordner)
  }
  return [...namen].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
}
