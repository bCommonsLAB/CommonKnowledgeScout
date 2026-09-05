import { describe, it, expect, beforeEach } from 'vitest'
import {
  consumeRealtimeTicketQuota,
  resetRealtimeTicketQuota,
} from '@/lib/secretary/realtime-rate-limit'

beforeEach(() => {
  resetRealtimeTicketQuota()
})

describe('consumeRealtimeTicketQuota', () => {
  it('laesst eine lange Aufnahme mit Sessionwechseln durch', () => {
    // Zwei Stunden Diktat brauchen wenige Tickets; 25 Versuche muessen passen.
    for (let i = 0; i < 25; i += 1) {
      expect(consumeRealtimeTicketQuota('user:a').allowed).toBe(true)
    }
  })

  it('bremst, wenn deutlich zu viele Tickets gezogen werden', () => {
    for (let i = 0; i < 30; i += 1) consumeRealtimeTicketQuota('user:a')
    const result = consumeRealtimeTicketQuota('user:a')

    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('zaehlt je Schluessel getrennt', () => {
    for (let i = 0; i < 30; i += 1) consumeRealtimeTicketQuota('user:a')

    expect(consumeRealtimeTicketQuota('user:a').allowed).toBe(false)
    expect(consumeRealtimeTicketQuota('user:b').allowed).toBe(true)
  })

  it('gibt nach dem Zeitfenster wieder frei', () => {
    const start = 1_000_000
    for (let i = 0; i < 30; i += 1) consumeRealtimeTicketQuota('user:a', start)

    expect(consumeRealtimeTicketQuota('user:a', start).allowed).toBe(false)
    // Elf Minuten spaeter ist das Fenster durch.
    expect(consumeRealtimeTicketQuota('user:a', start + 11 * 60 * 1000).allowed).toBe(true)
  })
})
