/**
 * @fileoverview Welcher Weg laedt das Medium — eigener Abruf oder Download des Secretary?
 *
 * Befund 25.11.2026: YouTube drosselt einen Abruf am Stueck (25–31 KiB/s, 83 MB in
 * 43–55 Minuten); in Teilbereichen laedt yt-dlp dieselbe Tonspur in 42 Sekunden.
 * Ohne Netz: die drei Ladewege sind Attrappen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdresseGesperrtError } from '@/lib/web-source/adress-schutz'
import type { ResolvedMedia } from '@/lib/web-source/media-resolve'
import type { WebPageExtract, WebPageMedia } from '@/lib/web-source/page-extract'

const wege = vi.hoisted(() => ({ downloadMedia: vi.fn(), downloadMediaViaSecretary: vi.fn(), downloadDeclaredMedia: vi.fn() }))

vi.mock('@/lib/web-source/media-resolve', () => wege)

import { holeMedium } from '@/lib/web-source/medium-und-cover'

const SEITE_URL = 'https://video.example.org/watch?v=abc'
const DIREKT_URL = 'https://cdn.example.org/videoplayback?itag=140'
const M4A = { buffer: Buffer.from('m4a'), mimeType: 'audio/mp4', ext: 'm4a' }
const MP3 = { buffer: Buffer.from('mp3'), mimeType: 'audio/mpeg', ext: 'mp3' }

function seite(media: WebPageMedia[] = []): WebPageExtract {
  return { url: SEITE_URL, title: 'Side Event', description: '', siteName: '', author: '', datePublished: '', imageUrl: '', language: '', bloecke: [], media }
}

function aufgeloest(felder: Partial<ResolvedMedia> = {}): ResolvedMedia {
  return {
    directUrl: DIREKT_URL, ext: 'm4a', title: 'Side Event', duration: 5120, istAudio: true, protocol: 'https',
    httpHeaders: { 'User-Agent': 'yt-dlp' }, extractor: 'generic', metadata: null, filesize: null, httpChunkSize: null, ...felder,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  wege.downloadMedia.mockResolvedValue(MP3)
  wege.downloadMediaViaSecretary.mockResolvedValue({ ...M4A, duration: 5120, istAudio: true })
  wege.downloadDeclaredMedia.mockResolvedValue(MP3)
})

describe('holeMedium: Quelle drosselt den Abruf am Stueck', () => {
  it('http_chunk_size gesetzt: der Secretary laedt, kein eigener Abruf', async () => {
    const ergebnis = await holeMedium(seite(), aufgeloest({ httpChunkSize: 10_485_760, filesize: 83_000_000, extractor: 'vimeo' }), 'cookies.txt')
    expect(ergebnis).toMatchObject({ weg: 'secretary-download', dauer: 5120, datei: M4A })
    expect(wege.downloadMedia).not.toHaveBeenCalled()
    expect(wege.downloadMediaViaSecretary).toHaveBeenCalledWith(SEITE_URL, undefined, 'cookies.txt')
  })

  it('Uebergangsregel: YouTube ohne das Feld (aelterer Secretary) laedt ebenfalls der Secretary', async () => {
    const ergebnis = await holeMedium(seite(), aufgeloest({ extractor: 'youtube', httpChunkSize: null }))
    expect(ergebnis).toMatchObject({ weg: 'secretary-download' })
    expect(wege.downloadMedia).not.toHaveBeenCalled()
  })

  it('Podcast ohne das Feld: eigener Abruf der direkten Adresse, der Secretary laedt nicht', async () => {
    const ergebnis = await holeMedium(seite(), aufgeloest({ ext: 'mp3', extractor: 'generic', duration: 1800 }))
    expect(ergebnis).toMatchObject({ weg: 'secretary', dauer: 1800, datei: MP3 })
    expect(wege.downloadMedia).toHaveBeenCalledWith(DIREKT_URL, { ext: 'mp3', istAudio: true, httpHeaders: { 'User-Agent': 'yt-dlp' } })
    expect(wege.downloadMediaViaSecretary).not.toHaveBeenCalled()
  })

  it('Stream und Video gehen wie bisher an den Secretary', async () => {
    expect(await holeMedium(seite(), aufgeloest({ protocol: 'm3u8_native' }))).toMatchObject({ weg: 'secretary-download' })
    expect(await holeMedium(seite(), aufgeloest({ istAudio: false, ext: 'mp4' }))).toMatchObject({ weg: 'secretary-download' })
    expect(wege.downloadMedia).not.toHaveBeenCalled()
  })
})

describe('holeMedium: der eigene Abruf scheitert', () => {
  it('Zeitgrenze: Rueckfall auf den Download des Secretary', async () => {
    wege.downloadMedia.mockRejectedValue(new Error('Abruf nach 600 s abgebrochen (Zeitgrenze): https://cdn.example.org/videoplayback'))
    const ergebnis = await holeMedium(seite(), aufgeloest(), null)
    expect(ergebnis).toMatchObject({ weg: 'secretary-download', datei: M4A })
    expect(wege.downloadMedia).toHaveBeenCalledTimes(1)
    expect(wege.downloadMediaViaSecretary).toHaveBeenCalledWith(SEITE_URL, undefined, null)
    expect(wege.downloadDeclaredMedia).not.toHaveBeenCalled()
  })

  it('beide scheitern, die Seite nennt keine Adresse: der Grund nennt beide Fehler', async () => {
    wege.downloadMedia.mockRejectedValue(new Error('Medien-Download HTTP 403 fuer https://cdn.example.org/videoplayback'))
    wege.downloadMediaViaSecretary.mockRejectedValue(new Error('Secretary media/download: [DOWNLOAD_FAILED] Sign in to confirm'))
    const ergebnis = await holeMedium(seite(), aufgeloest())
    expect(ergebnis).toEqual({
      grund:
        'yt-dlp: Direktabruf: Medien-Download HTTP 403 fuer https://cdn.example.org/videoplayback; ' +
        'Secretary-Download: Secretary media/download: [DOWNLOAD_FAILED] Sign in to confirm; ' +
        'die Seite nennt keine direkte Audio-/Video-Adresse',
    })
  })

  it('beide scheitern, die Seite nennt eine Adresse: sie ist der letzte Weg — scheitert auch sie, stehen alle drei Fehler im Grund', async () => {
    const mitAdresse = seite([{ url: 'https://example.org/a.mp3', art: 'audio', herkunft: 'json-ld' }])
    wege.downloadMedia.mockRejectedValue(new Error('socket hang up'))
    wege.downloadMediaViaSecretary.mockRejectedValue(new Error('Secretary media/download: [SECRETARY_ERROR] HTTP 502'))
    expect(await holeMedium(mitAdresse, aufgeloest())).toMatchObject({ weg: 'seite', dauer: null, datei: MP3 })
    expect(wege.downloadDeclaredMedia).toHaveBeenCalledWith('https://example.org/a.mp3', SEITE_URL)

    wege.downloadDeclaredMedia.mockRejectedValue(new Error('Medien-Download HTTP 404 fuer https://example.org/a.mp3'))
    const ergebnis = await holeMedium(mitAdresse, aufgeloest())
    expect('grund' in ergebnis && ergebnis.grund).toBe(
      'yt-dlp: Direktabruf: socket hang up; Secretary-Download: Secretary media/download: [SECRETARY_ERROR] HTTP 502; ' +
        'Adresse der Seite (json-ld): Medien-Download HTTP 404 fuer https://example.org/a.mp3',
    )
  })

  it('gesperrte Adresse: der Schutz wird nicht ueber den Secretary umgangen', async () => {
    wege.downloadMedia.mockRejectedValue(new AdresseGesperrtError('"10.0.0.5" ist eine interne Adresse und wird nicht abgerufen'))
    const ergebnis = await holeMedium(seite(), aufgeloest())
    expect(wege.downloadMediaViaSecretary).not.toHaveBeenCalled()
    expect('grund' in ergebnis && ergebnis.grund).toContain('Direktabruf: "10.0.0.5" ist eine interne Adresse')
  })

  it('Secretary-Download ohne vorherigen eigenen Abruf scheitert: nur dieser Fehler im Grund', async () => {
    wege.downloadMediaViaSecretary.mockRejectedValue(new Error('Secretary media/download lieferte 0 Bytes'))
    const ergebnis = await holeMedium(seite(), aufgeloest({ httpChunkSize: 10_485_760 }))
    expect(ergebnis).toEqual({ grund: 'yt-dlp: Secretary media/download lieferte 0 Bytes; die Seite nennt keine direkte Audio-/Video-Adresse' })
  })

  it('media/resolve selbst gescheitert: kein Ladeversuch ueber yt-dlp, Grund wie bisher', async () => {
    const ergebnis = await holeMedium(seite(), { fehler: 'Secretary media/resolve: [RESOLVE_FAILED] Unsupported URL' })
    expect(wege.downloadMedia).not.toHaveBeenCalled()
    expect(wege.downloadMediaViaSecretary).not.toHaveBeenCalled()
    expect(ergebnis).toEqual({ grund: 'yt-dlp: Secretary media/resolve: [RESOLVE_FAILED] Unsupported URL; die Seite nennt keine direkte Audio-/Video-Adresse' })
  })
})
