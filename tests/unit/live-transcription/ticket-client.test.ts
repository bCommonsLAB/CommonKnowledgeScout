import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AUTHENTICATED_TICKET_ENDPOINT,
  PUBLIC_TICKET_ENDPOINT,
  fetchRealtimeTicket,
} from '@/lib/live-transcription/ticket-client'

function mockFetch(response: { ok: boolean; status?: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRealtimeTicket', () => {
  it('liefert das Ticket der Route', async () => {
    mockFetch({
      ok: true,
      body: {
        value: 'ek_test',
        websocketUrl: 'wss://example.test/v1/realtime?intent=transcription',
        model: 'gpt-4o-transcribe',
        expiresAt: 1800000000,
      },
    })

    const ticket = await fetchRealtimeTicket({ language: 'de' })

    expect(ticket.value).toBe('ek_test')
    expect(ticket.model).toBe('gpt-4o-transcribe')
    expect(ticket.expiresAt).toBe(1800000000)
  })

  it('nutzt den angemeldeten Endpunkt als Voreinstellung', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { value: 'ek', websocketUrl: 'wss://example.test/v1/realtime' },
    })

    await fetchRealtimeTicket()

    expect(fetchMock.mock.calls[0][0]).toBe(AUTHENTICATED_TICKET_ENDPOINT)
  })

  it('reicht die Zusatzfelder des oeffentlichen Wegs mit', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { value: 'ek', websocketUrl: 'wss://example.test/v1/realtime' },
    })

    await fetchRealtimeTicket({
      endpoint: PUBLIC_TICKET_ENDPOINT,
      extraFields: { libraryId: 'lib-1', eventFileId: 'evt-1', writeKey: 'geheim' },
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(PUBLIC_TICKET_ENDPOINT)
    expect(JSON.parse(String(init.body))).toMatchObject({
      libraryId: 'lib-1',
      eventFileId: 'evt-1',
      writeKey: 'geheim',
    })
  })

  it('meldet den Fehlertext der Route weiter', async () => {
    mockFetch({
      ok: false,
      status: 503,
      body: { error: 'Fuer den Use-Case live_transcription ist kein Modell zugeordnet.' },
    })

    await expect(fetchRealtimeTicket()).rejects.toThrow(/kein Modell zugeordnet/)
  })

  it('faellt nicht still zurueck, wenn das Ticket unvollstaendig ist', async () => {
    mockFetch({ ok: true, body: { model: 'gpt-4o-transcribe' } })

    await expect(fetchRealtimeTicket()).rejects.toThrow(/kein gueltiges Ticket/)
  })
})
