/**
 * @fileoverview Beleg-Kopf gegen den Aufruf pruefen (Register, Welle R4). Reine Funktion.
 *
 * @description
 * Plan §6, Schritt 1: Der Kopf muss `type: chatverlauf` tragen und als
 * `session_id` genau die Kennung des Aufrufs — sonst ist es der falsche
 * Beleg, und nichts wird geschrieben. Ein angegebener Zugbereich muss
 * `zuege_von_bis` entsprechen (Teil-Beleg einer getrennten Sitzung).
 * Was nur nicht zusammenpasst, ohne falsch zu sein (Werkzeug, Haupt- und
 * Nebenvorhaben, Datum im Namen), wird Hinweis. Aus dem Kopf entsteht die
 * Meldung fuers Register (Titel, Beginn, Ende, Repo, Branch).
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import { asString } from '@/lib/agent-view/sichten/bericht-lesen'
import { belegNameLesen, belegVorhaben, vorhabenEintrag } from '@/lib/agent-view/sichten/sitzungen-types'
import { quelleAusWerkzeug, zuegeLesen, zuegeText } from '../ist-beleg'
import type { MeldeEingabe } from '../schreib-plaene'
import { SitzungsAbschlussError, type AbschlussEingabe } from './abschluss-typen'

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/

function tag(wert: unknown): string | undefined {
  const s = asString(wert)
  return s !== null && ISO_TAG.test(s) ? s : undefined
}

function oderUndefined(wert: string | null): string | undefined {
  return wert === null ? undefined : wert
}

export interface BelegKopfPruefung {
  meldung: MeldeEingabe
  hinweise: string[]
}

export function pruefeBelegKopf(args: {
  meta: Record<string, unknown>
  belegName: string
  eingabe: Pick<AbschlussEingabe, 'sitzungId' | 'quelle' | 'zugbereich'>
  /** Ordnername des Hauptvorhabens; null = bewusst ohne Vorhaben. */
  hauptvorhaben: string | null
  nebenvorhaben: readonly string[]
}): BelegKopfPruefung {
  const { meta, eingabe } = args
  const typ = asString(meta.type)
  if (typ !== 'chatverlauf') {
    throw new SitzungsAbschlussError('beleg_kopf', `${args.belegName}: Kopf type ist „${typ ?? 'leer'}", erwartet chatverlauf`)
  }
  const kennung = asString(meta.session_id)
  if (kennung === null) throw new SitzungsAbschlussError('beleg_kopf', `${args.belegName}: Kopf ohne session_id`)
  if (kennung !== eingabe.sitzungId) {
    throw new SitzungsAbschlussError('kennung_abweichend', `${args.belegName} traegt session_id ${kennung}, der Aufruf ${eingabe.sitzungId}`)
  }

  const zuege = zuegeLesen(meta.zuege_von_bis)
  if (eingabe.zugbereich !== null) {
    const soll = zuegeText(eingabe.zugbereich)
    if (zuege === null || zuegeText(zuege) !== soll) {
      throw new SitzungsAbschlussError('zuege_abweichend', `${args.belegName}: zuege_von_bis ist ${zuegeText(zuege) ?? 'leer'}, der Aufruf nennt ${soll}`)
    }
  }

  const hinweise: string[] = []
  const werkzeug = asString(meta.werkzeug)
  const ausKopf = quelleAusWerkzeug(werkzeug, kennung)
  if (ausKopf === null) hinweise.push(`Kopf ohne erkennbares werkzeug („${werkzeug ?? 'leer'}") — Quelle aus dem Aufruf: ${eingabe.quelle}`)
  else if (ausKopf !== eingabe.quelle) hinweise.push(`Kopf sagt ${ausKopf} (werkzeug ${werkzeug}), der Aufruf ${eingabe.quelle} — das Register nimmt den Aufruf`)

  // Kopf-Eintraege duerfen Ordnernamen oder Pfade sein (vorhabenEintrag); verglichen wird der Name.
  const { vorhaben, hauptvorhaben } = belegVorhaben(meta)
  const kopfNamen = vorhaben.map((v) => vorhabenEintrag(v).name)
  const hauptName = hauptvorhaben === null ? null : vorhabenEintrag(hauptvorhaben).name
  if (args.hauptvorhaben === null && hauptvorhaben !== null) {
    hinweise.push(`Kopf nennt hauptvorhaben „${hauptvorhaben}", abgelegt wird ohne Vorhaben`)
  } else if (args.hauptvorhaben !== null && hauptName !== null && hauptName !== args.hauptvorhaben) {
    hinweise.push(`Kopf nennt hauptvorhaben „${hauptvorhaben}", abgelegt wird in „${args.hauptvorhaben}"`)
  }
  for (const neben of args.nebenvorhaben) {
    if (!kopfNamen.includes(neben)) hinweise.push(`Nebenvorhaben „${neben}" fehlt in vorhaben: des Kopfs — der Block dort nennt die Sitzung erst, wenn der Kopf es sagt`)
  }

  const name = belegNameLesen(args.belegName)
  const datum = tag(meta.datum)
  if (name !== null && datum !== undefined && name.datum !== datum) {
    hinweise.push(`Datum im Namen ${name.datum}, im Kopf ${datum} — der Name gilt (Starttag)`)
  }

  return {
    meldung: {
      sitzungId: kennung,
      quelle: eingabe.quelle,
      titel: oderUndefined(asString(meta.titel)) ?? name?.titel,
      beginn: name?.datum ?? datum,
      ende: tag(meta.ende),
      repo: oderUndefined(asString(meta.repo)),
      branch: oderUndefined(asString(meta.branch)),
    },
    hinweise,
  }
}
