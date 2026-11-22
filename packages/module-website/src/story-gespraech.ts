/**
 * @fileoverview Fragen-Sektion → Gespraech fuer einen Hintergrund hinter der
 * Sektion (entstanden fuer die Common-UX-Buehne, Plan
 * `commonux-buehne-fragen-sektion`, Welle P3).
 *
 * @description
 * Reine Funktionen ohne React: Aus den Frage-Antwort-Paaren der Sitzung wird
 * das neutrale Gespraech, das die Sektion an ihren Hintergrund reicht. Lagen
 * rechnet hier niemand.
 *
 * Die Buehne mit dem Player ist ausgebaut (Plan `teppich-der-dokumente`,
 * Welle T0b, Owner 22.11.2026). Die Typen `WebsiteGespraech…` waren
 * strukturgleich mit `Gespraech` des Players; der Abgleich-Test ist mit dem
 * Player gegangen. Naechster Abnehmer ist der Teppich der Dokumente (T2).
 *
 * @module website
 */

import type { DocReference } from '@ks/contracts'
import { dokumentNummern } from '@ks/util'

export type WebsiteGespraechStand = 'sucht' | 'schreibt' | 'fertig' | 'fehler'

export interface WebsiteGespraechBeleg {
  /** Die `fileId` des Dokuments: dasselbe Dokument bleibt ueber Antworten derselbe Darsteller. */
  id: string
  dokument: string
  /** Die Zahl auf der Zitatmarke im Text: Dokumentnummer der Antwort (`dokumentNummern`), gilt nur in dieser Antwort. */
  nummer: number
  titel: string
  /** Zahl der zitierten Textstellen (mindestens 1). */
  fundstellen: number
}

export interface WebsiteGespraech {
  frage: { id: string; text: string }
  stand: WebsiteGespraechStand
  antwort?: { text: string }
  belege: WebsiteGespraechBeleg[]
  folgefragen: { id: string; text: string }[]
  /** Fruehere beantwortete Fragen der Sitzung, aelteste zuerst. */
  verlauf: { id: string; kurzfrage: string }[]
  /** Die Seite steht vorn, die Buehne dahinter. */
  lesen: boolean
}

/** Ein Paar der Sitzung in der Form, die das Gespraech braucht (wie `FrageAntwort` aus `@ks/module-story`). */
export interface GespraechPaar {
  frage: { text: string; kurztitel?: string }
  antwort?: { text: string; belege?: DocReference[]; anschlussfragen?: string[] }
}

export interface GespraechEingabe {
  /** Alle Paare der Sitzung, aelteste zuerst; das letzte ist das sichtbare. */
  paare: ReadonlyArray<GespraechPaar>
  /** Der Stream laeuft. */
  laeuft: boolean
  /** Verarbeitungsschritte des laufenden Streams (`ChatProcessingStep`); nur `type` zaehlt. */
  schritte: ReadonlyArray<{ type: string }>
  /** Die Sektion zeigt einen Fehler zur sichtbaren Frage. */
  fehler: boolean
  lesen: boolean
}

export interface GespraechErgebnis {
  /** `null`, solange die Sitzung keine Frage hat. */
  gespraech: WebsiteGespraech | null
  /** Je Zitatmarke (`a[data-beleg="k"]`, Dokumentnummer) die ID ihres Belegs — die Marken tragen nur die Nummer. */
  belegJeNummer: Record<number, string>
  /** Belege der Antwort ohne `fileId` oder Nummer; sie fehlen im Gespraech (kein erfundener Ersatz). */
  verworfen: number
}

/** Feste Streuung eines Textes (FNV-1a, 32 Bit): gleicher Text, gleiche Zahl. */
function streuung(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * ID einer Frage aus ihrem Wortlaut. Frage und Anschlussfrage bekommen so
 * dieselbe ID, sobald die Anschlussfrage gestellt wird — der Player laesst die
 * Frage dann von der Stelle der Anschlussfrage in die Mitte fliegen.
 */
export function gespraechFrageId(text: string): string {
  return `f${streuung(text.trim().replace(/\s+/g, ' ')).toString(36)}`
}

/** Schritte, ab denen das Sprachmodell schreibt. `llm_start` zaehlt nicht: Es kommt schon waehrend der Suche. */
const SCHREIBT_AB = new Set(['prompt_complete', 'llm_progress', 'llm_complete', 'parsing_response', 'complete'])

/**
 * Stand der sichtbaren Frage. Eine Frage ohne Antwort, die weder laeuft noch
 * einen Fehler zeigt, ist abgebrochen; der Player kennt dafuer keinen eigenen
 * Stand und zeigt bei `fehler` dasselbe Bild — nur die Frage.
 */
export function gespraechStand(p: { hatAntwort: boolean; laeuft: boolean; fehler: boolean; schritte: ReadonlyArray<{ type: string }> }): WebsiteGespraechStand {
  if (p.hatAntwort) return 'fertig'
  if (p.fehler || !p.laeuft) return 'fehler'
  return p.schritte.some((s) => SCHREIBT_AB.has(s.type)) ? 'schreibt' : 'sucht'
}

function istBeleg(b: DocReference): boolean {
  return typeof b.fileId === 'string' && b.fileId.length > 0 && typeof b.number === 'number' && Number.isFinite(b.number)
}

/**
 * Belege der Antwort je Dokument. Die Nummer ist die der Marke im Text: Der Antworttext zeigt je
 * Dokument eine laufende Nummer (`dokumentNummern`), auch wenn die Antwort anders zaehlt oder
 * (aeltere Antworten) je Textstelle nummeriert.
 */
function belegeJeDokument(references: ReadonlyArray<DocReference>): Pick<GespraechErgebnis, 'belegJeNummer' | 'verworfen'> & { belege: WebsiteGespraechBeleg[]; nummern: Map<number, number> } {
  const gueltig = references.filter(istBeleg).sort((a, b) => a.number - b.number)
  const nummern = dokumentNummern(gueltig)
  const belege: WebsiteGespraechBeleg[] = []
  const stelle = new Map<string, number>()
  const belegJeNummer: Record<number, string> = {}
  for (const ref of gueltig) {
    const nummer = nummern.get(ref.number)
    if (nummer === undefined) throw new Error(`Gespraech: Beleg ${ref.number} ohne Dokumentnummer`)
    const fundstellen = Math.max(1, ref.passages?.length ?? 1)
    const schonDa = stelle.get(ref.fileId)
    if (schonDa !== undefined) {
      belege[schonDa].fundstellen += fundstellen
      continue
    }
    stelle.set(ref.fileId, belege.length)
    belegJeNummer[nummer] = ref.fileId
    const titel = ref.title?.trim() || ref.fileName?.trim() || ref.description
    belege.push({ id: ref.fileId, dokument: ref.fileId, nummer, titel, fundstellen })
  }
  return { belege, belegJeNummer, nummern, verworfen: references.length - gueltig.length }
}

/**
 * Der Antworttext mit den Nummern der Marken: `[n]` der Antwort wird `[k]`, die Dokumentnummer —
 * dieselbe Zahl, die der Kreis des Belegs traegt. Eine Nummer ohne Beleg bleibt, wie sie ist.
 */
function textMitDokumentnummern(text: string, nummern: ReadonlyMap<number, number>): string {
  return text.replace(/\[(\d{1,3})\](?!\()/g, (marke, n: string) => {
    const k = nummern.get(Number(n))
    return k === undefined ? marke : `[${k}]`
  })
}

/**
 * Fruehere beantwortete Fragen als Perlen, aelteste zuerst. Eine wiederholte
 * Frage steht einmal, an ihrer juengsten Stelle; die sichtbare Frage ist keine Perle.
 */
function verlaufAus(fruehere: ReadonlyArray<GespraechPaar>, sichtbareId: string): WebsiteGespraech['verlauf'] {
  const perlen = new Map<string, string>()
  for (const paar of fruehere) {
    if (!paar.antwort) continue
    const id = gespraechFrageId(paar.frage.text)
    if (id === sichtbareId) continue
    perlen.delete(id)
    perlen.set(id, paar.frage.kurztitel?.trim() || paar.frage.text.trim())
  }
  return Array.from(perlen, ([id, kurzfrage]) => ({ id, kurzfrage }))
}

/** Uebersetzt den Stand der Fragen-Sektion in das Gespraech der Buehne. */
export function gespraechAusStory(eingabe: GespraechEingabe): GespraechErgebnis {
  const sichtbar = eingabe.paare[eingabe.paare.length - 1]
  if (!sichtbar) return { gespraech: null, belegJeNummer: {}, verworfen: 0 }

  const frage = { id: gespraechFrageId(sichtbar.frage.text), text: sichtbar.frage.text.trim() }
  const verlauf = verlaufAus(eingabe.paare.slice(0, -1), frage.id)
  const antwort = sichtbar.antwort
  const stand = gespraechStand({ hatAntwort: antwort !== undefined, laeuft: eingabe.laeuft, fehler: eingabe.fehler, schritte: eingabe.schritte })
  const kopf = { frage, stand, verlauf, lesen: eingabe.lesen }

  // Vor der Antwort kennt die Sektion weder Text noch Belege: Die Antwort kommt in einem Stueck.
  if (!antwort) return { gespraech: { ...kopf, belege: [], folgefragen: [] }, belegJeNummer: {}, verworfen: 0 }

  const { belege, belegJeNummer, nummern, verworfen } = belegeJeDokument(antwort.belege ?? [])
  const folgefragen = new Map<string, string>()
  for (const text of antwort.anschlussfragen ?? []) {
    if (text.trim() !== '') folgefragen.set(gespraechFrageId(text), text.trim())
  }
  return {
    gespraech: { ...kopf, antwort: { text: textMitDokumentnummern(antwort.text, nummern) }, belege, folgefragen: Array.from(folgefragen, ([id, text]) => ({ id, text })) },
    belegJeNummer,
    verworfen,
  }
}
