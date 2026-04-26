/**
 * Characterization Tests: OneDriveProvider.listItemsById
 *
 * Welle 1, Schritt 3 (Char-Tests vor dem Modul-Split).
 *
 * Strategie (siehe `02-contracts.md`):
 * - Wir mocken globalThis.fetch (Microsoft Graph API + interne API-Routen).
 * - Auth-Pfad wird umgangen, indem `accessToken`, `refreshToken`, `tokenExpiry`,
 *   `authenticated` und `baseFolderId` direkt gesetzt werden.
 * - Tests fixieren das beobachtete Verhalten (auch Edge-Cases), damit der
 *   Schritt-4-Split die API nicht versehentlich aendert.
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
    id: 'lib-onedrive-1',
    label: 'OneDrive Test',
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

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OneDriveProvider.listItemsById', () => {
  it('liefert StorageItems mit korrekt gemapptem MIME-Typ und Parent', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 'file-1',
            name: 'doc.pdf',
            size: 1024,
            lastModifiedDateTime: '2026-04-26T10:00:00Z',
            file: { mimeType: 'application/pdf' },
            parentReference: { id: 'root' },
          },
          {
            id: 'folder-1',
            name: 'sub',
            size: 0,
            lastModifiedDateTime: '2026-04-26T10:00:00Z',
            folder: { childCount: 3 },
            parentReference: { id: 'root' },
          },
        ],
      }),
    )

    const items = await provider.listItemsById('root')

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'file-1',
      type: 'file',
      parentId: 'root',
      metadata: { name: 'doc.pdf', size: 1024, mimeType: 'application/pdf' },
    })
    expect(items[0].metadata.modifiedAt).toBeInstanceOf(Date)
    expect(items[1]).toMatchObject({
      id: 'folder-1',
      type: 'folder',
      metadata: { mimeType: 'application/folder' },
    })
  })

  it('aggregiert Items ueber mehrere Pagination-Seiten via @odata.nextLink', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: 'file-1',
              name: 'a.txt',
              size: 1,
              lastModifiedDateTime: '2026-04-26T10:00:00Z',
              file: { mimeType: 'text/plain' },
              parentReference: { id: 'root' },
            },
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page-2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: 'file-2',
              name: 'b.txt',
              size: 2,
              lastModifiedDateTime: '2026-04-26T10:00:00Z',
              file: { mimeType: 'text/plain' },
              parentReference: { id: 'root' },
            },
          ],
        }),
      )

    const items = await provider.listItemsById('folder-x')

    expect(items.map((i) => i.id)).toEqual(['file-1', 'file-2'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('verwendet bei folderId="root" mit baseFolderId !== "root" den baseFolderId-Endpunkt', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)
    ;(provider as unknown as ProviderInternals).baseFolderId = 'base-123'

    fetchMock.mockResolvedValueOnce(jsonResponse({ value: [] }))

    await provider.listItemsById('root')

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('/drive/items/base-123/children')
    expect(calledUrl).not.toContain('/drive/root/children')
  })

  it('liefert exakt das selbe Promise bei parallelem Aufruf desselben folderId (Deduplizierung)', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    let resolveFetch: (value: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const p1 = provider.listItemsById('folder-dup')
    const p2 = provider.listItemsById('folder-dup')

    resolveFetch(jsonResponse({ value: [] }))

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(r2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wirft StorageError mit code "API_ERROR" bei nicht-OK-Response von Microsoft Graph', async () => {
    const provider = new OneDriveProvider(makeLibrary())
    authenticate(provider)

    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { message: 'Insufficient privileges' } },
        { status: 403, statusText: 'Forbidden' },
      ),
    )

    let caught: unknown
    try {
      await provider.listItemsById('any-folder')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(StorageError)
    expect(caught).toMatchObject({ code: 'API_ERROR', provider: 'lib-onedrive-1' })
  })
})
