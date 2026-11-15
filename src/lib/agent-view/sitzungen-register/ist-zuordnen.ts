/**
 * @fileoverview Soll (Register) und Ist (Belege) zusammenfuehren (Register, Welle R1). Reine Funktion.
 *
 * @description
 * Ein Beleg gehoert zu der Zeile, die seine `sourceId` schon kennt
 * (`belegSourceIds`), sonst zu der mit seiner Kennung, sonst zu der einzigen,
 * deren Praefix passt. Passt keine, entsteht eine Zeile aus dem Archiv
 * (`gemeldetVon: archiv`, `gespeichert: false`) — gespeichert wird sie erst
 * von einem schreibenden Sichten-Lauf (W3). Teil-Belege derselben Kennung
 * landen in EINER Zeile. Widersprueche (Kopf vs. Notiz, Praefix auf mehreren
 * Zeilen, Beleg bei zwei Zeilen) werden Hinweise, nie still aufgeloest.
 *
 * @module agent-view/sitzungen-register
 */

import { belegKennung, istVolleKennung, quelleAusWerkzeug, registerIdFuerBeleg } from './ist-beleg'
import type { IstBeleg, SitzungsHinweis, SitzungsRegisterDoc } from './types'

export interface ZugeordneteZeile {
  doc: SitzungsRegisterDoc
  gespeichert: boolean
  belege: IstBeleg[]
  hinweise: SitzungsHinweis[]
}

function nachZuegen(a: IstBeleg, b: IstBeleg): number {
  return (a.zuege?.von ?? 0) - (b.zuege?.von ?? 0) || a.name.localeCompare(b.name)
}

function kleinstes(werte: Array<string | null>): string | null {
  const da = werte.filter((w): w is string => w !== null).sort()
  return da[0] ?? null
}

/** Neue Zeile aus Belegen, die das Register noch nicht kennt. */
export function neueArchivZeile(libraryId: string, registerId: string, belege: readonly IstBeleg[], jetzt: string): SitzungsRegisterDoc {
  const sortiert = [...belege].sort(nachZuegen)
  const erster = sortiert[0]
  if (!erster) throw new Error(`neueArchivZeile: ${registerId} ohne Beleg`)
  const kennung = belegKennung(erster)
  const voll = kennung !== null && istVolleKennung(kennung)
  const enden = sortiert.map((b) => b.ende ?? b.datum).filter((w): w is string => w !== null).sort()
  return {
    libraryId,
    registerId,
    ...(voll ? { sitzungId: kennung } : {}),
    kennung: voll ? 'voll' : kennung !== null ? 'praefix' : 'keine',
    ...(!voll && kennung !== null ? { kennungPraefix: kennung } : {}),
    quelle: quelleAusWerkzeug(erster.werkzeug, kennung),
    titelOriginal: erster.titel,
    beginn: kleinstes(sortiert.map((b) => b.datum)),
    ende: enden[enden.length - 1] ?? null,
    link: null,
    repo: erster.repo,
    branch: erster.branch,
    prs: [],
    nrAlt: null,
    entscheidung: 'offen',
    entscheidungGrund: null,
    zugbereiche: [],
    vorhabenVorschlag: null,
    bemerkung: null,
    belegSourceIds: sortiert.map((b) => b.sourceId),
    altNotizPfad: null,
    ablage: null,
    berichtet: { chronikAm: null, blockAm: null },
    gemeldetVon: 'archiv',
    gemeldetAm: jetzt,
    geaendertAm: jetzt,
  }
}

function abweichung(b: IstBeleg): SitzungsHinweis | null {
  if (b.kopfKennung === null || b.notizKennung === null || b.kopfKennung === b.notizKennung) return null
  return {
    code: 'kennung_abweichend',
    text: `${b.name}: Beleg-Kopf session_id „${b.kopfKennung}", Notiz sitzung „${b.notizKennung}" — der Kopf gilt`,
  }
}

/** Zeilen, deren Kennung zur Beleg-Kennung passt (Praefix in beide Richtungen). */
function praefixTreffer(docs: readonly SitzungsRegisterDoc[], kennung: string): SitzungsRegisterDoc[] {
  return docs.filter((d) => {
    if (d.kennungPraefix !== undefined && kennung.startsWith(d.kennungPraefix)) return true
    return !istVolleKennung(kennung) && d.sitzungId !== undefined && d.sitzungId.startsWith(kennung)
  })
}

export function ordneIstZu(args: {
  libraryId: string
  docs: readonly SitzungsRegisterDoc[]
  belege: readonly IstBeleg[]
  jetzt: string
}): ZugeordneteZeile[] {
  const zeilen = new Map<string, ZugeordneteZeile>()
  const nachSource = new Map<string, string>()
  const nachKennung = new Map<string, string>()
  for (const doc of args.docs) {
    const zeile: ZugeordneteZeile = { doc, gespeichert: true, belege: [], hinweise: [] }
    zeilen.set(doc.registerId, zeile)
    if (doc.sitzungId !== undefined) nachKennung.set(doc.sitzungId, doc.registerId)
    for (const sourceId of doc.belegSourceIds) {
      const frueher = nachSource.get(sourceId)
      if (frueher === undefined) nachSource.set(sourceId, doc.registerId)
      else zeile.hinweise.push({ code: 'doppelt', text: `Beleg ${sourceId} ist auch bei Zeile ${frueher} eingetragen` })
    }
  }

  const virtuell = new Map<string, IstBeleg[]>()
  for (const b of args.belege) {
    const kennung = belegKennung(b)
    let ziel = nachSource.get(b.sourceId)
    if (ziel === undefined && kennung !== null) ziel = nachKennung.get(kennung)
    if (ziel === undefined && kennung !== null) {
      const treffer = praefixTreffer(args.docs, kennung)
      if (treffer.length === 1) ziel = treffer[0].registerId
      for (const t of treffer.length > 1 ? treffer : []) {
        zeilen.get(t.registerId)?.hinweise.push({
          code: 'praefix_mehrdeutig',
          text: `${b.name}: Kennung „${kennung}" passt auf ${treffer.map((x) => x.registerId).join(', ')} — nicht zugeordnet`,
        })
      }
    }
    if (ziel !== undefined) {
      const zeile = zeilen.get(ziel)
      if (!zeile) throw new Error(`ordneIstZu: Zeile ${ziel} fehlt`)
      zeile.belege.push(b)
      const a = abweichung(b)
      if (a) zeile.hinweise.push(a)
      if (kennung !== null && zeile.doc.sitzungId !== undefined && istVolleKennung(kennung) && kennung !== zeile.doc.sitzungId) {
        zeile.hinweise.push({ code: 'kennung_abweichend', text: `${b.name}: Kennung „${kennung}" weicht von der Zeile ab (${zeile.doc.sitzungId})` })
      }
      continue
    }
    const rid = registerIdFuerBeleg(b)
    virtuell.set(rid, [...(virtuell.get(rid) ?? []), b])
  }

  for (const [rid, belege] of virtuell) {
    const hinweise = belege.map(abweichung).filter((h): h is SitzungsHinweis => h !== null)
    const vorhanden = zeilen.get(rid)
    if (vorhanden) {
      // registerId gleich, aber weder Kennung noch sourceId bekannt (Altdaten): anhaengen, nicht ueberschreiben.
      vorhanden.belege.push(...belege)
      vorhanden.hinweise.push(...hinweise)
      continue
    }
    zeilen.set(rid, { doc: neueArchivZeile(args.libraryId, rid, belege, args.jetzt), gespeichert: false, belege, hinweise })
  }
  for (const zeile of zeilen.values()) zeile.belege.sort(nachZuegen)
  return [...zeilen.values()]
}
