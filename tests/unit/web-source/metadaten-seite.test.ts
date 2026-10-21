import { describe, expect, it } from 'vitest'
import { baueArtikelSammeldatei } from '@/lib/web-source/artikel-sammeldatei'
import { parseMediaMetadata } from '@/lib/web-source/media-metadata'
import { beschreibungInBloecke, seiteAusMetadaten } from '@/lib/web-source/metadaten-seite'

const METADATA = parseMediaMetadata({
  description: 'Zu Gast: eine Moderatorin und ein Gast.\r\n\r\nThema: Wie geht es weiter?\nZweite Zeile des Absatzes.\n\n\n',
  upload_date: '20151109',
  uploader: 'Kanal X',
  channel: 'Dialogreihe Kanal',
  chapters: [{ start_time: 0, end_time: 90, title: 'Begruessung' }, { start_time: 90, title: 'Gespraech' }],
  thumbnail: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
  webpage_url: 'https://www.youtube.com/watch?v=abc',
})
if (!METADATA) throw new Error('Fixture ohne Metadaten')

describe('beschreibungInBloecke (Welle K2)', () => {
  it('teilt woertlich an Leerzeilen, Zeilen im Absatz bleiben, Leerraum am Ende faellt', () => {
    expect(beschreibungInBloecke(METADATA.description)).toEqual([
      'Zu Gast: eine Moderatorin und ein Gast.',
      'Thema: Wie geht es weiter?\nZweite Zeile des Absatzes.',
    ])
    expect(beschreibungInBloecke('')).toEqual([])
  })
})

describe('seiteAusMetadaten', () => {
  it('baut das Seitenbild aus yt-dlp: Kanal als Quelle, Upload-Datum, Thumbnail, keine geratene Kurzbeschreibung', () => {
    const seite = seiteAusMetadaten({ url: 'https://www.youtube.com/watch?v=abc&list=PL1', title: 'start.klar. Folge 1', metadata: METADATA })
    expect(seite.title).toBe('start.klar. Folge 1')
    expect(seite.siteName).toBe('Dialogreihe Kanal')
    expect(seite.datePublished).toBe('2015-11-09')
    expect(seite.imageUrl).toContain('maxresdefault')
    expect(seite.description).toBe('')
    expect(seite.author).toBe('')
    expect(seite.bloecke).toHaveLength(2)
    expect(seite.media).toEqual([])
    expect(seite.url).toBe('https://www.youtube.com/watch?v=abc')
  })

  it('ohne Titel scheitert es laut', () => {
    expect(() => seiteAusMetadaten({ url: 'https://www.youtube.com/watch?v=abc', title: '  ', metadata: METADATA })).toThrow(/Titel/)
  })
})

describe('Sammeldatei aus yt-dlp-Metadaten', () => {
  it('traegt Beschreibung woertlich, Kapitel mit Zeitmarken, video_url, Datum und Kanal', () => {
    const seite = seiteAusMetadaten({ url: 'https://www.youtube.com/watch?v=abc', title: 'start.klar. Folge 1', metadata: METADATA })
    const md = baueArtikelSammeldatei({
      seite, medienDatei: '01 start.klar. Folge 1 - Audio.m4a', coverDatei: '01 start.klar. Folge 1 - Cover.jpg',
      medienDauerSekunden: 3725, videoEmbedUrl: 'https://www.youtube.com/embed/abc', kapitel: METADATA.kapitel,
    })
    expect(md).toContain('title: "start.klar. Folge 1"')
    expect(md).toContain('date: "2015-11-09"')
    expect(md).toContain('source: "Dialogreihe Kanal"')
    expect(md).toContain('video_url: "https://www.youtube.com/embed/abc"')
    expect(md).toContain('## Artikel')
    expect(md).toContain('Zu Gast: eine Moderatorin und ein Gast.')
    expect(md).toContain('## Kapitel')
    expect(md).toContain('- 0:00 Begruessung')
    expect(md).toContain('- 1:30 Gespraech')
    expect(md).toContain('[[01 start.klar. Folge 1 - Audio.m4a]] (62:05 min)')
    expect(md).toContain('Cover: [[01 start.klar. Folge 1 - Cover.jpg]]')
  })

  it('Video ohne Beschreibung: nur mit ohneTextErlaubt, dann ohne Abschnitt Artikel', () => {
    const leer = { ...METADATA, description: '', kapitel: [] }
    const seite = seiteAusMetadaten({ url: 'https://www.youtube.com/watch?v=abc', title: 'Folge ohne Text', metadata: leer })
    const input = { seite, medienDatei: 'x - Audio.m4a', coverDatei: null, medienDauerSekunden: null }
    expect(() => baueArtikelSammeldatei(input)).toThrow(/ohne Artikeltext/)
    const md = baueArtikelSammeldatei({ ...input, ohneTextErlaubt: true })
    expect(md).not.toContain('## Artikel')
    expect(md).not.toContain('## Kapitel')
    expect(md).toContain('# Folge ohne Text')
    expect(md).toContain('[[x - Audio.m4a]]')
  })
})
