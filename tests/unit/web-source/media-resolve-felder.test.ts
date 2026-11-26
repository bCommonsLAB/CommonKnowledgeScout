/**
 * @fileoverview `media/resolve` nennt seit dem Befund vom 25.11.2026 `filesize` und
 * `http_chunk_size`; ein aelterer Secretary liefert die Felder nicht — kein Fehler.
 * Ohne Netz: der Aufruf an den Secretary ist eine Attrappe.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const netz = vi.hoisted(() => ({ fetchWithTimeout: vi.fn() }))

vi.mock('@/lib/utils/fetch-with-timeout', () => netz)
vi.mock('@/lib/env', () => ({ getSecretaryConfig: () => ({ baseUrl: 'http://secretary.test/api', apiKey: 'test-key' }) }))

import { resolveMediaViaSecretary } from '@/lib/web-source/media-resolve'

const SEITE_URL = 'https://video.example.org/watch?v=abc'

function antwort(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ status: 'success', data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const GRUND = { url: 'https://cdn.example.org/videoplayback?itag=140', ext: 'm4a', title: 'Side Event', duration: 5120, ist_audio: true, protocol: 'https', extractor: 'youtube', http_headers: { 'User-Agent': 'yt-dlp' } }

beforeEach(() => vi.clearAllMocks())

describe('resolveMediaViaSecretary: filesize und http_chunk_size', () => {
  it('liest beide Felder als Bytes', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ ...GRUND, filesize: 82_866_143, http_chunk_size: 10_485_760 }))
    const r = await resolveMediaViaSecretary(SEITE_URL)
    expect(r.filesize).toBe(82_866_143)
    expect(r.httpChunkSize).toBe(10_485_760)
    expect(r).toMatchObject({ directUrl: GRUND.url, ext: 'm4a', istAudio: true, protocol: 'https', extractor: 'youtube', duration: 5120 })
    expect(netz.fetchWithTimeout).toHaveBeenCalledWith('http://secretary.test/api/media/resolve', expect.objectContaining({ method: 'POST' }))
  })

  it('aelterer Secretary ohne die Felder: beide null, kein Fehler', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort(GRUND))
    const r = await resolveMediaViaSecretary(SEITE_URL)
    expect(r.filesize).toBeNull()
    expect(r.httpChunkSize).toBeNull()
  })

  it('null (gewoehnliche Audio-Datei) bleibt null', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ ...GRUND, extractor: 'generic', filesize: null, http_chunk_size: null }))
    const r = await resolveMediaViaSecretary(SEITE_URL)
    expect(r.filesize).toBeNull()
    expect(r.httpChunkSize).toBeNull()
  })

  it.each([0, -1, '10485760', Number.NaN, true])('kein positiver Zahlenwert (%s) gilt als unbekannt', async (wert) => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ ...GRUND, filesize: wert, http_chunk_size: wert }))
    const r = await resolveMediaViaSecretary(SEITE_URL)
    expect(r.filesize).toBeNull()
    expect(r.httpChunkSize).toBeNull()
  })
})
