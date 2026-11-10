/**
 * Teil C des Handovers vom 10.11.2026: Kennungen an den Secretary durchreichen
 * und Eingabe-/Ausgabe-Tokens samt Kosten aus seiner Antwort uebernehmen.
 */

import { describe, expect, it, vi } from 'vitest'
import { korrelationsHeader } from '@/lib/secretary/korrelation'
import { usageAusSecretaryAntwort } from '@/lib/chat/common/llm-usage'

describe('korrelationsHeader', () => {
  it('setzt die drei Header, leere Kennungen fallen weg', () => {
    expect(korrelationsHeader({ queryId: 'de0bd6c0-f409', libraryId: 'lib-1', chatId: null })).toEqual({
      'X-Query-Id': 'de0bd6c0-f409',
      'X-Library-Id': 'lib-1',
    })
    expect(korrelationsHeader(undefined)).toEqual({})
  })

  it('sendet keine Werte, die keine Kennung sind, und nennt nur den Header-Namen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(korrelationsHeader({ queryId: 'Wie wird Europa souverän?' })).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('X-Query-Id')
    expect(String(warn.mock.calls[0][0])).not.toContain('Europa')
    warn.mockRestore()
  })
})

describe('usageAusSecretaryAntwort', () => {
  it('uebernimmt Aufteilung und Kosten aus `usage`', () => {
    expect(usageAusSecretaryAntwort({
      usage: { model: 'google/gemini-2.5-flash', prompt_tokens: 80449, completion_tokens: 3721, total_tokens: 84170, cost: 0.0334, cost_currency: 'USD' },
      process: { llm_info: { total_tokens: 84170, requests: [{ tokens: 84170 }] } },
    })).toEqual({ totalTokens: 84170, promptTokens: 80449, completionTokens: 3721, cost: 0.0334, costCurrency: 'USD' })
  })

  it('`cost: null` bleibt null (ohne Preis), wird nie 0', () => {
    expect(usageAusSecretaryAntwort({ usage: { total_tokens: 10, cost: null } })?.cost).toBeNull()
  })

  it('aelterer Secretary ohne `usage`: nur die Summe, nichts geschaetzt', () => {
    expect(usageAusSecretaryAntwort({ process: { llm_info: { total_tokens: 75824 } } })).toEqual({ totalTokens: 75824 })
    expect(usageAusSecretaryAntwort({ status: 'success' })).toBeUndefined()
  })
})
