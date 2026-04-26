/**
 * Characterization Tests: OneDriveProvider.getBinary
 *
 * Welle 1, Schritt 3.
 *
 * `getBinary` ist eine der komplexesten Methoden im OneDrive-Provider:
 * - Erkennt Item-IDs vs. Base64-kodierte Pfade.
 * - Loest Pfade ueber Microsoft Graph (`root:/path`) auf.
 * - Macht zwei Folge-Calls: Item-Info (fuer MIME-Typ) + Content.
 * - Wirft StorageError fuer Folder-IDs und Root-IDs.
 *
 * Diese Tests fixieren die beobachtete API, damit der Schritt-4-Split
 * (`onedrive/binary.ts`) keine Drift erzeugt.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OneDriveProvider } from '@/lib/storage/onedrive-provider'
import { StorageError } from '@/lib/storage/types'
import type { ClientLibrary } from '@/types/library'

interface ProviderInternals {
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: number
  authenticated: boolean
  baseFolderId: string | null
  basePath: string
}

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-onedrive-binary',
    label: 'OneDrive Binary Test',
    type: 'onedrive',
    path: '',
    isEnabled: true,
    config: {},
    ...overrides,
  }
}

function authenticate(provider: OneDriveProvider): void {
  const internals = provider as unknown as ProviderInternals
  internals.accessToken = 'fake-access-token'
  internals.refreshToken = 'fake-refresh-token'
  internals.tokenExpiry = Date.now() + 60 * 60 * 1000
  internals.authenticated = true
  internals.baseFolderId = 'root'
  internals.basePath = ''
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function blobResponse(content: string, mimeType: string): Response {
  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': mimeType },
  })
}

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OneDriveProvider.getBinary', () => {
  it('liefert Blob + MIME-Typ fuer eine OneDrive-Item-ID (zwei Calls: Info + Content)', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: '01XERETUL7BWNVHE3CV5CJ65TLD5WNPOTG',
          name: 'doc.pdf',
          size: 1024,
          lastModifiedDateTime: '2026-04-26T10:00:00Z',
          file: { mimeType: 'application/pdf' },
          parentReference: { id: 'root' },
        }),
      )
      .mockResolvedValueOnce(blobResponse('PDF-CONTENT', 'application/pdf'))

    const result = await provider.getBinary('01XERETUL7BWNVHE3CV5CJ65TLD5WNPOTG')

    expect(result.mimeType).toBe('application/pdf')
    expect(result.blob).toBeInstanceOf(Blob)
    expect(await result.blob.text()).toBe('PDF-CONTENT')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const infoUrl = String(fetchMock.mock.calls[0][0])
    const contentUrl = String(fetchMock.mock.calls[1][0])
    expect(infoUrl).toContain('/drive/items/01XERETUL7BWNVHE3CV5CJ65TLD5WNPOTG')
    expect(contentUrl).toMatch(/\/drive\/items\/[^/]+\/content$/)
  })

  it('wirft StorageError "INVALID_OPERATION" fuer fileId="root"', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    let caught: unknown
    try {
      await provider.getBinary('root')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StorageError)
    expect(caught).toMatchObject({ code: 'INVALID_OPERATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('wirft StorageError "INVALID_OPERATION", wenn die ID einen Ordner referenziert', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'FOLDERIDXXXXXXXXXXXXXXXXXXXXXXXXX',
        name: 'sub',
        size: 0,
        lastModifiedDateTime: '2026-04-26T10:00:00Z',
        folder: { childCount: 1 },
        parentReference: { id: 'root' },
      }),
    )

    let caught: unknown
    try {
      await provider.getBinary('FOLDERIDXXXXXXXXXXXXXXXXXXXXXXXXX')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StorageError)
    expect(caught).toMatchObject({ code: 'INVALID_OPERATION' })
  })

  it('loest Base64-kodierten Pfad auf, bevor Item-Info + Content geladen werden', async () => {
    const provider = new OneDriveProvider(makeLibrary({ path: 'Library' }))
    authenticate(provider)
    ;(provider as unknown as ProviderInternals).basePath = '/Library'

    const path = 'sub/file.pdf'
    const base64Path = Buffer.from(path, 'utf-8').toString('base64')

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resolved-id',
          name: 'file.pdf',
          size: 10,
          lastModifiedDateTime: '2026-04-26T10:00:00Z',
          file: { mimeType: 'application/pdf' },
          parentReference: { id: 'root' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resolved-id',
          name: 'file.pdf',
          size: 10,
          lastModifiedDateTime: '2026-04-26T10:00:00Z',
          file: { mimeType: 'application/pdf' },
          parentReference: { id: 'root' },
        }),
      )
      .mockResolvedValueOnce(blobResponse('PDF', 'application/pdf'))

    const result = await provider.getBinary(base64Path)

    expect(result.mimeType).toBe('application/pdf')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const pathResolveUrl = String(fetchMock.mock.calls[0][0])
    expect(pathResolveUrl).toContain('/drive/root:/Library%2Fsub%2Ffile.pdf')
  })

  it('liefert StorageError "API_ERROR", wenn Item-Info-Call mit non-OK antwortet', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { message: 'Item not found' } },
        { status: 404, statusText: 'Not Found' },
      ),
    )

    let caught: unknown
    try {
      await provider.getBinary('01XERETUL7BWNVHE3CV5CJ65TLD5WNPOTG')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StorageError)
    expect(caught).toMatchObject({ code: 'API_ERROR' })
  })
})
