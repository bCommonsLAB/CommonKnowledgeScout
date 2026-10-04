import { describe, it, expect } from 'vitest'
import { istThemenuebersichtTitel, SITZUNGSTITEL_MAX } from '@/lib/chat/common/sitzungstitel'
import { TOC_QUESTION } from '@/lib/chat/constants'

describe('Sitzungstitel (Story-Chronik, D1/D8)', () => {
  it('erkennt den Systemtitel, den createChat vor D8 aus der Themenuebersicht bildete', () => {
    expect(istThemenuebersichtTitel(TOC_QUESTION.slice(0, SITZUNGSTITEL_MAX))).toBe(true)
    expect(istThemenuebersichtTitel(`  ${TOC_QUESTION.slice(0, SITZUNGSTITEL_MAX)}  `)).toBe(true)
    expect(istThemenuebersichtTitel(TOC_QUESTION)).toBe(TOC_QUESTION.length <= SITZUNGSTITEL_MAX)
  })

  it('laesst echte Titel in Ruhe', () => {
    expect(istThemenuebersichtTitel('Heizen mit Holz')).toBe(false)
    expect(istThemenuebersichtTitel('Neuer Chat')).toBe(false)
    expect(istThemenuebersichtTitel('')).toBe(false)
  })
})
