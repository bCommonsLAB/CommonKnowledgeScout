/**
 * @fileoverview Ablauf von `sitzung_eintragen` (Register, Welle R4b).
 *
 * @description
 * Register-Zeile → Belege → Notizen (Mongo) → je Beleg Kopf frisch lesen,
 * Ablage-Vorhaben (Elternordner mit `BERICHT.md`, wie der volle Lauf es zuerst
 * findet) und Nebenvorhaben aus `vorhaben:` (nur Pfade; ein blosser Name
 * braucht den Scan). Dann die Zeile in jeden Block und in die Chronik setzen
 * (`sitzungen-einsetzen.ts`, dieselben Renderer wie der volle Lauf), zuletzt
 * das Register stempeln. Geschrieben wird versioniert, und nur, wenn sich der
 * Text aendert. Was ohne Scan nicht sicher geht, landet in `offen` — dann
 * nennt die Antwort die vollen Laeufe als Folgeaufrufe.
 *
 * @module agent-view/sitzungen-register/eintragen
 */

import { setzeZeileInBericht, setzeZeilenInChronik, type EinsetzStatus } from '@/lib/agent-view/sichten/sitzungen-einsetzen'
import { sitzungsZeile } from '@/lib/agent-view/sichten/sitzungen-render'
import { belegVorhaben, sitzungAusTransformation, vorhabenEintrag, type SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import { isoHeute, SICHTEN_ORDNER } from '@/lib/agent-view/sichten/types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import type { Folgeaufruf } from '../abschluss/abschluss-typen'
import {
  SitzungsEintragError, type ChronikStatus, type EintragErgebnis, type EintragOrdner, type EintragPorts,
} from './eintragen-typen'

interface Ziel { ordner: EintragOrdner; berichtId: string }
interface Vorbereitet { zeile: TransformationZeile; sitzung: SitzungsDatensatz; ablage: Ziel; weitere: Ziel[] }
interface Protokoll { offen: string[]; hinweise: string[] }

function nachricht(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function bereiteVor(n: TransformationZeile, ports: EintragPorts, p: Protokoll): Promise<Vorbereitet | null> {
  const kopf = await ports.belegKopf(n.sourceId)
  const zeile: TransformationZeile = { ...n, sourceFrontmatter: { fields: kopf.fields, sourceModifiedAt: kopf.modifiedAt } }
  const ordner = await ports.ordner.nachId(n.parentId)
  const berichtId = await ports.ordner.bericht(ordner.id)
  if (berichtId === null) {
    p.offen.push(`${n.sourceName}: liegt in „${ordner.pfad}" ohne BERICHT.md — das Vorhaben bestimmt nur der volle Lauf`)
    return null
  }
  const weitere: Ziel[] = []
  for (const eintrag of belegVorhaben(kopf.fields).vorhaben) {
    const v = vorhabenEintrag(eintrag)
    if (v.pfad === ordner.pfad || (v.pfad === null && v.name === ordner.name)) continue
    if (v.pfad === null) {
      p.offen.push(`${n.sourceName}: Vorhaben „${eintrag}" steht nur als Name im Kopf — den Querverweis findet nur der volle Lauf`)
      continue
    }
    const o = await ports.ordner.nachPfad(v.pfad)
    if (o === null || o.pfad !== v.pfad) {
      p.hinweise.push(`${n.sourceName}: Vorhaben „${eintrag}" ${o === null ? 'gibt es nicht' : `heisst im Speicher „${o.pfad}"`} — Querverweis entfaellt (wie im vollen Lauf)`)
      continue
    }
    if (weitere.some((w) => w.ordner.id === o.id)) continue
    const b = await ports.ordner.bericht(o.id)
    if (b === null) {
      p.offen.push(`${n.sourceName}: Nebenvorhaben „${o.pfad}" ohne BERICHT.md — ob es ein Vorhaben ist, entscheidet nur der volle Lauf`)
      continue
    }
    weitere.push({ ordner: o, berichtId: b })
  }
  const s = sitzungAusTransformation(zeile, {
    vorhaben: { pfad: ordner.pfad, folderId: ordner.id }, belegOrdnerPfad: ordner.pfad,
    weitereVorhaben: weitere.map((w) => ({ pfad: w.ordner.pfad, folderId: w.ordner.id })),
  })
  if (!s.ok) {
    p.offen.push(`${s.beleg}: ${s.grund}`)
    return null
  }
  return { zeile, sitzung: s.sitzung, ablage: { ordner, berichtId }, weitere }
}

interface BerichtArbeit { pfad: string; berichtId: string; zeilen: Array<{ beleg: string; zeile: string }>; ablageVon: string[] }

function berichtArbeiten(vorbereitet: readonly Vorbereitet[]): BerichtArbeit[] {
  const je = new Map<string, BerichtArbeit>()
  const dazu = (ziel: Ziel, v: Vorbereitet, anderswo: boolean) => {
    const a = je.get(ziel.ordner.id) ?? { pfad: ziel.ordner.pfad, berichtId: ziel.berichtId, zeilen: [], ablageVon: [] }
    a.zeilen.push({ beleg: v.sitzung.belegName, zeile: sitzungsZeile({ sitzung: v.sitzung, belegAnderswo: anderswo }) })
    if (!anderswo) a.ablageVon.push(v.zeile.sourceId)
    je.set(ziel.ordner.id, a)
  }
  for (const v of vorbereitet) {
    dazu(v.ablage, v, false)
    for (const w of v.weitere) dazu(w, v, true)
  }
  return [...je.values()]
}

async function schreibeBlock(a: BerichtArbeit, ports: EintragPorts, heute: string, p: Protokoll): Promise<EinsetzStatus> {
  const datei = await ports.datei.lesen(a.berichtId)
  let text = datei.text
  for (const z of a.zeilen) {
    const r = setzeZeileInBericht(text, z.beleg, z.zeile, heute)
    if (r.status === 'kein_block') {
      p.offen.push(`${a.pfad}/BERICHT.md hat noch keinen erzeugten Block — welche aelteren Sitzungen hineingehoeren, weiss nur sitzungen_block_schreiben (ohne Scope)`)
      return 'kein_block'
    }
    if (r.alterBlock === 'belassen') p.hinweise.push(`${a.pfad}: handgeschriebener Block daneben belassen — sitzungen_block_schreiben mit alteBloeckeUebernehmen=true ersetzt ihn`)
    text = r.text
  }
  if (text === datei.text) return 'unveraendert'
  await ports.datei.ersetzen(a.berichtId, text, datei.version)
  return 'geschrieben'
}

async function schreibeChronik(vorbereitet: readonly Vorbereitet[], ports: EintragPorts, p: Protokoll): Promise<ChronikStatus> {
  const id = await ports.chronik()
  if (id === null) {
    p.offen.push(`${SICHTEN_ORDNER}/SITZUNGEN.md fehlt — sichten_regenerieren legt sie an`)
    return 'fehlt'
  }
  const datei = await ports.datei.lesen(id)
  let text = datei.text
  try {
    for (const v of vorbereitet) {
      const zeile = (anderswo: boolean) => sitzungsZeile({ sitzung: v.sitzung, belegAnderswo: anderswo })
      const eintraege = [{ pfad: v.ablage.ordner.pfad, zeile: zeile(false) }, ...v.weitere.map((w) => ({ pfad: w.ordner.pfad, zeile: zeile(true) }))]
      text = setzeZeilenInChronik(text, v.sitzung.belegName, eintraege, ports.jetzt()).text
    }
  } catch (error) {
    p.offen.push(nachricht(error))
    return 'nicht_lesbar'
  }
  if (text === datei.text) return 'unveraendert'
  try {
    await ports.datei.ersetzen(id, text, datei.version)
  } catch (error) {
    p.offen.push(`SITZUNGEN.md nicht geschrieben: ${nachricht(error)} — sitzung_eintragen erneut aufrufen, es ist idempotent`)
    return 'fehler'
  }
  return 'geschrieben'
}

function volleLaeufe(libraryId: string, sitzungId: string): Folgeaufruf[] {
  const begruendung = `Folgeschritt sitzung_eintragen ${sitzungId}: offen nicht leer`
  const wann = 'nur weil offen nicht leer ist — volle Laeufe (je 1–2 min, ueber der 80-s-Grenze), am besten zuletzt'
  return [
    { werkzeug: 'sitzungen_block_schreiben', argumente: { libraryId, begruendung }, wann },
    { werkzeug: 'sichten_regenerieren', argumente: { libraryId, sichten: ['sitzungen'], begruendung }, wann },
  ]
}

export async function trageSitzungEin(sitzungId: string, ports: EintragPorts): Promise<EintragErgebnis> {
  const doc = await ports.register.holeNachKennung(sitzungId)
  if (doc === null) throw new SitzungsEintragError('nicht_im_register', `${sitzungId} steht nicht im Register — zuerst sitzung_abschliessen`)
  if (doc.belegSourceIds.length === 0) throw new SitzungsEintragError('ohne_beleg', `${sitzungId} hat im Register keinen Beleg — zuerst sitzung_abschliessen`)
  const notizen = await ports.notizen(doc.belegSourceIds)
  if (notizen.length === 0) {
    throw new SitzungsEintragError('notiz_fehlt', `keine Notiz chatverlauf-de zu ${doc.belegSourceIds.join(', ')} — Job noch nicht fertig? job_status bis completed, dann erneut`)
  }
  const p: Protokoll = { offen: [], hinweise: [] }
  for (const id of doc.belegSourceIds) {
    if (!notizen.some((n) => n.sourceId === id)) p.hinweise.push(`Beleg ${id}: noch keine Notiz — nicht eingetragen`)
  }
  const vorbereitet: Vorbereitet[] = []
  for (const n of notizen) {
    const v = await bereiteVor(n, ports, p)
    if (v !== null) vorbereitet.push(v)
  }

  const heute = isoHeute(ports.jetzt())
  const berichte: EintragErgebnis['berichte'] = []
  const imBlock = new Set<string>()
  for (const a of berichtArbeiten(vorbereitet)) {
    let status: EintragErgebnis['berichte'][number]['status']
    try {
      status = await schreibeBlock(a, ports, heute, p)
    } catch (error) {
      p.offen.push(`${a.pfad}/BERICHT.md nicht geschrieben: ${nachricht(error)} — sitzung_eintragen erneut aufrufen, es ist idempotent`)
      status = 'fehler'
    }
    if (status === 'geschrieben' || status === 'unveraendert') a.ablageVon.forEach((id) => imBlock.add(id))
    berichte.push({ pfad: a.pfad, status, querverweis: a.ablageVon.length === 0 })
  }
  const chronik = vorbereitet.length === 0 ? 'uebersprungen' : await schreibeChronik(vorbereitet, ports, p)

  const zeilen = vorbereitet.map((v) => v.zeile)
  const sitzungen = vorbereitet.map((v) => v.sitzung)
  const inChronik = chronik === 'geschrieben' || chronik === 'unveraendert'
  const register = {
    block: vorbereitet.length === 0 ? null : await ports.register.nachLauf({ zeilen, sitzungen, berichtet: imBlock, art: 'block' }),
    chronik: !inChronik ? null : await ports.register.nachLauf({ zeilen, sitzungen, berichtet: new Set(zeilen.map((z) => z.sourceId)), art: 'chronik' }),
  }
  return {
    sitzungId,
    belege: vorbereitet.map((v) => ({ beleg: v.sitzung.belegName, vorhaben: v.ablage.ordner.pfad, querverweise: v.weitere.map((w) => w.ordner.pfad) })),
    berichte,
    chronik,
    register,
    offen: p.offen,
    hinweise: p.hinweise,
    folgeaufrufe: p.offen.length === 0 ? [] : volleLaeufe(doc.libraryId, sitzungId),
  }
}
