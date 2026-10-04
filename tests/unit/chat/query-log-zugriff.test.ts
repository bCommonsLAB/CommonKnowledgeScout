/**
 * @fileoverview D12a: Wer darf ein Query-Log lesen?
 *
 * Eigene Logs (E-Mail bzw. anonyme Sitzung) sind lesbar wie bisher. Die
 * Themenuebersicht (`toc`) ist innerhalb der Library fuer alle lesbar — ihr
 * Cache ist benutzeruebergreifend, der `complete`-Schritt traegt die Kennung
 * eines fremden Logs (Befund 02.10., 404 unter der Uebersicht). Fremde
 * Uebersichts-Logs kommen ohne `userEmail`/`sessionId` des Erstellers;
 * fremde Fragen bleiben unsichtbar.
 */

import { describe, it, expect } from 'vitest'
import type { QueryLog } from '@/types/query-log'
import { istEigenesLog, istUebersichtsLog, logFuerLeser } from '@/lib/db/query-log-zugriff'

function log(teil: Partial<QueryLog>): QueryLog {
  return {
    queryId: 'q1',
    createdAt: new Date('2026-10-02T10:00:00Z'),
    status: 'ok',
    libraryId: 'lib',
    question: 'Frage',
    mode: 'chunks',
    retrieval: [],
    ...teil,
  }
}

describe('istUebersichtsLog', () => {
  it('erkennt den Typ in cacheParams (neue Logs) und in der Wurzel (alte Logs)', () => {
    expect(istUebersichtsLog({ cacheParams: { libraryId: 'lib', question: 'x', queryType: 'toc' } })).toBe(true)
    expect(istUebersichtsLog({ queryType: 'toc' })).toBe(true)
    expect(istUebersichtsLog({ queryType: 'question' })).toBe(false)
    expect(istUebersichtsLog({})).toBe(false)
  })
})

describe('istEigenesLog', () => {
  it('vergleicht angemeldet die E-Mail, anonym die Sitzung', () => {
    expect(istEigenesLog({ userEmail: 'a@x.de' }, { userEmail: 'a@x.de' })).toBe(true)
    expect(istEigenesLog({ userEmail: 'a@x.de' }, { userEmail: 'b@x.de' })).toBe(false)
    expect(istEigenesLog({ sessionId: 's1' }, { sessionId: 's1' })).toBe(true)
    expect(istEigenesLog({ sessionId: 's1' }, { sessionId: 's2' })).toBe(false)
    // Angemeldet zaehlt nur die E-Mail, auch wenn zufaellig eine Sitzung passt.
    expect(istEigenesLog({ sessionId: 's1', userEmail: 'a@x.de' }, { userEmail: 'b@x.de', sessionId: 's1' })).toBe(false)
  })
})

describe('logFuerLeser', () => {
  it('liefert das eigene Log unveraendert (Frage und Uebersicht)', () => {
    const frage = log({ userEmail: 'a@x.de', queryType: 'question' })
    expect(logFuerLeser(frage, { userEmail: 'a@x.de' })).toBe(frage)
    const toc = log({ sessionId: 's1', cacheParams: { libraryId: 'lib', question: 'x', queryType: 'toc' } })
    expect(logFuerLeser(toc, { sessionId: 's1' })).toBe(toc)
  })

  it('verbirgt die Frage einer anderen Person', () => {
    const frage = log({ userEmail: 'a@x.de', queryType: 'question' })
    expect(logFuerLeser(frage, { userEmail: 'b@x.de' })).toBeNull()
    expect(logFuerLeser(frage, { sessionId: 's9' })).toBeNull()
  })

  it('gibt die fremde Uebersicht ohne Erstellerdaten heraus', () => {
    const toc = log({
      userEmail: 'a@x.de',
      sessionId: 's1',
      cacheParams: { libraryId: 'lib', question: 'x', queryType: 'toc' },
      storyTopicsData: { id: 'lib', title: 'T', tagline: '', intro: '', topics: [] },
    })
    const sicht = logFuerLeser(toc, { userEmail: 'b@x.de' })
    expect(sicht).not.toBeNull()
    expect(sicht?.queryId).toBe('q1')
    expect(sicht?.storyTopicsData?.title).toBe('T')
    expect(sicht).not.toHaveProperty('userEmail')
    expect(sicht).not.toHaveProperty('sessionId')
    // Das Original bleibt unangetastet.
    expect(toc.userEmail).toBe('a@x.de')
  })

  it('wirft ohne Leser-Kennung — kein stiller Zugriff', () => {
    expect(() => logFuerLeser(log({ queryType: 'toc' }), {})).toThrow(/userEmail oder sessionId/)
  })
})
