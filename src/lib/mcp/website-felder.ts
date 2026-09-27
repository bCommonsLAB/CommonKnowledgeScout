/**
 * @fileoverview Feldregeln fuer `dokument_felder_setzen` (B2): reine Funktionen.
 *
 * @description
 * Ein Galerie-Eintrag hat zwei Ablagen, die zusammengehoeren: das Frontmatter
 * der Transformation am Twin (Quelle fuer jeden Re-Publish) und `docMetaJson`
 * des Meta-Dokuments (Quelle fuer Galerie, Facetten, Landingpage). Hier wird
 * das neue Frontmatter berechnet; geschrieben wird in `tools-website-felder.ts`.
 *
 * Gesperrt sind Felder, die die Pipeline selbst rechnet oder die den Typ
 * tragen — ein Werkzeug, das `prioritaets_index` setzt, wuerde beim naechsten
 * Transform-Lauf still ueberschrieben (Befund 27.09.2026).
 *
 * @module mcp
 */

import { getRequiredFields } from '@/lib/detail-view-types/registry'

/** Werte, die die Pipeline rechnet oder verwaltet — nie von Hand setzen. */
export const GESPERRTE_FELDER: ReadonlySet<string> = new Set([
  'prioritaets_index',
  'bewertung_stand',
  'bewertung_modell',
  'detailViewType',
  'docType',
  'markdown',
  'publication',
  'translations',
  'translationStatus',
])

export interface FeldAenderungen {
  /** Skalare setzen (String, Zahl, Boolean). */
  felder?: Record<string, string | number | boolean>
  /** Listenfelder ergaenzen (Dubletten normalisiert). */
  listen?: Record<string, string[]>
  /** Eintraege aus Listenfeldern entfernen (normalisiert). */
  entfernen?: Record<string, string[]>
}

function normalisiert(wert: string): string {
  return wert.trim().toLocaleLowerCase('de')
}

function alsListe(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.filter((v): v is string => typeof v === 'string')
  if (typeof wert === 'string' && wert.trim()) return [wert]
  return []
}

/**
 * Berechnet das neue Frontmatter. Wirft bei gesperrten Feldern und bei
 * Pflichtfeldern des Typs (die gehoeren in die Quelle, nicht in ein Patch).
 * Liefert zusaetzlich die Felder, die sich tatsaechlich geaendert haben —
 * fuer das Meta-Dokument und die Antwort.
 */
export function wendeFelderAn(
  meta: Record<string, unknown>,
  aenderungen: FeldAenderungen,
  detailViewType: string | null,
): { meta: Record<string, unknown>; geaendert: Record<string, unknown> } {
  const pflicht = new Set(detailViewType ? getRequiredFields(detailViewType) : [])
  const alleKeys = [
    ...Object.keys(aenderungen.felder ?? {}),
    ...Object.keys(aenderungen.listen ?? {}),
    ...Object.keys(aenderungen.entfernen ?? {}),
  ]
  for (const key of alleKeys) {
    if (GESPERRTE_FELDER.has(key)) throw new Error(`Feld "${key}" ist gesperrt — es wird von der Pipeline verwaltet`)
    if (pflicht.has(key)) throw new Error(`Pflichtfeld "${key}" (${detailViewType}) gehoert in die Quelldatei, nicht in einen Feld-Patch`)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error(`Feldname "${key}" ist kein flacher snake_case-Key`)
  }

  const neu: Record<string, unknown> = { ...meta }
  const geaendert: Record<string, unknown> = {}

  for (const [key, wert] of Object.entries(aenderungen.felder ?? {})) {
    if (neu[key] !== wert) {
      neu[key] = wert
      geaendert[key] = wert
    }
  }
  const listenKeys = new Set([...Object.keys(aenderungen.listen ?? {}), ...Object.keys(aenderungen.entfernen ?? {})])
  for (const key of listenKeys) {
    const vorher = alsListe(neu[key])
    const ergebnis = [...vorher]
    for (const eintrag of aenderungen.listen?.[key] ?? []) {
      if (!ergebnis.some((v) => normalisiert(v) === normalisiert(eintrag))) ergebnis.push(eintrag.trim())
    }
    const raus = new Set((aenderungen.entfernen?.[key] ?? []).map(normalisiert))
    const gefiltert = ergebnis.filter((v) => !raus.has(normalisiert(v)))
    if (gefiltert.length !== vorher.length || gefiltert.some((v, i) => v !== vorher[i])) {
      neu[key] = gefiltert
      geaendert[key] = gefiltert
    }
  }
  return { meta: neu, geaendert }
}
