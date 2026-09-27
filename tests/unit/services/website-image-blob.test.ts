/**
 * B3 — Website-Bilder im Blob: Konvention, Ueberschreib-Schutz, Fehler ohne Schluessel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  exists: vi.fn(async () => false),
  uploadData: vi.fn(async () => ({})),
  blobs: [] as Array<{ name: string; properties: { contentLength?: number } }>,
}))

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      accountName: 'konto',
      getContainerClient: () => ({
        getBlockBlobClient: () => ({ exists: h.exists, uploadData: h.uploadData }),
        listBlobsFlat: async function* () { for (const b of h.blobs) yield b },
      }),
    }),
  },
}))

import {
  bildContentType, listeWebsiteBilder, veroeffentlicheWebsiteBild, websiteBildUrl, websiteBildZiel,
} from '@/lib/services/website-image-blob'

beforeEach(() => {
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'AccountName=konto;Key=x'
  delete process.env.AZURE_STORAGE_CONTAINER_NAME
  h.exists.mockReset().mockResolvedValue(false)
  h.uploadData.mockClear()
  h.blobs.length = 0
})

describe('websiteBildZiel / websiteBildUrl', () => {
  it('baut die Blob-Konvention <container>/<libraryId>/website/images/<name>', () => {
    const ziel = websiteBildZiel('lib-1')
    expect(ziel.containerName).toBe('knowledgescout')
    expect(websiteBildUrl(ziel, 'hero.png')).toBe('https://konto.blob.core.windows.net/knowledgescout/lib-1/website/images/hero.png')
  })

  it('ohne Verbindungsschluessel: Fehler mit Variablennamen, kein Rueckfall', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING
    expect(() => websiteBildZiel('lib-1')).toThrow(/AZURE_STORAGE_CONNECTION_STRING/)
  })
})

describe('veroeffentlicheWebsiteBild', () => {
  it('laedt ein neues Bild mit Content-Type hoch', async () => {
    const r = await veroeffentlicheWebsiteBild({ ziel: websiteBildZiel('lib-1'), dateiname: 'a.jpg', buffer: Buffer.from('x'), ueberschreiben: false })
    expect(r).toMatchObject({ dateiname: 'a.jpg', vorhanden: false, bytes: 1 })
    expect(h.uploadData).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ blobHTTPHeaders: expect.objectContaining({ blobContentType: 'image/jpeg' }) }))
  })

  it('vorhandener Blob bleibt ohne ueberschreiben stehen', async () => {
    h.exists.mockResolvedValueOnce(true)
    const r = await veroeffentlicheWebsiteBild({ ziel: websiteBildZiel('lib-1'), dateiname: 'a.jpg', buffer: Buffer.from('x'), ueberschreiben: false })
    expect(r.vorhanden).toBe(true)
    expect(h.uploadData).not.toHaveBeenCalled()
  })

  it('mit ueberschreiben wird ersetzt, ohne exists zu fragen', async () => {
    await veroeffentlicheWebsiteBild({ ziel: websiteBildZiel('lib-1'), dateiname: 'a.png', buffer: Buffer.from('x'), ueberschreiben: true })
    expect(h.exists).not.toHaveBeenCalled()
    expect(h.uploadData).toHaveBeenCalled()
  })

  it('Nicht-Bilder werden abgewiesen', async () => {
    await expect(veroeffentlicheWebsiteBild({ ziel: websiteBildZiel('lib-1'), dateiname: 'seite.html', buffer: Buffer.from('x'), ueberschreiben: true }))
      .rejects.toThrow(/kein bekanntes Bildformat/)
    expect(bildContentType('x.webp')).toBe('image/webp')
    expect(bildContentType('x.pdf')).toBeNull()
  })
})

describe('listeWebsiteBilder', () => {
  it('liefert Dateiname, URL und Groesse je Blob unter dem Praefix', async () => {
    h.blobs.push({ name: 'lib-1/website/images/hero.png', properties: { contentLength: 42 } })
    const bilder = await listeWebsiteBilder(websiteBildZiel('lib-1'))
    expect(bilder).toEqual([{ dateiname: 'hero.png', url: 'https://konto.blob.core.windows.net/knowledgescout/lib-1/website/images/hero.png', bytes: 42 }])
  })
})
