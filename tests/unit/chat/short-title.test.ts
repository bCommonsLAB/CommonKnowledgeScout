/**
 * Kurztitel aus der LLM-Antwort (D5): bereinigen, nicht raten. Kein Wert →
 * `undefined`, damit die Chronik sichtbar auf die Heuristik faellt.
 */
import { describe, it, expect } from 'vitest'
import { normalizeShortTitle, SHORT_TITLE_MAX_CHARS } from '@/lib/chat/common/short-title'

describe('normalizeShortTitle', () => {
  it('nimmt einen sauberen Titel unveraendert', () => {
    expect(normalizeShortTitle('Heizen ohne Öl')).toBe('Heizen ohne Öl')
  })

  it('entfernt Anfuehrungszeichen, Satzzeichen am Ende und Mehrfach-Leerzeichen', () => {
    expect(normalizeShortTitle('  "Heizen   ohne Öl." ')).toBe('Heizen ohne Öl')
    expect(normalizeShortTitle('„Radwege ausbauen?“')).toBe('Radwege ausbauen')
  })

  it('kuerzt zu lange Titel an der Wortgrenze mit Auslassung', () => {
    const lang = 'Wort '.repeat(30).trim()
    const titel = normalizeShortTitle(lang)
    expect(titel).toBeDefined()
    expect(titel!.length).toBeLessThanOrEqual(SHORT_TITLE_MAX_CHARS + 1)
    expect(titel!.endsWith('…')).toBe(true)
    expect(titel!.includes('  ')).toBe(false)
  })

  it('liefert undefined bei Nicht-Strings, leerem Text und nur Satzzeichen', () => {
    expect(normalizeShortTitle(undefined)).toBeUndefined()
    expect(normalizeShortTitle(42)).toBeUndefined()
    expect(normalizeShortTitle('   ')).toBeUndefined()
    expect(normalizeShortTitle('"..."')).toBeUndefined()
  })
})
