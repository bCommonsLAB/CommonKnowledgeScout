import { describe, it, expect } from 'vitest'
import {
  pruefeAntwortregeln,
  loeseAntwortregelnAuf,
  legendeAlsMarkdown,
  type RegelFacette,
} from '@/lib/chat/antwortregeln'
import { normalizeChatConfig } from '@/lib/chat/config'
import { buildChatMessages, buildTOCMessages, ANTWORTREGELN_UEBERSCHRIFT } from '@/lib/chat/common/prompt'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'
import type { RetrievedSource } from '@/types/retriever'

/**
 * Plan story-status-modalitaet, m2: Antwortregeln pro Library mit Platzhaltern
 * auf das Facetten-Schema. Platzhalter sind Vertrag (unbekannt = Fehler), die
 * aufgelösten Regeln stehen in der System-Message und im Cache-Hash.
 */

const FACETS: RegelFacette[] = [
  {
    metaKey: 'lv_bewertung',
    label: 'Bewertung Landesverwaltung',
    werte: [
      { wert: 'in_umsetzung', label: 'in Umsetzung', bedeutung: 'Laut Landesverwaltung in Umsetzung.', verboten: ['ist umgesetzt'] },
      { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', bedeutung: 'Als nicht umsetzbar bewertet.' },
    ],
  },
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe' },
]

describe('pruefeAntwortregeln', () => {
  it('gültige Platzhalter ergeben keine Fehler; ohne Text nichts zu prüfen', () => {
    expect(pruefeAntwortregeln('Gliedere nach {{facette:lv_bewertung}}.\n{{legende:lv_bewertung}}', FACETS)).toEqual([])
    expect(pruefeAntwortregeln(undefined, FACETS)).toEqual([])
    expect(pruefeAntwortregeln('Keine Platzhalter.', [])).toEqual([])
  })

  it('unbekannte Facette, falsche Art und Legende ohne Wörterbuch sind je ein Fehler', () => {
    const fehler = pruefeAntwortregeln(
      '{{facette:gibt_es_nicht}} {{status:lv_bewertung}} {{legende:arbeitsgruppe}} {{facette:lv_bewertung}}',
      FACETS,
    )
    expect(fehler.map((f) => f.platzhalter)).toEqual([
      '{{facette:gibt_es_nicht}}',
      '{{status:lv_bewertung}}',
      '{{legende:arbeitsgruppe}}',
    ])
    expect(fehler[0].grund).toMatch(/gibt es im Schema nicht/)
    expect(fehler[1].grund).toMatch(/Erlaubt sind nur/)
    expect(fehler[2].grund).toMatch(/kein Bedeutungs-Wörterbuch/)
  })
})

describe('loeseAntwortregelnAuf', () => {
  it('setzt Label und Legende ein', () => {
    const text = loeseAntwortregelnAuf('Gliedere nach {{facette:lv_bewertung}}.\n\n{{legende:lv_bewertung}}', FACETS)
    expect(text).toContain('Gliedere nach Bewertung Landesverwaltung.')
    expect(text).toContain('- in Umsetzung (`in_umsetzung`): Laut Landesverwaltung in Umsetzung. Nicht formulieren: „ist umgesetzt".')
    expect(text).toContain('- nicht umsetzbar (`nicht_umsetzbar`): Als nicht umsetzbar bewertet.')
  })

  it('leerer Text ergibt undefined, ungültiger Text wirft mit Grund', () => {
    expect(loeseAntwortregelnAuf('   ', FACETS)).toBeUndefined()
    expect(loeseAntwortregelnAuf(undefined, FACETS)).toBeUndefined()
    expect(() => loeseAntwortregelnAuf('{{legende:fehlt}}', FACETS)).toThrow(/Antwortregeln ungültig[\s\S]*gibt es im Schema nicht/)
  })

  it('legendeAlsMarkdown ohne Wörterbuch ist leer (wird vorher als Fehler gemeldet)', () => {
    expect(legendeAlsMarkdown({ metaKey: 'x' })).toBe('')
  })
})

describe('chatConfigSchema: Antwortregeln gegen gallery.facets', () => {
  it('Regeln mit gültigen Platzhaltern überleben die Normalisierung', () => {
    const cfg = normalizeChatConfig({
      antwortregeln: 'Nach {{facette:lv_bewertung}} gliedern.\n{{legende:lv_bewertung}}',
      gallery: { facets: [{ metaKey: 'lv_bewertung', type: 'string', werte: FACETS[0].werte }] },
    })
    expect(cfg.antwortregeln).toContain('{{legende:lv_bewertung}}')
  })

  it('Regeln mit Platzhalter auf fehlende Facette lehnt das Server-Schema ab', () => {
    expect(() => normalizeChatConfig({
      antwortregeln: '{{facette:lv_bewertung}}',
      gallery: { facets: [{ metaKey: 'arbeitsgruppe', type: 'string' }] },
    })).toThrow(/gibt es im Schema nicht/)
  })
})

describe('Prompt und Cache', () => {
  const sources: RetrievedSource[] = [
    { id: 'a-0', fileId: 'a', fileName: 'A.md', chunkIndex: 0, text: 'Text.', sourceType: 'body' },
  ]
  const regeln = 'Status nur als Zuschreibung nennen.'

  it('aufgelöste Regeln stehen in der System-Message von Chat und TOC, ohne Regeln keine Sektion', () => {
    const chatSys = buildChatMessages('Frage?', sources, 'mittel', { targetLanguage: 'de', antwortregeln: regeln })[0]
    expect(chatSys.role).toBe('system')
    expect(chatSys.content).toContain(ANTWORTREGELN_UEBERSCHRIFT)
    expect(chatSys.content).toContain(regeln)

    const tocSys = buildTOCMessages('lib', sources, { targetLanguage: 'de', antwortregeln: regeln })[0]
    expect(tocSys.content).toContain(regeln)

    const ohne = buildChatMessages('Frage?', sources, 'mittel', { targetLanguage: 'de' })[0]
    expect(ohne.content).not.toContain(ANTWORTREGELN_UEBERSCHRIFT)
  })

  it('andere Regeln ergeben einen anderen Cache-Hash; leere Regeln zählen wie keine', () => {
    const basis = { libraryId: 'lib-1', question: 'Frage?', retriever: 'chunk', llmModel: 'm' }
    const ohne = createCacheHash(basis)
    expect(createCacheHash({ ...basis, antwortregeln: '' })).toBe(ohne)
    expect(createCacheHash({ ...basis, antwortregeln: '   ' })).toBe(ohne)
    const mitA = createCacheHash({ ...basis, antwortregeln: 'Regel A' })
    const mitB = createCacheHash({ ...basis, antwortregeln: 'Regel B' })
    expect(mitA).not.toBe(ohne)
    expect(mitA).not.toBe(mitB)
  })
})
