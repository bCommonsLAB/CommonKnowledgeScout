import { describe, expect, it } from 'vitest'
import { energie, energieVergleich, euro, monatsName, monatVerschieben } from '@/lib/verbrauch/format'

describe('Darstellung der Verbrauchsseite', () => {
  it('Euro: unter einem Euro drei Nachkommastellen', () => {
    expect(euro(0.0261, 'de').replace(/\s/g, ' ')).toBe('0,026 €')
    expect(euro(28.26, 'de').replace(/\s/g, ' ')).toBe('28,26 €')
  })

  it('Energie: Wh, ab 1.000 Wh kWh', () => {
    expect(energie(32.6, 'de')).toBe('≈ 33 Wh')
    expect(energie(30320, 'de')).toBe('≈ 30 kWh')
    expect(energie(1500, 'de')).toBe('≈ 1,5 kWh')
  })

  it('Vergleich: LED-Stunden unter 1 kWh, Kilometer darüber, nichts bei null', () => {
    expect(energieVergleich(96)).toEqual({ art: 'lampe', stunden: 10 })
    expect(energieVergleich(30000)).toEqual({ art: 'auto', km: 200 })
    expect(energieVergleich(0)).toBeNull()
  })

  it('Monat: verschieben über den Jahreswechsel, Name in der Sprache', () => {
    expect(monatVerschieben('2026-01', -1)).toBe('2025-12')
    expect(monatVerschieben('2026-12', 1)).toBe('2027-01')
    expect(monatsName('2026-11', 'de')).toBe('November 2026')
  })
})
