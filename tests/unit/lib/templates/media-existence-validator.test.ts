/**
 * Unit-Tests fuer media-existence-validator.
 *
 * Fixiert das Verhalten der Phantom-Erkennung fuer alle Medien-Felder:
 * coverImageUrl (string), galleryImageUrls / speakers_image_url /
 * authors_image_url / attachments_url (array).
 *
 * Coverage-Schwerpunkte:
 * - String-Feld: gueltig / Phantom / null / leerer String
 * - Array-Feld: alle gueltig / alle Phantome / gemischt / leer / nicht-strings
 * - Twin-Relativpfad-Match (frontmatterRef)
 * - Absolute URLs werden rejected
 * - buildMediaFieldsConfig pro DetailViewType
 *
 * @see src/lib/templates/media-existence-validator.ts
 * @see docs/refactor/cover-image-deterministic-flow/
 */

import { describe, it, expect } from 'vitest'
import {
  validateMediaExistence,
  buildMediaFieldsConfig,
  type AvailableMediaEntry,
  type MediaFieldsConfig,
} from '@/lib/templates/media-existence-validator'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const cover: MediaFieldsConfig = {
  stringFields: ['coverImageUrl'],
  arrayFields: [],
}

const coverAndGallery: MediaFieldsConfig = {
  stringFields: ['coverImageUrl'],
  arrayFields: ['galleryImageUrls'],
}

const sessionConfig: MediaFieldsConfig = {
  stringFields: ['coverImageUrl'],
  arrayFields: ['speakers_image_url', 'attachments_url'],
}

const availableWebp: AvailableMediaEntry[] = [
  {
    name: 'dell-optiplex-7060-sff-1665130604.webp',
    mimeType: 'image/webp',
    source: 'sibling',
  },
]

const availableMixed: AvailableMediaEntry[] = [
  { name: 'cover.png', mimeType: 'image/png', source: 'sibling' },
  { name: 'gallery-01.jpg', mimeType: 'image/jpeg', source: 'sibling' },
  { name: 'gallery-02.webp', mimeType: 'image/webp', source: 'sibling' },
  {
    name: 'img-0.jpeg',
    mimeType: 'image/jpeg',
    source: 'fragment',
    frontmatterRef: '_quelle.pdf/img-0.jpeg',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// String-Feld (coverImageUrl)
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMediaExistence — String-Feld', () => {
  it('behaelt gueltigen Wert unveraendert (Match auf name)', () => {
    const meta = { coverImageUrl: 'dell-optiplex-7060-sff-1665130604.webp' }
    const result = validateMediaExistence(meta, availableWebp, cover)
    expect(result.cleanedMeta.coverImageUrl).toBe(
      'dell-optiplex-7060-sff-1665130604.webp',
    )
    expect(result.hasChanges).toBe(false)
    expect(result.report.rejected).toEqual({})
  })

  it('setzt Phantom-Wert auf null und meldet ihn im Report', () => {
    const meta = { coverImageUrl: 'thinkpad-t480-front.jpg' }
    const result = validateMediaExistence(meta, availableWebp, cover)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.hasChanges).toBe(true)
    expect(result.report.rejected).toEqual({
      coverImageUrl: ['thinkpad-t480-front.jpg'],
    })
  })

  it('beibehaelt null unveraendert (kein Eintrag im Report)', () => {
    const meta = { coverImageUrl: null }
    const result = validateMediaExistence(meta, availableWebp, cover)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.hasChanges).toBe(false)
    expect(result.report.rejected).toEqual({})
  })

  it('beibehaelt leeren String unveraendert (kein Eintrag im Report)', () => {
    const meta = { coverImageUrl: '' }
    const result = validateMediaExistence(meta, availableWebp, cover)
    expect(result.cleanedMeta.coverImageUrl).toBe('')
    expect(result.hasChanges).toBe(false)
  })

  it('akzeptiert Match auf frontmatterRef (Twin-Relativpfad)', () => {
    const meta = { coverImageUrl: '_quelle.pdf/img-0.jpeg' }
    const result = validateMediaExistence(meta, availableMixed, cover)
    expect(result.cleanedMeta.coverImageUrl).toBe('_quelle.pdf/img-0.jpeg')
    expect(result.hasChanges).toBe(false)
  })

  it('rejected absolute http-URL', () => {
    const meta = { coverImageUrl: 'https://example.com/cover.jpg' }
    const result = validateMediaExistence(meta, availableMixed, cover)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.hasChanges).toBe(true)
    expect(result.report.rejected.coverImageUrl).toEqual([
      'https://example.com/cover.jpg',
    ])
  })

  it('rejected blob-URL', () => {
    const meta = { coverImageUrl: 'blob:https://app.example.com/abc' }
    const result = validateMediaExistence(meta, availableMixed, cover)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.hasChanges).toBe(true)
  })

  it('rejected data-URL', () => {
    const meta = { coverImageUrl: 'data:image/png;base64,iVBORw0KGgo=' }
    const result = validateMediaExistence(meta, availableMixed, cover)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.hasChanges).toBe(true)
  })

  it('mutiert Original-meta NICHT (immutable)', () => {
    const meta = { coverImageUrl: 'thinkpad-t480-front.jpg', other: 'keep' }
    const result = validateMediaExistence(meta, availableWebp, cover)
    expect(meta.coverImageUrl).toBe('thinkpad-t480-front.jpg')
    expect(result.cleanedMeta.other).toBe('keep')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Array-Feld (galleryImageUrls etc.)
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMediaExistence — Array-Feld', () => {
  it('behaelt vollstaendig gueltige Liste unveraendert', () => {
    const meta = {
      galleryImageUrls: ['gallery-01.jpg', 'gallery-02.webp'],
    }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([
      'gallery-01.jpg',
      'gallery-02.webp',
    ])
    expect(result.hasChanges).toBe(false)
  })

  it('filtert Phantome heraus, behaelt gueltige', () => {
    const meta = {
      galleryImageUrls: [
        'gallery-01.jpg',
        'phantom-1.jpg',
        'gallery-02.webp',
        'phantom-2.png',
      ],
    }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([
      'gallery-01.jpg',
      'gallery-02.webp',
    ])
    expect(result.hasChanges).toBe(true)
    expect(result.report.rejected.galleryImageUrls).toEqual([
      'phantom-1.jpg',
      'phantom-2.png',
    ])
  })

  it('liefert leeres Array, wenn alle Phantome', () => {
    const meta = {
      galleryImageUrls: ['phantom-1.jpg', 'phantom-2.jpg'],
    }
    const result = validateMediaExistence(meta, availableWebp, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([])
    expect(result.hasChanges).toBe(true)
    expect(result.report.rejected.galleryImageUrls).toEqual([
      'phantom-1.jpg',
      'phantom-2.jpg',
    ])
  })

  it('beibehaelt leeres Array unveraendert', () => {
    const meta = { galleryImageUrls: [] }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([])
    expect(result.hasChanges).toBe(false)
  })

  it('entfernt leere Strings aus Array (Bereinigung, keine Rejection)', () => {
    const meta = {
      galleryImageUrls: ['gallery-01.jpg', '', '   ', 'gallery-02.webp'],
    }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([
      'gallery-01.jpg',
      'gallery-02.webp',
    ])
    // hasChanges true, weil Liste sich aendert — aber NICHT als Rejection markiert
    expect(result.hasChanges).toBe(true)
    expect(result.report.rejected.galleryImageUrls).toBeUndefined()
  })

  it('beibehaelt Nicht-String-Eintraege defensiv (kein Schema-Bruch)', () => {
    const meta = {
      galleryImageUrls: ['gallery-01.jpg', null, 42, 'gallery-02.webp'],
    }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    // null und 42 bleiben, weil sie keine pruefbaren Strings sind
    expect(result.cleanedMeta.galleryImageUrls).toEqual([
      'gallery-01.jpg',
      null,
      42,
      'gallery-02.webp',
    ])
  })

  it('akzeptiert Twin-Relativpfad in Array', () => {
    const meta = {
      galleryImageUrls: ['gallery-01.jpg', '_quelle.pdf/img-0.jpeg'],
    }
    const result = validateMediaExistence(meta, availableMixed, coverAndGallery)
    expect(result.cleanedMeta.galleryImageUrls).toEqual([
      'gallery-01.jpg',
      '_quelle.pdf/img-0.jpeg',
    ])
    expect(result.hasChanges).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mehrere Felder gleichzeitig (session)
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMediaExistence — Mehrere Felder (session)', () => {
  it('validiert coverImageUrl + speakers_image_url + attachments_url', () => {
    const meta = {
      coverImageUrl: 'cover.png',
      speakers_image_url: ['gallery-01.jpg', 'phantom.jpg'],
      attachments_url: ['phantom.pdf'],
    }
    const result = validateMediaExistence(meta, availableMixed, sessionConfig)
    expect(result.cleanedMeta.coverImageUrl).toBe('cover.png')
    expect(result.cleanedMeta.speakers_image_url).toEqual(['gallery-01.jpg'])
    expect(result.cleanedMeta.attachments_url).toEqual([])
    expect(result.report.rejected).toEqual({
      speakers_image_url: ['phantom.jpg'],
      attachments_url: ['phantom.pdf'],
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Empty available media
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMediaExistence — leere availableMedia-Liste', () => {
  it('rejected ALLE Werte, wenn availableMedia leer ist', () => {
    const meta = {
      coverImageUrl: 'cover.png',
      galleryImageUrls: ['a.jpg', 'b.jpg'],
    }
    const result = validateMediaExistence(meta, [], coverAndGallery)
    expect(result.cleanedMeta.coverImageUrl).toBeNull()
    expect(result.cleanedMeta.galleryImageUrls).toEqual([])
    expect(result.hasChanges).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Report-Struktur
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMediaExistence — Report-Struktur', () => {
  it('Report enthaelt available-Snapshot und Zeitstempel', () => {
    const meta = { coverImageUrl: 'cover.png' }
    const result = validateMediaExistence(meta, availableMixed, cover)
    expect(result.report.available).toEqual([
      'cover.png',
      'gallery-01.jpg',
      'gallery-02.webp',
      'img-0.jpeg',
    ])
    expect(result.report.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildMediaFieldsConfig
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMediaFieldsConfig', () => {
  it('book: coverImageUrl + authors_image_url', () => {
    const cfg = buildMediaFieldsConfig('book')
    expect(cfg.stringFields).toContain('coverImageUrl')
    expect(cfg.arrayFields).toContain('authors_image_url')
    // book hat keinen galleryField und keine attachments
    expect(cfg.arrayFields).not.toContain('galleryImageUrls')
    expect(cfg.arrayFields).not.toContain('attachments_url')
  })

  it('session: coverImageUrl + galleryImageUrls + speakers_image_url + attachments_url', () => {
    const cfg = buildMediaFieldsConfig('session')
    expect(cfg.stringFields).toEqual(['coverImageUrl'])
    expect(cfg.arrayFields).toEqual(
      expect.arrayContaining([
        'galleryImageUrls',
        'speakers_image_url',
        'attachments_url',
      ]),
    )
  })

  it('refurbedDevice: coverImageUrl + galleryImageUrls', () => {
    const cfg = buildMediaFieldsConfig('refurbedDevice')
    expect(cfg.stringFields).toEqual(['coverImageUrl'])
    expect(cfg.arrayFields).toEqual(['galleryImageUrls'])
  })

  it('testimonial: keine coverImage, nur author_image_url als Array', () => {
    const cfg = buildMediaFieldsConfig('testimonial')
    expect(cfg.stringFields).not.toContain('coverImageUrl')
    expect(cfg.arrayFields).toEqual(['author_image_url'])
  })

  it('unbekannter ViewType: nur coverImageUrl als Default-Minimum', () => {
    const cfg = buildMediaFieldsConfig('totally-unknown-type')
    expect(cfg.stringFields).toEqual(['coverImageUrl'])
    expect(cfg.arrayFields).toEqual([])
  })

  it('climateAction: nur coverImageUrl, keine Arrays', () => {
    const cfg = buildMediaFieldsConfig('climateAction')
    expect(cfg.stringFields).toEqual(['coverImageUrl'])
    expect(cfg.arrayFields).toEqual([])
  })
})
