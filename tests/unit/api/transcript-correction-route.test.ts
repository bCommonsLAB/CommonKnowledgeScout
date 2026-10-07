import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * P3b: Reiter „Korrektur" — Schreib-Route. Clerk, LibraryService, Laden und
 * Schreiben sind gemockt; geprueft wird der Riegel (409), alles-oder-nichts
 * (422) und dass die Vorschau nichts schreibt.
 */

const h = vi.hoisted(() => ({
  schreibe: vi.fn(async () => undefined),
  record: { markdown: '', updatedAt: '2026-10-08T09:00:00.000Z', createdAt: '2026-10-07T00:00:00.000Z' },
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user-1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'peter@example.com' }] }),
}))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: async () => ({ id: 'lib-1', config: {} }) }) },
}))
vi.mock('@/lib/shadow-twin/shadow-twin-config', () => ({ getShadowTwinConfig: () => ({ persistToFilesystem: false }) }))
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: vi.fn() }))
vi.mock('@/lib/transkript-korrektur/schreiben', () => ({
  schreibeTranskriptKorrektur: h.schreibe,
  transformationenVon: () => [{ pfad: 'x.de.vortrag.md', template: 'vortrag', sprache: 'de', jetztUeberholt: true }],
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: async () => new Map([[
    'src-1',
    { sourceId: 'src-1', sourceName: 'a.m4a', parentId: 'p', artifacts: { transcript: h.record, transformation: {} } },
  ]]),
  readTranscriptRecord: (doc: { artifacts?: { transcript?: unknown } }) => doc.artifacts?.transcript ?? null,
}))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

const MARKDOWN = '---\nspeakers: ["Stück 1 Sprecher A"]\ngenerated_by: "knowledgescout/pipeline"\n---\n\n**Stück 1 Sprecher A:** Frau Mahler spricht.\n'

async function post(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/library/[libraryId]/transcript-correction/route')
  const req = new Request('http://localhost/api/library/lib-1/transcript-correction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return POST(req as unknown as Parameters<typeof POST>[0], { params: Promise.resolve({ libraryId: 'lib-1' }) })
}

async function get(sourceId: string) {
  const { GET } = await import('@/app/api/library/[libraryId]/transcript-correction/route')
  const req = new Request(`http://localhost/api/library/lib-1/transcript-correction?sourceId=${sourceId}`)
  return GET(req as unknown as Parameters<typeof GET>[0], { params: Promise.resolve({ libraryId: 'lib-1' }) })
}

const basis = {
  sourceId: 'src-1', begruendung: 'Namen laut Einladung', ifUpdatedAt: '2026-10-08T09:00:00.000Z',
  ersetzungen: [{ alt: 'Frau Mahler', neu: 'Frau Mahlknecht' }],
  sprecher: [{ label: 'Stück 1 Sprecher A', name: 'Dr. Anna Mahlknecht' }],
}

describe('transcript-correction Route (P3b)', () => {
  beforeEach(() => {
    h.schreibe.mockClear()
    h.record.markdown = MARKDOWN
    h.record.updatedAt = '2026-10-08T09:00:00.000Z'
  })

  it('GET liefert den Zustand ohne Body: updatedAt, speakers, Transformationen', async () => {
    const res = await get('src-1')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.updatedAt).toBe('2026-10-08T09:00:00.000Z')
    expect(json.speakers).toEqual(['Stück 1 Sprecher A'])
    expect(json.hatPraefixe).toBe(true)
    expect(json.transformationen).toHaveLength(1)
    expect(JSON.stringify(json)).not.toContain('Frau Mahler spricht')
  })

  it('schreibt mit Revisions-Stempel des Anwenders und meldet Belege und speakerNames', async () => {
    const res = await post(basis)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.geschrieben).toBe(true)
    expect(json.revision.revised_by).toBe('peter@example.com')
    expect(json.speakerNames).toEqual(['Stück 1 Sprecher A: Dr. Anna Mahlknecht'])
    expect(json.belege).toHaveLength(2)
    expect(h.schreibe).toHaveBeenCalledTimes(1)
    const markdownNeu = (h.schreibe.mock.calls[0] as unknown as [{ markdownNeu: string }])[0].markdownNeu
    expect(markdownNeu).toContain('**Dr. Anna Mahlknecht:** Frau Mahlknecht spricht.')
    expect(markdownNeu).toContain('revised_by: "peter@example.com"')
  })

  it('409 bei veraltetem ifUpdatedAt — nichts geschrieben', async () => {
    const res = await post({ ...basis, ifUpdatedAt: '2026-10-08T08:00:00.000Z' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('konflikt')
    expect(h.schreibe).not.toHaveBeenCalled()
  })

  it('422 bei nicht gefundener Stelle — alles oder nichts', async () => {
    const res = await post({ ...basis, ersetzungen: [{ alt: 'gibt es nicht', neu: 'x' }] })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('nicht_gefunden')
    expect(h.schreibe).not.toHaveBeenCalled()
  })

  it('Vorschau schreibt nichts, liefert aber Belege', async () => {
    const res = await post({ ...basis, nurVorschau: true })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.geschrieben).toBe(false)
    expect(json.belege).toHaveLength(2)
    expect(h.schreibe).not.toHaveBeenCalled()
  })

  it('400 ohne begruendung oder ifUpdatedAt', async () => {
    expect((await post({ ...basis, begruendung: '' })).status).toBe(400)
    expect((await post({ ...basis, ifUpdatedAt: undefined })).status).toBe(400)
  })
})
