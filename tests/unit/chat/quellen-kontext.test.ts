import { describe, it, expect } from 'vitest'
import {
  formatiereQuellenMetadaten,
  facettenKontextFuerCache,
  type KontextFacette,
} from '@/lib/chat/quellen-kontext'
import { buildContext, buildChatMessages } from '@/lib/chat/common/prompt'
import { createCacheHash } from '@/lib/chat/utils/cache-key-utils'
import type { RetrievedSource } from '@/types/retriever'

/**
 * Plan story-status-modalitaet, m3: Jede Textstelle trägt im Quellen-Header
 * ihre Facettenwerte als Klartext mit Bedeutung (aus dem Wörterbuch, m1).
 * Ohne Wörterbuch Label + Rohwert, ohne Definition metaKey + Rohwert.
 */

const FACETS: KontextFacette[] = [
  {
    metaKey: 'lv_bewertung',
    label: 'Bewertung Landesverwaltung',
    werte: [
      { wert: 'in_umsetzung', label: 'in Umsetzung', bedeutung: 'Laut Landesverwaltung in Umsetzung. Kein Urteil über Erfolg.' },
      { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', bedeutung: 'Als nicht umsetzbar bewertet; wird nicht umgesetzt.' },
      { wert: 'unklar', label: 'offen' },
    ],
  },
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe' },
  { metaKey: 'tags', label: 'Tags', werte: [{ wert: 'mobilitaet', label: 'Mobilität' }] },
]

describe('formatiereQuellenMetadaten', () => {
  it('Wert mit Wörterbuch: Label, Wertlabel und Bedeutung; ohne Bedeutung nur Wertlabel', () => {
    expect(formatiereQuellenMetadaten({ lv_bewertung: 'nicht_umsetzbar' }, FACETS)).toEqual([
      'Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet; wird nicht umgesetzt.',
    ])
    expect(formatiereQuellenMetadaten({ lv_bewertung: 'unklar' }, FACETS)).toEqual(['Bewertung Landesverwaltung: offen'])
  })

  it('Wert ohne Wörterbuch-Eintrag: Label und Rohwert; ohne Definition: metaKey und Rohwert', () => {
    expect(formatiereQuellenMetadaten({ lv_bewertung: 'neu_umsetzbar' }, FACETS)).toEqual(['Bewertung Landesverwaltung: neu_umsetzbar'])
    expect(formatiereQuellenMetadaten({ arbeitsgruppe: 'Mobilität' }, FACETS)).toEqual(['Arbeitsgruppe: Mobilität'])
    expect(formatiereQuellenMetadaten({ year: 2024 }, FACETS)).toEqual(['year: 2024'])
    expect(formatiereQuellenMetadaten({ year: 2024 })).toEqual(['year: 2024'])
  })

  it('Arrays je Element übersetzt; leere Arrays, null, undefined und Objekte entfallen', () => {
    expect(formatiereQuellenMetadaten({ tags: ['mobilitaet', 'heizen'] }, FACETS)).toEqual(['Tags: Mobilität, heizen'])
    expect(formatiereQuellenMetadaten({ tags: [], lv_bewertung: null, arbeitsgruppe: undefined, x: { a: 1 } }, FACETS)).toEqual([])
    expect(formatiereQuellenMetadaten(undefined, FACETS)).toEqual([])
  })

  it('Dokument ohne das Feld zeigt nichts davon — gemischte Libraries brauchen keinen Sonderfall', () => {
    expect(formatiereQuellenMetadaten({ speakers: ['A'] }, FACETS)).toEqual(['speakers: A'])
  })
})

describe('buildContext mit Facetten-Definitionen', () => {
  const sources: RetrievedSource[] = [
    { id: 'a-0', fileId: 'a', fileName: 'Schwerverkehr.md', chunkIndex: 0, text: 'Text.', sourceType: 'body', metadata: { lv_bewertung: 'nicht_umsetzbar', arbeitsgruppe: 'Mobilität' } },
  ]

  it('Header trägt die Bedeutung, wenn Definitionen übergeben werden; sonst Rohwerte wie bisher', () => {
    const mit = buildContext(sources, 800, FACETS)
    expect(mit).toContain('| Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet; wird nicht umgesetzt. | Arbeitsgruppe: Mobilität)')
    const ohne = buildContext(sources)
    expect(ohne).toContain('| lv_bewertung: nicht_umsetzbar | arbeitsgruppe: Mobilität)')
  })

  it('buildChatMessages reicht facetDefs in den Header durch', () => {
    const user = buildChatMessages('Frage?', sources, 'mittel', {
      targetLanguage: 'de',
      facetDefs: FACETS.map((f) => ({ ...f, type: 'string' })),
    }).find((m) => m.role === 'user')
    expect(user?.content).toContain('Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet')
  })
})

describe('facettenKontextFuerCache', () => {
  it('ist deterministisch und reihenfolgeunabhängig; ohne Facetten undefined', () => {
    const a = facettenKontextFuerCache(FACETS)
    const b = facettenKontextFuerCache([...FACETS].reverse())
    expect(a).toBe(b)
    expect(a).toContain('lv_bewertung:Bewertung Landesverwaltung:in_umsetzung=in Umsetzung=')
    expect(facettenKontextFuerCache([])).toBeUndefined()
    expect(facettenKontextFuerCache(undefined)).toBeUndefined()
  })

  it('Label- oder Bedeutungsänderung ändert den Kontext und damit den Cache-Hash', () => {
    const geaendert: KontextFacette[] = FACETS.map((f) =>
      f.metaKey === 'lv_bewertung'
        ? { ...f, werte: f.werte!.map((w) => (w.wert === 'unklar' ? { ...w, bedeutung: 'Bewertung unklar.' } : w)) }
        : f,
    )
    const basis = { libraryId: 'lib-1', question: 'Frage?', retriever: 'chunk', llmModel: 'm' }
    const ohne = createCacheHash(basis)
    const h1 = createCacheHash({ ...basis, facettenKontext: facettenKontextFuerCache(FACETS) })
    const h2 = createCacheHash({ ...basis, facettenKontext: facettenKontextFuerCache(geaendert) })
    expect(h1).not.toBe(ohne)
    expect(h1).not.toBe(h2)
    expect(createCacheHash({ ...basis, facettenKontext: '' })).toBe(ohne)
  })
})
