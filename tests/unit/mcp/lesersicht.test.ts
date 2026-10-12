/**
 * Welle K1 — Lesersicht eines Meta-Dokuments: Cover, Anhaenge als Paare,
 * Folien mit/ohne Adresse, Galerie-Adresse oder Grund. Fixture folgt der Form,
 * die `upsertVectorMeta` schreibt (`docMetaJson` + Top-Level-Felder).
 */
import { describe, expect, it } from 'vitest'
import { anhaengeAusMeta, folienAusMeta, galerieAdresse, lesersichtAusMeta, lesersichtKurz } from '@/lib/mcp/lesersicht'

const CORBO = {
  _id: 'src-corbo-meta', kind: 'meta', fileId: 'src-corbo', fileName: '03 Vortrag Corbo.md',
  title: 'Vortrag Corbo', detailViewType: 'session', slug: 'vortrag-corbo', upsertedAt: '2026-10-11T20:00:00.000Z',
  publication: { status: 'published' },
  docMetaJson: {
    title: 'Vortrag Corbo', detailViewType: 'session',
    coverImageUrl: 'https://blob.example/page_002.jpeg', coverThumbnailUrl: 'https://blob.example/preview_002.jpeg',
    attachments_url: ['https://blob.example/corbo.pdf', 'https://blob.example/flyer.pdf'],
    attachments_names: ['Corbo Folien.pdf'],
    slides: [
      { page_num: 1, image_url: 'https://blob.example/preview_001.jpeg' },
      { page_num: 2, image_url: 'preview_002.jpg' },
      { title: 'ohne Seitenzahl' },
    ],
    galleryImageUrls: ['https://blob.example/a.jpg', 'https://blob.example/b.jpg'],
  },
}

describe('lesersichtAusMeta', () => {
  it('zeigt dieselben Werte wie Galerie-Karte und Session-Detail', () => {
    const sicht = lesersichtAusMeta(CORBO)
    expect(sicht).toMatchObject({
      titel: 'Vortrag Corbo', detailViewType: 'session', publikation: 'published',
      coverImageUrl: 'https://blob.example/page_002.jpeg', coverThumbnailUrl: 'https://blob.example/preview_002.jpeg',
      galerieBilder: 2, upsertedAt: '2026-10-11T20:00:00.000Z', hinweise: [],
    })
    expect(sicht.anhaenge).toEqual([
      { name: 'Corbo Folien.pdf', url: 'https://blob.example/corbo.pdf' },
      { name: null, url: 'https://blob.example/flyer.pdf' },
    ])
    // Nackter Name ist KEINE Adresse; ohne page_num zaehlt die Position.
    expect(sicht.folien).toEqual({ anzahl: 3, mitAdresse: 1, ohneAdresse: [2, 3] })
  })

  it('nennt slides als Text statt es still als leer zu zaehlen', () => {
    const sicht = lesersichtAusMeta({ docMetaJson: { slides: '[{"page_num":1}]' } })
    expect(sicht.folien).toBeNull()
    expect(sicht.hinweise[0]).toMatch(/slides liegt .* nicht als Liste vor \(string\)/)
    expect(folienAusMeta({})).toEqual({ folien: { anzahl: 0, mitAdresse: 0, ohneAdresse: [] }, hinweis: null })
  })

  it('liest ein leeres Cover als null und eine String-Adresse als einen Anhang', () => {
    const sicht = lesersichtAusMeta({ docMetaJson: { coverImageUrl: '', attachments_url: 'https://x/a.pdf' } })
    expect(sicht.coverImageUrl).toBeNull()
    expect(anhaengeAusMeta({ attachments_url: 'https://x/a.pdf' })).toEqual([{ name: null, url: 'https://x/a.pdf' }])
    expect(sicht.anhaenge).toHaveLength(1)
  })
})

describe('lesersichtKurz', () => {
  it('liefert die Kurzform fuer dokumente_auflisten', () => {
    expect(lesersichtKurz(CORBO.docMetaJson)).toEqual({ cover: true, anhaenge: 2, folienMitAdresse: 1, folienAnzahl: 3 })
    expect(lesersichtKurz({ slides: 'text' })).toEqual({ cover: false, anhaenge: 0, folienMitAdresse: null, folienAnzahl: null })
  })
})

describe('galerieAdresse', () => {
  it('baut /explore/<slug>?doc=<docSlug> fuer eine oeffentliche Library', () => {
    expect(galerieAdresse({ publicPublishing: { slugName: 'neuaufbau', publicName: 'N', description: '', isPublic: true } }, CORBO))
      .toEqual({ galerieAdresse: '/explore/neuaufbau?doc=vortrag-corbo', galerieAdresseGrund: null })
  })

  it('nennt den Grund statt einer leeren Adresse', () => {
    expect(galerieAdresse({}, CORBO).galerieAdresseGrund).toMatch(/keinen oeffentlichen Slug/)
    expect(galerieAdresse({ publicPublishing: { slugName: 'n', publicName: 'N', description: '', isPublic: false } }, CORBO).galerieAdresseGrund)
      .toMatch(/nicht oeffentlich/)
    expect(galerieAdresse({ publicPublishing: { slugName: 'n', publicName: 'N', description: '', isPublic: true } }, { docMetaJson: {} }).galerieAdresseGrund)
      .toMatch(/ohne slug/)
  })
})
