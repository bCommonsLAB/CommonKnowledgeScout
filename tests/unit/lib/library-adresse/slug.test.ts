import { describe, it, expect } from 'vitest'
import { bekannteSlugs, bestimmeSlugs, findeLibraryZuSlug, leiteSlugAb, pruefeSlug, type SlugQuelle } from '@/lib/library-adresse/slug'

describe('leiteSlugAb', () => {
  it('macht aus Namen mit Umlauten, Gedankenstrich und Klammern einen Slug', () => {
    expect(leiteSlugAb('Dachverband für Soziales – Neuaufbau')).toBe('dachverband-fuer-soziales-neuaufbau')
    expect(leiteSlugAb('Archiv  Peter (onedrive)')).toBe('archiv-peter-onedrive')
    expect(leiteSlugAb('Großes Café')).toBe('grosses-cafe')
  })

  it('liefert leer, wenn nichts Lesbares bleibt, und kappt auf 64 Zeichen ohne Randstrich', () => {
    expect(leiteSlugAb('–– ??')).toBe('')
    const lang = leiteSlugAb(`${'a'.repeat(63)} b`)
    expect(lang.length).toBeLessThanOrEqual(64)
    expect(lang.endsWith('-')).toBe(false)
  })
})

describe('pruefeSlug', () => {
  it('nimmt gueltige Slugs und weist alles andere mit Grund ab', () => {
    expect(pruefeSlug(' klima-archiv ')).toBe('klima-archiv')
    expect(() => pruefeSlug('Klima')).toThrow(/Ungueltiger Slug/)
    expect(() => pruefeSlug('-klima')).toThrow(/Ungueltiger Slug/)
    expect(() => pruefeSlug('a/b')).toThrow(/Ungueltiger Slug/)
  })
})

function lib(id: string, label: string, config?: SlugQuelle['config']): SlugQuelle {
  return { id, label, config }
}

describe('bestimmeSlugs', () => {
  it('nimmt gesetzt vor veroeffentlicht vor abgeleitet und nennt die Herkunft', () => {
    const [a, b, c] = bestimmeSlugs([
      lib('a', 'Archiv', { adresse: { slug: 'archiv-peter' }, publicPublishing: { slugName: 'egal' } }),
      lib('b', 'SFSCON', { publicPublishing: { slugName: 'sfscon-talks' } }),
      lib('c', 'Klimamassnahmen'),
    ])
    expect([a.slug, a.herkunft]).toEqual(['archiv-peter', 'gesetzt'])
    expect([b.slug, b.herkunft]).toEqual(['sfscon-talks', 'veroeffentlicht'])
    expect([c.slug, c.herkunft]).toEqual(['klimamassnahmen', 'abgeleitet'])
  })

  it('laesst bei Kollision die hoehere Herkunft gewinnen und benennt den Verlierer', () => {
    const [gesetzt, abgeleitet] = bestimmeSlugs([
      lib('g', 'Irgendwas', { adresse: { slug: 'klima' } }),
      lib('a', 'Klima'),
    ])
    expect(gesetzt.slug).toBe('klima')
    expect(abgeleitet.slug).toBeNull()
    expect(abgeleitet.konflikt).toContain('belegt von Irgendwas')
  })

  it('vergibt bei Gleichstand keinem den Slug — kein stilles -2', () => {
    const eintraege = bestimmeSlugs([lib('x', 'Swap To Learn'), lib('y', 'SwapToLearn'), lib('z', 'swap to learn')])
    const gleich = eintraege.filter((e) => e.libraryId !== 'y')
    expect(gleich.every((e) => e.slug === null && e.konflikt?.includes('mehrdeutig'))).toBe(true)
    expect(eintraege.find((e) => e.libraryId === 'y')?.slug).toBe('swaptolearn')
  })

  it('benennt unbrauchbare Slugs statt auf den Namen zurueckzufallen', () => {
    const [e] = bestimmeSlugs([lib('p', 'Pluriversum', { publicPublishing: { slugName: 'Pluri Versum' } })])
    expect(e.slug).toBeNull()
    expect(e.herkunft).toBe('veroeffentlicht')
    expect(e.konflikt).toContain('passt nicht in die Adressform')
  })
})

describe('findeLibraryZuSlug / bekannteSlugs', () => {
  const eintraege = bestimmeSlugs([
    lib('a', 'Archiv', { adresse: { slug: 'archiv-peter', frueher: ['archiv-peter-onedrive'] } }),
    lib('k', 'Klima'),
  ])

  it('trifft aktuelle Slugs direkt und fruehere mit Merker', () => {
    expect(findeLibraryZuSlug('klima', eintraege)).toMatchObject({ eintrag: { libraryId: 'k' }, ueberFrueher: false })
    expect(findeLibraryZuSlug('archiv-peter-onedrive', eintraege)).toMatchObject({ eintrag: { libraryId: 'a' }, ueberFrueher: true })
  })

  it('nennt den Grund, wenn nichts trifft', () => {
    expect(findeLibraryZuSlug('gibt-es-nicht', eintraege)).toEqual({ grund: 'Keine Library mit dem Slug "gibt-es-nicht" bekannt' })
  })

  it('sammelt aktuelle und fruehere Slugs', () => {
    expect([...bekannteSlugs(eintraege)].sort()).toEqual(['archiv-peter', 'archiv-peter-onedrive', 'klima'])
  })
})
