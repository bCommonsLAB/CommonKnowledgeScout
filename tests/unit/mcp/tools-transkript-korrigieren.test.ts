/**
 * Wunschliste 7, B1 — `transkript_korrigieren` als Werkzeug.
 *
 * Prueft den Ablauf aus dem Handover: Vorschau ohne Schreiben, echter Lauf mit
 * MongoDB-zuerst und versioniertem Spiegel-Export, Konflikt bei Drift oder
 * veraltetem ifVersion (nichts geschrieben), kein_transkript, und dass die
 * Fehlercodes der Ersetzungen durchkommen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageVersionConflictError } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const h = vi.hoisted(() => ({
  requireLibrary: vi.fn(),
  requireProvider: vi.fn(),
  getShadowTwinsBySourceIds: vi.fn(),
  resolveArtifact: vi.fn(),
  upsertMarkdown: vi.fn(),
  protokolliereAktion: vi.fn(),
  registriert: new Map<string, (args: never) => Promise<unknown>>(),
}))

vi.mock('@/lib/repositories/aktions-protokoll-repo', () => ({
  protokolliereAktion: h.protokolliereAktion.mockResolvedValue(undefined),
  MAX_BEGRUENDUNG: 500,
}))
vi.mock('@/lib/mcp/tool-shared', async () => {
  const { z } = await import('zod')
  return {
    LIBRARY_ID: z.string(),
    mcpUserEmail: () => 'agent@test',
    requireLibrary: h.requireLibrary,
    requireProvider: h.requireProvider,
    jsonResult: (wert: unknown) => ({ ok: true, wert }),
    errorResult: (fehler: unknown) => ({ ok: false, fehler: (fehler as Error).message }),
  }
})
vi.mock('@/lib/repositories/shadow-twin-repo', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/repositories/shadow-twin-repo')>()
  return { ...original, getShadowTwinsBySourceIds: h.getShadowTwinsBySourceIds }
})
vi.mock('@/lib/shadow-twin/artifact-resolver', () => ({ resolveArtifact: h.resolveArtifact }))
vi.mock('@/lib/shadow-twin/store/shadow-twin-service', () => ({
  ShadowTwinService: class {
    upsertMarkdown = h.upsertMarkdown
  },
}))

import { registerTranskriptKorrigierenTool } from '@/lib/mcp/tools-transkript-korrigieren'

const server = {
  registerTool: (name: string, _s: unknown, handler: (args: never) => Promise<unknown>) => {
    h.registriert.set(name, handler)
  },
} as never

const TRANSKRIPT =
  '---\ntype: transcript\nsource_file: Todo Oktober-1.m4a\ngenerated_by: knowledgescout/pipeline\n' +
  'generated_at: 2026-10-01T08:00:00.000Z\nkorrektur_auftrag: Hoerfehler ausbessern\n---\n\n' +
  'Momentan noch in ihren Nextdrive-Ordner.\nDabei sollte mir der Knowledge Card helfen.\n' +
  'Bei diesen Knowledge-Card-Verarbeitungen.\n'

const QUELLE = { id: 'q1', parentId: 'ordner', type: 'file' as const, metadata: { name: 'Todo Oktober-1.m4a', size: 1, modifiedAt: new Date(), mimeType: 'audio/mp4' } }
const SPIEGEL = { id: 't1', parentId: 'twinordner', type: 'file' as const, metadata: { name: 'Todo Oktober-1.md', size: 1, modifiedAt: new Date(), mimeType: 'text/markdown', version: 'v2' } }

function provider(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test',
    id: 'lib',
    getItemById: vi.fn(async (id: string) => (id === 'q1' ? QUELLE : SPIEGEL)),
    getPathById: vi.fn(async () => 'Organisation/_Todo Oktober-1.m4a/Todo Oktober-1.md'),
    getBinary: vi.fn(async () => ({ blob: new Blob([TRANSKRIPT]), mimeType: 'text/markdown' })),
    updateFile: vi.fn(async () => ({ id: 't1', version: 'v3' })),
    ...overrides,
  }
}

function familie(transformation = false) {
  return new Map([[
    'q1',
    {
      libraryId: 'lib', sourceId: 'q1', sourceName: 'Todo Oktober-1.m4a', parentId: 'ordner', userEmail: 'x',
      artifacts: {
        transcript: { markdown: TRANSKRIPT, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z' },
        ...(transformation ? { transformation: { zusammenfassung: { de: { markdown: '---\ntype: x\n---\nZ', createdAt: 'a', updatedAt: 'b' } } } } : {}),
      },
      createdAt: 'a', updatedAt: 'b',
    },
  ]])
}

function aufruf(args: Record<string, unknown>) {
  const handler = h.registriert.get('transkript_korrigieren')
  if (!handler) throw new Error('transkript_korrigieren nicht registriert')
  return handler({
    libraryId: 'lib', sourceId: 'q1', ifVersion: 'v2', begruendung: 'Hoerfehler laut Diktat korrigiert',
    ersetzungen: [{ alt: 'Nextdrive-Ordner', neu: 'Nextcloud-Ordner' }],
    ...args,
  } as never)
}

function fehlerbild(ergebnis: unknown): Record<string, unknown> {
  return JSON.parse((ergebnis as { content: Array<{ text: string }> }).content[0].text)
}

beforeEach(() => {
  h.registriert.clear()
  h.upsertMarkdown.mockReset().mockResolvedValue({ id: 'mongo', name: 'Todo Oktober-1.md' })
  h.requireLibrary.mockResolvedValue({ id: 'lib' })
  h.getShadowTwinsBySourceIds.mockResolvedValue(familie())
  h.resolveArtifact.mockResolvedValue({ kind: 'transcript', fileId: 't1', fileName: 'Todo Oktober-1.md', location: 'dotFolder', shadowTwinFolderId: 'twinordner' })
  h.protokolliereAktion.mockClear()
  registerTranskriptKorrigierenTool(server)
})

describe('transkript_korrigieren', () => {
  it('Vorschau: liefert Treffer mit Kontext und schreibt nichts (Pruefschritt 1)', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)
    const ergebnis = (await aufruf({ nurVorschau: true })) as { ok: boolean; wert: Record<string, unknown> }
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.wert).toMatchObject({ geschrieben: false, versionVorher: 'v2', versionNachher: null, pfad: 'Organisation/_Todo Oktober-1.m4a/Todo Oktober-1.md', id: 't1' })
    expect((ergebnis.wert.ersetzungen as Array<{ treffer: number }>)[0].treffer).toBe(1)
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
    expect(p.updateFile).not.toHaveBeenCalled()
    expect(h.protokolliereAktion).toHaveBeenCalledWith(expect.objectContaining({ modus: 'vorschau', status: 'ok' }))
  })

  it('echter Lauf: MongoDB zuerst, dann Spiegel mit ifVersion; revised_* gesetzt, generated_* unveraendert (Pruefschritte 2-3)', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)
    const ergebnis = (await aufruf({})) as { ok: boolean; wert: Record<string, unknown> }
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.wert).toMatchObject({ geschrieben: true, versionVorher: 'v2', versionNachher: 'v3' })

    expect(h.upsertMarkdown).toHaveBeenCalledTimes(1)
    const mongo = h.upsertMarkdown.mock.calls[0][0] as { markdown: string; kind: string; skipFilesystemMirror: boolean }
    expect(mongo.kind).toBe('transcript')
    expect(mongo.skipFilesystemMirror).toBe(true)
    expect(mongo.markdown).toContain('Nextcloud-Ordner')
    expect(mongo.markdown).not.toContain('Nextdrive')
    // Der zentrale Serializer schreibt Strings in Anfuehrungszeichen — gelesen
    // wird deshalb ueber den Parser, nicht ueber den Rohtext.
    const meta = parseFrontmatter(mongo.markdown).meta
    expect(meta).toMatchObject({
      generated_by: 'knowledgescout/pipeline',
      generated_at: '2026-10-01T08:00:00.000Z',
      revised_by: 'claude/cowork',
      revision_note: 'Hoerfehler laut Diktat korrigiert',
      korrektur_auftrag: 'Hoerfehler ausbessern',
    })
    expect(String(meta.revised_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(p.updateFile).toHaveBeenCalledTimes(1)
    const [fileId, blob, optionen] = p.updateFile.mock.calls[0] as unknown as [string, Blob, { ifVersion: string }]
    expect(fileId).toBe('t1')
    expect(optionen.ifVersion).toBe('v2')
    expect(await blob.text()).toBe(mongo.markdown)
    expect(h.protokolliereAktion).toHaveBeenCalledWith(expect.objectContaining({ werkzeug: 'transkript_korrigieren', status: 'ok' }))
  })

  it('nennt offene Korrekturauftraege und empfiehlt korrektur_melden, meldet aber nicht selbst', async () => {
    h.requireProvider.mockResolvedValue(provider())
    const ergebnis = (await aufruf({ nurVorschau: true })) as { wert: { offeneKorrekturauftraege: unknown[]; hinweis: string } }
    expect(ergebnis.wert.offeneKorrekturauftraege).toEqual([{ auftrag: 'Hoerfehler ausbessern', von: null, at: null }])
    expect(ergebnis.wert.hinweis).toContain('korrektur_melden')
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
  })

  it('listet Transformationen der Familie als ueberholt (Pruefschritt 8)', async () => {
    h.getShadowTwinsBySourceIds.mockResolvedValue(familie(true))
    h.requireProvider.mockResolvedValue(provider())
    const ergebnis = (await aufruf({ nurVorschau: true })) as { wert: { transformationen: unknown[] } }
    expect(ergebnis.wert.transformationen).toEqual([
      { pfad: 'Organisation/_Todo Oktober-1.m4a/Todo Oktober-1.zusammenfassung.de.md', template: 'zusammenfassung', sprache: 'de', jetztUeberholt: true },
    ])
  })

  it('konflikt bei Spiegel ≠ MongoDB (Handkorrektur) — nichts geschrieben, Hinweis auf import', async () => {
    const p = provider({ getBinary: vi.fn(async () => ({ blob: new Blob([TRANSKRIPT.replace('Knowledge Card', 'KnowledgeScout')]), mimeType: 'text/markdown' })) })
    h.requireProvider.mockResolvedValue(p)
    const bild = fehlerbild(await aufruf({}))
    expect(bild.fehler).toBe('konflikt')
    expect(bild.wiederholbar).toBe(true)
    expect(String(bild.hinweis)).toContain('import')
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
    expect(p.updateFile).not.toHaveBeenCalled()
    expect(h.protokolliereAktion).toHaveBeenCalledWith(expect.objectContaining({ status: 'fehler' }))
  })

  it('konflikt bei veraltetem ifVersion — nennt die aktuelle Version, nichts geschrieben', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)
    const bild = fehlerbild(await aufruf({ ifVersion: 'v1' }))
    expect(bild).toMatchObject({ fehler: 'konflikt', erwarteteVersion: 'v1', aktuelleVersion: 'v2' })
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
  })

  it('Konflikt erst beim Export: MongoDB ist geschrieben, die Antwort sagt es (export statt erneut korrigieren)', async () => {
    const p = provider({
      updateFile: vi.fn(async () => { throw new StorageVersionConflictError('weg', 'v2', 'v9', 'test') }),
    })
    h.requireProvider.mockResolvedValue(p)
    const bild = fehlerbild(await aufruf({}))
    expect(bild).toMatchObject({ fehler: 'konflikt', mongoGeschrieben: true, aktuelleVersion: 'v9' })
    expect(String(bild.hinweis)).toContain('export')
    expect(h.upsertMarkdown).toHaveBeenCalledTimes(1)
  })

  it('nicht_eindeutig fuer "Knowledge" ohne alle — zwei Stellen, nichts geschrieben (Pruefschritt 7)', async () => {
    const p = provider()
    h.requireProvider.mockResolvedValue(p)
    const bild = fehlerbild(await aufruf({ ersetzungen: [{ alt: 'Knowledge', neu: 'KnowledgeScout' }] }))
    expect(bild.fehler).toBe('nicht_eindeutig')
    expect(bild.anzahl).toBe(2)
    expect(bild.treffer).toHaveLength(2)
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
    expect(p.updateFile).not.toHaveBeenCalled()
  })

  it('nicht_gefunden beim zweiten Lauf mit derselben Ersetzung (Pruefschritt 6)', async () => {
    const korrigiert = TRANSKRIPT.replace('Nextdrive', 'Nextcloud')
    h.getShadowTwinsBySourceIds.mockResolvedValue(new Map([['q1', { ...familie().get('q1'), artifacts: { transcript: { markdown: korrigiert, createdAt: 'a', updatedAt: 'b' } } }]]))
    h.requireProvider.mockResolvedValue(provider({ getBinary: vi.fn(async () => ({ blob: new Blob([korrigiert]), mimeType: 'text/markdown' })) }))
    const bild = fehlerbild(await aufruf({ ifVersion: 'v2' }))
    expect(bild.fehler).toBe('nicht_gefunden')
    expect(bild.ersetzung).toEqual({ alt: 'Nextdrive-Ordner', neu: 'Nextcloud-Ordner' })
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
  })

  it('kein_transkript, wenn die Familie keins hat', async () => {
    h.getShadowTwinsBySourceIds.mockResolvedValue(new Map())
    h.requireProvider.mockResolvedValue(provider())
    expect(fehlerbild(await aufruf({})).fehler).toBe('kein_transkript')
  })

  it('kein_spiegel, wenn kein Twin im "_"-Ordner liegt — ifVersion ist dann nicht pruefbar', async () => {
    h.resolveArtifact.mockResolvedValue(null)
    h.requireProvider.mockResolvedValue(provider())
    const bild = fehlerbild(await aufruf({}))
    expect(bild.fehler).toBe('kein_spiegel')
    expect(String(bild.meldung)).toContain('twins_synchronisieren')
    expect(h.upsertMarkdown).not.toHaveBeenCalled()
  })

  it('verlangt genau eine Adresse: sourceId ODER pfad', async () => {
    h.requireProvider.mockResolvedValue(provider())
    const bild = fehlerbild(await aufruf({ pfad: 'Organisation/Todo Oktober-1.m4a' }))
    expect(String(bild.meldung)).toContain('nicht beides')
  })
})
