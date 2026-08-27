/**
 * Welle ST2 — `datei_schreiben`.
 *
 * Deckt Pruefstein 2 der Anforderungen ab: „Von zwei Sitzungen gleichzeitig
 * dieselbe Datei schreiben — die zweite bekommt einen Konflikt, keine stille
 * Ueberschreibung." Und Q1: Der Konflikt bringt den aktuellen Inhalt mit,
 * damit der Aufrufer mergen kann, ohne noch einmal zu lesen.
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

import { registerStorageSchreibTools } from '@/lib/mcp/storage/tools-schreiben'

const server = {
  registerTool: (name: string, _schema: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, handler)
  },
} as never

function schreiben(args: Record<string, unknown>) {
  const handler = h.registriert.get('datei_schreiben')
  if (!handler) throw new Error('datei_schreiben nicht registriert')
  return handler(args as never)
}

/** Provider mit einer Datei "26.01 Klima/BERICHT.md" (id b1, version v1). */
function provider(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test',
    id: 'lib',
    listItemsById: vi.fn(async (folderId: string) => {
      if (folderId === 'root') return [{ id: 'f1', parentId: 'root', type: 'folder', metadata: { name: '26.01 Klima', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' } }]
      return [{ id: 'b1', parentId: 'f1', type: 'file', metadata: { name: 'BERICHT.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }]
    }),
    getItemById: vi.fn(async () => ({ id: 'b1', parentId: 'f1', type: 'file', metadata: { name: 'BERICHT.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } })),
    getPathById: vi.fn(async () => '26.01 Klima/BERICHT.md'),
    getBinary: vi.fn(async () => ({ blob: new Blob(['# Stand von jemand anderem']), mimeType: 'text/markdown' })),
    updateFile: vi.fn(async () => ({ id: 'b1', version: 'v2' })),
    ...overrides,
  }
}

beforeEach(() => {
  h.registriert.clear()
  h.requireLibrary.mockResolvedValue({ id: 'lib' })
  registerStorageSchreibTools(server)
})

describe('datei_schreiben', () => {
  it('schreibt mit ifVersion und meldet die neue Version', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await schreiben({
      libraryId: 'lib', pfad: '26.01 Klima/BERICHT.md', inhalt: '# Neu',
      ifVersion: 'v1', begruendung: 'Zahl korrigiert',
    }) as { ok: boolean; wert: Record<string, unknown> }

    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.wert).toMatchObject({ pfad: '26.01 Klima/BERICHT.md', id: 'b1', version: 'v2' })
    expect(p.updateFile).toHaveBeenCalledWith('b1', expect.any(Blob), { ifVersion: 'v1' })
  })

  it('gibt bei Konflikt den AKTUELLEN Inhalt mit zurueck (Q1)', async () => {
    const p = provider({
      updateFile: vi.fn(async () => {
        throw new StorageVersionConflictError('geaendert', 'v1', 'v9', 'lib')
      }),
    })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await schreiben({
      libraryId: 'lib', pfad: '26.01 Klima/BERICHT.md', inhalt: '# Neu',
      ifVersion: 'v1', begruendung: 'Zahl korrigiert',
    }) as { isError: boolean; content: Array<{ text: string }> }

    expect(ergebnis.isError).toBe(true)
    const antwort = JSON.parse(ergebnis.content[0].text)
    expect(antwort).toMatchObject({
      fehler: 'konflikt',
      erwarteteVersion: 'v1',
      aktuelleVersion: 'v9',
      aktuellerInhalt: '# Stand von jemand anderem',
    })
    expect(antwort.hinweis).toMatch(/NICHTS geschrieben/)
  })

  it('bleibt eine Konfliktmeldung, auch wenn das Nachladen scheitert', async () => {
    const p = provider({
      updateFile: vi.fn(async () => { throw new StorageVersionConflictError('geaendert', 'v1', 'v9', 'lib') }),
      getBinary: vi.fn(async () => { throw new Error('Netzwerk weg') }),
    })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await schreiben({
      libraryId: 'lib', pfad: '26.01 Klima/BERICHT.md', inhalt: '# Neu',
      ifVersion: 'v1', begruendung: 'x',
    }) as { content: Array<{ text: string }> }

    const antwort = JSON.parse(ergebnis.content[0].text)
    expect(antwort.fehler).toBe('konflikt')
    expect(antwort.aktuellerInhalt).toBeNull()
    expect(antwort.nachladeFehler).toBe('Netzwerk weg')
  })

  it('schreibt NICHT in eine _INDEX.md und nennt das Fachwerkzeug', async () => {
    const p = provider({
      listItemsById: vi.fn(async (folderId: string) => {
        if (folderId === 'root') return [{ id: 'f1', parentId: 'root', type: 'folder', metadata: { name: '26.01 Klima', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' } }]
        return [{ id: 'i1', parentId: 'f1', type: 'file', metadata: { name: '_INDEX.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }]
      }),
    })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await schreiben({
      libraryId: 'lib', pfad: '26.01 Klima/_INDEX.md', inhalt: 'x',
      ifVersion: 'v1', begruendung: 'Stand setzen',
    }) as unknown

    expect(fehlerbild(ergebnis).meldung).toMatch(/stand_setzen/)
    expect(p.updateFile).not.toHaveBeenCalled()
  })

  it('faellt nicht auf uploadFile zurueck, wenn der Provider nicht versionieren kann', async () => {
    const p = provider({ updateFile: undefined })
    h.requireProvider.mockResolvedValue(p)

    const ergebnis = await schreiben({
      libraryId: 'lib', pfad: '26.01 Klima/BERICHT.md', inhalt: 'x',
      ifVersion: 'v1', begruendung: 'x',
    }) as unknown

    expect(fehlerbild(ergebnis).meldung).toMatch(/nicht versioniert schreiben/)
  })
})
