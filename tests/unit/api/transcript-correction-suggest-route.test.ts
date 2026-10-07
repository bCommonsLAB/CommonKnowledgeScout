import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * P3b: Vorschlags-Route. Laedt Transkript und Begleittexte server-seitig,
 * reicht Secretary-Fehler mit Status und Code durch, misst die 600k-Grenze vorab.
 */

const h = vi.hoisted(() => ({
  hole: vi.fn(),
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
vi.mock('@/lib/transkript-korrektur/vorschlag', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/transkript-korrektur/vorschlag')>()
  return { ...original, holeKorrekturvorschlag: h.hole }
})
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

function rec(markdown: string) {
  return { markdown, updatedAt: '2026-10-08T09:00:00.000Z', createdAt: '2026-10-07T00:00:00.000Z' }
}

async function post(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/library/[libraryId]/transcript-correction/suggest/route')
  const req = new Request('http://localhost/api/library/lib-1/transcript-correction/suggest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return POST(req as unknown as Parameters<typeof POST>[0], { params: Promise.resolve({ libraryId: 'lib-1' }) })
}

describe('transcript-correction/suggest Route (P3b)', () => {
  beforeEach(() => {
    h.hole.mockReset()
    h.docs.clear()
    h.docs.set('audio', { sourceId: 'audio', sourceName: 'a.m4a', parentId: 'p', artifacts: { transcript: rec('---\ntype: "transcript"\n---\n**Stück 1 Sprecher A:** Hallo') } })
    h.docs.set('flyer', { sourceId: 'flyer', sourceName: 'flyer.pdf', parentId: 'p', artifacts: { transcript: rec('---\ntype: "transcript"\n---\nReferentin: Dr. Anna Mahlknecht') } })
    h.docs.set('ohne', { sourceId: 'ohne', sourceName: 'ohne.pdf', parentId: 'p', artifacts: {} })
  })

  it('schickt Body ohne Frontmatter und Begleittexte mit Namen an den Secretary', async () => {
    h.hole.mockResolvedValue({ ersetzungen: [], sprecher: [{ label: 'Stück 1 Sprecher A', name: 'Dr. Anna Mahlknecht', begruendung: 'Einladung', beleg: 'einladung' }], verworfen: [], modell: 'm', tokens: 1, dauer_ms: 2 })
    const res = await post({ sourceId: 'audio', begleitSourceIds: ['flyer'] })
    expect(res.status).toBe(200)
    expect((await res.json()).sprecher).toHaveLength(1)
    const args = h.hole.mock.calls[0][0] as { transkript: string; begleittexte: Array<{ name: string; text: string }>; zielsprache: string }
    expect(args.transkript).toBe('**Stück 1 Sprecher A:** Hallo')
    expect(args.begleittexte).toEqual([{ name: 'flyer.pdf', text: 'Referentin: Dr. Anna Mahlknecht' }])
    expect(args.zielsprache).toBe('de')
  })

  it('Begleitdokument ohne Transkript: 400 mit Namen, kein Secretary-Aufruf', async () => {
    const res = await post({ sourceId: 'audio', begleitSourceIds: ['ohne'] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('ohne')
    expect(h.hole).not.toHaveBeenCalled()
  })

  it('reicht Secretary-Fehler mit Status und Code durch', async () => {
    const { SecretaryVorschlagError } = await import('@/lib/transkript-korrektur/vorschlag')
    h.hole.mockRejectedValue(new SecretaryVorschlagError(503, 'NO_MODEL_CONFIGURED', 'kein Modell'))
    const res = await post({ sourceId: 'audio', begleitSourceIds: [] })
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('NO_MODEL_CONFIGURED')
  })

  it('404 ohne Transkript der Quelle', async () => {
    expect((await post({ sourceId: 'ohne', begleitSourceIds: [] })).status).toBe(404)
  })
})
