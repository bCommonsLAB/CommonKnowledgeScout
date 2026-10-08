/**
 * Welle F — Sicht auf einen Query-Log: Lesbares immer, Prompt nur auf Wunsch,
 * Verarbeitungsschritte als Zaehler.
 */
import { describe, it, expect } from 'vitest'
import { frageLogSicht } from '@/lib/mcp/frage-log-sicht'
import type { QueryLog } from '@/types/query-log'

const LOG = {
  queryId: 'q1', libraryId: 'lib', question: 'Was gilt?', mode: 'chunks', status: 'ok', createdAt: new Date('2026-10-08T10:00:00Z'),
  answer: 'Antwort [1]', shortTitle: 'Gilt', retriever: 'chunk', cacheHash: 'abc', cacheParams: { x: 1 },
  references: [{ number: 1, fileId: 'f1', title: 'Doc 1' }], processingLogs: [{}, {}], prompt: { system: 'S', user: 'U' },
  nachpruefung: { verteilung: {} },
} as unknown as QueryLog

describe('frageLogSicht', () => {
  it('liefert die lesbaren Felder und zaehlt Verarbeitungsschritte', () => {
    const sicht = frageLogSicht(LOG, false)
    expect(sicht).toMatchObject({ queryId: 'q1', frage: 'Was gilt?', antwort: 'Antwort [1]', cacheHash: 'abc', verarbeitungsschritte: 2, erstellt: '2026-10-08T10:00:00.000Z' })
    expect(sicht.belege).toEqual([{ nummer: 1, fileId: 'f1', titel: 'Doc 1' }])
    expect(sicht).not.toHaveProperty('prompt')
  })

  it('haengt den Prompt nur mit mitPrompt an', () => {
    expect(frageLogSicht(LOG, true).prompt).toEqual({ system: 'S', user: 'U' })
  })
})
