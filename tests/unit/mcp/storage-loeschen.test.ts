/**
 * Welle ST4 — `loeschen` und `speicher_info`.
 *
 * Der Kern: Die Archiv-Grundregel „Geloescht wird nie" haengt an der Frage,
 * ob es einen Papierkorb gibt. Der Filesystem-Provider hat keinen. Ein
 * `loeschen`, das dort trotzdem „im Papierkorb" meldet, waere die
 * gefaehrlichste Antwort der ganzen Schicht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { StorageCapabilityInfo } from '@/lib/storage/types'

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

import { registerStorageInfoLoeschenTools } from '@/lib/mcp/storage/tools-info-loeschen'

const server = {
  registerTool: (name: string, _s: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, handler)
  },
} as never

function ruf(name: string, args: Record<string, unknown>) {
  const handler = h.registriert.get(name)
  if (!handler) throw new Error(`${name} nicht registriert`)
  return handler(args as never)
}

function fehlerbild(ergebnis: unknown): { fehler: string; meldung: string; wiederholbar: boolean } {
  return JSON.parse((ergebnis as { content: Array<{ text: string }> }).content[0].text)
}

const MIT_PAPIERKORB: StorageCapabilityInfo = {
  provider: 'onedrive', grossKleinSchreibungRelevant: false, pfadLimit: 400, namensLimit: 255,
  maxDateigroesse: null, papierkorbVorhanden: true, aufbewahrungTage: 93,
  unicodeNormalisierung: null, zeitstempelGenauigkeit: 'millisekunde',
  trenntInhaltVonMetadaten: true, hinweise: [],
}
const OHNE_PAPIERKORB: StorageCapabilityInfo = {
  ...MIT_PAPIERKORB, provider: 'filesystem', papierkorbVorhanden: false, aufbewahrungTage: null,
}

function provider(faehigkeiten: StorageCapabilityInfo | null) {
  const item = { id: 'd1', parentId: 'root', type: 'file' as const, metadata: { name: 'Notiz.md', size: 5, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v1' } }
  return {
    name: 'test', id: 'lib',
    listItemsById: vi.fn(async () => [item]),
    getItemById: vi.fn(async () => item),
    getPathById: vi.fn(async () => 'Notiz.md'),
    deleteItem: vi.fn(async () => undefined),
    updateFile: vi.fn(),
    ...(faehigkeiten ? { beschreibeFaehigkeiten: () => faehigkeiten } : {}),
  }
}

beforeEach(() => {
  h.registriert.clear()
  h.requireLibrary.mockResolvedValue({ id: 'lib' })
  registerStorageInfoLoeschenTools(server)
})

describe('loeschen', () => {
  it('meldet Papierkorb und Aufbewahrung, wo es einen gibt', async () => {
    const p = provider(MIT_PAPIERKORB)
    h.requireProvider.mockResolvedValue(p)

    const e = await ruf('loeschen', { libraryId: 'lib', pfad: 'Notiz.md', begruendung: 'nicht mehr gebraucht' }) as { wert: Record<string, unknown> }

    expect(e.wert.imPapierkorb).toBe(true)
    expect(e.wert.wiederherstellbarTage).toBe(93)
    expect(p.deleteItem).toHaveBeenCalledWith('d1')
  })

  it('LOESCHT NICHT, wenn der Speicher keinen Papierkorb hat', async () => {
    const p = provider(OHNE_PAPIERKORB)
    h.requireProvider.mockResolvedValue(p)

    const e = await ruf('loeschen', { libraryId: 'lib', pfad: 'Notiz.md', begruendung: 'weg damit' })

    expect(fehlerbild(e).meldung).toMatch(/KEINEN Papierkorb/)
    expect(fehlerbild(e).meldung).toMatch(/quelle_verwerfen/)
    expect(p.deleteItem).not.toHaveBeenCalled()
  })

  it('loescht ohne Papierkorb nur mit ausdruecklichem endgueltig', async () => {
    const p = provider(OHNE_PAPIERKORB)
    h.requireProvider.mockResolvedValue(p)

    const e = await ruf('loeschen', { libraryId: 'lib', pfad: 'Notiz.md', endgueltig: true, begruendung: 'x' }) as { wert: Record<string, unknown> }

    expect(p.deleteItem).toHaveBeenCalled()
    expect(e.wert.imPapierkorb).toBe(false)
    expect(e.wert.hinweis).toMatch(/Nicht wiederherstellbar/)
  })

  it('loescht nichts, wenn der Provider keine Selbstauskunft gibt', async () => {
    const p = provider(null)
    h.requireProvider.mockResolvedValue(p)

    const e = await ruf('loeschen', { libraryId: 'lib', pfad: 'Notiz.md', begruendung: 'x' })

    expect(fehlerbild(e).meldung).toMatch(/keine Selbstauskunft/)
    expect(p.deleteItem).not.toHaveBeenCalled()
  })
})

describe('speicher_info', () => {
  it('reicht die Provider-Auskunft durch und ergaenzt, was DIESE Schicht kann', async () => {
    h.requireProvider.mockResolvedValue(provider(MIT_PAPIERKORB))

    const e = await ruf('speicher_info', { libraryId: 'lib' }) as { wert: Record<string, unknown> }

    expect(e.wert.provider).toBe('onedrive')
    expect(e.wert.papierkorbVorhanden).toBe(true)
    // Provider-Fakten und Schicht-Fakten bleiben getrennt: `delta`/`binaer`
    // sind noch nicht gebaut, also sagt die Schicht false — egal was ein
    // Provider theoretisch koennte.
    expect(e.wert.unterstuetzt).toEqual({ patch: true, ifVersion: true, delta: false, binaer: false })
  })

  it('meldet unbekannte Angaben als null statt sie zu raten', async () => {
    h.requireProvider.mockResolvedValue(provider({ ...MIT_PAPIERKORB, unicodeNormalisierung: null, pfadLimit: null }))

    const e = await ruf('speicher_info', { libraryId: 'lib' }) as { wert: Record<string, unknown> }

    expect(e.wert.unicodeNormalisierung).toBeNull()
    expect(e.wert.pfadLimit).toBeNull()
  })

  it('raet nicht, wenn der Provider gar nichts sagt', async () => {
    h.requireProvider.mockResolvedValue(provider(null))
    const e = await ruf('speicher_info', { libraryId: 'lib' })
    expect(fehlerbild(e).meldung).toMatch(/keine Selbstauskunft/)
  })
})
