/**
 * @fileoverview Stapel von `datei_von_adresse_holen`: jede Adresse hat ihr
 * eigenes Ergebnis, nichts wird ueberschrieben, nichts verschwindet still.
 */

import { describe, it, expect, vi } from 'vitest'
import type { StorageProvider } from '@/lib/storage/types'
import type { GeholteDatei } from '@/lib/web-source/datei-holen'

vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({ MAX_BEGRUENDUNG: 500, protokolliereAktion: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return { LIBRARY_ID: z.string(), jsonResult: vi.fn(), mcpUserEmail: vi.fn(), requireLibrary: vi.fn(), requireProvider: vi.fn() }
})

import { holeInOrdner } from '@/lib/mcp/storage/tools-adresse-holen'

function datei(name: string): GeholteDatei {
  return { buffer: Buffer.from('%PDF-1.7'), dateiname: name, mimeType: 'application/pdf', bytes: 8, sha256: 'abc', endAdresse: `https://a.example/${name}`, abgerufenAm: '2026-01-01T00:00:00.000Z' }
}

function provider(vorhanden: string[]) {
  const hochgeladen: string[] = []
  const p = {
    listItemsById: vi.fn().mockResolvedValue(vorhanden.map((name) => ({ id: name, type: 'file', metadata: { name } }))),
    uploadFile: vi.fn(async (_ordner: string, file: File) => {
      hochgeladen.push(file.name)
      return { id: `id-${file.name}`, type: 'file', metadata: { name: file.name } }
    }),
  }
  return { provider: p as unknown as StorageProvider, hochgeladen }
}

describe('holeInOrdner', () => {
  it('legt ab, lehnt ab und meldet Vorhandenes — je Adresse, in Eingabe-Reihenfolge', async () => {
    const { provider: p, hochgeladen } = provider(['Schon Da.pdf'])
    const hole = vi.fn(async (url: string) => {
      if (url.endsWith('/kaputt')) throw new Error('HTTP 403 — nichts geschrieben')
      return datei(url.endsWith('/da') ? 'schon da.pdf' : 'neu.pdf')
    })
    const r = await holeInOrdner({
      provider: p, ordnerId: 'o1', ordnerPfad: 'Ordner/Unter',
      auftraege: [{ url: 'https://a.example/neu' }, { url: 'https://a.example/kaputt' }, { url: 'https://a.example/da' }, { url: 'https://a.example/neu2' }],
      hole,
    })
    expect(r.map((e) => e.status)).toEqual(['abgelegt', 'abgelehnt', 'vorhanden', 'vorhanden'])
    expect(r[0]).toMatchObject({ pfad: 'Ordner/Unter/neu.pdf', id: 'id-neu.pdf', sha256: 'abc', groesse: 8 })
    expect(r[1]).toMatchObject({ grund: 'HTTP 403 — nichts geschrieben' })
    expect(hochgeladen).toEqual(['neu.pdf'])
  })

  it('schreibt nicht in geschuetzte Pfade', async () => {
    const { provider: p, hochgeladen } = provider([])
    const r = await holeInOrdner({ provider: p, ordnerId: 'o1', ordnerPfad: 'Ordner/_twin', auftraege: [{ url: 'https://a.example/x' }], hole: async () => datei('x.pdf') })
    expect(r[0].status).toBe('abgelehnt')
    expect(hochgeladen).toEqual([])
  })

  it('meldet nicht begonnene Adressen, wenn das Zeitbudget verbraucht ist', async () => {
    const { provider: p } = provider([])
    let uhr = 0
    const hole = vi.fn(async (url: string) => {
      uhr += 600
      return datei(`${url.split('/').pop()}.pdf`)
    })
    const auftraege = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ url: `https://a.example/${n}` }))
    const r = await holeInOrdner({ provider: p, ordnerId: 'o1', ordnerPfad: 'O', auftraege, hole, jetzt: () => uhr, zeitbudgetMs: 1000 })
    expect(r.filter((e) => e.status === 'abgelegt').length).toBeGreaterThan(0)
    expect(r.filter((e) => e.status === 'nicht_begonnen').length).toBeGreaterThan(0)
    expect(r.every((e) => e !== undefined)).toBe(true)
    expect(hole.mock.calls.length).toBeLessThan(5)
  })
})
