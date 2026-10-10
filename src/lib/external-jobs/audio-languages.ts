/**
 * @fileoverview Sprachen einer Aufnahme (ISO 639-1) lesen und pruefen.
 *
 * @description
 * Gemischtsprachige Aufnahmen (z. B. Deutsch und Italienisch) transkribiert der
 * Secretary nur dann ohne Uebersetzung, wenn er die moeglichen Sprachen kennt
 * (Form-Feld `languages`). Dieses Modul ist rein (kein I/O, keine Server-
 * Importe), damit Dialog, Einstellungen und Job-Aufloesung dieselbe Regel nutzen.
 * Ungueltige Codes werden nicht still verworfen, sondern zurueckgemeldet.
 *
 * @module external-jobs
 */

const SPRACH_CODE = /^[a-z]{2}$/

export function isLanguageCode(value: string): boolean {
  return SPRACH_CODE.test(value)
}

export interface ParsedLanguages {
  /** Gueltige Codes, klein geschrieben, ohne Dubletten, in Eingabereihenfolge. */
  codes: string[]
  /** Eintraege, die kein zweibuchstabiger Code sind — der Aufrufer meldet sie. */
  invalid: string[]
}

/** Komma, Leerzeichen oder Zeilenumbruch trennen: „de, it" → ['de', 'it']. */
export function parseLanguagesText(text: string): ParsedLanguages {
  const codes: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/[\s,;]+/)) {
    const entry = raw.trim().toLowerCase()
    if (!entry) continue
    if (!isLanguageCode(entry)) {
      invalid.push(raw.trim())
      continue
    }
    if (!codes.includes(entry)) codes.push(entry)
  }
  return { codes, invalid }
}

/** Liste aus Config/Job-Optionen lesen; Nicht-Codes fallen heraus und werden gemeldet. */
export function readLanguageList(value: unknown): ParsedLanguages {
  if (!Array.isArray(value)) return { codes: [], invalid: [] }
  const text = value.filter((entry): entry is string => typeof entry === 'string').join(',')
  return parseLanguagesText(text)
}
