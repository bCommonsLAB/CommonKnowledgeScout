/**
 * Welle D — Chat-Konfiguration: Merge wie die PATCH-Route, Pruefung wie das
 * Formular (Platzhalter gegen Facetten, Woerterbuch zum Typ), lesbare Fehler.
 */
import { describe, it, expect } from 'vitest'
import {
  formatiereChatKonfigurationFehler, mergeChatKonfiguration, validiereChatKonfiguration,
} from '@/lib/services/chat-config-validation'

const FACETTEN = [
  { metaKey: 'lv_bewertung', label: 'Bewertung', type: 'string', multi: false, visible: true,
    werte: [{ wert: 'beschlossen', label: 'beschlossen' }] },
]

describe('mergeChatKonfiguration', () => {
  it('ersetzt genannte Schluessel und laesst ungenannte stehen', () => {
    const alt = { placeholder: 'Frage?', antwortregeln: 'alt', gallery: { detailViewType: 'book', facets: [] } }
    expect(mergeChatKonfiguration(alt, { antwortregeln: 'neu' })).toEqual({ ...alt, antwortregeln: 'neu' })
    expect(mergeChatKonfiguration(undefined, { maxChars: 300 })).toEqual({ maxChars: 300 })
  })
})

describe('validiereChatKonfiguration', () => {
  it('nimmt eine gueltige Konfiguration an und liefert sie normalisiert', () => {
    const r = validiereChatKonfiguration({ antwortregeln: 'Gliedere nach {{facette:lv_bewertung}}.', gallery: { detailViewType: 'book', facets: FACETTEN } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.config.gallery.facets[0].metaKey).toBe('lv_bewertung')
  })

  it('weist einen Platzhalter auf eine unbekannte Facette mit Pfad ab', () => {
    const r = validiereChatKonfiguration({ antwortregeln: '{{facette:gibt_es_nicht}}', gallery: { detailViewType: 'book', facets: FACETTEN } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.fehler).toHaveLength(1)
      expect(r.fehler[0]).toMatch(/^antwortregeln: \{\{facette:gibt_es_nicht\}\}/)
      expect(formatiereChatKonfigurationFehler(r.fehler)).toContain('Chat-Konfiguration ungueltig')
    }
  })

  it('weist ein Woerterbuch an einer Zahl-Facette und falsche Typen ab', () => {
    const r = validiereChatKonfiguration({
      maxChars: 'viel',
      gallery: { detailViewType: 'book', facets: [{ metaKey: 'jahr', type: 'number', werte: [{ wert: '1', label: '1' }] }] },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fehler.some((f) => f.startsWith('maxChars'))).toBe(true)
  })
})
