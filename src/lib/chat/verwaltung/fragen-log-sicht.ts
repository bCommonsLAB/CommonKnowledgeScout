/**
 * @fileoverview Seite der Verwaltungssicht „Fragen & Antworten" — gemeinsam für Route und Brücke.
 *
 * @description
 * Aus den Hash-Gruppen des Fragen-Logs wird je Gruppe eine Zeile ohne
 * Antworttext (der kommt auf Abruf je Zeile) mit der Aktualität des Hashes
 * („aktuell"/„veraltet"/„unbekannt"). Die Prüfung läuft über alle gelesenen
 * Gruppen (höchstens MAX_GRUPPEN), damit „nur veraltete" serverseitig filtern
 * und die Seitenzahl stimmen kann; geblättert wird danach im Speicher.
 *
 * @module chat
 */

import type { CacheAktualitaet, AktualitaetsPruefer } from '@/lib/chat/utils/cache-aktualitaet'
import type { FragenLogGruppe } from '@/lib/db/queries-verwaltung'

export const PRO_SEITE_VORGABE = 25
export const PRO_SEITE_MAX = 100

export interface FragenLogZeile {
  queryId: string
  frage: string
  kurztitel: string | null
  erstellt: string
  status: FragenLogGruppe['status']
  queryType: 'toc' | 'question'
  sprache: string | null
  modell: string | null
  anzahlQuellen: number
  facetten: Record<string, unknown> | null
  anzahlEintraege: number
  cacheInvalidatedAt: string | null
  aktualitaet: CacheAktualitaet
}

export interface FragenLogSeite {
  zeilen: FragenLogZeile[]
  gesamt: number
  seite: number
  proSeite: number
  /** Gesetzt, wenn die Aktualität nicht prüfbar war (Antwortregeln der Library kaputt). */
  hinweis: string | null
}

export interface SeitenWahl {
  seite: number
  proSeite: number
  nurVeraltete: boolean
}

/** Zahl aus einem Query-Parameter lesen; ungültige Werte sind ein Fehler, kein stiller Default. */
export function leseZahl(roh: string | null, vorgabe: number, max: number, name: string): number {
  if (roh === null || roh.trim() === '') return vorgabe
  const n = Number(roh)
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${name} muss eine ganze Zahl von 1 bis ${max} sein (hier: "${roh}")`)
  }
  return n
}

/** Schalter aus einem Query-Parameter lesen: fehlt = false, sonst nur "true" oder "false". */
export function leseSchalter(roh: string | null, name: string): boolean {
  if (roh === null || roh.trim() === '') return false
  if (roh === 'true') return true
  if (roh === 'false') return false
  throw new Error(`${name} muss "true" oder "false" sein (hier: "${roh}")`)
}

export async function zeileAusGruppe(g: FragenLogGruppe, pruefer: AktualitaetsPruefer): Promise<FragenLogZeile> {
  const p = g.cacheParams
  return {
    queryId: g.queryId,
    frage: g.question,
    kurztitel: g.shortTitle,
    erstellt: g.createdAt.toISOString(),
    status: g.status,
    queryType: p?.queryType ?? 'question',
    sprache: p?.targetLanguage ?? null,
    modell: p?.llmModel ?? null,
    anzahlQuellen: g.anzahlQuellen,
    facetten: p?.facetsSelected && Object.keys(p.facetsSelected).length > 0 ? p.facetsSelected : null,
    anzahlEintraege: g.anzahlEintraege,
    cacheInvalidatedAt: g.cacheInvalidatedAt ? g.cacheInvalidatedAt.toISOString() : null,
    aktualitaet: await pruefer.pruefe(g),
  }
}

export async function baueFragenLogSeite(
  gruppen: FragenLogGruppe[],
  pruefer: AktualitaetsPruefer,
  wahl: SeitenWahl,
): Promise<FragenLogSeite> {
  const alle = await Promise.all(gruppen.map((g) => zeileAusGruppe(g, pruefer)))
  const gefiltert = wahl.nurVeraltete ? alle.filter((z) => z.aktualitaet === 'veraltet') : alle
  const von = (wahl.seite - 1) * wahl.proSeite
  return {
    zeilen: gefiltert.slice(von, von + wahl.proSeite),
    gesamt: gefiltert.length,
    seite: wahl.seite,
    proSeite: wahl.proSeite,
    hinweis: pruefer.hinweis,
  }
}
