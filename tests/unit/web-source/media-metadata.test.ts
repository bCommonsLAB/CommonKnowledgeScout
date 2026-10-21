import { describe, expect, it } from 'vitest'
import { istVideoExtractor, parseMediaMetadata, uploadDateZuIso, zeitmarke } from '@/lib/web-source/media-metadata'

describe('parseMediaMetadata (Welle K1)', () => {
  it('liest den Block typgeprueft: Datum nach ISO, Kapitel mit Zeitmarken, Tags nur als Text', () => {
    const m = parseMediaMetadata({
      description: 'Zu Gast: eine Moderatorin\n\nThema des Abends',
      upload_date: '20151109',
      uploader: 'Kanal X',
      channel: 'Kanal X',
      chapters: [
        { start_time: 0, end_time: 120.5, title: 'Begruessung' },
        { start_time: 120.5, title: 'Gespraech' },
        { title: 'ohne Start' },
        'kaputt',
      ],
      tags: ['dialog', 42, ''],
      thumbnail: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      webpage_url: 'https://www.youtube.com/watch?v=abc',
    })
    expect(m).not.toBeNull()
    expect(m?.uploadDate).toBe('2015-11-09')
    expect(m?.kapitel).toEqual([
      { start: 0, ende: 120.5, titel: 'Begruessung' },
      { start: 120.5, ende: null, titel: 'Gespraech' },
    ])
    expect(m?.tags).toEqual(['dialog'])
    expect(m?.thumbnail).toContain('maxresdefault')
  })

  it('fehlender oder falscher Block ergibt null — kein geratenes Objekt', () => {
    expect(parseMediaMetadata(undefined)).toBeNull()
    expect(parseMediaMetadata('text')).toBeNull()
    expect(parseMediaMetadata([])).toBeNull()
  })

  it('Antwortform des Secretary (Welle S): upload_date schon als ISO oder null, Kapitel mit title/start_time/end_time', () => {
    const m = parseMediaMetadata({
      id: 'abc', description: null, upload_date: '2015-11-09', uploader: null, channel: 'Kanal', chapters: [{ title: 'Start', start_time: 0, end_time: 12 }],
      tags: [], thumbnail: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg', webpage_url: 'https://www.youtube.com/watch?v=abc',
    })
    expect(m).toMatchObject({ description: '', uploadDate: '2015-11-09', uploader: '', channel: 'Kanal', kapitel: [{ titel: 'Start', start: 0, ende: 12 }] })
    expect(parseMediaMetadata({ upload_date: null })?.uploadDate).toBe('')
  })

  it('leerer Block: alle Felder leer, kein Datum', () => {
    const m = parseMediaMetadata({})
    expect(m).toEqual({ description: '', uploadDate: '', uploader: '', channel: '', kapitel: [], tags: [], thumbnail: '', webpageUrl: '' })
  })
})

describe('uploadDateZuIso', () => {
  it('YYYYMMDD und ISO-Praefix; alles andere bleibt leer', () => {
    expect(uploadDateZuIso('20260321')).toBe('2026-03-21')
    expect(uploadDateZuIso('2026-03-21T10:00:00Z')).toBe('2026-03-21')
    expect(uploadDateZuIso('gestern')).toBe('')
    expect(uploadDateZuIso(20260321)).toBe('')
  })
})

describe('istVideoExtractor', () => {
  it('youtube, vimeo, peertube samt Unter-Extractoren; andere Seiten nicht', () => {
    expect(istVideoExtractor('youtube')).toBe(true)
    expect(istVideoExtractor('Youtube')).toBe(true)
    expect(istVideoExtractor('youtube:tab')).toBe(true)
    expect(istVideoExtractor('vimeo')).toBe(true)
    expect(istVideoExtractor('PeerTube')).toBe(true)
    expect(istVideoExtractor('rai')).toBe(false)
    expect(istVideoExtractor('generic')).toBe(false)
    expect(istVideoExtractor('')).toBe(false)
  })
})

describe('zeitmarke', () => {
  it('m:ss unter einer Stunde, h:mm:ss darueber', () => {
    expect(zeitmarke(0)).toBe('0:00')
    expect(zeitmarke(75.9)).toBe('1:15')
    expect(zeitmarke(3600)).toBe('1:00:00')
    expect(zeitmarke(3661)).toBe('1:01:01')
  })
})
