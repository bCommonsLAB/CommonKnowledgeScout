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

/** Eine woertliche Ersetzung im Text der Transformation (keine Muster). */
export interface TextErsetzung {
  alt: string
  neu: string
}

export interface ErsetzungsErgebnis {
  meta: Record<string, unknown>
  body: string
  /** Text-Felder des Frontmatters, in denen ersetzt wurde (neuer Wert). */
  geaendert: Record<string, unknown>
  /** true, wenn sich der Seitentext (Body) geaendert hat. */
  textGeaendert: boolean
  /** Ersetzungen ohne einen einzigen Treffer — laut gemeldet, nicht still uebergangen. */
  nichtGefunden: string[]
}

/**
 * Ersetzt woertlich jede Fundstelle von `alt` durch `neu` im Seitentext und in
 * den Text-Feldern des Frontmatters. Anlass (Befund 20.11.2026): das Modell
 * verkuerzt lange Adressen; `felder` korrigiert nur das Kopffeld, der Link im
 * Seitentext bleibt kaputt. Gesperrte Felder bleiben unberuehrt; wuerde ein
 * Pflichtfeld des Typs geaendert, wirft die Funktion (es gehoert in die Quelle).
 */
export function ersetzeText(
  meta: Record<string, unknown>,
  body: string,
  ersetzungen: readonly TextErsetzung[],
  detailViewType: string | null,
): ErsetzungsErgebnis {
  for (const { alt, neu } of ersetzungen) {
    if (alt.length < 3) throw new Error(`Ersetzung "${alt}": alt braucht mindestens 3 Zeichen`)
    if (alt === neu) throw new Error(`Ersetzung "${alt}": alt und neu sind gleich`)
  }
  const pflicht = new Set(detailViewType ? getRequiredFields(detailViewType) : [])
  const neuMeta: Record<string, unknown> = { ...meta }
  const geaendert: Record<string, unknown> = {}
  const nichtGefunden: string[] = []
  let neuBody = body

  for (const { alt, neu } of ersetzungen) {
    let treffer = 0
    if (neuBody.includes(alt)) {
      treffer += neuBody.split(alt).length - 1
      neuBody = neuBody.split(alt).join(neu)
    }
    for (const [key, wert] of Object.entries(neuMeta)) {
      if (GESPERRTE_FELDER.has(key) || typeof wert !== 'string' || !wert.includes(alt)) continue
      if (pflicht.has(key)) throw new Error(`Ersetzung "${alt}" traefe das Pflichtfeld "${key}" (${detailViewType}) — das gehoert in die Quelldatei`)
      treffer += wert.split(alt).length - 1
      neuMeta[key] = wert.split(alt).join(neu)
      geaendert[key] = neuMeta[key]
    }
    if (treffer === 0) nichtGefunden.push(alt)
  }
  return { meta: neuMeta, body: neuBody, geaendert, textGeaendert: neuBody !== body, nichtGefunden }
}
