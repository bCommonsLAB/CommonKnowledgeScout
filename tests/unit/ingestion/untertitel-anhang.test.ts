/**
 * @fileoverview Untertitel als einsehbarer Anhang (Owner 26.11.2026): Der Story-Modus zitiert
 * aus dem unsichtbaren Anhang; mit `attachments_subtitles: true` bekommt das Dokument je
 * Untertitel-Quelle ein Textdokument „Untertitel von <Anbieter>". Vorgabe aus.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = vi.hoisted(() => ({ getShadowTwinsBySourceIds: vi.fn() }))

vi.mock('@/lib/repositories/shadow-twin-repo', () => ({
  getShadowTwinsBySourceIds: repo.getShadowTwinsBySourceIds,
  readTranscriptRecord: (doc: { artifacts?: { transcript?: { markdown?: string } } } | undefined) =>
    typeof doc?.artifacts?.transcript?.markdown === 'string' ? doc.artifacts.transcript : null,
}))

import {
  haengeAnhaengeAn, ladeUntertitelAnhaenge, untertitelAnhangAusTranskript, untertitelAnhangErlaubt, untertitelTitel,
} from '@/lib/ingestion/untertitel-anhang'
import type { QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

const UNTERTITEL_MD = [
  '---',
  'transcript_origin: "subtitles"',
  'subtitle_provider: "YouTube"',
  'subtitle_kind: "automatic"',
  'subtitle_language: "en"',
  'subtitle_track: "en-orig"',
  'subtitle_fetched_at: "2026-11-26T11:30:00.000Z"',
  'source_url: "https://www.youtube.com/watch?v=abc123def45"',
  'generated_by: "knowledgescout/untertitel"',
  '---',
  '',
  '[00:00:01] good morning everyone',
  '',
  '[00:01:03] concessional finance',
  '',
].join('\n')

const TONSPUR_MD = '---\ntype: "transcript"\n---\n\n**Sprecher A:** Guten Morgen.\n'

function quelle(sourceId: string, sourceName: string, eigener = false): QuellenTwin {
  return { sourceId, sourceName, fragments: [], eigener }
}

function twin(markdown: string) {
  return { artifacts: { transcript: { markdown } } }
}

beforeEach(() => vi.clearAllMocks())

describe('untertitelAnhangErlaubt', () => {
  it('Vorgabe ist aus; true schaltet ein; ein anderer Wert ist ein Fehler', () => {
    expect(untertitelAnhangErlaubt({})).toBe(false)
    expect(untertitelAnhangErlaubt({ attachments_subtitles: '' })).toBe(false)
    expect(untertitelAnhangErlaubt({ attachments_subtitles: false })).toBe(false)
    expect(untertitelAnhangErlaubt({ attachments_subtitles: 'true' })).toBe(true)
    expect(untertitelAnhangErlaubt({ attachments_subtitles: true })).toBe(true)
    expect(() => untertitelAnhangErlaubt({ attachments_subtitles: 'ja' })).toThrow(/weder true noch false/)
  })
})

describe('untertitelAnhangAusTranskript', () => {
  it('baut Titel, Dateiname und Text mit Kopfzeilen aus dem Frontmatter', () => {
    const a = untertitelAnhangAusTranskript('s1', 'Side Event - Untertitel.txt', UNTERTITEL_MD)
    expect(a).toEqual({
      sourceId: 's1',
      dateiname: 'Side Event - Untertitel.txt',
      titel: 'Untertitel von YouTube',
      text: 'Untertitel von YouTube (automatisch erzeugt, Sprache en, abgerufen am 2026-11-26)\n'
        + 'Quelle: https://www.youtube.com/watch?v=abc123def45\n\n'
        + '[00:00:01] good morning everyone\n\n[00:01:03] concessional finance\n',
    })
  })

  it('ein Transkript aus der Tonspur ist kein Untertitel-Anhang', () => {
    expect(untertitelAnhangAusTranskript('s2', 'Side Event - Audio.m4a', TONSPUR_MD)).toBeNull()
  })

  it('nennt eine Korrektur und kommt ohne Anbieter aus, ohne zu raten', () => {
    const md = UNTERTITEL_MD.replace('subtitle_provider: "YouTube"\n', '').replace('generated_by:', 'revised_at: "2026-11-27T08:00:00.000Z"\ngenerated_by:')
    const a = untertitelAnhangAusTranskript('s1', 'Vortrag.vtt', md)
    expect(a?.titel).toBe('Untertitel')
    expect(a?.dateiname).toBe('Vortrag.txt')
    expect(a?.text.split('\n')[0]).toBe('Untertitel (automatisch erzeugt, Sprache en, abgerufen am 2026-11-26, korrigiert am 2026-11-27)')
    expect(untertitelTitel('Vimeo')).toBe('Untertitel von Vimeo')
  })

  it('Untertitel-Transkript ohne Text ist ein Fehler', () => {
    expect(() => untertitelAnhangAusTranskript('s1', 'x.txt', '---\ntranscript_origin: "subtitles"\n---\n\n')).toThrow(/ist leer/)
  })
})

describe('ladeUntertitelAnhaenge', () => {
  it('nimmt nur verbundene Quellen mit Untertitel-Herkunft, in Reihenfolge der Sammeldatei', async () => {
    repo.getShadowTwinsBySourceIds.mockResolvedValue(new Map([['u1', twin(UNTERTITEL_MD)], ['a1', twin(TONSPUR_MD)]]))
    const anhaenge = await ladeUntertitelAnhaenge('lib', [
      quelle('sammel', 'Side Event.md', true), quelle('a1', 'Side Event - Audio.m4a'), quelle('u1', 'Side Event - Untertitel.txt'), quelle('ohne', 'Folien.pdf'),
    ])
    expect(repo.getShadowTwinsBySourceIds).toHaveBeenCalledWith({ libraryId: 'lib', sourceIds: ['a1', 'u1', 'ohne'] })
    expect(anhaenge.map((a) => [a.sourceId, a.titel])).toEqual([['u1', 'Untertitel von YouTube']])
  })

  it('ohne verbundene Quellen keine Abfrage', async () => {
    expect(await ladeUntertitelAnhaenge('lib', [quelle('sammel', 'x.md', true)])).toEqual([])
    expect(repo.getShadowTwinsBySourceIds).not.toHaveBeenCalled()
  })
})

describe('haengeAnhaengeAn', () => {
  const NEU = [{ url: 'https://blob/x/Untertitel.txt', name: 'Untertitel von YouTube' }]

  it('legt beide Listen an, wenn es noch keine Anhaenge gibt', () => {
    const meta: Record<string, unknown> = {}
    haengeAnhaengeAn(meta, NEU)
    expect(meta).toEqual({ attachments_url: ['https://blob/x/Untertitel.txt'], attachments_names: ['Untertitel von YouTube'] })
  })

  it('haengt hinter vorhandene PDFs und haelt die Namen gleich lang', () => {
    const meta: Record<string, unknown> = { attachments_url: ['https://blob/x/Folien.pdf'], attachments_names: ['Folien.pdf'] }
    haengeAnhaengeAn(meta, NEU)
    expect(meta['attachments_url']).toEqual(['https://blob/x/Folien.pdf', 'https://blob/x/Untertitel.txt'])
    expect(meta['attachments_names']).toEqual(['Folien.pdf', 'Untertitel von YouTube'])
  })

  it('ergaenzt fehlende Namen aus der Adresse und verdoppelt beim zweiten Ingest nichts', () => {
    const meta: Record<string, unknown> = { attachments_url: 'https://blob/x/Flyer.pdf' }
    haengeAnhaengeAn(meta, NEU)
    haengeAnhaengeAn(meta, NEU)
    expect(meta['attachments_url']).toEqual(['https://blob/x/Flyer.pdf', 'https://blob/x/Untertitel.txt'])
    expect(meta['attachments_names']).toEqual(['Flyer.pdf', 'Untertitel von YouTube'])
  })
})
