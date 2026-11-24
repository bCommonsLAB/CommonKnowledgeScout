/**
 * @fileoverview Verzeichnis einer neuen Library: anlegen, was fehlt, und beim
 * Scheitern den Grund nennen — Verbindung oder nur der Ordner.
 */

import { describe, it, expect, vi } from 'vitest'
import type { StorageProvider } from '@/lib/storage/types'

vi.mock('@/lib/storage/server-provider-wurzel', () => ({ getServerProviderAnVerbindungsWurzel: vi.fn() }))

import { diagnoseVerzeichnis, legeVerzeichnisAn, stelleZielordnerSicher } from '@/lib/mcp/bibliothek-zielordner'

/** Speicher als Baum im Speicher: Ordner-Id = Pfad. */
function speicher(ordner: string[]) {
  const vorhanden = new Set(ordner)
  const p = {
    listItemsById: vi.fn(async (id: string) => {
      const eltern = id === 'root' ? '' : `${id}/`
      return [...vorhanden].filter((o) => o.startsWith(eltern) && !o.slice(eltern.length).includes('/') && o !== id)
        .map((o) => ({ id: o, type: 'folder', metadata: { name: o.slice(eltern.length) } }))
    }),
    createFolder: vi.fn(async (parentId: string, name: string) => {
      const id = parentId === 'root' ? name : `${parentId}/${name}`
      vorhanden.add(id)
      return { id, type: 'folder', metadata: { name } }
    }),
  }
  return { provider: p as unknown as StorageProvider, vorhanden }
}

describe('legeVerzeichnisAn', () => {
  it('legt nur fehlende Segmente an und nennt sie', async () => {
    const { provider, vorhanden } = speicher(['Archiv'])
    expect(await legeVerzeichnisAn(provider, '/Archiv/Konferenz/2026/')).toEqual({ angelegt: ['Archiv/Konferenz', 'Archiv/Konferenz/2026'] })
    expect(vorhanden.has('Archiv/Konferenz/2026')).toBe(true)
  })
})

describe('stelleZielordnerSicher', () => {
  const kopf = { userEmail: 'a@example.org', libraryId: 'lib' }

  it('meldet angelegt, vorhanden und die Wurzel', async () => {
    const { provider } = speicher(['Da'])
    const wurzelProvider = async () => provider
    expect(await stelleZielordnerSicher({ ...kopf, verzeichnis: 'Neu/Unter', hatVerbindung: true, wurzelProvider })).toEqual({ status: 'angelegt', verzeichnis: 'Neu/Unter', angelegt: ['Neu', 'Neu/Unter'] })
    expect(await stelleZielordnerSicher({ ...kopf, verzeichnis: 'Da', hatVerbindung: true, wurzelProvider })).toEqual({ status: 'vorhanden', verzeichnis: 'Da' })
    expect(await stelleZielordnerSicher({ ...kopf, verzeichnis: '/', hatVerbindung: true, wurzelProvider })).toEqual({ status: 'vorhanden', verzeichnis: '/' })
  })

  it('prueft ohne Verbindung nichts und sagt das', async () => {
    const r = await stelleZielordnerSicher({ ...kopf, verzeichnis: 'X', hatVerbindung: false })
    expect(r.status).toBe('nicht_geprueft')
  })

  it('nennt den Grund, wenn das Anlegen scheitert, statt zu werfen', async () => {
    const r = await stelleZielordnerSicher({ ...kopf, verzeichnis: 'X', hatVerbindung: true, wurzelProvider: async () => { throw new Error('401 Unauthorized') } })
    expect(r).toEqual({ status: 'fehler', verzeichnis: 'X', grund: '401 Unauthorized' })
  })
})

describe('diagnoseVerzeichnis', () => {
  const kopf = { userEmail: 'a@example.org', libraryId: 'lib', hatVerbindung: true }

  it('unterscheidet fehlendes Verzeichnis von einer Verbindung, die nicht antwortet', async () => {
    const { provider } = speicher(['Archiv'])
    const fehlt = await diagnoseVerzeichnis({ ...kopf, verzeichnis: 'Archiv/Neu', wurzelProvider: async () => provider })
    expect(fehlt).toMatchObject({ verbindungAntwortet: true, verzeichnisFehlt: 'Archiv/Neu' })
    const tot = await diagnoseVerzeichnis({ ...kopf, verzeichnis: 'Archiv/Neu', wurzelProvider: async () => { throw new Error('ECONNREFUSED') } })
    expect(tot).toMatchObject({ verbindungAntwortet: false, verzeichnisFehlt: null })
    expect(tot?.grund).toContain('ECONNREFUSED')
  })

  it('sagt nichts, wo nichts zu sagen ist', async () => {
    expect(await diagnoseVerzeichnis({ ...kopf, verzeichnis: '', wurzelProvider: async () => speicher([]).provider })).toBeNull()
    expect(await diagnoseVerzeichnis({ ...kopf, hatVerbindung: false, verzeichnis: 'X' })).toBeNull()
  })
})
