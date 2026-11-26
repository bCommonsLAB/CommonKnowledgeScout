/**
 * @fileoverview Untertitel statt Tonspur (Handover 26.11.2026): Antwort von
 * `media/subtitles` typgeprueft lesen, Herkunft und Hinweise bilden, Schalter
 * `transkript` lesen. Ohne Netz: der Aufruf an den Secretary ist eine Attrappe.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const netz = vi.hoisted(() => ({ fetchWithTimeout: vi.fn() }))

vi.mock('@/lib/utils/fetch-with-timeout', () => netz)
vi.mock('@/lib/env', () => ({ getSecretaryConfig: () => ({ baseUrl: 'http://secretary.test/api', apiKey: 'test-key' }) }))
vi.mock('@/lib/shadow-twin/shadow-twin-mongo-writer', () => ({ persistShadowTwinToMongo: vi.fn() }))

import { holeUntertitelViaSecretary, leseTranskriptWeg, parseUntertitel, type Untertitel } from '@/lib/web-source/untertitel'
import { untertitelDateiInhalt, untertitelDateiname, untertitelHerkunft, untertitelHinweise, untertitelSpur, untertitelTranskript } from '@/lib/web-source/untertitel-ablage'

const VIDEO = 'https://www.youtube.com/watch?v=abc123def45'
const AM = new Date('2026-11-26T11:30:00.000Z')

const DATA = {
  extractor: 'youtube', id: 'abc123def45', title: 'Klimafinanzierung im Gespraech', duration: 5120,
  sprache: 'en', art: 'automatisch', spur: 'en-orig', format: 'json3',
  verfuegbar: { manuell: [], automatisch_original: ['en'], automatisch_uebersetzt: 175, originalsprache: 'en' },
  abdeckung: { beginn: 1.2, ende: 5104, anteil: 0.997, groesste_luecke: 12.4, groesste_luecke_bei: 2310, zeilen: 2890, woerter: 11840 },
  absaetze: [{ start: 1.2, text: 'good morning everyone' }, { start: 63, text: 'concessional finance' }],
  text: '[00:00:01] good morning everyone\n\n[00:01:03] concessional finance',
  metadata: { id: 'abc123def45', description: 'Side event', upload_date: '20261110', channel: 'Konferenz-Kanal', chapters: [], tags: [], thumbnail: 'https://i.ytimg.com/x.jpg', webpage_url: VIDEO },
}

function antwort(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function untertitel(teil: Partial<Untertitel> = {}): Untertitel {
  return { ...parseUntertitel(DATA), ...teil }
}

beforeEach(() => vi.clearAllMocks())

describe('holeUntertitelViaSecretary', () => {
  it('ruft media/subtitles mit Adresse, Sprache und Video-Anmeldung und liest die Antwort', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ status: 'success', data: DATA }))
    const u = await holeUntertitelViaSecretary(VIDEO, 'cookie-inhalt', 'en')
    const [adresse, init] = netz.fetchWithTimeout.mock.calls[0] as [string, { body: string }]
    expect(adresse).toBe('http://secretary.test/api/media/subtitles')
    expect(JSON.parse(init.body)).toEqual({ url: VIDEO, sprache: 'en', cookies: 'cookie-inhalt' })
    expect(u).toMatchObject({ sprache: 'en', art: 'automatisch', spur: 'en-orig', format: 'json3', absaetze: 2, duration: 5120 })
    expect(u.abdeckung).toEqual({ beginn: 1.2, ende: 5104, anteil: 0.997, groessteLuecke: 12.4, groessteLueckeBei: 2310, zeilen: 2890, woerter: 11840 })
    expect(u.metadata?.uploadDate).toBe('2026-11-10')
  })

  it('ohne Sprache und ohne Anmeldung bleibt der Body bei der Adresse', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ status: 'success', data: DATA }))
    await holeUntertitelViaSecretary(VIDEO)
    expect(JSON.parse((netz.fetchWithTimeout.mock.calls[0] as [string, { body: string }])[1].body)).toEqual({ url: VIDEO })
  })

  it('keine brauchbare Spur: der Grund des Secretary steht in der Meldung', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ status: 'error', error: { code: 'SUBTITLES_NOT_AVAILABLE', message: 'Das Video traegt keine Untertitel', details: { grund: 'KEINE_UNTERTITEL' } } }, 422))
    await expect(holeUntertitelViaSecretary(VIDEO)).rejects.toThrow('Secretary media/subtitles: [SUBTITLES_NOT_AVAILABLE] Das Video traegt keine Untertitel')
  })

  it('aelterer Secretary ohne die Route: 404 wird als solcher benannt', async () => {
    netz.fetchWithTimeout.mockResolvedValue(antwort({ message: 'not found' }, 404))
    await expect(holeUntertitelViaSecretary(VIDEO)).rejects.toThrow(/Route gibt es dort nicht/)
  })
})

describe('parseUntertitel', () => {
  it.each([
    [{ art: 'uebersetzt' }, /unbekannte Art der Spur "uebersetzt"/],
    [{ text: '  ' }, /Feld text fehlt oder ist leer/],
    [{ sprache: undefined }, /Feld sprache fehlt/],
    [{ abdeckung: undefined }, /Feld abdeckung fehlt/],
    [{ abdeckung: { ...DATA.abdeckung, woerter: 'viele' } }, /abdeckung.woerter fehlt oder ist keine Zahl/],
  ])('wirft bei unbrauchbarer Antwort %#', (teil, meldung) => {
    expect(() => parseUntertitel({ ...DATA, ...teil })).toThrow(meldung)
  })

  it('Anteil ohne bekannte Dauer bleibt null', () => {
    const u = parseUntertitel({ ...DATA, duration: null, abdeckung: { ...DATA.abdeckung, anteil: null } })
    expect(u.duration).toBeNull()
    expect(u.abdeckung.anteil).toBeNull()
  })
})

describe('leseTranskriptWeg', () => {
  it('weggelassen heisst Tonspur, ein unbekannter Wert ist ein Fehler', () => {
    expect(leseTranskriptWeg(undefined)).toBe('tonspur')
    expect(leseTranskriptWeg('untertitel')).toBe('untertitel')
    expect(() => leseTranskriptWeg('vtt')).toThrow(/transkript "vtt" ist unbekannt — erlaubt: tonspur, untertitel/)
  })
})

describe('Ablage: Herkunft, Datei, Transkript, Hinweise', () => {
  it('nennt die Herkunft im Klartext und als kurze Spur', () => {
    expect(untertitelHerkunft(untertitel(), AM)).toBe('YouTube, automatisch erzeugt, Sprache en, abgerufen am 2026-11-26')
    expect(untertitelHerkunft(untertitel({ art: 'manuell', extractor: 'vimeo', sprache: 'de' }), AM)).toBe('Vimeo, von Hand gepflegt, Sprache de, abgerufen am 2026-11-26')
    expect(untertitelSpur(untertitel())).toBe('en, automatisch')
    expect(untertitelDateiname('2026-11-09 Side Event')).toBe('2026-11-09 Side Event - Untertitel.txt')
  })

  it('die Datei traegt zwei Kopfzeilen und den Text mit Zeitmarken', () => {
    expect(untertitelDateiInhalt(untertitel(), VIDEO, AM)).toBe(
      `Untertitel: YouTube, automatisch erzeugt, Sprache en, abgerufen am 2026-11-26\nQuelle: ${VIDEO}\n\n[00:00:01] good morning everyone\n\n[00:01:03] concessional finance\n`,
    )
  })

  it('das Transkript traegt die Herkunft als flaches Frontmatter', () => {
    const md = untertitelTranskript(untertitel(), VIDEO, AM)
    expect(md).toContain('transcript_origin: "subtitles"')
    expect(md).toContain('subtitle_provider: "YouTube"')
    expect(md).toContain('subtitle_kind: "automatic"')
    expect(md).toContain('subtitle_language: "en"')
    expect(md).toContain('subtitle_track: "en-orig"')
    expect(md).toContain('subtitle_fetched_at: "2026-11-26T11:30:00.000Z"')
    expect(md).toContain(`source_url: "${VIDEO}"`)
    expect(md.trimEnd().endsWith('[00:01:03] concessional finance')).toBe(true)
    expect(md).not.toMatch(/^\s+\w+:/m)
  })

  it('Hinweise: automatisch erzeugt, lueckenhaft, grosse Luecke', () => {
    expect(untertitelHinweise(untertitel())).toHaveLength(1)
    expect(untertitelHinweise(untertitel({ art: 'manuell' }))).toEqual([])
    const lueckenhaft = untertitel({ art: 'manuell', abdeckung: { ...untertitel().abdeckung, anteil: 0.62, groessteLuecke: 754, groessteLueckeBei: 1830 } })
    expect(untertitelHinweise(lueckenhaft)).toEqual([
      'Untertitel enden bei 62 % der Laufzeit — der Rest des Videos fehlt im Transkript',
      'Untertitel haben eine Luecke von 12:34 min ab 30:30 — dort fehlt Text oder es wurde nicht gesprochen',
    ])
  })
})
