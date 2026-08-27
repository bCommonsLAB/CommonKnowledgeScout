/**
 * Welle ST3 — `datei_patchen` als Werkzeug.
 *
 * Deckt Pruefstein 1 der Anforderungen ab: „Eine Zeile in BERICHT.md aendern,
 * ohne die Datei zu uebertragen."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageVersionConflictError } from '@/lib/storage/types'

/** Liest die Q5-Fehlerantwort (code + meldung + wiederholbar) aus. */
function fehlerbild(ergebnis: unknown): { fehler: string; meldung: string; wiederholbar: boolean } {
  return JSON.parse((ergebnis as { content: Array<{ text: string }> }).content[0].text)
}

const h = vi.hoisted(() => ({
  requireLibrary: vi.fn(),
  requireProvider: vi.fn(),
  registriert: new Map<string, (args: never) => Promise<unknown>>(),
}))

vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({
  protokolliereAktion: vi.fn().mockResolvedValue(undefined),
  MAX_BEGRUENDUNG: 500,
}))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    mcpUserEmail: () => 'a@b.c',
    requireLibrary: h.requireLibrary,
    requireProvider: h.requireProvider,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message }),
  }
})

import { registerStoragePatchTool } from '@/lib/mcp/storage/tools-patch'

const server = {
  registerTool: (name: string, _s: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, handler)
  },
} as never

const BERICHT = '---\ntype: index\n---\n\n# Bericht\n\n38 Befunde offen.\n'

function patchen(args: Record<string, unknown>) {
  const handler = h.registriert.get('datei_patchen')
  if (!handler) throw new Error('datei_patchen nicht registriert')
  return handler(args as never)
}

function provider(overrides: Record<string, unknown> = {}) {
  const item = { id: 'b1', parentId: 'f1', type: 'file' as const, metadata: { name: 'BERICHT.md', size: 60, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }
  return {
    name: 'test',
    id: 'lib',
    listItemsById: vi.fn(async () => [item]),
    getItemById: vi.fn(async () => item),
    getPathById: vi.fn(async () => 'BERICHT.md'),
    getBinary: vi.fn(async () => ({ blob: new Blob([BERICHT]), mimeType: 'text/markdown' })),
    updateFile: vi.fn(async () => ({ id: 'b1', version: 'v2' })),
    ...overrides,
  }
}

beforeEach(() => {
  h.registriert.clear()
  h.requireLibrary.mockResolvedValue({ id: 'lib' })
  registerStoragePatchTool(server)
})

describe('datei_patchen', () => {
  it('aendert eine Zahl, ohne die Datei zu uebertragen (Pruefstein 1)', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: 'BERICHT.md', ifVersion: 'v1', begruendung: 'Zahl nachgezogen',
      modus: { art: 'ersetze', altText: '38 Befunde', neuText: '30 Befunde' },
    }) as { ok: boolean; wert: Record<string, unknown> }

    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.wert.geaendert).toBe(true)
    expect(ergebnis.wert.version).toBe('v2')

    const geschrieben = await (p.updateFile.mock.calls[0][1] as Blob).text()
    expect(geschrieben).toContain('30 Befunde offen.')
    // Der Rest der Datei ist unangetastet durchgelaufen.
    expect(geschrieben).toContain('type: index')
  })

  it('schreibt NICHT, wenn der Patch denselben Inhalt ergibt', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: 'BERICHT.md', ifVersion: 'v1', begruendung: 'x',
      modus: { art: 'ersetze', altText: '38 Befunde', neuText: '38 Befunde' },
    }) as { wert: Record<string, unknown> }

    expect(ergebnis.wert.geaendert).toBe(false)
    // Sonst wuerde die Datei fuer eine Nicht-Aenderung altern (bericht_veraltet).
    expect(p.updateFile).not.toHaveBeenCalled()
  })

  it('schreibt nichts, wenn der Patch mehrdeutig ist', async () => {
    const p = provider({ getBinary: vi.fn(async () => ({ blob: new Blob(['x\nx\n']), mimeType: 'text/markdown' })) })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: 'BERICHT.md', ifVersion: 'v1', begruendung: 'x',
      modus: { art: 'ersetze', altText: 'x', neuText: 'y' },
    }) as unknown

    expect(fehlerbild(ergebnis).meldung).toMatch(/2-mal vor/)
    expect(p.updateFile).not.toHaveBeenCalled()
  })

  it('gibt bei Konflikt den aktuellen Inhalt mit zurueck', async () => {
    const p = provider({
      updateFile: vi.fn(async () => { throw new StorageVersionConflictError('geaendert', 'v1', 'v9', 'lib') }),
    })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: 'BERICHT.md', ifVersion: 'v1', begruendung: 'x',
      modus: { art: 'ersetze', altText: '38 Befunde', neuText: '30 Befunde' },
    }) as { isError: boolean; content: Array<{ text: string }> }

    const antwort = JSON.parse(ergebnis.content[0].text)
    expect(antwort.fehler).toBe('konflikt')
    expect(antwort.aktuelleVersion).toBe('v9')
    expect(antwort.aktuellerInhalt).toContain('38 Befunde offen.')
  })

  it('verlangt die zum Modus passenden Felder, statt zu raten', async () => {
    h.requireProvider.mockResolvedValue(provider())

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: 'BERICHT.md', ifVersion: 'v1', begruendung: 'x',
      modus: { art: 'abschnitt_ersetzen', ueberschrift: '## Befunde' },
    }) as unknown

    expect(fehlerbild(ergebnis).meldung).toMatch(/braucht `ueberschrift` und `neuerInhalt`/)
  })

  it('patcht keine _INDEX.md', async () => {
    const p = provider({
      listItemsById: vi.fn(async () => [{ id: 'i1', parentId: 'f1', type: 'file' as const, metadata: { name: '_INDEX.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }]),
    })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await patchen({
      libraryId: 'lib', pfad: '_INDEX.md', ifVersion: 'v1', begruendung: 'x',
      modus: { art: 'frontmatter_setzen', felder: { bearbeitungsstand: 'erschlossen' } },
    }) as unknown

    expect(fehlerbild(ergebnis).meldung).toMatch(/stand_setzen/)
    expect(p.updateFile).not.toHaveBeenCalled()
  })
})
