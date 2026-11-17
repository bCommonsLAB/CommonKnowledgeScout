/**
 * Ingest-Anhang: Quellen einer Sammeldatei finden — auch in Unterordnern, ueber den
 * Pfad aus der Sammeldatei — und ihren Text anhaengen. Fehlende Texte bleiben Fehler;
 * eine Markdown-Quelle nur aus Frontmatter wird ausgelassen und genannt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const transkripte = new Map<string, string>()
const transformationen = new Map<string, string>()
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  toArtifactKey: (key: unknown) => key,
  getShadowTwinArtifact: vi.fn(async (args: { sourceId: string; artifactKey: { kind: string; templateName?: string } }) => {
    const text = args.artifactKey.kind === 'transformation'
      ? transformationen.get(`${args.sourceId}/${args.artifactKey.templateName}`)
      : transkripte.get(args.sourceId)
    return text === undefined ? null : { markdown: text }
  }),
}))

import { ANHANG_MARKER, buildSourceAppendix, type BuildSourceAppendixArgs } from '@/lib/external-jobs/ingest-source-appendix'
import type { StorageProvider } from '@/lib/storage/types'

interface Eintrag {
  id: string
  type: 'file' | 'folder'
  name: string
  parentId: string
  text?: string
}

const SAMMELDATEI = [
  '---',
  'kind: composite-transcript',
  '_include_self: true',
  '_media_files: ["pdfs/karte_front.png"]',
  '_source_files: ["pdfs/karte_front.pdf", "pdfs/karte_rueck.pdf", "videos/film.md", "notiz.md"]',
  '---',
  '# Artefakte',
].join('\n')

const NUR_FRONTMATTER = '---\ntitle: Film\nurl: https://video.example/w/abc\n---\n'

function speicher(extra: Eintrag[] = [], ohne: string[] = []) {
  const basis: Eintrag[] = [
    { id: 'karte', type: 'file', name: 'karte.md', parentId: 'ordner', text: SAMMELDATEI },
    { id: 'notiz', type: 'file', name: 'notiz.md', parentId: 'ordner', text: '---\ntitle: Notiz\n---\nEine Notiz mit Text.' },
    { id: 'pdfs', type: 'folder', name: 'pdfs', parentId: 'ordner' },
    { id: 'videos', type: 'folder', name: 'videos', parentId: 'ordner' },
    { id: 'front', type: 'file', name: 'karte_front.pdf', parentId: 'pdfs' },
    { id: 'rueck', type: 'file', name: 'karte_rueck.pdf', parentId: 'pdfs' },
    { id: 'film', type: 'file', name: 'film.md', parentId: 'videos', text: NUR_FRONTMATTER },
  ]
  const eintraege = [...basis, ...extra].filter((e) => !ohne.includes(e.id))
  const gelesen: string[] = []
  const provider = {
    listItemsById: vi.fn(async (folderId: string) =>
      eintraege.filter((e) => e.parentId === folderId).map((e) => ({ id: e.id, type: e.type, parentId: e.parentId, metadata: { name: e.name } }))),
    getBinary: vi.fn(async (id: string) => {
      gelesen.push(id)
      const eintrag = eintraege.find((e) => e.id === id)
      if (!eintrag || eintrag.text === undefined) throw new Error(`Datei ${id} nicht lesbar`)
      return { blob: new Blob([eintrag.text]), mimeType: 'text/markdown' }
    }),
  } as unknown as StorageProvider
  return { provider, gelesen }
}

/** So fuehrt der Twin die Quellen: blosse Dateinamen, die Sammeldatei selbst voran. */
const TWIN_META = { template: 'karte-de', _source_files: ['karte.md', 'karte_front.pdf', 'karte_rueck.pdf'] }

function args(provider: StorageProvider, meta: Record<string, unknown> = TWIN_META): BuildSourceAppendixArgs {
  return { libraryId: 'lib', sourceId: 'karte', sourceName: 'karte.md', parentId: 'ordner', targetLanguage: 'de', provider, meta, ingestedIsTransformation: true }
}

beforeEach(() => {
  transkripte.clear()
  transformationen.clear()
  transkripte.set('front', '---\nkind: transcript\n---\nText der Vorderseite.')
  transkripte.set('rueck', 'Text der Rueckseite.')
})

describe('buildSourceAppendix — Sammeldatei', () => {
  it('findet Quellen im Unterordner ueber den Pfad aus der Sammeldatei, in der Reihenfolge des Twins', async () => {
    const { provider } = speicher()
    const anhang = await buildSourceAppendix(args(provider))
    expect(anhang?.sections.map((s) => s.title)).toEqual([
      'Anhang 1: karte_front.pdf (Transkript)',
      'Anhang 2: karte_rueck.pdf (Transkript)',
    ])
    expect(anhang?.markdown.startsWith(`${ANHANG_MARKER}\n\n## Anhang 1: karte_front.pdf (Transkript)\n\nText der Vorderseite.`)).toBe(true)
    expect(anhang?.markdown).toContain('Text der Rueckseite.')
    expect(anhang?.markdown).not.toContain('kind: transcript')
    expect(anhang?.ausgelassen).toBeUndefined()
  })

  it('liest die Sammeldatei nicht, wenn alle Quellen neben ihr liegen', async () => {
    const { provider, gelesen } = speicher([
      { id: 'a', type: 'file', name: 'folien.pdf', parentId: 'ordner' },
    ])
    transkripte.set('a', 'Folientext.')
    const anhang = await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'folien.pdf'] }))
    expect(anhang?.sections.map((s) => s.sourceName)).toEqual(['folien.pdf'])
    expect(gelesen).toEqual([])
  })

  it('laesst die Sammeldatei selbst und Bilder aus, ohne nach ihnen zu suchen', async () => {
    const { provider, gelesen } = speicher([{ id: 'a', type: 'file', name: 'folien.pdf', parentId: 'ordner' }])
    transkripte.set('a', 'Folientext.')
    const anhang = await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'nicht-da.png', 'folien.pdf'] }))
    expect(anhang?.sections).toHaveLength(1)
    expect(gelesen).toEqual([])
  })

  it('haengt eine Markdown-Quelle mit Text an, ohne ihr Frontmatter', async () => {
    const { provider } = speicher()
    const anhang = await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'notiz.md'] }))
    expect(anhang?.sections.map((s) => s.title)).toEqual(['Anhang 1: notiz.md (Markdown)'])
    expect(anhang?.markdown).toContain('Eine Notiz mit Text.')
    expect(anhang?.markdown).not.toContain('title: Notiz')
  })

  it('laesst eine Markdown-Quelle nur aus Frontmatter aus und nennt sie — kein Abbruch', async () => {
    const { provider } = speicher()
    const anhang = await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'karte_front.pdf', 'film.md'] }))
    expect(anhang?.sections.map((s) => s.sourceName)).toEqual(['karte_front.pdf'])
    expect(anhang?.ausgelassen).toEqual(['film.md'])
    expect(anhang?.markdown).not.toContain('video.example')
  })

  it('liefert null, wenn nach dem Auslassen nichts anzuhaengen bleibt', async () => {
    const { provider } = speicher()
    expect(await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'film.md'] }))).toBeNull()
  })

  it('bleibt beim Fehler, wenn ein Transkript fehlt oder leer ist', async () => {
    const { provider } = speicher()
    transkripte.delete('rueck')
    await expect(buildSourceAppendix(args(provider))).rejects.toThrow('Anhang fuer Ingestion: Transkript von "karte_rueck.pdf" fehlt oder ist leer')
    transkripte.set('rueck', '---\nkind: transcript\n---\n   ')
    await expect(buildSourceAppendix(args(provider))).rejects.toThrow(/Transkript von "karte_rueck\.pdf" fehlt oder ist leer/)
  })

  it('bleibt beim Fehler, wenn die Sammeldatei den Dateinamen nicht nennt oder die Datei fehlt', async () => {
    const { provider } = speicher()
    await expect(buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'unbekannt.pdf'] })))
      .rejects.toThrow('Anhang fuer Ingestion: Quelle "unbekannt.pdf" nicht im Storage gefunden')
    const ohneDatei = speicher([], ['rueck'])
    await expect(buildSourceAppendix(args(ohneDatei.provider)))
      .rejects.toThrow('Anhang fuer Ingestion: Quelle "karte_rueck.pdf" nicht im Storage gefunden')
  })

  it('raet nicht, wenn die Sammeldatei denselben Dateinamen unter zwei Pfaden nennt', async () => {
    const doppelt = SAMMELDATEI.replace('"notiz.md"]', '"notiz.md", "alt/karte_front.pdf"]')
    const { provider } = speicher([{ id: 'karte2', type: 'file', name: 'karte.md', parentId: 'anders', text: doppelt }])
    await expect(buildSourceAppendix({ ...args(provider), sourceId: 'karte2' }))
      .rejects.toThrow('Anhang fuer Ingestion: Quelle "karte_front.pdf" steht in der Sammeldatei unter mehreren Pfaden — nicht eindeutig')
  })

  it('meldet eine nicht lesbare Sammeldatei mit Grund statt „nicht gefunden"', async () => {
    const { provider } = speicher([], ['karte'])
    await expect(buildSourceAppendix(args(provider)))
      .rejects.toThrow('Anhang fuer Ingestion: Sammeldatei "karte.md" nicht lesbar — Pfade ihrer Quellen unbekannt (Datei karte nicht lesbar)')
  })

  it('laedt bei einem Eintrag mit Vorlagen-Suffix die Transformation der Quelle im Unterordner', async () => {
    const { provider } = speicher()
    transformationen.set('front/steckbrief', '---\ntemplate: steckbrief\n---\nSteckbrief der Vorderseite.')
    const anhang = await buildSourceAppendix(args(provider, { template: 't', _source_files: ['karte.md', 'karte_front.pdf/steckbrief'] }))
    expect(anhang?.sections.map((s) => s.title)).toEqual(['Anhang 1: karte_front.pdf (Transformation)'])
    expect(anhang?.markdown).toContain('Steckbrief der Vorderseite.')
  })

  it('verlangt den Ordner der Sammeldatei', async () => {
    const { provider } = speicher()
    await expect(buildSourceAppendix({ ...args(provider), parentId: undefined })).rejects.toThrow(/Elternordner von "karte\.md" unbekannt/)
  })

  it('ist deterministisch: gleiche Eingabe, gleicher Anhang', async () => {
    const erster = await buildSourceAppendix(args(speicher().provider))
    const zweiter = await buildSourceAppendix(args(speicher().provider))
    expect(zweiter).toEqual(erster)
  })
})

describe('buildSourceAppendix — Einzelquelle', () => {
  it('haengt das eigene Transkript an, wenn eine Transformation ingestiert wird', async () => {
    const { provider } = speicher()
    transkripte.set('karte', 'Eigenes Transkript.')
    const anhang = await buildSourceAppendix(args(provider, { template: 't' }))
    expect(anhang?.sections.map((s) => s.title)).toEqual(['Anhang 1: karte.md (Transkript)'])
  })

  it('haengt nichts an, wenn der ingestierte Text selbst das Transkript ist oder keines da ist', async () => {
    const { provider } = speicher()
    transkripte.set('karte', 'Eigenes Transkript.')
    expect(await buildSourceAppendix({ ...args(provider, {}), ingestedIsTransformation: false })).toBeNull()
    transkripte.delete('karte')
    expect(await buildSourceAppendix(args(provider, { template: 't' }))).toBeNull()
  })
})
