/**
 * Welle W6 Stufe 1 — Binaerdateien ueber die Bruecke.
 *
 * Beleg: Zwoelf Anhaenge lagen nach drei Wochen weiter im Postfach, weil die
 * Schicht durchgehend Text ist. Die „Abschrift" traegt fuer ein Protokoll,
 * nicht fuer ein PDF-Layout.
 */
import { describe, expect, it } from 'vitest'
import { MAX_BINAER_BYTES, dekodiereBase64 } from '@/lib/mcp/storage/tools-binaer'

describe('dekodiereBase64', () => {
  it('dekodiert sauberes base64', () => {
    const roh = Buffer.from('%PDF-1.7 Inhalt')
    expect(dekodiereBase64(roh.toString('base64')).equals(roh)).toBe(true)
  })

  it('erlaubt Zeilenumbrueche in der Eingabe', () => {
    const roh = Buffer.from('abcdefghijklmnopqrstuvwxyz0123456789')
    const umbrochen = roh.toString('base64').replace(/(.{8})/g, '$1\n')
    expect(dekodiereBase64(umbrochen).equals(roh)).toBe(true)
  })

  it('lehnt Muell ab, statt eine halbe Datei abzulegen', () => {
    // Node verwirft ungueltige Zeichen still — genau das darf nicht passieren.
    expect(() => dekodiereBase64('nicht base64!!!')).toThrow(/kein gueltiges base64/)
    expect(() => dekodiereBase64('QUJD')).not.toThrow()
    expect(() => dekodiereBase64('QUJDR')).toThrow(/kein gueltiges base64/)
  })

  it('nennt den data:-Praefix beim Namen', () => {
    expect(() => dekodiereBase64('data:application/pdf;base64,QUJD')).toThrow(/data:-Praefix/)
  })

  it('lehnt Leeres ab', () => {
    expect(() => dekodiereBase64('')).toThrow(/leer/)
    expect(() => dekodiereBase64('   \n ')).toThrow(/leer/)
  })
})

describe('Grenze der Stufe 1', () => {
  it('liegt bei 6 MB — gross genug fuer Postfach-Anhaenge, klein genug fuers Zeitlimit', () => {
    expect(MAX_BINAER_BYTES).toBe(6 * 1024 * 1024)
  })
})
