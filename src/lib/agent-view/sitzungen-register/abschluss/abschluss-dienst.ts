/**
 * @fileoverview Ablauf von `sitzung_abschliessen` (Plan sitzungen-register, Welle R4).
 *
 * @description
 * Erst wird alles geprueft, was ohne Schreiben pruefbar ist — Orte, Beleg,
 * Kopf, Register —, dann geschrieben: Beleg (nur bei Text), Register-Zeile
 * (umschluesseln, melden, Beleg anhaengen), zuletzt der Transformations-Job.
 * Scheitert das Register NACH dem Beleg, nennt der Fehler den geschriebenen
 * Beleg; ein zweiter Aufruf ist gefahrlos (gleiche Kennung → ersetzen bzw.
 * vorhanden, Register idempotent). Ein gescheiterter Job-Start ist kein
 * Fehler des Aufrufs: er steht in `transformation.fehler`, der Neustart in
 * den Folgeaufrufen (E7: der Skill ruft sie).
 *
 * Speicher, Register und Job sind Anschluesse (Ports), damit der Ablauf
 * ohne Provider und Mongo testbar ist; die Bruecke verdrahtet sie.
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import { createHash } from 'crypto'
import { asString } from '@/lib/agent-view/sichten/bericht-lesen'
import { SICHTEN_ORDNER } from '@/lib/agent-view/sichten/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { MeldeEingabe } from '../schreib-plaene'
import type { SitzungsRegisterDoc, SitzungsStand } from '../types'
import { SitzungsAbschlussError, type AbschlussEingabe, type AbschlussErgebnis } from './abschluss-typen'
import { pruefeBelegKopf } from './beleg-pruefen'
import { planeFolgeaufrufe } from './folgeaufrufe'
import { planeRegisterAbschluss } from './register-planen'

/** Ablage ohne Vorhaben (Skill `sitzung-abschliessen`, Abschnitt 2). */
export const OHNE_VORHABEN_PFAD = `${SICHTEN_ORDNER}/Sitzungen`

export interface AbschlussOrdner { id: string; name: string; pfad: string | null }
export interface AbschlussDatei { id: string; parentId: string; name: string }

export interface AbschlussPorts {
  speicher: {
    /** Wirft `vorhaben_nicht_gefunden`, wenn der Ordner fehlt. */
    ordner: (ref: { pfad: string } | { folderId: string }) => Promise<AbschlussOrdner>
    /** null = nicht (oder noch nicht) im Speicher. */
    datei: (ref: { pfad: string } | { sourceId: string }) => Promise<AbschlussDatei | null>
    dateiImOrdner: (ordnerId: string, name: string) => Promise<{ id: string; version: string | null } | null>
    lesen: (id: string) => Promise<string>
    anlegen: (ordnerId: string, name: string, text: string) => Promise<{ id: string }>
    ersetzen: (id: string, text: string, version: string | null) => Promise<{ id: string }>
  }
  register: {
    holeNachKennung: (sitzungId: string) => Promise<SitzungsRegisterDoc | null>
    holeZeile: (registerId: string) => Promise<SitzungsRegisterDoc | null>
    umschluesseln: (registerId: string, sitzungId: string) => Promise<{ zusammengefuehrt: string | null }>
    melden: (eingabe: MeldeEingabe) => Promise<'angelegt' | 'ergaenzt' | 'unveraendert'>
    /** true = Beleg neu an der Zeile. */
    belegAnhaengen: (sitzungId: string, sourceId: string) => Promise<boolean>
    /** Gerechneter Stand der Zeile (wie sitzungen_auflisten). */
    stand: (sitzungId: string) => Promise<SitzungsStand>
  }
  /** `abgesagt`: die Notiz ist aktuell, kein Job. Andere Fehler wirft der Anschluss. */
  transformation: (source: AbschlussDatei, erzwingen: boolean | undefined) =>
    Promise<{ jobId: string; erzwungen: string; hinweis?: string } | { abgesagt: string }>
}

function nachricht(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function schliesseSitzungAb(e: AbschlussEingabe, ports: AbschlussPorts): Promise<AbschlussErgebnis> {
  const { speicher, register } = ports
  const ohneVorhaben = e.ort.art === 'ohneVorhaben'
  const haupt = await speicher.ordner(e.ort.art === 'folderId' ? { folderId: e.ort.folderId } : { pfad: e.ort.art === 'pfad' ? e.ort.pfad : OHNE_VORHABEN_PFAD })
  const neben = await Promise.all(e.nebenvorhaben.map((pfad) => speicher.ordner({ pfad })))

  // Beleg lesen, ohne zu schreiben.
  let text: string
  let name: string
  let vorhanden: AbschlussDatei | null = null
  let ziel: { id: string; version: string | null } | null = null
  if (e.beleg.art === 'text') {
    text = e.beleg.text
    name = e.beleg.name
    ziel = await speicher.dateiImOrdner(haupt.id, name)
    if (ziel !== null) {
      const alt = asString(parseFrontmatter(await speicher.lesen(ziel.id)).meta.session_id)
      if (alt !== e.sitzungId) {
        throw new SitzungsAbschlussError('andere_kennung_am_namen', `${name} gibt es schon mit session_id ${alt ?? 'leer'} — Titel schaerfen, nicht ueberschreiben`)
      }
    }
  } else {
    const ref = e.beleg.art === 'pfad' ? { pfad: e.beleg.pfad } : { sourceId: e.beleg.sourceId }
    vorhanden = await speicher.datei(ref)
    if (vorhanden === null) {
      throw new SitzungsAbschlussError('beleg_nicht_gefunden', `${'pfad' in ref ? ref.pfad : ref.sourceId} ist nicht im Speicher. Gerade erst abgelegt? Dann ist die Datei vermutlich noch nicht synchronisiert — in einer Minute erneut aufrufen`)
    }
    if (vorhanden.parentId !== haupt.id) {
      throw new SitzungsAbschlussError('beleg_falscher_ort', `${vorhanden.name} liegt nicht in ${haupt.pfad ?? haupt.name} (lose Datei im Vorhabensordner erwartet)`)
    }
    text = await speicher.lesen(vorhanden.id)
    name = vorhanden.name
  }
  const kopf = pruefeBelegKopf({
    meta: parseFrontmatter(text).meta, belegName: name, eingabe: e,
    hauptvorhaben: ohneVorhaben ? null : haupt.name, nebenvorhaben: neben.map((n) => n.name),
  })
  const bestehend = await register.holeNachKennung(e.sitzungId)
  const alt = e.nrAlt === null ? null : await register.holeZeile(`alt:${e.nrAlt}`)
  const vorplan = planeRegisterAbschluss({ sitzungId: e.sitzungId, nrAlt: e.nrAlt, bestehend, alt })

  // Ab hier wird geschrieben.
  let sourceId: string
  let aktion: AbschlussErgebnis['beleg']['aktion']
  if (vorhanden !== null) { sourceId = vorhanden.id; aktion = 'vorhanden' }
  else if (ziel !== null) { sourceId = (await speicher.ersetzen(ziel.id, text, ziel.version)).id; aktion = 'ersetzt' }
  else { sourceId = (await speicher.anlegen(haupt.id, name, text)).id; aktion = 'angelegt' }
  const pfad = haupt.pfad === null ? null : `${haupt.pfad}/${name}`

  let registerTeil: AbschlussErgebnis['register']
  try {
    const um = vorplan.umschluesseln === null ? null : await register.umschluesseln(vorplan.umschluesseln, e.sitzungId)
    const regAktion = await register.melden(kopf.meldung)
    const belegNeu = await register.belegAnhaengen(e.sitzungId, sourceId)
    registerTeil = {
      aktion: regAktion,
      umgeschluesselt: vorplan.umschluesseln === null ? null : { von: vorplan.umschluesseln, nach: e.sitzungId },
      zusammengefuehrt: um?.zusammengefuehrt ?? null,
      belegNeu,
    }
  } catch (error) {
    throw new Error(`Beleg ${aktion} (${pfad ?? name}, sourceId ${sourceId}), Register nicht geschrieben: ${nachricht(error)} — Aufruf wiederholen, er ist idempotent`)
  }

  const erzwingen = e.erzwingen ?? (aktion === 'ersetzt' ? true : undefined)
  let transformation: AbschlussErgebnis['transformation']
  try {
    transformation = await ports.transformation({ id: sourceId, parentId: haupt.id, name }, erzwingen)
  } catch (error) {
    transformation = { fehler: nachricht(error) }
  }

  const hinweise = [...kopf.hinweise, ...vorplan.hinweise]
  let stand: SitzungsStand | null
  try {
    stand = await register.stand(e.sitzungId)
  } catch (error) {
    stand = null
    hinweise.push(`Stand nicht lesbar: ${nachricht(error)} — sitzungen_auflisten nennt ihn`)
  }

  const blockOrdner = [...(ohneVorhaben ? [] : [haupt]), ...neben]
    .filter((o, i, alle) => alle.findIndex((x) => x.id === o.id) === i)
    .map((o) => ({ folderId: o.id, name: o.name }))
  const bytesUndHash = { bytes: Buffer.byteLength(text, 'utf-8'), sha256: createHash('sha256').update(text, 'utf-8').digest('hex') }
  return {
    sitzungId: e.sitzungId,
    registerId: e.sitzungId,
    beleg: { pfad, sourceId, ordnerId: haupt.id, ...bytesUndHash, aktion },
    register: registerTeil,
    transformation,
    stand,
    folgeaufrufe: planeFolgeaufrufe({ libraryId: e.libraryId, sitzungId: e.sitzungId, sourceId, transformation, blockOrdner }),
    hinweise,
  }
}
