import { describe, it, expect } from 'vitest'
import { isAtLeast, readBearbeitungsstand, standRank } from '@/lib/agent-view/bearbeitungsstand'

describe('bearbeitungsstand', () => {
  it('liest Stand und Datum (Datum als Tagesende)', () => {
    const result = readBearbeitungsstand({ bearbeitungsstand: 'berichtet', bearbeitungsstand_seit: '2026-08-18' })
    expect(result).toEqual({ bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: '2026-08-18T23:59:59.999Z' })
  })

  it('meldet unbekannte Werte als Fehler statt sie auf einen Default zu biegen', () => {
    const result = readBearbeitungsstand({ bearbeitungsstand: 'fertig', bearbeitungsstand_seit: 'gestern' })
    expect(result.bearbeitungsstand).toBeNull()
    expect(result.error).toContain('Unbekannter bearbeitungsstand')
    expect(result.error).toContain('Unlesbares bearbeitungsstand_seit')
  })

  it('liefert fuer leeres Frontmatter keinen Stand und keinen Fehler', () => {
    expect(readBearbeitungsstand({})).toEqual({ bearbeitungsstand: null, bearbeitungsstandSeit: null })
  })

  it('ordnet die v2-Reihenfolge', () => {
    expect(standRank('ungesichtet')).toBeLessThan(standRank('abgenommen'))
    expect(isAtLeast('berichtet', 'berichtet')).toBe(true)
    expect(isAtLeast('strukturiert', 'berichtet')).toBe(false)
    expect(isAtLeast(null, 'ungesichtet')).toBe(false)
  })
})
