// @vitest-environment jsdom

/**
 * Tests fuer `useSessionHeaders`.
 *
 * Der Hook bekommt den Anmeldezustand seit der Welle „Session-Header
 * entkoppeln" hereingereicht, statt ihn bei Clerk zu erfragen — sonst
 * erreichte die Galerie ueber diesen Umweg weiterhin einen Auth-Anbieter
 * (Galerie-Audit, Nachtrag zum langen Schwanz).
 *
 * Warum ein Test und kein Browser-Durchgang: In der Galerie fliessen die
 * Header nur in Aufrufe, die eine `queryId` brauchen — die entsteht erst nach
 * einer Chat-Antwort. Ein Klick-Durchgang haette den Pfad also gar nicht
 * beruehrt; eine echte Chat-Abfrage haette die Produktivdatenbank belastet.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSessionHeaders } from '@/hooks/use-session-headers'

const SPEICHER_SCHLUESSEL_KANDIDATEN = ['sessionId', 'session-id', 'ks-session-id']

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('useSessionHeaders', () => {
  it('liefert keine Header fuer angemeldete Betrachter', () => {
    const { result } = renderHook(() => useSessionHeaders(true))
    expect(result.current).toEqual({})
  })

  it('liefert einen X-Session-ID-Header fuer anonyme Betrachter', () => {
    const { result } = renderHook(() => useSessionHeaders(false))
    expect(Object.keys(result.current)).toEqual(['X-Session-ID'])
    expect(result.current['X-Session-ID']).toBeTruthy()
    // Eine temporaere ID waere ein Zeichen dafuer, dass der Speicher nicht
    // erreichbar war — die wird bewusst NICHT gesendet.
    expect(result.current['X-Session-ID'].startsWith('temp-')).toBe(false)
  })

  it('haelt die Session-ID ueber mehrere Aufrufe stabil', () => {
    const ersteId = renderHook(() => useSessionHeaders(false)).result.current['X-Session-ID']
    const zweiteId = renderHook(() => useSessionHeaders(false)).result.current['X-Session-ID']
    expect(zweiteId).toBe(ersteId)
  })

  it('sendet nichts, wenn der Speicher nicht erreichbar ist', () => {
    // Kein stiller Fallback auf eine temporaere ID im Header: Lieber gar kein
    // Header als einer, den der Server nicht zuordnen kann.
    for (const schluessel of SPEICHER_SCHLUESSEL_KANDIDATEN) {
      window.localStorage.removeItem(schluessel)
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Speicher gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Speicher gesperrt')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useSessionHeaders(false))
    expect(result.current).toEqual({})
  })

  it('reagiert auf einen Wechsel des Anmeldezustands', () => {
    const { result, rerender } = renderHook(
      ({ angemeldet }: { angemeldet: boolean }) => useSessionHeaders(angemeldet),
      { initialProps: { angemeldet: false } }
    )
    expect(Object.keys(result.current)).toEqual(['X-Session-ID'])

    rerender({ angemeldet: true })
    expect(result.current).toEqual({})
  })
})
