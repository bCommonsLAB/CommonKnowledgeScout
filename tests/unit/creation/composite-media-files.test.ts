// @vitest-environment node
/**
 * Medien einer Sammeldatei (`_media_files`) als Fragmente am Twin registrieren.
 *
 * Provider und Twin-Dienste sind Stummel: der Provider kennt einen kleinen
 * Ordnerbaum, der ShadowTwinService zaehlt Uploads. Geprueft wird, dass
 * Pfade aufgeloest, Bilder hochgeladen, vorhandene Fragmente uebersprungen
 * und Nicht-Bilder gemeldet werden.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploads: Array<{ fileName: string; mimeType: string; size: number }> = []
const fragmenteVorhanden: Array<{ name: string; size: number; url?: string; variant?: string }> = []

vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
  ShadowTwinService: {
    create: vi.fn(async () => ({
      uploadBinaryFragment: vi.fn(async (opts: { fileName: string; mimeType: string; buffer: Buffer }) => {
        uploads.push({ fileName: opts.fileName, mimeType: opts.mimeType, size: opts.buffer.length })
        return { name: opts.fileName, resolvedUrl: 'https://blob/' + opts.fileName }
      }),
    })),
  },
}))
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: vi.fn(async () => ({ id: 'lib-1' })) }) },
}))
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinBinaryFragments: vi.fn(async () => fragmenteVorhanden),
}))
vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import {
  parseCompositeMediaFilesFromMeta,
  registerCompositeMediaFragments,
} from '@/lib/creation/composite-media-files'

const BAUM: Record<string, Array<{ id: string; name: string; type: 'file' | 'folder' }>> = {
  mk: [
    { id: 'karte', name: 'karte-01.md', type: 'file' },
    { id: 'pp', name: 'pdfs-pngs', type: 'folder' },
  ],
  pp: [
    { id: 'prev', name: 'previews', type: 'folder' },
    { id: 'notiz', name: 'notiz.txt', type: 'file' },
  ],
  prev: [{ id: 'k1', name: 'k1.png', type: 'file' }, { id: 'karte-pdf', name: 'karte-01_front.pdf', type: 'file' }],
  root: [],
}

function stummelProvider(): StorageProvider {
  return {
    listItemsById: async (folderId: string): Promise<StorageItem[]> =>
      (BAUM[folderId] ?? []).map((k) => ({ id: k.id, type: k.type, parentId: folderId, metadata: { name: k.name } })) as unknown as StorageItem[],
    getBinary: async (id: string) => ({
      blob: new Blob([Buffer.from(id === 'k1' ? 'PNGDATEN' : id === 'karte-pdf' ? '%PDF-1.4' : 'txt')]),
      mimeType: id === 'k1' ? 'image/png' : id === 'karte-pdf' ? 'application/pdf' : 'text/plain',
    }),
  } as unknown as StorageProvider
}

beforeEach(() => {
  uploads.length = 0
  fragmenteVorhanden.length = 0
})

describe('parseCompositeMediaFilesFromMeta', () => {
  it('liest Array und JSON-String, ignoriert Leeres', () => {
    expect(parseCompositeMediaFilesFromMeta({ _media_files: ['a.png', ''] })).toEqual(['a.png'])
    expect(parseCompositeMediaFilesFromMeta({ _media_files: '["b.png"]' })).toEqual(['b.png'])
    expect(parseCompositeMediaFilesFromMeta({})).toEqual([])
  })
})

describe('registerCompositeMediaFragments', () => {
  it('loest den Pfad auf und laedt das Bild als Fragment hoch', async () => {
    const r = await registerCompositeMediaFragments({
      libraryId: 'lib-1', userEmail: 'u@e.com', provider: stummelProvider(),
      compositeSourceId: 'karte', compositeFileName: 'karte-01.md', parentId: 'mk',
      mediaFiles: ['pdfs-pngs/previews/k1.png'],
    })
    expect(r.registered).toEqual(['k1.png'])
    expect(r.unresolved).toEqual([])
    expect(uploads).toEqual([{ fileName: 'k1.png', mimeType: 'image/png', size: 8 }])
  })

  it('laedt nicht erneut hoch, wenn ein gleich grosses Fragment mit URL schon haengt', async () => {
    fragmenteVorhanden.push({ name: 'k1.png', size: 8, url: 'https://blob/k1.png', variant: 'original' })
    const r = await registerCompositeMediaFragments({
      libraryId: 'lib-1', userEmail: 'u@e.com', provider: stummelProvider(),
      compositeSourceId: 'karte', compositeFileName: 'karte-01.md', parentId: 'mk',
      mediaFiles: ['pdfs-pngs/previews/k1.png'],
    })
    expect(r.registered).toEqual(['k1.png'])
    expect(uploads).toEqual([])
  })

  it('registriert PDFs als Dokument-Fragmente (Anhaenge fuer attachments_url)', async () => {
    const r = await registerCompositeMediaFragments({
      libraryId: 'lib-1', userEmail: 'u@e.com', provider: stummelProvider(),
      compositeSourceId: 'karte', compositeFileName: 'karte-01.md', parentId: 'mk',
      mediaFiles: ['pdfs-pngs/previews/karte-01_front.pdf'],
    })
    expect(r.registered).toEqual(['karte-01_front.pdf'])
    expect(uploads).toEqual([{ fileName: 'karte-01_front.pdf', mimeType: 'application/pdf', size: 8 }])
  })

  it('meldet Unbekanntes und Nicht-Bilder als unresolved, statt sie zu uebergehen', async () => {
    const r = await registerCompositeMediaFragments({
      libraryId: 'lib-1', userEmail: 'u@e.com', provider: stummelProvider(),
      compositeSourceId: 'karte', compositeFileName: 'karte-01.md', parentId: 'mk',
      mediaFiles: ['pdfs-pngs/notiz.txt', 'pdfs-pngs/fehlt.png'],
    })
    expect(r.registered).toEqual([])
    expect(r.unresolved).toEqual(['pdfs-pngs/notiz.txt', 'pdfs-pngs/fehlt.png'])
    expect(uploads).toEqual([])
  })
})
