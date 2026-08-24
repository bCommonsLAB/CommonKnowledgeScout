/**
 * @fileoverview Tests: MCP-Werkzeug `stand_setzen` (F8-Nachzug zur Bruecke).
 *
 * Der Punkt der Welle: Die Bruecke schreibt `bearbeitungsstand` NICHT mehr an
 * den Schutzstufen vorbei, sondern ueber `fuehreStandAus` — und `abgenommen`
 * ist hier nicht setzbar (menschliche Selbstauskunft). Provider, Repo und die
 * Schreiboperation sind gemockt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  ausfuehren: vi.fn(),
  getReport: vi.fn(),
  requireLibrary: vi.fn(),
  requireProvider: vi.fn(),
  registriert: new Map<string, { schema: Record<string, unknown>; handler: (args: never) => Promise<unknown> }>(),
}))

vi.mock('@/lib/agent-view/stand-ausfuehren', () => ({ fuehreStandAus: h.ausfuehren }))
vi.mock('@/lib/repositories/agent-view-coverage-repo', () => ({ getCoverageReport: h.getReport }))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    FOLDER_ID: z.string(),
    mcpUserEmail: () => 'a@b.c',
    requireLibrary: h.requireLibrary,
    requireProvider: h.requireProvider,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message }),
  }
})

import { registerStandTool, STAND_WERTE_BRUECKE } from '@/lib/mcp/tools-stand'

const server = {
  registerTool: (name: string, schema: Record<string, unknown>, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, { schema, handler })
  },
} as never

function aufrufen(args: Record<string, unknown>) {
  const eintrag = h.registriert.get('stand_setzen')
  if (!eintrag) throw new Error('stand_setzen nicht registriert')
  return eintrag.handler(args as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.registriert.clear()
  registerStandTool(server)
  h.requireProvider.mockResolvedValue({ marke: 'provider' })
  h.getReport.mockResolvedValue({ generatedAt: 'T1' })
  h.ausfuehren.mockResolvedValue({ bearbeitungsstand: 'erschlossen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' })
})

describe('stand_setzen', () => {
  it('„abgenommen" ist ueber die Bruecke NICHT waehlbar', () => {
    expect(STAND_WERTE_BRUECKE).not.toContain('abgenommen')
    expect(STAND_WERTE_BRUECKE).toContain('erschlossen')
  })

  it('setzt den Stand ueber den geschuetzten Weg der Agentensicht', async () => {
    const antwort = await aufrufen({ libraryId: 'L', folderId: 'F', stand: 'erschlossen', erwarteterStand: null })

    expect(h.ausfuehren).toHaveBeenCalledTimes(1)
    const args = h.ausfuehren.mock.calls[0][0]
    expect(args.request).toMatchObject({ folderId: 'F', stand: 'erschlossen', erwarteterStand: null, bestaetigen: false })
    expect(args.gespeicherterGeneratedAt).toBe('T1')
    expect(antwort).toMatchObject({ ok: true })
  })

  it('reicht bestaetigen durch (Widerspruch nach Pruefung aufloesen)', async () => {
    await aufrufen({ libraryId: 'L', folderId: 'F', stand: 'berichtet', erwarteterStand: 'berichtet', bestaetigen: true })

    expect(h.ausfuehren.mock.calls[0][0].request).toMatchObject({ stand: 'berichtet', bestaetigen: true })
  })

  it('ohne gespeicherten Report wird nichts geschrieben', async () => {
    h.getReport.mockResolvedValue(null)

    const antwort = await aufrufen({ libraryId: 'L', folderId: 'F', stand: 'erschlossen', erwarteterStand: null })

    expect(h.ausfuehren).not.toHaveBeenCalled()
    expect(antwort).toMatchObject({ ok: false })
  })

  it('Validierungsfehler des Plans kommen als Fehler zurueck, ohne zu schreiben', async () => {
    const antwort = await aufrufen({ libraryId: 'L', folderId: 'F', stand: 'berichtet', erwarteterStand: 'erschlossen', bestaetigen: true })

    expect(h.ausfuehren).not.toHaveBeenCalled()
    expect(antwort).toMatchObject({ ok: false })
  })
})
