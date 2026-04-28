/**
 * Characterization Tests fuer src/lib/chat/common/budget.ts.
 * Welle 2.3 Schritt 3 — pure Funktionen.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getBaseBudget,
  reduceBudgets,
  canAccumulate,
  getTokenBudget,
  estimateTokensFromText,
  canAccumulateTokens,
} from '@/lib/chat/common/budget'

const ORIGINAL_ENV = process.env.CHAT_MAX_INPUT_TOKENS

beforeEach(() => {
  delete process.env.CHAT_MAX_INPUT_TOKENS
})

afterEach(() => {
  if (ORIGINAL_ENV !== undefined) {
    process.env.CHAT_MAX_INPUT_TOKENS = ORIGINAL_ENV
  } else {
    delete process.env.CHAT_MAX_INPUT_TOKENS
  }
})

describe('getBaseBudget', () => {
  it('liefert MAX_SAFE_INTEGER fuer "unbegrenzt"', () => {
    expect(getBaseBudget('unbegrenzt')).toBe(Number.MAX_SAFE_INTEGER)
  })
  it('liefert 180000 fuer "ausführlich"', () => {
    expect(getBaseBudget('ausführlich')).toBe(180000)
  })
  it('liefert 90000 fuer "mittel"', () => {
    expect(getBaseBudget('mittel')).toBe(90000)
  })
  it('liefert 30000 fuer "kurz"', () => {
    expect(getBaseBudget('kurz' as never)).toBe(30000)
  })
})

describe('reduceBudgets', () => {
  it('liefert grosse Fallback-Werte fuer "unbegrenzt" ohne ENV', () => {
    expect(reduceBudgets('unbegrenzt')).toEqual([
      200000, 150000, 120000, 90000, 60000, 30000,
    ])
  })

  it('berechnet Char-Budget aus CHAT_MAX_INPUT_TOKENS', () => {
    process.env.CHAT_MAX_INPUT_TOKENS = '1000'
    const r = reduceBudgets('unbegrenzt')
    // 1000 token * 4 = 4000 char-budget; 80% = 3200, etc.
    expect(r[0]).toBe(3200)
    expect(r[5]).toBe(800)
  })

  it('liefert ausführlich-Stufen', () => {
    expect(reduceBudgets('ausführlich')).toEqual([120000, 90000, 60000, 30000])
  })

  it('liefert mittel-Stufen', () => {
    expect(reduceBudgets('mittel')).toEqual([60000, 30000])
  })

  it('liefert kurz-Stufen', () => {
    expect(reduceBudgets('kurz' as never)).toEqual([20000])
  })
})

describe('canAccumulate / canAccumulateTokens', () => {
  it('liefert true wenn current+add <= budget', () => {
    expect(canAccumulate(10, 20, 30)).toBe(true)
    expect(canAccumulateTokens(10, 20, 30)).toBe(true)
  })
  it('liefert false bei Ueberschreitung', () => {
    expect(canAccumulate(10, 21, 30)).toBe(false)
    expect(canAccumulateTokens(10, 21, 30)).toBe(false)
  })
})

describe('getTokenBudget', () => {
  it('liefert undefined ohne ENV', () => {
    expect(getTokenBudget()).toBeUndefined()
  })
  it('liefert undefined bei nicht-numerischer ENV', () => {
    process.env.CHAT_MAX_INPUT_TOKENS = 'abc'
    expect(getTokenBudget()).toBeUndefined()
  })
  it('liefert undefined bei <= 0', () => {
    process.env.CHAT_MAX_INPUT_TOKENS = '0'
    expect(getTokenBudget()).toBeUndefined()
    process.env.CHAT_MAX_INPUT_TOKENS = '-5'
    expect(getTokenBudget()).toBeUndefined()
  })
  it('parst gueltige Werte', () => {
    process.env.CHAT_MAX_INPUT_TOKENS = '1234'
    expect(getTokenBudget()).toBe(1234)
  })
})

describe('estimateTokensFromText', () => {
  it('liefert 0 bei leerem String', () => {
    expect(estimateTokensFromText('')).toBe(0)
  })
  it('rechnet ~4 Zeichen pro Token (aufgerundet)', () => {
    expect(estimateTokensFromText('x')).toBe(1)
    expect(estimateTokensFromText('xxxx')).toBe(1)
    expect(estimateTokensFromText('xxxxx')).toBe(2)
  })
})
