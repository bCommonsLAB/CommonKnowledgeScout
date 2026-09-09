/**
 * @fileoverview Tests: MCP-Werkzeug `themen_setzen` prueft gegen das Vokabular (Wunschliste 5, A1).
 *
 * Vorher wurde jeder Name geschrieben; die Werkbank bildet ihr Vokabular aus
 * Konfiguration PLUS allem, was je gepflegt wurde — ein Tippfehler wurde so
 * selbst zum Vokabular. Jetzt: unbekannt → abgewiesen mit Vorschlag, nichts
 * geschrieben; `neuesThemaErlauben: true` → geschrieben und als `neueThemen`
 * in der Antwort (und damit im Protokoll) benannt; ohne konfiguriertes
 * Vokabular → geschrieben, aber `vokabularPruefung` sagt es.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  setzeThemen: vi.fn(),
  requireLibrary: vi.fn(),
  requireProvider: vi.fn(),
  registriert: new Map<string, { schema: Record<string, unknown>; handler: (args: never) => Promise<unknown> }>(),
}))

vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({
  protokolliereAktion: vi.fn().mockResolvedValue(undefined),
  MAX_BEGRUENDUNG: 500,
}))
vi.mock('@/lib/agent-view/themen-schreiben', () => ({ setzeThemen: h.setzeThemen }))
vi.mock('@/lib/agent-view/stand-ausfuehren', () => ({ baueIndexPorts: () => ({ marke: 'ports' }) }))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    mcpUserEmail: () => 'a@b.c',
    requireLibrary: h.requireLibrary,
    requireProvider: h.requireProvider,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message, code: (fehler as { code?: string }).code }),
  }
})

import { registerThemenTool } from '@/lib/mcp/tools-themen'

const server = {
  registerTool: (name: string, schema: Record<string, unknown>, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, { schema, handler })
  },
} as never

function aufrufen(args: Record<string, unknown>) {
  const eintrag = h.registriert.get('themen_setzen')
  if (!eintrag) throw new Error('themen_setzen nicht registriert')
  return eintrag.handler({ libraryId: 'L', folderId: 'F', erwarteteThemen: null, begruendung: 'Test', ...args } as never)
}

function libraryMit(themen: string[] | undefined) {
  h.requireLibrary.mockResolvedValue({ config: { agentView: themen ? { themen } : {} } })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.registriert.clear()
  registerThemenTool(server)
  h.requireProvider.mockResolvedValue({ marke: 'provider' })
  h.setzeThemen.mockResolvedValue({ themen: ['KS-Plattform'], indexAngelegt: false })
  libraryMit(['KS-Plattform', 'KS-Datenmodell', 'ACT-Klima'])
})

describe('themen_setzen: Vokabular-Riegel', () => {
  it('bekannte Namen werden geschrieben, die Pruefung ist in der Antwort benannt', async () => {
    const antwort = await aufrufen({ themen: ['KS-Plattform', 'ACT-Klima'] })
    expect(h.setzeThemen).toHaveBeenCalledTimes(1)
    expect(h.setzeThemen.mock.calls[0][1]).toEqual(['KS-Plattform', 'ACT-Klima'])
    expect(antwort).toMatchObject({ ok: true, wert: { vokabularPruefung: 'geprueft' } })
    expect((antwort as { wert: Record<string, unknown> }).wert).not.toHaveProperty('neueThemen')
  })

  it('Tippfehler wird abgewiesen: nichts geschrieben, Vorschlag in der Meldung', async () => {
    const antwort = await aufrufen({ themen: ['KS-Datenmodel'] })
    expect(h.setzeThemen).not.toHaveBeenCalled()
    expect(h.requireProvider).not.toHaveBeenCalled()
    expect(antwort).toMatchObject({ ok: false, code: 'thema_unbekannt' })
    expect((antwort as { fehler: string }).fehler).toContain('KS-Datenmodell')
  })

  it('neuesThemaErlauben: true schreibt und nennt das neue Thema in der Antwort', async () => {
    const antwort = await aufrufen({ themen: ['KS-Plattform', 'KS-Neu'], neuesThemaErlauben: true })
    expect(h.setzeThemen).toHaveBeenCalledTimes(1)
    expect(antwort).toMatchObject({ ok: true, wert: { neueThemen: ['KS-Neu'], vokabularPruefung: 'geprueft' } })
  })

  it('ohne konfiguriertes Vokabular wird geschrieben, die Antwort sagt es', async () => {
    libraryMit(undefined)
    const antwort = await aufrufen({ themen: ['Irgendwas'] })
    expect(h.setzeThemen).toHaveBeenCalledTimes(1)
    expect(antwort).toMatchObject({ ok: true, wert: { vokabularPruefung: 'kein_vokabular_konfiguriert', vokabular: null } })
  })

  it('leeres Vokabular zaehlt wie keines', async () => {
    libraryMit([])
    const antwort = await aufrufen({ themen: ['Irgendwas'] })
    expect(h.setzeThemen).toHaveBeenCalledTimes(1)
    expect(antwort).toMatchObject({ ok: true, wert: { vokabularPruefung: 'kein_vokabular_konfiguriert' } })
  })

  it('erwarteteThemen wird unveraendert an den Schreibweg gereicht', async () => {
    await aufrufen({ themen: ['ACT-Klima'], erwarteteThemen: ['KS-Plattform'] })
    expect(h.setzeThemen.mock.calls[0][3]).toEqual({ erwarteteThemen: ['KS-Plattform'], indexAnlegen: false })
  })
})

describe('themen_setzen: Ordner unterhalb des Vorhabens (Wunschliste 5, B3)', () => {
  it('indexAnlegen wird an den Schreibweg gereicht und die Antwort sagt es', async () => {
    h.setzeThemen.mockResolvedValue({ themen: ['ACT-Klima'], indexAngelegt: true })
    const antwort = await aufrufen({ themen: ['ACT-Klima'], indexAnlegen: true })
    expect(h.setzeThemen.mock.calls[0][3]).toEqual({ erwarteteThemen: null, indexAnlegen: true })
    expect(antwort).toMatchObject({ ok: true, wert: { gesetzt: { indexAngelegt: true } } })
  })

  it('Stapel: jeder Ordner wird genau einmal geschrieben, mit derselben Liste', async () => {
    const antwort = await aufrufen({ folderId: undefined, folderIds: ['f-1', 'f-2', 'f-3'], themen: ['ACT-Klima'] })
    expect(h.setzeThemen).toHaveBeenCalledTimes(3)
    expect(h.setzeThemen.mock.calls.map((call) => call[0])).toEqual(['f-1', 'f-2', 'f-3'])
    expect(h.setzeThemen.mock.calls.map((call) => call[1])).toEqual([['ACT-Klima'], ['ACT-Klima'], ['ACT-Klima']])
    expect(antwort).toMatchObject({ ok: true, wert: { ok: true, gesetzt: 3, gescheitert: 0 } })
  })

  it('Stapel: ein gescheiterter Ordner steht in seiner Zeile, ok wird false', async () => {
    h.setzeThemen
      .mockResolvedValueOnce({ themen: ['ACT-Klima'], indexAngelegt: false })
      .mockRejectedValueOnce(Object.assign(new Error('kein Index'), { code: 'kein_index' }))
    const antwort = await aufrufen({ folderId: undefined, folderIds: ['f-1', 'f-2'], themen: ['ACT-Klima'] })
    expect(h.setzeThemen).toHaveBeenCalledTimes(2)
    const wert = (antwort as { wert: { ok: boolean; gescheitert: number; zeilen: Array<Record<string, unknown>> } }).wert
    expect(wert.ok).toBe(false)
    expect(wert.gescheitert).toBe(1)
    expect(wert.zeilen[1]).toMatchObject({ folderId: 'f-2', code: 'kein_index' })
  })

  it('ein unbekanntes Thema stoppt den GANZEN Stapel vor dem ersten Schreibweg', async () => {
    const antwort = await aufrufen({ folderId: undefined, folderIds: ['f-1', 'f-2'], themen: ['KS-Datenmodel'] })
    expect(h.setzeThemen).not.toHaveBeenCalled()
    expect(h.requireProvider).not.toHaveBeenCalled()
    expect(antwort).toMatchObject({ ok: false, code: 'thema_unbekannt' })
  })

  it('folderId und folderIds zusammen: kein Schreibweg, benannter Fehler', async () => {
    const antwort = await aufrufen({ folderIds: ['f-2'], themen: ['ACT-Klima'] })
    expect(h.setzeThemen).not.toHaveBeenCalled()
    expect(h.requireLibrary).not.toHaveBeenCalled()
    expect(antwort).toMatchObject({ ok: false })
    expect((antwort as { fehler: string }).fehler).toMatch(/nicht beides/)
  })

  it('folderIds liefert Zeilen, auch bei EINEM Ordner — die Form haengt an der Adressierung', async () => {
    const antwort = await aufrufen({ folderId: undefined, folderIds: ['f-1'], themen: ['ACT-Klima'] })
    expect(antwort).toMatchObject({ ok: true, wert: { ok: true, gesetzt: 1, zeilen: [{ folderId: 'f-1' }] } })
    expect((antwort as { wert: Record<string, unknown> }).wert).not.toHaveProperty('gesetzt.themen')
  })

  it('der Einzelaufruf meldet einen Fehlschlag weiterhin als Fehler, nicht als Zeile', async () => {
    h.setzeThemen.mockRejectedValue(Object.assign(new Error('kein Index'), { code: 'kein_index' }))
    const antwort = await aufrufen({ themen: ['ACT-Klima'] })
    expect(antwort).toMatchObject({ ok: false, code: 'kein_index' })
  })
})
