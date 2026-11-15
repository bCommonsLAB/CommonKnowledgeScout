/**
 * @fileoverview Was der Import der Arbeitsliste im Register aendert (R2). Reine Funktion.
 *
 * @description
 * Jede Zeile wird ihrer Sitzung zugeordnet (`import-zuordnen.ts`) und auf eine
 * Arbeitskopie der Register-Zeile angewandt. Die Liste FUELLT nur, was die
 * Zeile noch nicht weiss (Titel, Daten, Repo, Vorschlag, Notiz-Kopie,
 * Bemerkung); sie ueberschreibt nichts Gepflegtes. Drei Ausnahmen, alle
 * benannt: `überspringen` setzt die Entscheidung, solange sie `offen` ist;
 * `code_cloud` aus der Liste schlaegt die Archiv-Schaetzung `code_lokal`
 * (Cloud ist an der Kennung nicht immer zu erkennen, Befund 15.11.); und
 * `cowork` aus der Liste berichtigt das `chat`, das ein frueherer Import an
 * SEINE Zeilen geschrieben hat (Teil B galt bis R3 pauschal als Chat).
 * Ein zweiter Lauf mit derselben Liste aendert nichts.
 *
 * @module agent-view/sitzungen-register/import
 */

import { neueArchivZeile } from '../ist-zuordnen'
import { registerIdFuerBeleg } from '../ist-beleg'
import { ALT_PRAEFIX, type IstBeleg, type SitzungsRegisterDoc } from '../types'
import type { ListenZeile } from './arbeitsliste-parsen'
import { belegIndex, ordneZeileZu, type Zuordnung, type ZuordnungsWeg } from './import-zuordnen'
import { leseListenzeile, type ListenEintrag } from './listenzeile-lesen'

export interface ImportZeileBericht {
  nr: string
  zeile: number
  erledigt: boolean
  ueberspringen: boolean
  registerId: string
  weg: ZuordnungsWeg
  aktion: 'neu' | 'ergaenzt' | 'unveraendert'
  hinweise: string[]
}

export interface ImportPlan {
  neu: SitzungsRegisterDoc[]
  aenderungen: Array<{ registerId: string; set: Partial<SitzungsRegisterDoc> }>
  zeilen: ImportZeileBericht[]
  /** Register-Zeilen mit Beleg, die keine Listenzeile nennt. */
  belegeOhneZeile: string[]
  fehler: string[]
}

interface Arbeit { orig: SitzungsRegisterDoc | null; doc: SitzungsRegisterDoc }

function leereZeile(libraryId: string, rid: string, e: ListenEintrag, z: Zuordnung, jetzt: string): SitzungsRegisterDoc {
  const praefix = z.kennung === null ? e.exportPraefix : null
  return {
    libraryId, registerId: rid,
    ...(z.kennung !== null ? { sitzungId: z.kennung } : {}),
    kennung: z.kennung !== null ? 'voll' : praefix !== null ? 'praefix' : 'keine',
    ...(praefix !== null ? { kennungPraefix: praefix } : {}),
    quelle: e.quelle, titelOriginal: null, beginn: null, ende: null, link: null, repo: null, branch: null, prs: [],
    nrAlt: null, entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [], vorhabenVorschlag: null, bemerkung: null,
    belegSourceIds: [], altNotizPfad: null, ablage: null, berichtet: { chronikAm: null, blockAm: null },
    gemeldetVon: 'import', gemeldetAm: jetzt, geaendertAm: jetzt,
  }
}

/** Schlaegt die Quelle der Liste die der Zeile? Nur in den drei benannten Faellen (Kopf der Datei). */
export function listeSchlaegtQuelle(doc: Pick<SitzungsRegisterDoc, 'quelle' | 'gemeldetVon'>, liste: ListenEintrag['quelle']): boolean {
  if (doc.quelle === null) return true
  if (doc.quelle === 'code_lokal' && liste === 'code_cloud') return true
  return doc.gemeldetVon === 'import' && doc.quelle === 'chat' && liste === 'cowork'
}

/** Wendet eine Listenzeile auf die Arbeitskopie an (fuellen, nicht ueberschreiben). */
export function wendeZeileAn(doc: SitzungsRegisterDoc, e: ListenEintrag, z: Zuordnung): void {
  const nrs = doc.nrAlt === null ? [] : doc.nrAlt.split(', ')
  if (!nrs.includes(e.nr)) doc.nrAlt = [...nrs, e.nr].join(', ')
  if (listeSchlaegtQuelle(doc, e.quelle)) doc.quelle = e.quelle
  doc.titelOriginal ??= e.titel
  doc.beginn ??= e.beginn
  doc.ende ??= e.ende
  doc.link ??= e.link
  doc.repo ??= e.repo
  doc.branch ??= e.branch
  for (const pr of e.prs) if (!doc.prs.includes(pr)) doc.prs = [...doc.prs, pr]
  if (doc.vorhabenVorschlag === null && e.vorhaben !== null) doc.vorhabenVorschlag = { ordner: e.vorhaben, herkunft: 'arbeitsliste' }
  if (e.ueberspringenGrund !== null && doc.entscheidung === 'offen') {
    doc.entscheidung = 'ueberspringen'
    doc.entscheidungGrund = e.ueberspringenGrund
  }
  if (doc.altNotizPfad === null && e.notizVorhanden !== null) doc.altNotizPfad = `Organisation/Sitzungen/${e.notizVorhanden}.md`
  if (doc.bemerkung === null && e.bemerkung !== '') doc.bemerkung = `Arbeitsliste ${e.nr}: ${e.bemerkung}`
  if (z.beleg !== null && !doc.belegSourceIds.includes(z.beleg.sourceId)) doc.belegSourceIds = [...doc.belegSourceIds, z.beleg.sourceId]
  if (doc.kennung === 'keine' && z.kennung === null && e.exportPraefix !== null) {
    doc.kennung = 'praefix'
    doc.kennungPraefix = e.exportPraefix
  }
}

function unterschied(orig: SitzungsRegisterDoc, doc: SitzungsRegisterDoc): Partial<SitzungsRegisterDoc> {
  const set: Record<string, unknown> = {}
  for (const key of Object.keys(doc) as Array<keyof SitzungsRegisterDoc>) {
    if (JSON.stringify(orig[key]) !== JSON.stringify(doc[key])) set[key] = doc[key]
  }
  return set as Partial<SitzungsRegisterDoc>
}

export function planeImport(args: {
  libraryId: string
  zeilen: readonly ListenZeile[]
  docs: readonly SitzungsRegisterDoc[]
  belege: readonly IstBeleg[]
  jetzt: string
}): ImportPlan {
  const index = belegIndex(args.belege)
  const arbeit = new Map<string, Arbeit>()
  const bySitzung = new Map<string, SitzungsRegisterDoc>()
  const bySource = new Map<string, SitzungsRegisterDoc>()
  const byRid = new Map<string, SitzungsRegisterDoc>()
  for (const d of args.docs) {
    byRid.set(d.registerId, d)
    if (d.sitzungId !== undefined) bySitzung.set(d.sitzungId, d)
    for (const s of d.belegSourceIds) bySource.set(s, d)
  }
  const holen = (vorhanden: SitzungsRegisterDoc | undefined, rid: string, neu: () => SitzungsRegisterDoc): { rid: string; a: Arbeit } => {
    const key = vorhanden?.registerId ?? rid
    let a = arbeit.get(key)
    if (!a) {
      a = vorhanden ? { orig: vorhanden, doc: structuredClone(vorhanden) } : { orig: null, doc: neu() }
      arbeit.set(key, a)
    }
    return { rid: key, a }
  }

  const plan: ImportPlan = { neu: [], aenderungen: [], zeilen: [], belegeOhneZeile: [], fehler: [] }
  const ridJeZeile: Array<{ bericht: ImportZeileBericht; rid: string }> = []
  const nrsJeRid = new Map<string, string[]>()
  for (const z of args.zeilen) {
    let e: ListenEintrag
    try { e = leseListenzeile(z) } catch (error) { plan.fehler.push(error instanceof Error ? error.message : String(error)); continue }
    const zu = ordneZeileZu(e, index)
    const vorhanden = (zu.kennung !== null ? bySitzung.get(zu.kennung) : undefined)
      ?? (zu.beleg !== null ? bySource.get(zu.beleg.sourceId) : undefined)
      ?? byRid.get(`${ALT_PRAEFIX}${e.nr}`)
    const rid = zu.kennung ?? (zu.beleg !== null ? registerIdFuerBeleg(zu.beleg) : `${ALT_PRAEFIX}${e.nr}`)
    const { rid: key, a } = holen(vorhanden, rid, () => {
      const basis = zu.beleg !== null ? neueArchivZeile(args.libraryId, rid, [zu.beleg], args.jetzt) : leereZeile(args.libraryId, rid, e, zu, args.jetzt)
      return { ...basis, gemeldetVon: 'import' }
    })
    wendeZeileAn(a.doc, e, zu)
    nrsJeRid.set(key, [...(nrsJeRid.get(key) ?? []), e.nr])
    const bericht: ImportZeileBericht = {
      nr: e.nr, zeile: e.zeile, erledigt: e.erledigt, ueberspringen: e.ueberspringenGrund !== null,
      registerId: key, weg: zu.weg, aktion: 'unveraendert', hinweise: zu.hinweise,
    }
    ridJeZeile.push({ bericht, rid: key })
  }

  const aktion = new Map<string, ImportZeileBericht['aktion']>()
  for (const [rid, a] of arbeit) {
    if (a.orig === null) { plan.neu.push(a.doc); aktion.set(rid, 'neu'); continue }
    const set = unterschied(a.orig, a.doc)
    if (Object.keys(set).length === 0) { aktion.set(rid, 'unveraendert'); continue }
    plan.aenderungen.push({ registerId: rid, set: { ...set, geaendertAm: args.jetzt } })
    aktion.set(rid, 'ergaenzt')
  }
  for (const { bericht, rid } of ridJeZeile) {
    bericht.aktion = aktion.get(rid) ?? 'unveraendert'
    const nrs = nrsJeRid.get(rid) ?? []
    if (nrs.length > 1) bericht.hinweise = [...bericht.hinweise, `mehrere Listenzeilen fuer dieselbe Sitzung: ${nrs.join(', ')}`]
    plan.zeilen.push(bericht)
  }
  for (const d of args.docs) {
    if (d.belegSourceIds.length > 0 && !arbeit.has(d.registerId)) plan.belegeOhneZeile.push(`${d.registerId} · ${d.titelOriginal ?? '(ohne Titel)'}`)
  }
  return plan
}
