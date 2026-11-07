/**
 * Cover-Kandidat aus `_media_files`: nur Eintraege mit Cover-Namen, kein
 * beliebiges Bild; Array oder JSON-Text aus dem flachen Twin-Frontmatter.
 */

import { describe, expect, it } from 'vitest'
import { coverKandidatAusMedienliste, medienlisteAusMeta } from '@/lib/ingestion/cover-aus-medienliste'

describe('coverKandidatAusMedienliste', () => {
  it('nimmt cover.jpg aus einem Array, nicht das Sprecherfoto', () => {
    expect(coverKandidatAusMedienliste({ _media_files: ['speaker-1-jane.jpg', 'cover.jpg'] })).toBe('cover.jpg')
  })

  it('liest die Liste auch als JSON-Text', () => {
    expect(coverKandidatAusMedienliste({ _media_files: '["Talk - Audio.mp3","Talk - Cover.jpg"]' })).toBe('Talk - Cover.jpg')
    expect(medienlisteAusMeta({ _media_files: '["a.png"]' })).toEqual(['a.png'])
  })

  it('gibt den Eintrag mit Pfad zurueck, prueft aber nur den Dateinamen', () => {
    expect(coverKandidatAusMedienliste({ _media_files: ['bilder/Talk.cover.png'] })).toBe('bilder/Talk.cover.png')
  })

  it('liefert null ohne Cover-Namen — kein Ersatz durch ein beliebiges Bild', () => {
    expect(coverKandidatAusMedienliste({ _media_files: ['flyer.png', 'slides.pdf', 'cover.pdf'] })).toBeNull()
    expect(coverKandidatAusMedienliste({ _media_files: ['discover.jpg'] })).toBeNull()
  })

  it('liefert null bei fehlendem oder unlesbarem Feld', () => {
    expect(coverKandidatAusMedienliste({})).toBeNull()
    expect(coverKandidatAusMedienliste({ _media_files: '[cover.jpg' })).toBeNull()
    expect(coverKandidatAusMedienliste({ _media_files: 42 })).toBeNull()
  })
})
