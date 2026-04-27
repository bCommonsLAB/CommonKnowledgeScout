/**
 * @fileoverview Unit-Tests für die composite-multi API-Route.
 *
 * Geprüft wird:
 * - Auth (401 ohne userId)
 * - Validation (400 bei <2, >10, Nicht-Bild, ungültigem Filename)
 * - Kollision (409 bei existierendem Filename)
 * - Happy-Path (200, Datei gespeichert)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Clerk mocken
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}))

// LibraryService mocken
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: {
    getInstance: vi.fn(() => ({
      getLibrary: vi.fn(),
    })),
  },
}))

// Storage-Provider mocken
vi.mock('@/lib/storage/server-provider', () => ({
  getServerProvider: vi.fn(),
}))

/**
 * Erzeugt einen POST-Request mit JSON-Body.
 */
function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/composite-multi', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Setzt Standard-Mocks für authentifizierte Requests mit valider Library.
 */
async function setupAuthenticatedRequest(): Promise<{ providerMock: ReturnType<typeof makeProviderMock> }> {
  const { auth, currentUser } = await import('@clerk/nextjs/server')
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-1' })
  ;(currentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    emailAddresses: [{ emailAddress: 'u@example.com' }],
  })

  const { LibraryService } = await import('@/lib/services/library-service')
  const getInstanceMock = LibraryService.getInstance as unknown as ReturnType<typeof vi.fn>
  getInstanceMock.mockReturnValue({
    getLibrary: vi.fn().mockResolvedValue({ id: 'lib-1', name: 'Test' }),
  })

  const providerMock = makeProviderMock()
  const { getServerProvider } = await import('@/lib/storage/server-provider')
  ;(getServerProvider as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(providerMock)

  return { providerMock }
}

/**
 * Erzeugt einen Provider-Mock mit konfigurierbaren Siblings und uploadFile-Verhalten.
 */
function makeProviderMock(opts?: { siblings?: Array<{ id: string; type: 'file' | 'folder'; metadata: { name: string } }> }) {
  const siblings = opts?.siblings ?? []
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

describe('POST /api/library/[libraryId]/composite-multi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({})
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(401)
  })

  it('returns 404 when library is not found', async () => {
    const { auth, currentUser } = await import('@clerk/nextjs/server')
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-1' })
    ;(currentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      emailAddresses: [{ emailAddress: 'u@example.com' }],
    })

    const { LibraryService } = await import('@/lib/services/library-service')
    const getInstanceMock = LibraryService.getInstance as unknown as ReturnType<typeof vi.fn>
    getInstanceMock.mockReturnValue({
      getLibrary: vi.fn().mockResolvedValue(null),
    })

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({ sourceItems: [], filename: 'foo.md' })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(404)
  })

  it('returns 400 when fewer than 2 sources are provided', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [{ id: 'a', name: 'a.jpg', parentId: 'p' }],
      filename: 'foo.md',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Mindestens 2 Bilder/i)
  })

  it('returns 400 when more than 10 sources are provided', async () => {
    await setupAuthenticatedRequest()

    const sourceItems = Array.from({ length: 11 }, (_, i) => ({
      id: `id-${i}`,
      name: `p_${i}.jpeg`,
      parentId: 'p',
    }))

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({ sourceItems, filename: 'foo.md' })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Maximal 10 Bilder/i)
  })

  it('returns 400 when a non-image source is provided', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [
        { id: 'a', name: 'a.jpg', parentId: 'p' },
        { id: 'b', name: 'doc.pdf', parentId: 'p' },
      ],
      filename: 'foo.md',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Nur Bild-Quellen|doc\.pdf/)
  })

  it('returns 400 when filename is empty or invalid', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')

    const cases = [
      '',
      '../etc/passwd',
      'no/slashes.md',
      'no:colons.md',
      'wrong.txt',
    ]
    for (const filename of cases) {
      const req = makePostRequest({
        sourceItems: [
          { id: 'a', name: 'a.jpg', parentId: 'p' },
          { id: 'b', name: 'b.jpg', parentId: 'p' },
        ],
        filename,
      })
      const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })
      expect(res.status, `filename=${JSON.stringify(filename)}`).toBe(400)
    }
  })

  it('returns 400 when sources have different parentIds', async () => {
    await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [
        { id: 'a', name: 'a.jpg', parentId: 'p1' },
        { id: 'b', name: 'b.jpg', parentId: 'p2' },
      ],
      filename: 'foo.md',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/selben Verzeichnis/i)
  })

  it('returns 409 when filename already exists', async () => {
    const { providerMock } = await setupAuthenticatedRequest()
    providerMock.listItemsById.mockResolvedValue([
      { id: 'existing-id', type: 'file', metadata: { name: 'foo.md' } },
    ])

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [
        { id: 'a', name: 'a.jpg', parentId: 'p' },
        { id: 'b', name: 'b.jpg', parentId: 'p' },
      ],
      filename: 'foo.md',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/existiert bereits/i)
    expect(body.existingFileId).toBe('existing-id')
  })

  it('happy path: persists composite and returns 200 with file metadata', async () => {
    const { providerMock } = await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [
        { id: 'a', name: 'page_009.jpeg', parentId: 'p' },
        { id: 'b', name: 'page_010.jpeg', parentId: 'p' },
        { id: 'c', name: 'page_011.jpeg', parentId: 'p' },
      ],
      filename: 'cortina_zusammenstellung.md',
      title: 'CORTINA Zusammenstellung',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.file.name).toBe('cortina_zusammenstellung.md')
    expect(body.file.parentId).toBe('p')
    expect(body.sourceFileNames).toEqual(['page_009.jpeg', 'page_010.jpeg', 'page_011.jpeg'])

    // uploadFile wurde mit dem korrekten parentId und Dateinamen aufgerufen
    expect(providerMock.uploadFile).toHaveBeenCalledTimes(1)
    const [calledParentId, calledFile] = providerMock.uploadFile.mock.calls[0]
    expect(calledParentId).toBe('p')
    expect(calledFile.name).toBe('cortina_zusammenstellung.md')
    expect(calledFile.type).toBe('text/markdown')
  })

  it('appends .md extension automatically if user provided filename without extension', async () => {
    const { providerMock } = await setupAuthenticatedRequest()

    const { POST } = await import('@/app/api/library/[libraryId]/composite-multi/route')
    const req = makePostRequest({
      sourceItems: [
        { id: 'a', name: 'a.jpg', parentId: 'p' },
        { id: 'b', name: 'b.jpg', parentId: 'p' },
      ],
      filename: 'meine_sammlung',
    })
    const res = await POST(req, { params: Promise.resolve({ libraryId: 'lib-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.file.name).toBe('meine_sammlung.md')
    expect(providerMock.uploadFile.mock.calls[0][1].name).toBe('meine_sammlung.md')
  })
})
