/**
 * Welle D — Bereiche von konfiguration_setzen: Facetten als Ganzes, Antwortregeln
 * mit Loeschen, chat/galerie als Teil-Update mit Sperrliste, nur echte Aenderungen.
 */
import { describe, it, expect } from 'vitest'
import { chatSicht, wendeKonfigurationAn } from '@/lib/mcp/konfiguration-bereiche'

const ALT = {
  placeholder: 'Frage?', antwortregeln: 'Gliedere nach {{facette:lv_bewertung}}.',
  embeddings: { embeddingModel: 'voyage-3-large', dimensions: 2048 },
  gallery: { detailViewType: 'climateAction', defaultSortField: 'massnahme_nr', facets: [{ metaKey: 'lv_bewertung', type: 'string' }] },
}

describe('wendeKonfigurationAn', () => {
  it('ersetzt Facetten als Ganzes und laesst die uebrige Galerie stehen', () => {
    const { chat, geaendert } = wendeKonfigurationAn(ALT, { facetten: [{ metaKey: 'arbeitsgruppe', type: 'string' }] })
    expect(geaendert).toEqual(['facetten'])
    expect(chat.gallery).toEqual({ detailViewType: 'climateAction', defaultSortField: 'massnahme_nr', facets: [{ metaKey: 'arbeitsgruppe', type: 'string' }] })
  })

  it('setzt und loescht Antwortregeln, zaehlt Gleiches nicht als Aenderung', () => {
    expect(wendeKonfigurationAn(ALT, { antwortregeln: 'Gliedere nach {{facette:lv_bewertung}}.' }).geaendert).toEqual([])
    const { chat, geaendert } = wendeKonfigurationAn(ALT, { antwortregeln: '  ' })
    expect(geaendert).toEqual(['antwortregeln'])
    expect(chat).not.toHaveProperty('antwortregeln')
  })

  it('macht Teil-Updates an chat und galerie und nennt die Schluessel', () => {
    const { chat, geaendert } = wendeKonfigurationAn(ALT, { chat: { placeholder: 'Was willst du wissen?', maxChars: 800 }, galerie: { defaultSortDirection: 'asc' } })
    expect(geaendert).toEqual(['chat.placeholder', 'chat.maxChars', 'galerie.defaultSortDirection'])
    expect(chat.placeholder).toBe('Was willst du wissen?')
    expect((chat.gallery as Record<string, unknown>).defaultSortDirection).toBe('asc')
    expect((chat.gallery as Record<string, unknown>).facets).toEqual(ALT.gallery.facets)
  })

  it('weist Infrastruktur und unbekannte Schluessel laut ab', () => {
    expect(() => wendeKonfigurationAn(ALT, { chat: { embeddings: { dimensions: 1 } } })).toThrow(/nicht ueber die Bruecke setzbar: embeddings/)
    expect(() => wendeKonfigurationAn(ALT, { galerie: { facets: [] } })).toThrow(/galerie: unbekannt/)
  })

  it('arbeitet auch ohne bestehende Konfiguration', () => {
    const { chat, geaendert } = wendeKonfigurationAn(undefined, { galerie: { detailViewType: 'book' } })
    expect(geaendert).toEqual(['galerie.detailViewType'])
    expect(chat).toEqual({ gallery: { detailViewType: 'book' } })
  })
})

describe('chatSicht', () => {
  it('liefert je Bereich die passende Sicht, Infrastruktur nur lesbar', () => {
    expect(chatSicht(ALT, 'facetten')).toEqual(ALT.gallery.facets)
    expect(chatSicht(ALT, 'antwortregeln')).toBe(ALT.antwortregeln)
    expect(chatSicht(ALT, 'galerie')).toMatchObject({ detailViewType: 'climateAction', defaultSortField: 'massnahme_nr', groupByField: null })
    const chat = chatSicht(ALT, 'chat') as { placeholder: string; nurLesbar: { embeddings: unknown } }
    expect(chat.placeholder).toBe('Frage?')
    expect(chat.nurLesbar.embeddings).toEqual(ALT.embeddings)
    expect(chatSicht(undefined, 'facetten')).toEqual([])
  })
})
