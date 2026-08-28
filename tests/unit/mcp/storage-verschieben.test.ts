/**
 * Welle ST5 — `verschieben` prueft den Schreibschutz.
 *
 * Live-Befund 28.08.2026 (Cowork): `verschieben` prüfte die Sperre NICHT.
 * Damit war derselbe Riegel, der `datei_patchen` blockiert, in zwei Schritten
 * zu umgehen — und mit `ueberschreiben: true` liess sich die _INDEX.md eines
 * echten Vorhabens samt Bearbeitungsstand ersetzen: ohne ifVersion, ohne die
 * vier Schutzstufen, ohne dass ein Coverage-Befund entsteht.
 *
 * Die Luecke wurde in der Sitzung zweimal tatsaechlich benutzt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  }
})

import { registerStorageVerschiebenTool } from '@/lib/mcp/storage/tools-verschieben'

const server = {
  registerTool: (name: string, _s: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, handler)
  },
} as never

function fehlerbild(ergebnis: unknown): { fehler: string; meldung: string } {
  return JSON.parse((ergebnis as { content: Array<{ text: string }> }).content[0].text)
}

function verschieben(args: Record<string, unknown>) {
  const handler = h.registriert.get('verschieben')
  if (!handler) throw new Error('verschieben nicht registriert')
  return handler(args as never)
}

function provider() {
  const datei = { id: 'q1', parentId: 'f1', type: 'file' as const, metadata: { name: 'Entwurf.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }
  return {
    name: 'test', id: 'lib',
    listItemsById: vi.fn(async (folderId: string) =>
      folderId === 'root'
        ? [{ id: 'f1', parentId: 'root', type: 'folder' as const, metadata: { name: '26.01 Klima', size: 0, modifiedAt: new Date(), mimeType: 'application/folder' } }]
        : [datei]),
    getItemById: vi.fn(async () => datei),
    getPathById: vi.fn(async () => '26.01 Klima/Entwurf.md'),
    moveItem: vi.fn(async () => undefined),
    renameItem: vi.fn(async () => datei),
  }
}

beforeEach(() => {
  h.registriert.clear()
  h.requireLibrary.mockResolvedValue({ id: 'lib' })
  registerStorageVerschiebenTool(server)
})

describe('verschieben: die Sperre gilt auch hier', () => {
  it('verschiebt NICHTS an eine _INDEX.md — auch nicht mit ueberschreiben: true', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const e = await verschieben({
      libraryId: 'lib', von: '26.01 Klima/Entwurf.md', nach: '26.01 Klima/_INDEX.md',
      ueberschreiben: true, begruendung: 'Contract setzen',
    })

    expect(fehlerbild(e).fehler).toBe('nicht_unterstuetzt')
    expect(fehlerbild(e).meldung).toMatch(/stand_setzen/)
    expect(p.moveItem).not.toHaveBeenCalled()
    expect(p.renameItem).not.toHaveBeenCalled()
  })

  it('benennt eine _INDEX.md auch nicht WEG — das war der Umweg', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const e = await verschieben({
      libraryId: 'lib', von: '26.01 Klima/_INDEX.md', nach: '26.01 Klima/alt.md',
      begruendung: 'Platz machen',
    })

    expect(fehlerbild(e).fehler).toBe('nicht_unterstuetzt')
    expect(p.moveItem).not.toHaveBeenCalled()
  })

  it('schuetzt auch Twin-Artefakte als Ziel', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const e = await verschieben({
      libraryId: 'lib', von: '26.01 Klima/Entwurf.md', nach: '26.01 Klima/_Aufnahme/transkript.md',
      begruendung: 'x',
    })

    expect(fehlerbild(e).meldung).toMatch(/twins_synchronisieren/)
    expect(p.moveItem).not.toHaveBeenCalled()
  })

  it('laesst gewoehnliche Umzuege weiterhin durch', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)

    const e = await verschieben({
      libraryId: 'lib', von: '26.01 Klima/Entwurf.md', nach: '26.01 Klima/BERICHT.md',
      begruendung: 'umbenannt',
    }) as { ok: boolean }

    expect(e.ok).toBe(true)
    expect(p.renameItem).toHaveBeenCalledWith('q1', 'BERICHT.md')
  })
})
