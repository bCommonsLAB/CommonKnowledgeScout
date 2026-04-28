/**
 * @fileoverview Tests fuer composite-transformations API-Route (GET + POST).
 *
 * Mockt Clerk, LibraryService, Storage-Provider, Mongo-Pool-Lookup,
 * sowie das Build-Helper-Modul (composite-transcript), damit die Route ohne
 * MongoDB lokal laeuft.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (muessen VOR dem Import der Route gesetzt werden) ───
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

vi.mock('@/lib/services/library-service', () => ({
  LibraryService: {
    getInstance: vi.fn(() => ({
      getLibrary: vi.fn(),
    })),
  },
}))

vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

vi.mock('@/lib/creation/composite-transformations-pool', () => ({
  findCommonTemplatesForSources: vi.fn(),
}))

vi.mock('@/lib/creation/composite-transcript', () => ({
  buildCompositeReference: vi.fn().mockResolvedValue({
    markdown: '---\n_source_files: ["a.pdf/tmpl","b.pdf/tmpl"]\nkind: composite-transcript\n---\nbody',
    sourceFileNames: ['a.pdf', 'b.pdf'],
    missingTranscripts: [],
    mediaFiles: [],
  }),
}))

function makeProviderMock(siblings: Array<{ id: string; type: 'file' | 'folder'; metadata: { name: string } }> = []) {
  return {
    listItemsById: vi.fn().mockResolvedValue(siblings),
    uploadFile: vi.fn(async (parentId: string, file: File) => ({
      id: 'new-file-id',
      parentId,
      type: 'file',
      metadata: { name: file.name, size: file.size, modifiedAt: new Date(), mimeType: file.type },
    })),
  }
}

async function setupAuthenticatedRequest(): Promise<{ providerMock: ReturnType<typeof makeProviderMock> }> {
  const { auth, currentUser } = await import('@clerk/nextjs/server')
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-1' })
  ;(currentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    emailAddresses: [{ emailAddress: 'u@example.com' }],
  })

  const { LibraryService } = await import('@/lib/services/library-service')
  ;(LibraryService.getInstance as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    getLibrary: vi.fn().mockResolvedValue({ id: 'lib-1', name: 'Test' }),
  })

  const providerMock = makeProviderMock()
  const { getServerProvider } = await import('@/lib/storage/server-provider')
  ;(getServerProvider as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(providerMock)

  return { providerMock }
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/composite-transformations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/library/lib-1/composite-transformations?${query}`, {
    method: 'GET',
  })
}

const goodSourceItems = [
  { id: 'a', name: 'a.pdf', parentId: 'p' },
  { id: 'b', name: 'b.pdf', parentId: 'p' },
]

describe('POST /api/library/[libraryId]/composite-transformations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(makePostRequest({}), { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fewer than 2 sources are provided', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: [{ id: 'a', name: 'a.pdf', parentId: 'p' }], templateName: 'tmpl', filename: 'x.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Mindestens 2/)
  })

  it('returns 400 when sources have different parentIds', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({
        sourceItems: [
          { id: 'a', name: 'a.pdf', parentId: 'p1' },
          { id: 'b', name: 'b.pdf', parentId: 'p2' },
        ],
        templateName: 'tmpl',
        filename: 'x.md',
      }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/selben Verzeichnis/)
  })

  it('returns 400 when templateName is missing', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: goodSourceItems, filename: 'x.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/templateName/)
  })

  it('returns 400 when template is not in pool', async () => {
    await setupAuthenticatedRequest()
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'other-tmpl', coveredSources: ['a.pdf', 'b.pdf'], missingSources: [] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: goodSourceItems, templateName: 'tmpl', filename: 'x.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/keiner der Quellen vorhanden/)
    expect(body.availableTemplates).toEqual(['other-tmpl'])
  })

  it('returns 400 when template is partial coverage', async () => {
    await setupAuthenticatedRequest()
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'tmpl', coveredSources: ['a.pdf'], missingSources: ['b.pdf'] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: goodSourceItems, templateName: 'tmpl', filename: 'x.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/fehlt bei 1/)
    expect(body.missingSources).toEqual(['b.pdf'])
  })

  it('returns 400 when filename is invalid', async () => {
    await setupAuthenticatedRequest()
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'tmpl', coveredSources: ['a.pdf', 'b.pdf'], missingSources: [] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: goodSourceItems, templateName: 'tmpl', filename: 'no/slashes.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Ungueltiger Dateiname/)
  })

  it('returns 409 on filename collision', async () => {
    const { providerMock } = await setupAuthenticatedRequest()
    providerMock.listItemsById.mockResolvedValue([
      { id: 'existing', type: 'file', metadata: { name: 'sammel.md' } },
    ])
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'tmpl', coveredSources: ['a.pdf', 'b.pdf'], missingSources: [] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({ sourceItems: goodSourceItems, templateName: 'tmpl', filename: 'sammel.md' }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(409)
  })

  it('returns 200 and persists file on happy path', async () => {
    const { providerMock } = await setupAuthenticatedRequest()
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'tmpl', coveredSources: ['a.pdf', 'b.pdf'], missingSources: [] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await POST(
      makePostRequest({
        sourceItems: goodSourceItems,
        templateName: 'tmpl',
        filename: 'sammel',
      }),
      { params: Promise.resolve({ libraryId: 'lib-1' }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.file.name).toBe('sammel.md')
    expect(body.templateName).toBe('tmpl')
    expect(providerMock.uploadFile).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/library/[libraryId]/composite-transformations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null })

    const { GET } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await GET(makeGetRequest('sourceIds=a&sourceNames=a.pdf'), {
      params: Promise.resolve({ libraryId: 'lib-1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 400 when sourceIds is missing', async () => {
    await setupAuthenticatedRequest()

    const { GET } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await GET(makeGetRequest(''), { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when sourceIds and sourceNames have different lengths', async () => {
    await setupAuthenticatedRequest()

    const { GET } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await GET(makeGetRequest('sourceIds=a,b&sourceNames=a.pdf'), {
      params: Promise.resolve({ libraryId: 'lib-1' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 200 with templates array on happy path', async () => {
    await setupAuthenticatedRequest()
    const { findCommonTemplatesForSources } = await import('@/lib/creation/composite-transformations-pool')
    ;(findCommonTemplatesForSources as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      templates: [{ templateName: 'tmpl-x', coveredSources: ['a.pdf'], missingSources: [] }],
      sourcesWithoutShadowTwin: 0,
    })

    const { GET } = await import('@/app/api/library/[libraryId]/composite-transformations/route')
    const res = await GET(makeGetRequest('sourceIds=a&sourceNames=a.pdf&targetLanguage=de'), {
      params: Promise.resolve({ libraryId: 'lib-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.templates).toHaveLength(1)
    expect(body.templates[0].templateName).toBe('tmpl-x')
    expect(body.targetLanguage).toBe('de')
  })
})
