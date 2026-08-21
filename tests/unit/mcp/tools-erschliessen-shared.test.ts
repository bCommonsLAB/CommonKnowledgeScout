/**
 * @fileoverview Unit-Tests: Stapel-Semantik der Erschliessungs-Werkzeuge (C3).
 *
 * Fehler EINER Quelle brechen den Stapel nicht ab; Eingabe-Kombinationen
 * werden hart geprueft (kein Raten).
 */

import { describe, it, expect } from 'vitest'
import type { StorageProvider } from '@/lib/storage/types'
import { runForSources } from '@/lib/mcp/tools-erschliessen-shared'

const provider = {
  getItemById: async (id: string) =>
    id === 'kaputt'
      ? null
      : { id, type: 'file', parentId: 'parent-1', metadata: { name: `${id}.m4a` } },
} as unknown as StorageProvider

describe('runForSources (C3 — Stapelbetrieb)', () => {
  it('startet jede Quelle einzeln; ein Fehler bricht den Stapel nicht ab', async () => {
    const result = await runForSources({
      provider,
      sourceIds: ['a', 'kaputt', 'b'],
      start: async (source) => {
        if (source.name === 'b.m4a') throw new Error('kein Transkript')
        return `job-${source.itemId}`
      },
    })
    expect(result.gestartet).toBe(1)
    expect(result.gescheitert).toBe(2)
    expect(result.zeilen).toEqual([
      { quelle: 'a.m4a', jobId: 'job-a' },
      { quelle: 'kaputt', fehler: expect.stringContaining('keine Datei') },
      { quelle: 'b.m4a', fehler: 'kein Transkript' },
    ])
  })

  it('Einzelaufruf via sourceId bleibt eine Zeile (Bestandsverhalten)', async () => {
    const result = await runForSources({
      provider,
      sourceId: 'a',
      start: async () => 'job-1',
    })
    expect(result.zeilen).toEqual([{ quelle: 'a.m4a', jobId: 'job-1' }])
  })

  it('Eingabe-Kombinationen werden hart geprueft (kein Raten)', async () => {
    const start = async () => 'job'
    await expect(runForSources({ provider, start })).rejects.toThrow(/Pflicht/)
    await expect(
      runForSources({ provider, sourceId: 'a', sourceIds: ['b'], start }),
    ).rejects.toThrow(/nicht beides/)
  })
})
