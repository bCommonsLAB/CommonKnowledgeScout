/**
 * @fileoverview Schreibwege des Sitzungs-Registers (Register, Welle R1, I/O).
 *
 * @description
 * Drei Wege, alle mit den reinen Planern aus `schreib-plaene.ts`/`abgleich.ts`:
 * - `meldeSitzungen`: Stapel, idempotent, Ergebnis je Zeile (angelegt,
 *   ergaenzt, unveraendert oder Fehler) — ein Fehler bricht den Stapel nicht ab.
 * - `setzeSitzung`: Entscheidung, Grund, Zugbereiche, Vorschlag, Bemerkung,
 *   Kennung nachtragen. Traegt die Kennung schon eine reine Archiv-Zeile
 *   (nur vom Sichten-Lauf angelegt, nichts von Hand), wird sie hineingefuehrt
 *   und das gesagt; sonst wirft es benannt.
 * - `gleicheRegisterAb`: der Teil der Sichten-Laeufe (W3, W4, W7).
 *
 * @module agent-view/sitzungen-register
 */

import type { SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import {
  SitzungsKennungVergebenError, aendereZeile, holeNachKennung, holeZeile, legeZeileAn, listeRegister, loescheZeile, schreibeAbgleich,
  type AbgleichSchreibErgebnis,
} from '@/lib/repositories/agent-view-sitzungen-repo'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { planeAbgleich, zusammenfuehren, type AbgleichArt } from './abgleich'
import { istAusTransformation } from './ist-beleg'
import { istReineArchivZeile, planeMeldung, planeSetzen, type MeldeEingabe, type SetzEingabe } from './schreib-plaene'
import type { SitzungsRegisterDoc } from './types'

export class SitzungNichtGefundenError extends Error {
  readonly code = 'nicht_gefunden' as const
}

export interface MeldeZeile {
  sitzungId: string
  aktion?: 'angelegt' | 'ergaenzt' | 'unveraendert'
  felder?: string[]
  /** Gemeldete Werte, die eine vorhandene Angabe nicht ersetzen (Vorhaben-Vorschlag). */
  belassen?: string[]
  fehler?: string
}

export async function meldeSitzungen(args: {
  libraryId: string
  eingaben: readonly MeldeEingabe[]
  gemeldetVon: 'skill' | 'inventar'
  jetzt: string
}): Promise<MeldeZeile[]> {
  const zeilen: MeldeZeile[] = []
  for (const eingabe of args.eingaben) {
    try {
      const bestehend = await holeNachKennung(args.libraryId, eingabe.sitzungId)
      const plan = planeMeldung({ libraryId: args.libraryId, bestehend, eingabe, gemeldetVon: args.gemeldetVon, jetzt: args.jetzt })
      if (plan.aktion === 'angelegt') await legeZeileAn(args.libraryId, plan.doc)
      if (plan.aktion === 'ergaenzt' && bestehend !== null) {
        await aendereZeile(args.libraryId, bestehend.registerId, { set: plan.set, neuePrs: plan.neuePrs })
      }
      zeilen.push({
        sitzungId: eingabe.sitzungId,
        aktion: plan.aktion,
        ...(plan.aktion === 'ergaenzt' ? { felder: plan.felder } : {}),
        ...(plan.aktion !== 'angelegt' && plan.belassen.length > 0 ? { belassen: plan.belassen } : {}),
      })
    } catch (error) {
      zeilen.push({ sitzungId: eingabe.sitzungId, fehler: error instanceof Error ? error.message : String(error) })
    }
  }
  return zeilen
}

export interface SetzErgebnis {
  zeile: SitzungsRegisterDoc
  felder: string[]
  umgeschluesselt: { von: string; nach: string } | null
  zusammengefuehrt: string | null
}

export async function setzeSitzung(args: {
  libraryId: string
  registerId: string
  eingabe: SetzEingabe
  jetzt: string
}): Promise<SetzErgebnis> {
  const doc = await holeZeile(args.libraryId, args.registerId)
  if (doc === null) throw new SitzungNichtGefundenError(`Register-Zeile ${args.registerId} gibt es nicht (sitzungen_auflisten nennt die Schluessel)`)
  const plan = planeSetzen(doc, args.eingabe, args.jetzt)
  if (plan.felder.length === 0) return { zeile: doc, felder: [], umgeschluesselt: null, zusammengefuehrt: null }

  let set = plan.set
  let zusammengefuehrt: string | null = null
  if (plan.neueKennung !== null) {
    const andere = (await holeNachKennung(args.libraryId, plan.neueKennung)) ?? (await holeZeile(args.libraryId, plan.neueKennung))
    if (andere !== null && andere.registerId !== doc.registerId) {
      if (!istReineArchivZeile(andere)) {
        throw new SitzungsKennungVergebenError(
          `Kennung ${plan.neueKennung} traegt schon Zeile ${andere.registerId} (gemeldet von ${andere.gemeldetVon}) mit eigenen Angaben — nicht zusammengefuehrt`,
        )
      }
      set = { ...set, ...zusammenfuehren({ ...doc, ...set }, andere) }
      // Erst loeschen, dann umschluesseln (Unique-Index). Scheitert das Umschluesseln, legt der naechste Sichten-Lauf die Archiv-Zeile neu an.
      await loescheZeile(args.libraryId, andere.registerId)
      zusammengefuehrt = andere.registerId
    }
  }
  const neu = await aendereZeile(args.libraryId, doc.registerId, { set, unset: plan.unset })
  if (neu === null) throw new SitzungNichtGefundenError(`Register-Zeile ${doc.registerId} waehrend des Setzens verschwunden`)
  return {
    zeile: neu,
    felder: plan.felder,
    umgeschluesselt: plan.neueKennung !== null ? { von: doc.registerId, nach: plan.neueKennung } : null,
    zusammengefuehrt,
  }
}

export interface RegisterAbgleichErgebnis extends AbgleichSchreibErgebnis {
  geplant: { neu: number; aenderungen: number }
  hinweise: string[]
}

/**
 * Register-Teil eines Sichten-Laufs. `zeilen`: Notizen dieses Laufs (mit
 * Kopf), `sitzungen`: ihre S1-Zuordnung, `berichtet`: sourceIds, die der Lauf
 * in Chronik bzw. Block geschrieben hat. `ablageSchreiben`: nur bei einem Lauf
 * ueber die ganze Library (im Teilbaum sind die Pfade relativ zum Scope).
 */
export async function gleicheRegisterAb(args: {
  libraryId: string
  zeilen: readonly TransformationZeile[]
  sitzungen: readonly SitzungsDatensatz[]
  berichtet: ReadonlySet<string>
  ablageSchreiben: boolean
  art: AbgleichArt
  jetzt: string
}): Promise<RegisterAbgleichErgebnis> {
  const docs = await listeRegister(args.libraryId)
  const ablagen = new Map(args.sitzungen.map((s) => [s.sourceId, {
    vorhabenPfad: s.vorhabenPfad, vorhabenFolderId: s.vorhabenFolderId, belegOrdnerPfad: s.belegOrdnerPfad,
  }]))
  const plan = planeAbgleich({
    libraryId: args.libraryId, docs, belege: args.zeilen.map(istAusTransformation),
    ablagen, berichtet: args.berichtet, ablageSchreiben: args.ablageSchreiben, art: args.art, jetzt: args.jetzt,
  })
  const ergebnis = await schreibeAbgleich(args.libraryId, plan)
  return { ...ergebnis, geplant: { neu: plan.neu.length, aenderungen: plan.aenderungen.length }, hinweise: plan.hinweise }
}

export type RegisterLaufErgebnis = RegisterAbgleichErgebnis | { abgebrochen: true; fehler: string[] }

/**
 * Fuer die Sichten-Laeufe: Chronik bzw. Block sind dann schon geschrieben.
 * Scheitert das Register, steht das in der Antwort des Laufs (`register.fehler`),
 * statt die geschriebenen Sichten als Fehlschlag zu melden.
 */
export async function registerNachLauf(args: Parameters<typeof gleicheRegisterAb>[0]): Promise<RegisterLaufErgebnis> {
  try {
    return await gleicheRegisterAb(args)
  } catch (error) {
    return { abgebrochen: true, fehler: [`Register nicht abgeglichen: ${error instanceof Error ? error.message : String(error)}`] }
  }
}
