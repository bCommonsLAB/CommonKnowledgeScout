import { describe, expect, test } from 'vitest'
import {
  getLocalized,
  getLocalizedLabel,
  getLocalizedTopics,
} from '@/lib/i18n/get-localized'

/**
 * Unit-Tests fuer den `getLocalized()`-Helper.
 *
 * Wichtige Faelle:
 *  - Translation in gewuenschter Locale vorhanden -> diese gewinnt
 *  - Locale fehlt -> Fallback-Locale gewinnt
 *  - Beide fehlen -> Original (`docMetaJson`/Top-Level) gewinnt
 *  - Leere Strings/Arrays gelten NICHT als praesent (Fallback springt weiter)
 *  - `gallery`- vs. `detail`-Scope: bewusst getrennt, damit Galerie-Payload klein bleibt
 */
describe('getLocalized', () => {
  test('liefert Wert aus translations.gallery in gewuenschter Locale', () => {
    const doc = {
      docMetaJson: {
        title: 'Original Title',
        translations: {
          gallery: {
            de: { title: 'Deutscher Titel' },
            en: { title: 'English Title' },
          },
        },
      },
    }
    expect(getLocalized<string>(doc, 'title', 'de', { scope: 'gallery' })).toBe(
      'Deutscher Titel',
    )
  })

  test('faellt auf fallbackLocale zurueck, wenn Locale fehlt', () => {
    const doc = {
      docMetaJson: {
        title: 'Original',
        translations: {
          gallery: { en: { title: 'English Title' } },
        },
      },
    }
    expect(
      getLocalized<string>(doc, 'title', 'de', {
        scope: 'gallery',
        fallbackLocale: 'en',
      }),
    ).toBe('English Title')
  })

  test('faellt auf docMetaJson zurueck, wenn keine Translation existiert', () => {
    const doc = {
      docMetaJson: {
        title: 'Original Title',
      },
    }
    expect(
      getLocalized<string>(doc, 'title', 'es', {
        scope: 'gallery',
        fallbackLocale: 'en',
      }),
    ).toBe('Original Title')
  })

  test('faellt auf Top-Level zurueck, wenn docMetaJson leer', () => {
    // Legacy-Datensaetze, bei denen Felder noch auf Top-Level liegen
    const doc = { title: 'Top Title', docMetaJson: {} }
    expect(getLocalized<string>(doc, 'title', 'de')).toBe('Top Title')
  })

  test('leerer String wird NICHT als praesent gewertet', () => {
    const doc = {
      docMetaJson: {
        title: 'Original',
        translations: {
          gallery: { de: { title: '   ' } }, // Whitespace-only zaehlt als leer
        },
      },
    }
    expect(
      getLocalized<string>(doc, 'title', 'de', {
        scope: 'gallery',
        fallbackLocale: 'en',
      }),
    ).toBe('Original')
  })

  test('leeres Array wird NICHT als praesent gewertet', () => {
    const doc = {
      docMetaJson: {
        topics: ['original'],
        translations: {
          detail: { de: { authors: [] } },
        },
      },
    }
    // Wir suchen `authors` auf detail-Scope; Translation ist []
    // -> faellt auf docMetaJson.authors (existiert nicht) -> undefined
    expect(getLocalized(doc, 'authors', 'de', { scope: 'detail' })).toBeUndefined()
  })

  test('detail-Scope greift auf translations.detail zu, NICHT auf gallery', () => {
    const doc = {
      docMetaJson: {
        summary: 'Original',
        translations: {
          gallery: { de: { summary: 'Galerie-Summary DE' } },
          detail: { de: { summary: 'Detail-Summary DE' } },
        },
      },
    }
    expect(
      getLocalized<string>(doc, 'summary', 'de', { scope: 'detail' }),
    ).toBe('Detail-Summary DE')
    expect(
      getLocalized<string>(doc, 'summary', 'de', { scope: 'gallery' }),
    ).toBe('Galerie-Summary DE')
  })

  test('null und undefined doc geben undefined zurueck', () => {
    expect(getLocalized(null, 'title', 'de')).toBeUndefined()
    expect(getLocalized(undefined, 'title', 'de')).toBeUndefined()
  })
})

describe('getLocalizedLabel', () => {
  test('liefert uebersetztes Label aus topicsLabels-Map', () => {
    const doc = {
      docMetaJson: {
        topics: ['sustainability'],
        translations: {
          gallery: {
            de: { topicsLabels: { sustainability: 'Nachhaltigkeit' } },
          },
        },
      },
    }
    expect(getLocalizedLabel(doc, 'topics', 'sustainability', 'de')).toBe(
      'Nachhaltigkeit',
    )
  })

  test('faellt auf kanonischen Wert zurueck, wenn kein Mapping existiert', () => {
    const doc = {
      docMetaJson: {
        topics: ['unknown-topic'],
        translations: { gallery: { de: { topicsLabels: {} } } },
      },
    }
    expect(getLocalizedLabel(doc, 'topics', 'unknown-topic', 'de')).toBe(
      'unknown-topic',
    )
  })

  test('nutzt fallbackLocale, wenn Ziel-Locale keine Map hat', () => {
    const doc = {
      docMetaJson: {
        topics: ['energy'],
        translations: {
          gallery: { en: { topicsLabels: { energy: 'Energy' } } },
        },
      },
    }
    expect(
      getLocalizedLabel(doc, 'topics', 'energy', 'de', { fallbackLocale: 'en' }),
    ).toBe('Energy')
  })
})

describe('getLocalizedTopics', () => {
  test('liefert Wert+Label-Paare und filtert leere Eintraege', () => {
    const doc = {
      docMetaJson: {
        topics: ['energy', '', 'mobility'],
        translations: {
          gallery: {
            de: {
              topicsLabels: { energy: 'Energie', mobility: 'Mobilitaet' },
            },
          },
        },
      },
    }
    const result = getLocalizedTopics(doc, 'topics', 'de')
    expect(result).toEqual([
      { value: 'energy', label: 'Energie' },
      { value: 'mobility', label: 'Mobilitaet' },
    ])
  })

  test('faellt auf kanonische Werte zurueck bei fehlendem Mapping', () => {
    const doc = {
      docMetaJson: { tags: ['a', 'b'] },
    }
    const result = getLocalizedTopics(doc, 'tags', 'de')
    expect(result).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ])
  })
})
