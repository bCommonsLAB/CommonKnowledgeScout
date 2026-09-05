import { describe, it, expect } from 'vitest'
import {
  HARD_ROTATE_AFTER_MS,
  MAX_RECONNECT_DELAY_MS,
  SESSION_LIMIT_MS,
  SOFT_ROTATE_AFTER_MS,
  reconnectDelayMs,
  shouldRotateSession,
} from '@/lib/live-transcription/connection-policy'

describe('shouldRotateSession', () => {
  it('wechselt frueh nicht', () => {
    expect(shouldRotateSession({ sessionAgeMs: 60_000, isSpeaking: false })).toBe(false)
  })

  it('wechselt ab der weichen Schwelle in einer Sprechpause', () => {
    expect(shouldRotateSession({ sessionAgeMs: SOFT_ROTATE_AFTER_MS, isSpeaking: false })).toBe(true)
  })

  it('wartet an der weichen Schwelle, solange gesprochen wird', () => {
    expect(shouldRotateSession({ sessionAgeMs: SOFT_ROTATE_AFTER_MS, isSpeaking: true })).toBe(false)
  })

  it('wechselt an der harten Schwelle auch mitten im Satz', () => {
    expect(shouldRotateSession({ sessionAgeMs: HARD_ROTATE_AFTER_MS, isSpeaking: true })).toBe(true)
  })

  it('wechselt vor dem Zeitlimit des Anbieters', () => {
    expect(HARD_ROTATE_AFTER_MS).toBeLessThan(SESSION_LIMIT_MS)
  })
})

describe('reconnectDelayMs', () => {
  it('startet kurz und verdoppelt sich', () => {
    expect(reconnectDelayMs(1)).toBe(500)
    expect(reconnectDelayMs(2)).toBe(1000)
    expect(reconnectDelayMs(3)).toBe(2000)
  })

  it('bleibt unter der Obergrenze', () => {
    expect(reconnectDelayMs(50)).toBe(MAX_RECONNECT_DELAY_MS)
  })

  it('behandelt ungueltige Versuchsnummern wie den ersten Versuch', () => {
    expect(reconnectDelayMs(0)).toBe(500)
    expect(reconnectDelayMs(-3)).toBe(500)
  })
})
