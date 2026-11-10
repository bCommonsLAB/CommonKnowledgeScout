/**
 * Verbrauchsseite (Konzept 10.11.2026): Kosten in Euro, Energie als obere
 * Grenze, nur Zahlen. Die Token-Zahlen stammen aus dem Live-Test vom 10.11.
 */

import { describe, expect, it } from 'vitest'
import { aktuellerMonat, energieWh, monatsGrenzen, usdEurKurs, verbrauchAuswerten, type VerbrauchZeile } from '@/lib/verbrauch/rechnen'

const ZEILEN: VerbrauchZeile[] = [
  { createdAt: '2026-11-10T20:12:41Z', sessionId: 's1', tokenUsage: { totalTokens: 81442, cost: 0.029 } },
  { createdAt: '2026-11-10T20:11:58Z', sessionId: 's1', tokenUsage: { totalTokens: 79798, cost: 0.029 } },
  { createdAt: '2026-11-10T20:09:03Z', sessionId: 's2', retrieval: [{ cacheFound: false }, { cacheFound: true }] },
  { createdAt: '2026-11-10T19:41:37Z', userEmail: 'mitglied@example.org', tokenUsage: { totalTokens: 79112, cost: null } },
  { createdAt: '2026-11-09T10:00:00Z', sessionId: 's3', tokenUsage: { totalTokens: 75824 } },
  { createdAt: '2026-11-08T10:00:00Z', sessionId: 's4' },
]
const alle = { kurs: 0.9, betrachter: { sessionId: 's1' }, nurEigen: false, limit: 200 }

describe('Rechnung', () => {
  it('Energie: 0,4 Wh je 1.000 Tokens', () => {
    expect(energieWh(80000)).toBeCloseTo(32)
  })

  it('Kurs: nicht gesetzt → null, unbrauchbar → Fehler, Komma erlaubt', () => {
    expect(usdEurKurs(undefined)).toBeNull()
    expect(usdEurKurs(' ')).toBeNull()
    expect(usdEurKurs('0,90')).toBe(0.9)
    expect(() => usdEurKurs('abc')).toThrow(/VERBRAUCH_USD_EUR_KURS/)
    expect(() => usdEurKurs('0')).toThrow()
  })

  it('Monat: Grenzen in UTC, falsche Form ist ein Fehler', () => {
    expect(monatsGrenzen('2026-12')).toEqual({ von: new Date('2026-12-01T00:00:00Z'), bis: new Date('2027-01-01T00:00:00Z') })
    expect(() => monatsGrenzen('2026-13')).toThrow(/JJJJ-MM/)
    expect(aktuellerMonat(new Date('2026-11-10T20:00:00Z'))).toBe('2026-11')
  })
})

describe('verbrauchAuswerten', () => {
  const a = verbrauchAuswerten(ZEILEN, alle)

  it('zählt neu berechnete Fragen, Speicher-Treffer und Lücken getrennt', () => {
    expect(a.summen).toMatchObject({ fragen: 6, neuBerechnet: 5, ausSpeicher: 1, ohnePreis: 3, ohneTokens: 1, tokens: 316176 })
  })

  it('Kosten in Euro nur aus Fragen mit Preis (Untergrenze), Energie aus allen mit Tokens', () => {
    expect(a.summen.kostenEur).toBeCloseTo(0.058 * 0.9)
    expect(a.summen.energieWh).toBeCloseTo(126.4704)
  })

  it('Zeilen tragen nur Zahlen — keine Person, keine Sitzung, Zeit auf die Minute', () => {
    expect(a.eintraege[0]).toEqual({ zeit: '2026-11-10T20:12:00.000Z', tokens: 81442, kostenEur: 0.029 * 0.9, energieWh: energieWh(81442), ausSpeicher: false, eigen: true })
    expect(Object.keys(a.eintraege[3]).sort()).toEqual(['ausSpeicher', 'eigen', 'energieWh', 'kostenEur', 'tokens', 'zeit'])
  })

  it('Speicher-Treffer: null Kosten, keine Energie; fehlender Preis bleibt null, nie 0', () => {
    expect(a.eintraege[2]).toMatchObject({ ausSpeicher: true, tokens: null, kostenEur: 0, energieWh: null })
    expect(a.eintraege[3].kostenEur).toBeNull()
  })

  it('Meine Sitzung: nur die eigenen Fragen, in Summen und Liste', () => {
    const s = verbrauchAuswerten(ZEILEN, { ...alle, nurEigen: true })
    expect(s.summen).toMatchObject({ fragen: 2, tokens: 161240 })
    expect(s.eintraege).toHaveLength(2)
  })

  it('angemeldet zählt die E-Mail, nicht die Sitzung', () => {
    const s = verbrauchAuswerten(ZEILEN, { ...alle, betrachter: { userEmail: 'mitglied@example.org' }, nurEigen: true })
    expect(s.summen.fragen).toBe(1)
  })

  it('ohne Betrachter ist nichts „eigen"', () => {
    expect(verbrauchAuswerten(ZEILEN, { ...alle, betrachter: {}, nurEigen: true }).summen.fragen).toBe(0)
  })

  it('ohne Kurs gibt es keine Kosten statt falscher', () => {
    const o = verbrauchAuswerten(ZEILEN, { ...alle, kurs: null })
    expect(o.summen.kostenEur).toBeNull()
    expect(o.eintraege.every((e) => e.kostenEur === null)).toBe(true)
  })

  it('die Liste ist begrenzt, die Summen nicht', () => {
    const k = verbrauchAuswerten(ZEILEN, { ...alle, limit: 2 })
    expect(k.eintraege).toHaveLength(2)
    expect(k.summen.fragen).toBe(6)
  })
})
