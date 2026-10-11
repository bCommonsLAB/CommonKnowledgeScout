/**
 * @fileoverview Unit-Tests: Bilanz des Text-Feeds (Welle I2).
 *
 * Der Abnahmefall aus dem Plan: Feed scheitert NACH abgeschlossenem Ingest
 * → der Status bleibt bei der Route (completed), das Ereignis steht im Trace.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

import {
  TEXT_FEED_INGEST_ZUGABE_MS,
  deuteZeitablauf,
  textFeedZeitgrenzeMs,
  verbucheFeedAusgang,
  type TextFeedRepo,
} from '@/lib/external-jobs/text-feed'

function repoMit(gesetzt: boolean): TextFeedRepo & { setFailedIfUntouched: ReturnType<typeof vi.fn>; traceAddEvent: ReturnType<typeof vi.fn> } {
  return {
    setFailedIfUntouched: vi.fn().mockResolvedValue(gesetzt),
    traceAddEvent: vi.fn().mockResolvedValue(undefined),
  }
}

describe('textFeedZeitgrenzeMs', () => {
  it('liegt oberhalb der Template-Grenze plus Ingest-Zugabe', () => {
    expect(textFeedZeitgrenzeMs({ EXTERNAL_TEMPLATE_TIMEOUT_MS: '900000' } as unknown as NodeJS.ProcessEnv)).toBe(900000 + TEXT_FEED_INGEST_ZUGABE_MS)
  })

  it('nimmt ohne Umgebung die 600-s-Vorgabe der Route — deutlich ueber der stillen 300-s-Grenze von fetch', () => {
    const grenze = textFeedZeitgrenzeMs({} as unknown as NodeJS.ProcessEnv)
    expect(grenze).toBe(600000 + TEXT_FEED_INGEST_ZUGABE_MS)
    expect(grenze).toBeGreaterThan(300000)
  })
})

describe('verbucheFeedAusgang', () => {
  it('tut nichts, wenn der Feed zugestellt wurde', async () => {
    const repo = repoMit(true)
    expect(await verbucheFeedAusgang(repo, 'j1', { art: 'zugestellt' })).toBe('nichts')
    expect(repo.setFailedIfUntouched).not.toHaveBeenCalled()
    expect(repo.traceAddEvent).not.toHaveBeenCalled()
  })

  it('setzt failed, wenn die Route den Job nie angefasst hat (Feed nicht zustellbar)', async () => {
    const repo = repoMit(true)
    expect(await verbucheFeedAusgang(repo, 'j1', { art: 'netz', meldung: 'ECONNREFUSED' })).toBe('failed')
    expect(repo.setFailedIfUntouched).toHaveBeenCalledWith('j1', { code: 'text_feed_failed', message: expect.stringContaining('ECONNREFUSED') })
  })

  it('Feed scheitert nach abgeschlossenem Ingest → Status bleibt bei der Route, Ereignis im Trace', async () => {
    const repo = repoMit(false)
    expect(await verbucheFeedAusgang(repo, 'j1', { art: 'netz', meldung: 'fetch failed' })).toBe('ereignis')
    expect(repo.traceAddEvent).toHaveBeenCalledWith('j1', expect.objectContaining({
      name: 'text_feed_fehler_nach_arbeit', level: 'warn', message: expect.stringContaining('Endstatus gilt'),
    }))
  })

  it('HTTP-Fehler traegt Status und Antwort-Auszug in die Meldung', async () => {
    const repo = repoMit(true)
    await verbucheFeedAusgang(repo, 'j1', { art: 'http', status: 401, text: 'Unauthorized' })
    expect(repo.setFailedIfUntouched).toHaveBeenCalledWith('j1', expect.objectContaining({ message: 'Text-Feed schlug fehl (HTTP 401): Unauthorized' }))
  })

  it('Zeitablauf ist ein Ereignis mit Deutung, nie ein Status', async () => {
    const repo = repoMit(true)
    expect(await verbucheFeedAusgang(repo, 'j1', { art: 'zeitablauf', zeitgrenzeMs: 1_200_000 })).toBe('ereignis')
    expect(repo.setFailedIfUntouched).not.toHaveBeenCalled()
    expect(repo.traceAddEvent).toHaveBeenCalledWith('j1', expect.objectContaining({
      name: 'text_feed_timeout', message: deuteZeitablauf(1_200_000), attributes: { zeitgrenzeMs: 1_200_000 },
    }))
    expect(deuteZeitablauf(1_200_000)).toContain('1200 s')
  })
})
