/**
 * Unit-Tests für Gate-Kombination mit Phasen-Direktiven (keine stillen Abweichungen).
 */
import { describe, expect, it } from 'vitest'
import { shouldRunWithGate } from '@/lib/processing/phase-policy'

describe('shouldRunWithGate', () => {
  it('ignore und skip laufen nie', () => {
    expect(shouldRunWithGate(false, 'ignore')).toBe(false)
    expect(shouldRunWithGate(true, 'ignore')).toBe(false)
    expect(shouldRunWithGate(false, 'skip')).toBe(false)
    expect(shouldRunWithGate(true, 'skip')).toBe(false)
  })

  it('force läuft immer', () => {
    expect(shouldRunWithGate(false, 'force')).toBe(true)
    expect(shouldRunWithGate(true, 'force')).toBe(true)
  })

  it('do und auto respektieren das Gate', () => {
    expect(shouldRunWithGate(false, 'do')).toBe(true)
    expect(shouldRunWithGate(true, 'do')).toBe(false)
    expect(shouldRunWithGate(false, 'auto')).toBe(true)
    expect(shouldRunWithGate(true, 'auto')).toBe(false)
  })
})
