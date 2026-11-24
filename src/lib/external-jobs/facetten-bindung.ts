/**
 * @fileoverview Vorlage an das Facetten-Woerterbuch der Library binden: Platzhalter
 * einsetzen und die Werte nach der Transformation pruefen.
 *
 * @description
 * Bisher stand die Liste der erlaubten Werte zweimal: im Woerterbuch der
 * Facette (`chat.gallery.facets[].werte`) und als abgeschriebener Text in der
 * Vorlage. Die beiden liefen auseinander, und schrieb das Sprachmodell einen
 * Wert ausserhalb der Liste, meldete es niemand.
 *
 * Zwei Platzhalter, ueberall in der Vorlage erlaubt (Feldbeschreibung,
 * Body, Systemprompt), immer einzeilig:
 *
 *   <<werte:<metaKey>>>    → `a, b, c` (die rohen Werte)
 *   <<legende:<metaKey>>>  → `a = Label (Bedeutung); b = Label`
 *
 * Bewusst NICHT `{{…}}` wie in den Antwortregeln: In einer Vorlage gehoert
 * `{{feld|beschreibung}}` dem Feld-Parser, und der liest bis zur ersten `}`.
 *
 * Ein Platzhalter BINDET das Feld `<metaKey>` an das Woerterbuch: Nach der
 * Transformation werden Werte ausserhalb verworfen und als Befund gemeldet.
 * Facetten, die keine Vorlage per Platzhalter nennt, bleiben ungeprueft — ihr
 * Woerterbuch muss nicht vollstaendig sein (es traegt dort nur Bedeutungen).
 *
 * Unbekannte Facette, fehlendes Woerterbuch, falsch geschriebener Platzhalter:
 * Fehler, nie stilles Leerlassen. Pure Helfer, keine Seiteneffekte.
 *
 * @module external-jobs
 */

import type { FacetWert } from '@/lib/chat/facet-werte'

export interface BindungsFacette {
  metaKey: string
  label?: string
  werte?: FacetWert[]
}

export interface BindungsFehler {
  platzhalter: string
  grund: string
}

/** Alles, was wie einer unserer Platzhalter beginnt — auch falsch geschriebene, damit sie gemeldet werden. */
const PLATZHALTER_ALLE = /<<\s*(?:werte|legende)\b[^<>\n]*>>/gi
const PLATZHALTER_GUELTIG = /^<<\s*(werte|legende)\s*:\s*([A-Za-z0-9_.-]+)\s*>>$/

/** Zeichen, die eine einzeilige Feldbeschreibung `{{feld|…}}` zerbrechen wuerden. */
const UNERLAUBT = /[{}\r\n]/

function ersatz(art: string, facette: BindungsFacette): string {
  const werte = facette.werte ?? []
  if (art === 'werte') return werte.map((w) => w.wert).join(', ')
  return werte.map((w) => `${w.wert} = ${w.label}${w.bedeutung ? ` (${w.bedeutung})` : ''}`).join('; ')
}

/** Prueft alle Platzhalter einer Vorlage gegen das Facetten-Schema. Leere Liste heisst gueltig. */
export function pruefeFacettenPlatzhalter(text: string, facets: ReadonlyArray<BindungsFacette>): BindungsFehler[] {
  const byKey = new Map(facets.map((f) => [f.metaKey, f]))
  const fehler: BindungsFehler[] = []
  for (const treffer of text.matchAll(PLATZHALTER_ALLE)) {
    const roh = treffer[0]
    const m = PLATZHALTER_GUELTIG.exec(roh)
    if (!m) {
      fehler.push({ platzhalter: roh, grund: 'Erlaubt sind nur <<werte:<metaKey>>> und <<legende:<metaKey>>>' })
      continue
    }
    const facette = byKey.get(m[2])
    if (!facette) {
      fehler.push({ platzhalter: roh, grund: `Facette „${m[2]}" gibt es im Schema der Library nicht` })
      continue
    }
    if (!facette.werte || facette.werte.length === 0) {
      fehler.push({ platzhalter: roh, grund: `Facette „${m[2]}" hat kein Wörterbuch (werte)` })
      continue
    }
    if (UNERLAUBT.test(ersatz(m[1].toLowerCase(), facette))) {
      fehler.push({ platzhalter: roh, grund: `Das Wörterbuch von „${m[2]}" enthält geschweifte Klammern oder Zeilenumbrüche — das zerbricht die Vorlage` })
    }
  }
  return fehler
}

export function formatiereBindungsFehler(fehler: ReadonlyArray<BindungsFehler>): string {
  return fehler.map((f) => `${f.platzhalter}: ${f.grund}`).join('; ')
}

/** metaKeys der Facetten, die die Vorlage per Platzhalter nennt (je einmal, in Reihenfolge). */
export function gebundeneFacetten(text: string): string[] {
  const keys: string[] = []
  for (const treffer of text.matchAll(PLATZHALTER_ALLE)) {
    const m = PLATZHALTER_GUELTIG.exec(treffer[0])
    if (m && !keys.includes(m[2])) keys.push(m[2])
  }
  return keys
}

/** true, wenn der Text einen (auch falsch geschriebenen) Facetten-Platzhalter traegt. */
export function hatFacettenPlatzhalter(text: string): boolean {
  return text.search(PLATZHALTER_ALLE) !== -1
}

/** Setzt alle Platzhalter ein. Wirft bei jedem Fehler — eine halb eingesetzte Vorlage geht nicht ans Sprachmodell. */
export function setzeFacettenPlatzhalter(text: string, facets: ReadonlyArray<BindungsFacette>): { content: string; gebunden: string[] } {
  const fehler = pruefeFacettenPlatzhalter(text, facets)
  if (fehler.length > 0) throw new Error(`Vorlage nennt Facetten-Platzhalter, die nicht auflösbar sind — ${formatiereBindungsFehler(fehler)}`)
  const byKey = new Map(facets.map((f) => [f.metaKey, f]))
  const content = text.replace(PLATZHALTER_ALLE, (roh) => {
    const m = PLATZHALTER_GUELTIG.exec(roh) as RegExpExecArray
    return ersatz(m[1].toLowerCase(), byKey.get(m[2]) as BindungsFacette)
  })
  return { content, gebunden: gebundeneFacetten(text) }
}

export interface VerworfeneWerte {
  feld: string
  verworfen: string[]
}

/**
 * Prueft die Werte der gebundenen Felder gegen das Woerterbuch. Werte ausserhalb
 * fallen weg (Liste) bzw. das Feld wird null (Einzelwert) — und stehen in
 * `verworfen`, damit der Aufrufer sie meldet. Fehlende und leere Felder bleiben,
 * wie sie sind. `meta` wird nicht veraendert.
 */
export function pruefeFacettenWerte(
  meta: Record<string, unknown>,
  gebunden: ReadonlyArray<string>,
  facets: ReadonlyArray<BindungsFacette>,
): { cleanedMeta: Record<string, unknown>; verworfen: VerworfeneWerte[] } {
  const cleanedMeta: Record<string, unknown> = { ...meta }
  const verworfen: VerworfeneWerte[] = []
  for (const feld of gebunden) {
    const facette = facets.find((f) => f.metaKey === feld)
    if (!facette?.werte || facette.werte.length === 0) throw new Error(`Facette „${feld}" ist gebunden, hat aber kein Wörterbuch`)
    const erlaubt = new Set(facette.werte.map((w) => w.wert))
    const wert = meta[feld]
    if (wert === undefined || wert === null || wert === '') continue
    if (Array.isArray(wert)) {
      const raus = wert.filter((w) => typeof w !== 'string' || !erlaubt.has(w.trim()))
      if (raus.length === 0) continue
      cleanedMeta[feld] = wert.filter((w) => typeof w === 'string' && erlaubt.has(w.trim()))
      verworfen.push({ feld, verworfen: raus.map((w) => (typeof w === 'string' ? w : JSON.stringify(w))) })
    } else if (typeof wert !== 'string' || !erlaubt.has(wert.trim())) {
      cleanedMeta[feld] = null
      verworfen.push({ feld, verworfen: [typeof wert === 'string' ? wert : JSON.stringify(wert)] })
    }
  }
  return { cleanedMeta, verworfen }
}
