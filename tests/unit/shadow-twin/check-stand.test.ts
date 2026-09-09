/**
 * @fileoverview Riegel fuer das Fingerabdruck-Tor des check-Modus (Stufe 1).
 *
 * Befund 09.09.2026 (Owner-Log): Ein `abdeckung_scannen` liess den Check jede
 * Markdown-Datei jeder Twin-Familie vollstaendig laden — rund 330 ms je Datei
 * gegen OneDrive, bei 200 Dateien ueber eine Minute nur fuers Lesen.
 *
 * Der entscheidende Beweis ist deshalb ein GEZAEHLTES `getBinary`: ein zweiter
 * Check ueber ein unveraendertes Archiv darf den Storage-Inhalt NULL Mal
 * anfassen und muss trotzdem dieselbe Zeile liefern. Alles andere hier prueft
 * die Gegenrichtung — jede Aenderung, die den Plan beeinflussen kann, muss das
 * Tor wieder oeffnen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runLibrarySync } from '@/lib/shadow-twin/sync-engine/run-library-sync'
import { SYNC_ENGINE_VERSION } from '@/lib/shadow-twin/sync-engine/check-stand'
import type { ShadowTwinCheckStand, ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const LIB = 'lib-1'
const USER = 'peter@example.com'
const SOURCE_ID = 'f-doc'
const TWIN_FOLDER = 'twin-1'

// --- Mongo-Bestand (in-memory) -----------------------------------------------

let twinDoc: ShadowTwinDocument

const repoMocks = vi.hoisted(() => ({
  getShadowTwinsBySourceIds: vi.fn(),
  getAllShadowTwins: vi.fn(),
}))
vi.mock('@/lib/repositories/shadow-twin-repo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/repositories/shadow-twin-repo')>()),
  ...repoMocks,
}))

const standMocks = vi.hoisted(() => ({ setCheckStand: vi.fn(), clearCheckStand: vi.fn() }))
vi.mock('@/lib/repositories/shadow-twin-check-stand', () => standMocks)

vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibrary: async () => ({ id: LIB, config: {} }) }) },
}))

let provider: StorageProvider & { getBinary: ReturnType<typeof vi.fn> }
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: async () => provider }))

// --- Storage-Bestand (in-memory) ---------------------------------------------

function file(id: string, name: string, parentId: string, size = 100): StorageItem {
  return {
    id, type: 'file', parentId,
    metadata: { name, size, modifiedAt: new Date('2026-09-01T10:00:00Z'), mimeType: 'text/markdown' },
  } as unknown as StorageItem
}
function folder(id: string, name: string, parentId: string): StorageItem {
  return {
    id, type: 'folder', parentId,
    metadata: { name, size: 0, modifiedAt: new Date('2026-09-01T10:00:00Z'), mimeType: 'application/folder' },
  } as unknown as StorageItem
}

let baum: Record<string, StorageItem[]>
/** Ordner, deren Listing fehlschlaegt (Test „Listing kaputt"). */
let kaputteOrdner: Set<string>

function makeProvider(): void {
  provider = {
    listItemsById: vi.fn(async (id: string) => {
      if (kaputteOrdner.has(id)) throw new Error(`Ordner nicht lesbar: ${id}`)
      return baum[id] ?? []
    }),
    getBinary: vi.fn(async () => ({ blob: new Blob(['# doc\n\nInhalt']) })),
    getItemById: vi.fn(async (id: string) => {
      const item = Object.values(baum).flat().find((it) => it.id === id)
      if (!item) throw new Error(`Item nicht gefunden: ${id}`)
      return item
    }),
  } as unknown as StorageProvider & { getBinary: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
  baum = {
    root: [file(SOURCE_ID, 'doc.pdf', 'root', 5000), folder(TWIN_FOLDER, '_doc.pdf', 'root')],
    [TWIN_FOLDER]: [file('f-md', 'doc.md', TWIN_FOLDER, 120)],
  }
  kaputteOrdner = new Set()
  twinDoc = {
    libraryId: LIB, sourceId: SOURCE_ID, sourceName: 'doc.pdf', parentId: 'root', userEmail: USER,
    artifacts: { transcript: { markdown: '# doc\n\nInhalt', createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-01T09:00:00Z' } },
    filesystemSync: { enabled: true, shadowTwinFolderId: TWIN_FOLDER, lastSyncedAt: null },
    createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-01T09:00:00Z',
  }
  repoMocks.getShadowTwinsBySourceIds.mockImplementation(async () => new Map([[SOURCE_ID, twinDoc]]))
  repoMocks.getAllShadowTwins.mockImplementation(async () => [twinDoc])
  // Schreibweg wie in Mongo: der abgelegte Stand ist beim naechsten Lauf da.
  standMocks.setCheckStand.mockImplementation(async (args: { checkStand: ShadowTwinCheckStand }) => {
    twinDoc = { ...twinDoc, checkStand: args.checkStand }
  })
  standMocks.clearCheckStand.mockImplementation(async () => {
    twinDoc = { ...twinDoc, checkStand: undefined }
  })
  makeProvider()
})

function check(overrides: { erzwingen?: boolean } = {}) {
  return runLibrarySync({ libraryId: LIB, userEmail: USER, mode: 'check', preset: 'repair', scope: { folderId: 'root' }, ...overrides })
}

describe('Fingerabdruck-Tor — Wiederverwendung', () => {
  it('zweiter Check bei unveraendertem Bestand: NULL getBinary, identische Zeile', async () => {
    const ersterLauf = await check()
    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(ersterLauf.gelesen).toBe(1)
    expect(ersterLauf.wiederverwendet).toBe(0)
    expect(standMocks.setCheckStand).toHaveBeenCalledTimes(1)

    provider.getBinary.mockClear()
    const zweiterLauf = await check()

    expect(provider.getBinary).not.toHaveBeenCalled()
    expect(zweiterLauf.wiederverwendet).toBe(1)
    expect(zweiterLauf.gelesen).toBe(0)
    expect(zweiterLauf.sources).toEqual(ersterLauf.sources)
    // Die Zaehler muessen mitziehen — sonst waere ein billiger Lauf von einem
    // leeren nicht zu unterscheiden.
    expect(zweiterLauf.planned).toEqual(ersterLauf.planned)
    expect(zweiterLauf.changed).toBe(ersterLauf.changed)
    expect(zweiterLauf.conflicts).toBe(ersterLauf.conflicts)
  })

  it('erzwingen: true umgeht das Tor und liest wieder', async () => {
    await check()
    provider.getBinary.mockClear()

    const bericht = await check({ erzwingen: true })

    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(bericht.wiederverwendet).toBe(0)
    expect(bericht.gelesen).toBe(1)
  })
})

describe('Fingerabdruck-Tor — was es wieder oeffnet', () => {
  it('geaenderte Dateigroesse im Listing: voller Weg, Stand wird neu geschrieben', async () => {
    await check()
    const vorher = twinDoc.checkStand?.fingerabdruck
    provider.getBinary.mockClear()
    standMocks.setCheckStand.mockClear()

    baum[TWIN_FOLDER] = [file('f-md', 'doc.md', TWIN_FOLDER, 999)]
    const bericht = await check()

    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(bericht.wiederverwendet).toBe(0)
    expect(standMocks.setCheckStand).toHaveBeenCalledTimes(1)
    expect(twinDoc.checkStand?.fingerabdruck).not.toBe(vorher)
  })

  it('neueres updatedAt am Dokument: voller Weg', async () => {
    await check()
    provider.getBinary.mockClear()

    twinDoc = { ...twinDoc, updatedAt: '2026-09-05T08:00:00Z' }
    const bericht = await check()

    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(bericht.wiederverwendet).toBe(0)
    expect(twinDoc.checkStand?.mongoUpdatedAt).toBe('2026-09-05T08:00:00Z')
  })

  it('andere engineVersion im gespeicherten Stand: voller Weg', async () => {
    await check()
    provider.getBinary.mockClear()

    twinDoc = {
      ...twinDoc,
      checkStand: { ...(twinDoc.checkStand as ShadowTwinCheckStand), engineVersion: `${SYNC_ENGINE_VERSION}-alt` },
    }
    const bericht = await check()

    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(bericht.wiederverwendet).toBe(0)
    expect(twinDoc.checkStand?.engineVersion).toBe(SYNC_ENGINE_VERSION)
  })

  it('Listing des Twin-Ordners schlaegt fehl: voller Weg, Stand bleibt, Fehler steht in der Zeile', async () => {
    await check()
    const gespeichert = twinDoc.checkStand
    expect(gespeichert).toBeDefined()
    standMocks.setCheckStand.mockClear()

    kaputteOrdner.add(TWIN_FOLDER)
    const bericht = await check()

    expect(bericht.wiederverwendet).toBe(0)
    expect(bericht.errors).toBe(1)
    expect(bericht.sources[0].error).toContain('Ordner nicht lesbar')
    // Kein neuer Stand — der alte bleibt unangetastet.
    expect(standMocks.setCheckStand).not.toHaveBeenCalled()
    expect(twinDoc.checkStand).toBe(gespeichert)
  })

  it('Modus repair verwendet NIE wieder, auch bei gleichem Fingerabdruck', async () => {
    await check()
    expect(twinDoc.checkStand).toBeDefined()
    provider.getBinary.mockClear()
    standMocks.setCheckStand.mockClear()

    const bericht = await runLibrarySync({
      libraryId: LIB, userEmail: USER, mode: 'repair', preset: 'repair', scope: { folderId: 'root' },
    })

    expect(provider.getBinary.mock.calls.length).toBeGreaterThan(0)
    expect(bericht.wiederverwendet).toBe(0)
    expect(bericht.gelesen).toBe(1)
    // Im repair-Modus wird kein Stand fortgeschrieben.
    expect(standMocks.setCheckStand).not.toHaveBeenCalled()
  })
})
