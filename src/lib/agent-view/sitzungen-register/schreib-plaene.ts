/**
 * @fileoverview Was `sitzungen_melden` und `sitzung_setzen` aendern (Register, Welle R1). Reine Funktionen.
 *
 * @description
 * Melden ist idempotent: dieselbe Meldung zweimal ergibt `unveraendert`.
 * Gemeldete Felder ueberschreiben (der Melder weiss es besser als die
 * Archiv-Schaetzung), ausser dem Vorhaben-Vorschlag: ein vorhandener bleibt
 * und wird als `belassen` genannt. `entscheidung`, Grund, Zugbereiche und
 * Bemerkung setzt nur `sitzung_setzen`. Ungueltige Eingaben werfen benannt
 * (`SitzungsEingabeError`) — nie still korrigiert.
 *
 * @module agent-view/sitzungen-register
 */

import { istVolleKennung } from './ist-beleg'
import {
  ALT_PRAEFIX, BELEG_PRAEFIX,
  type Entscheidung, type SitzungsQuelle, type SitzungsRegisterDoc, type VorhabenVorschlag, type Zugbereich,
} from './types'

export class SitzungsEingabeError extends Error {
  readonly code = 'eingabe_ungueltig' as const
}

export interface MeldeEingabe {
  sitzungId: string
  quelle: SitzungsQuelle
  titel?: string
  beginn?: string
  ende?: string
  link?: string
  repo?: string
  branch?: string
  prs?: string[]
  vorhabenVorschlag?: VorhabenVorschlag
}

export type MeldePlan =
  | { aktion: 'angelegt'; doc: SitzungsRegisterDoc }
  | { aktion: 'ergaenzt'; set: Partial<SitzungsRegisterDoc>; neuePrs: string[]; felder: string[]; belassen: string[] }
  | { aktion: 'unveraendert'; belassen: string[] }

/** Eine volle Kennung, nicht mit den reservierten Praefixen `alt:`/`beleg:`. */
export function pruefeKennung(sitzungId: string): void {
  if (sitzungId.startsWith(ALT_PRAEFIX) || sitzungId.startsWith(BELEG_PRAEFIX)) {
    throw new SitzungsEingabeError(`Kennung „${sitzungId}": ${ALT_PRAEFIX} und ${BELEG_PRAEFIX} sind Register-Schluessel, keine Sitzungs-Kennungen`)
  }
  if (!istVolleKennung(sitzungId)) {
    throw new SitzungsEingabeError(`Kennung „${sitzungId}" ist keine volle Kennung (mind. 20 Zeichen, ohne Leerzeichen)`)
  }
}

export function planeMeldung(args: {
  libraryId: string
  bestehend: SitzungsRegisterDoc | null
  eingabe: MeldeEingabe
  gemeldetVon: 'skill' | 'inventar'
  jetzt: string
}): MeldePlan {
  const e = args.eingabe
  pruefeKennung(e.sitzungId)
  const skalare = {
    quelle: e.quelle, titelOriginal: e.titel, beginn: e.beginn, ende: e.ende, link: e.link, repo: e.repo, branch: e.branch,
  }
  const b = args.bestehend
  if (b === null) {
    return {
      aktion: 'angelegt',
      doc: {
        libraryId: args.libraryId, registerId: e.sitzungId, sitzungId: e.sitzungId, kennung: 'voll',
        quelle: e.quelle, titelOriginal: e.titel ?? null, beginn: e.beginn ?? null, ende: e.ende ?? null,
        link: e.link ?? null, repo: e.repo ?? null, branch: e.branch ?? null, prs: [...new Set(e.prs ?? [])], nrAlt: null,
        entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [], vorhabenVorschlag: e.vorhabenVorschlag ?? null,
        bemerkung: null, belegSourceIds: [], altNotizPfad: null, ablage: null, berichtet: { chronikAm: null, blockAm: null },
        gemeldetVon: args.gemeldetVon, gemeldetAm: args.jetzt, geaendertAm: args.jetzt,
      },
    }
  }
  const set: Partial<SitzungsRegisterDoc> = {}
  const felder: string[] = []
  for (const [feld, wert] of Object.entries(skalare) as Array<[keyof typeof skalare, string | undefined]>) {
    if (wert === undefined || b[feld] === wert) continue
    Object.assign(set, { [feld]: wert })
    felder.push(feld)
  }
  const belassen: string[] = []
  if (e.vorhabenVorschlag !== undefined) {
    const alt = b.vorhabenVorschlag
    if (alt === null) { set.vorhabenVorschlag = e.vorhabenVorschlag; felder.push('vorhabenVorschlag') }
    else if (alt.ordner !== e.vorhabenVorschlag.ordner) belassen.push('vorhabenVorschlag')
  }
  const neuePrs = (e.prs ?? []).filter((pr, i, alle) => !b.prs.includes(pr) && alle.indexOf(pr) === i)
  if (neuePrs.length > 0) felder.push('prs')
  if (felder.length === 0) return { aktion: 'unveraendert', belassen }
  return { aktion: 'ergaenzt', set: { ...set, geaendertAm: args.jetzt }, neuePrs, felder, belassen }
}

export interface SetzEingabe {
  entscheidung?: Entscheidung
  /** null oder "" loescht. */
  entscheidungGrund?: string | null
  zugbereiche?: Zugbereich[]
  vorhabenVorschlag?: VorhabenVorschlag | null
  bemerkung?: string | null
  /** Kennung nachtragen; der Register-Schluessel wird dann zur Kennung. */
  sitzungId?: string
}

export interface SetzPlan {
  set: Partial<SitzungsRegisterDoc>
  unset: Array<'kennungPraefix'>
  felder: string[]
  /** Neue Kennung = neuer registerId (Umschluesseln). */
  neueKennung: string | null
}

function leerZuNull(wert: string | null | undefined): string | null | undefined {
  return wert === undefined ? undefined : wert === null || wert.trim() === '' ? null : wert.trim()
}

/** Zugbereiche: von ≥ 1, bis ≥ von, keine Ueberschneidung. Liefert sie aufsteigend. */
export function pruefeZugbereiche(bereiche: readonly Zugbereich[]): Zugbereich[] {
  const sortiert = [...bereiche].sort((a, b) => a.von - b.von)
  sortiert.forEach((z, i) => {
    if (!Number.isInteger(z.von) || !Number.isInteger(z.bis) || z.von < 1 || z.bis < z.von) {
      throw new SitzungsEingabeError(`Zugbereich ${z.von}-${z.bis} ungueltig (von ≥ 1, bis ≥ von, ganze Zahlen)`)
    }
    if (i > 0 && z.von <= sortiert[i - 1].bis) {
      throw new SitzungsEingabeError(`Zugbereiche ${sortiert[i - 1].von}-${sortiert[i - 1].bis} und ${z.von}-${z.bis} ueberschneiden sich`)
    }
  })
  return sortiert
}

export function planeSetzen(doc: SitzungsRegisterDoc, e: SetzEingabe, jetzt: string): SetzPlan {
  const set: Partial<SitzungsRegisterDoc> = {}
  const felder: string[] = []
  const merke = <K extends keyof SitzungsRegisterDoc>(feld: K, wert: SitzungsRegisterDoc[K]) => {
    if (JSON.stringify(doc[feld]) === JSON.stringify(wert)) return
    set[feld] = wert
    felder.push(feld)
  }
  const grund = leerZuNull(e.entscheidungGrund)
  const entscheidung = e.entscheidung ?? doc.entscheidung
  const zugbereiche = e.zugbereiche !== undefined ? pruefeZugbereiche(e.zugbereiche) : doc.zugbereiche
  const wirksamerGrund = grund !== undefined ? grund : e.entscheidung === 'offen' ? null : doc.entscheidungGrund
  if (entscheidung === 'ueberspringen' && wirksamerGrund === null) {
    throw new SitzungsEingabeError('ueberspringen braucht entscheidungGrund')
  }
  if (entscheidung === 'trennen' && zugbereiche.length < 2) {
    throw new SitzungsEingabeError('trennen braucht mindestens zwei zugbereiche')
  }
  merke('entscheidung', entscheidung)
  merke('entscheidungGrund', wirksamerGrund)
  merke('zugbereiche', zugbereiche)
  if (e.vorhabenVorschlag !== undefined) merke('vorhabenVorschlag', e.vorhabenVorschlag)
  const bemerkung = leerZuNull(e.bemerkung)
  if (bemerkung !== undefined) merke('bemerkung', bemerkung)

  let neueKennung: string | null = null
  const unset: SetzPlan['unset'] = []
  if (e.sitzungId !== undefined && e.sitzungId !== doc.sitzungId) {
    pruefeKennung(e.sitzungId)
    if (doc.sitzungId !== undefined) {
      throw new SitzungsEingabeError(`Zeile ${doc.registerId} hat schon die Kennung ${doc.sitzungId} — nicht ueberschrieben`)
    }
    if (doc.kennungPraefix !== undefined && !e.sitzungId.startsWith(doc.kennungPraefix)) {
      throw new SitzungsEingabeError(`Kennung ${e.sitzungId} passt nicht zum Praefix ${doc.kennungPraefix} der Zeile`)
    }
    neueKennung = e.sitzungId
    Object.assign(set, { sitzungId: e.sitzungId, registerId: e.sitzungId, kennung: 'voll' })
    if (doc.kennungPraefix !== undefined) unset.push('kennungPraefix')
    felder.push('sitzungId')
  }
  if (felder.length > 0) set.geaendertAm = jetzt
  return { set, unset, felder, neueKennung }
}

/** Eine Zeile, die nur das Archiv angelegt hat und nichts von Hand traegt — beim Umschluesseln zusammenfuehrbar. */
export function istReineArchivZeile(doc: SitzungsRegisterDoc): boolean {
  return doc.gemeldetVon === 'archiv' && doc.entscheidung === 'offen' && doc.bemerkung === null &&
    doc.zugbereiche.length === 0 && doc.vorhabenVorschlag === null
}
