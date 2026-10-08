/**
 * Welle G — Artefakt-Auswahl fuer artefakt_lesen: Transkript sprach-neutral,
 * Transformation exakt nach Sprache und Vorlage, sonst die juengste; Fehler
 * nennen das Vorhandene; Kuerzung und Frontmatter-Schalter.
 */
import { describe, it, expect } from 'vitest'
import { artefaktUebersicht, waehleArtefakt } from '@/lib/mcp/artefakt-auswahl'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

const rec = (markdown: string, at: string) => ({ markdown, createdAt: at, updatedAt: at })
const DOC = {
  sourceId: 's', sourceName: 'Rede.m4a', parentId: 'p', libraryId: 'lib', userEmail: 'o@x',
  artifacts: {
    transcript: rec('---\nspeakers: ["A"]\n---\nHallo Welt', '2026-10-01T00:00:00.000Z'),
    transformation: {
      vortrag: { de: rec('---\ntitle: V\n---\nVortrag de', '2026-10-02T00:00:00.000Z') },
      kurz: { de: rec('---\ntitle: K\n---\nKurz de', '2026-10-03T00:00:00.000Z'), en: rec('---\ntitle: K\n---\nShort en', '2026-10-03T00:00:00.000Z') },
    },
  },
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z',
} as unknown as ShadowTwinDocument

describe('waehleArtefakt', () => {
  it('liefert das Transkript ohne Frontmatter, mit Metadaten', () => {
    const s = waehleArtefakt({ doc: DOC, art: 'transkript', sprache: 'de', ohneFrontmatter: true, maxZeichen: 1000 })
    expect(s).toMatchObject({ art: 'transkript', sprache: null, vorlage: null, text: 'Hallo Welt', zeichen: 10, gekuerzt: false })
    expect(s.frontmatter).toEqual({ speakers: ['A'] })
  })

  it('nimmt ohne vorlage die juengste Transformation der Sprache und nennt sie', () => {
    expect(waehleArtefakt({ doc: DOC, art: 'transformation', sprache: 'de', ohneFrontmatter: true, maxZeichen: 1000 })).toMatchObject({ vorlage: 'kurz', text: 'Kurz de' })
    expect(waehleArtefakt({ doc: DOC, art: 'transformation', sprache: 'de', vorlage: 'vortrag', ohneFrontmatter: false, maxZeichen: 1000 }).text).toContain('title: V')
  })

  it('kuerzt auf maxZeichen und sagt es', () => {
    const s = waehleArtefakt({ doc: DOC, art: 'transkript', sprache: 'de', ohneFrontmatter: true, maxZeichen: 5 })
    expect(s).toMatchObject({ text: 'Hallo', gekuerzt: true, zeichen: 10 })
  })

  it('nennt im Fehler, was stattdessen vorhanden ist', () => {
    expect(() => waehleArtefakt({ doc: DOC, art: 'transformation', sprache: 'fr', ohneFrontmatter: true, maxZeichen: 10 })).toThrow(/\(fr\).*vortrag\/de, kurz\/de, kurz\/en/)
    expect(() => waehleArtefakt({ doc: DOC, art: 'transformation', sprache: 'de', vorlage: 'gibtsnicht', ohneFrontmatter: true, maxZeichen: 10 })).toThrow(/"gibtsnicht"/)
    expect(artefaktUebersicht(DOC)).toEqual({ transkript: true, transformationen: [{ vorlage: 'vortrag', sprache: 'de' }, { vorlage: 'kurz', sprache: 'de' }, { vorlage: 'kurz', sprache: 'en' }] })
  })
})
