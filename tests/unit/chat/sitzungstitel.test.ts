import { describe, it, expect } from 'vitest'
import { istThemenuebersichtTitel, sitzungstitelAusFrage, SITZUNGSTITEL_MAX } from '@/lib/chat/common/sitzungstitel'
import { TOC_QUESTION } from '@/lib/chat/constants'

describe('Sitzungstitel (Story-Chronik, D1)', () => {
  it('erkennt den Systemtitel, den createChat aus der Themenuebersicht bildet', () => {
    expect(istThemenuebersichtTitel(TOC_QUESTION.slice(0, SITZUNGSTITEL_MAX))).toBe(true)
    expect(istThemenuebersichtTitel(TOC_QUESTION)).toBe(TOC_QUESTION.length <= SITZUNGSTITEL_MAX)
  })

  it('laesst echte Titel in Ruhe', () => {
    expect(istThemenuebersichtTitel('Heizen mit Holz')).toBe(false)
    expect(istThemenuebersichtTitel('Neuer Chat')).toBe(false)
  })

  it('bildet den Titel aus der Frage wie createChat: 60 Zeichen', () => {
    expect(sitzungstitelAusFrage('  Wie heizen wir morgen?  ')).toBe('Wie heizen wir morgen?')
    expect(sitzungstitelAusFrage('x'.repeat(100))).toHaveLength(SITZUNGSTITEL_MAX)
  })
})
