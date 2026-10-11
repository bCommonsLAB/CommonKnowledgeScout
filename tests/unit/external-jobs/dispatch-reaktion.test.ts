import { describe, expect, it } from 'vitest'
import { reaktionAufAntwort, reaktionAufFehler } from '@/lib/external-jobs/dispatch-reaktion'
import { neueStartLock, startLockFreiFilter } from '@/lib/external-jobs/start-lock'

/**
 * Befund 11.10.2026: Job 707873f4 lief zweimal, weil der Worker sein eigenes
 * 60-s-Timeout als „Job nicht gestartet" las und neu einreihte.
 */
describe('reaktionAufFehler', () => {
  it('Timeout des eigenen Wartens: loslassen, NICHT neu einreihen', () => {
    const abort = new Error('This operation was aborted')
    abort.name = 'AbortError'
    expect(reaktionAufFehler(abort)).toBe('losgelassen')
  })

  it('Route nicht erreicht (fetch failed, ECONNREFUSED): neu einreihen', () => {
    const fetchFailed = new TypeError('fetch failed')
    expect(reaktionAufFehler(fetchFailed)).toBe('neu_einreihen')
    expect(reaktionAufFehler('irgendwas')).toBe('neu_einreihen')
  })
})

describe('reaktionAufAntwort', () => {
  it('409 = Doppelstart, folgenlos; 2xx erledigt; Rest fehlgeschlagen', () => {
    expect(reaktionAufAntwort(409)).toBe('laeuft_schon')
    expect(reaktionAufAntwort(200)).toBe('erledigt')
    expect(reaktionAufAntwort(202)).toBe('erledigt')
    expect(reaktionAufAntwort(500)).toBe('fehlgeschlagen')
    expect(reaktionAufAntwort(404)).toBe('fehlgeschlagen')
  })
})

describe('Start-Sperre', () => {
  it('frei ohne Sperre oder bei failed — ein laufender/fertiger Job mit Sperre bleibt gesperrt', () => {
    expect(startLockFreiFilter('j1')).toEqual({ jobId: 'j1', $or: [{ startLock: { $exists: false } }, { status: 'failed' }] })
  })

  it('Sperre traegt Herkunft und Zeitpunkt', () => {
    const lock = neueStartLock({ startRequestId: 'r1', workerId: 'w1', pid: 7 })
    expect(lock).toMatchObject({ startRequestId: 'r1', workerId: 'w1', pid: 7 })
    expect(lock.at).toBeInstanceOf(Date)
  })
})
