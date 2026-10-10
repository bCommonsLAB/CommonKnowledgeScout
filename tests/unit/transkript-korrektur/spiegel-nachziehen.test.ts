import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/shadow-twin/sync-engine/run-library-sync', () => ({ runLibrarySync: vi.fn() }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { planeSpiegelExport, spiegelExportOffen } from '@/lib/transkript-korrektur/spiegel-nachziehen'

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('planeSpiegelExport', () => {
  it('buendelt schnelle Aenderungen derselben Quelle zu EINEM Export nach der letzten', async () => {
    const exportieren = vi.fn(async () => undefined)
    planeSpiegelExport({ libraryId: 'lib', userEmail: 'u', sourceId: 'a', verzoegerungMs: 30, exportieren })
    await warte(15)
    planeSpiegelExport({ libraryId: 'lib', userEmail: 'u', sourceId: 'a', verzoegerungMs: 30, exportieren })
    expect(spiegelExportOffen('lib', 'a')).toBe(true)
    await warte(20)
    expect(exportieren).not.toHaveBeenCalled() // der zweite Aufruf hat den Timer verschoben
    await warte(20)
    expect(exportieren).toHaveBeenCalledTimes(1)
    expect(exportieren).toHaveBeenCalledWith({ libraryId: 'lib', userEmail: 'u', sourceId: 'a' })
    expect(spiegelExportOffen('lib', 'a')).toBe(false)
  })

  it('verschiedene Quellen laufen getrennt', async () => {
    const exportieren = vi.fn(async () => undefined)
    planeSpiegelExport({ libraryId: 'lib', userEmail: 'u', sourceId: 'b', verzoegerungMs: 10, exportieren })
    planeSpiegelExport({ libraryId: 'lib', userEmail: 'u', sourceId: 'c', verzoegerungMs: 10, exportieren })
    await warte(30)
    expect(exportieren).toHaveBeenCalledTimes(2)
  })

  it('ein fehlgeschlagener Export wird laut protokolliert, nicht verschluckt', async () => {
    const { FileLogger } = await import('@/lib/debug/logger')
    planeSpiegelExport({ libraryId: 'lib', userEmail: 'u', sourceId: 'd', verzoegerungMs: 10, exportieren: async () => { throw new Error('WebDAV weg') } })
    await warte(30)
    expect(FileLogger.error).toHaveBeenCalledWith('transcript-correction', expect.stringContaining('NICHT nachgezogen'), expect.objectContaining({ error: 'WebDAV weg' }))
  })
})
