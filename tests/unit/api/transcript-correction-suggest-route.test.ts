import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Korrektur-Assistent: Vorschlags-Route. Saetze aus den gespeicherten Segmenten,
 * Begleittexte server-seitig, Auftrag Pflicht, Antwort gegen den Text geprueft.
 */

const h = vi.hoisted(() => ({
  llm: vi.fn(),
  segmente: null as null | { segments: Array<{ text: string }> },
  docs: new Map<string, { sourceId: string; sourceName: string; parentId: string; artifacts: { transcript?: { markdown: string; updatedAt: string; createdAt: string } } }>(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user-1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'peter@example.com' }] }),
}))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: async () => ({ id: 'lib-1', config: {} }) }) },
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: async ({ sourceIds }: { sourceIds: string[] }) =>
    new Map(sourceIds.filter((id) => h.docs.has(id)).map((id) => [id, h.docs.get(id)!])),
  readTranscriptRecord: (doc: { artifacts?: { transcript?: unknown } }) => doc.artifacts?.transcript ?? null,
}))
vi.mock('@/lib/repositories/transcript-segments-repo', () => ({ getTranscriptSegments: async () => h.segmente }))
vi.mock('@/lib/db/llm-models-repo', () => ({ getDefaultLlmModel: async () => ({ modelId: 'google/gemini-test' }) }))
vi.mock('@/lib/chat/common/llm', () => ({ callLlmJson: h.llm }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

async function post(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/library/[libraryId]/transcript-correction/suggest/route')
  const req = new Request('http://localhost/api/library/lib-1/transcript-correction/suggest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return POST(req as unknown as Parameters<typeof POST>[0], { params: Promise.resolve({ libraryId: 'lib-1' }) })
}

describe('transcript-correction/suggest — Korrektur-Assistent', () => {
  beforeEach(() => {
    h.llm.mockReset()
    h.docs.clear()
    h.segmente = { segments: [{ text: 'Grazie Assunta.' }, { text: 'Frau Britzko hat gesagt, das stimmt.' }, { text: 'Ich habe eine Frage.' }] }
    h.docs.set('flyer', { sourceId: 'flyer', sourceName: 'Flyer.pdf', parentId: 'p', artifacts: { transcript: { markdown: '---\n---\nReferentinnen: Sascha Britsko, Assunta Corbo', updatedAt: 'x', createdAt: 'x' } } })
  })

  it('schickt Auftrag, Begleittext und nummerierte Saetze; gibt gepruefte Vorschlaege zurueck', async () => {
    h.llm.mockResolvedValue({ data: {
      korrekturen: [{ satz: 1, alt: 'Britzko', neu: 'Britsko', grund: 'Flyer' }, { satz: 1, alt: 'gibt es nicht', neu: 'x' }],
      sprecher: [{ ab_satz: 1, name: 'Sascha Britsko', rolle: 'Referentin' }, { ab_satz: 2, name: 'Publikum', rolle: 'Publikum' }, { ab_satz: 0, name: 'Erfundene Person' }],
    }, usage: { totalTokens: 1234 } })
    const res = await post({ sourceId: 'audio', begleitSourceIds: ['flyer'], auftrag: 'Finde Hoerfehler.' })
    expect(res.status).toBe(200)
    const json = await res.json()
    const nachricht = (h.llm.mock.calls[0] as unknown as [{ messages: Array<{ content: string }> }])[0].messages[0].content
    expect(nachricht).toContain('Finde Hoerfehler.')
    expect(nachricht).toContain('### Flyer.pdf')
    expect(nachricht).toContain('[1] Frau Britzko hat gesagt')
    expect(json.korrekturen).toEqual([{ id: 'k1-0', satz: 1, alt: 'Britzko', neu: 'Britsko', grund: 'Flyer' }])
    expect(json.sprecher.map((s: { name: string }) => s.name)).toEqual(['Sascha Britsko', 'Publikum'])
    expect(json.verworfen).toHaveLength(2)
    expect(json.tokens).toBe(1234)
  })

  it('ohne Auftrag 400, ohne Saetze 409 (zuerst neu transkribieren)', async () => {
    expect((await post({ sourceId: 'audio', auftrag: '  ' })).status).toBe(400)
    h.segmente = null
    const res = await post({ sourceId: 'audio', auftrag: 'x' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('keine_saetze')
  })

  it('fehlendes Begleit-Transkript ist ein Fehler mit Namen, kein stilles Weglassen', async () => {
    const res = await post({ sourceId: 'audio', begleitSourceIds: ['fehlt'], auftrag: 'x' })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('begleittext_fehlt')
    expect(h.llm).not.toHaveBeenCalled()
  })
})
