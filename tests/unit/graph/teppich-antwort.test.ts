// @vitest-environment node
/**
 * Antwort der Lese-Route des Teppichs (Plan `teppich-der-dokumente`, T1):
 * benannte Zustaende, Seiten der Website zaehlen nicht, juengster Stand.
 */
import { describe, it, expect } from 'vitest'
import { baueTeppichAntwort } from '@/lib/graph/teppich-antwort'

const mitLage = (fileId: string, stand = '2026-11-22T10:00:00.000Z') =>
  ({ fileId, title: fileId, docMetaJson: { teppich_x: 0.5, teppich_y: 0.5, teppich_stand: stand } })

describe('Teppich-Antwort', () => {
  it('nicht_berechnet, solange kein Dokument eine Lage hat', () => {
    const a = baueTeppichAntwort([{ fileId: 'a' }, { fileId: 'b' }])
    expect(a).toEqual({ zustand: 'nicht_berechnet', stand: null, gesamt: 2, ohneLage: 2, items: [] })
  })

  it('veraltet, wenn neue Dokumente noch keine Lage haben', () => {
    const a = baueTeppichAntwort([mitLage('a'), { fileId: 'neu' }])
    expect(a.zustand).toBe('veraltet')
    expect(a.ohneLage).toBe(1)
    expect(a.items.map((p) => p.fileId)).toEqual(['a'])
  })

  it('bereit mit dem juengsten Stand; Seiten der Website zaehlen nicht', () => {
    const a = baueTeppichAntwort([
      mitLage('a', '2026-11-20T00:00:00.000Z'),
      mitLage('b', '2026-11-22T00:00:00.000Z'),
      { fileId: 'seite', detailViewType: 'website' },
    ])
    expect(a.zustand).toBe('bereit')
    expect(a.gesamt).toBe(2)
    expect(a.stand).toBe('2026-11-22T00:00:00.000Z')
  })

  it('T5a: staerkste Nachbarn als Indizes, hoechstens drei, nur sichtbare', () => {
    const mitNachbarn = (fileId: string, nachbarn: Array<[string, number]>) => {
      const z = mitLage(fileId)
      return { ...z, docMetaJson: { ...z.docMetaJson, similarity_neighbors: nachbarn.map(([f, weight]) => ({ fileId: f, weight })) } }
    }
    const a = baueTeppichAntwort([
      mitNachbarn('a', [['b', 0.5], ['c', 0.9], ['d', 0.7], ['e', 0.6], ['unsichtbar', 0.99], ['a', 1]]),
      mitLage('b'), mitLage('c'), mitLage('d'), mitLage('e'),
    ])
    // c (0,9), d (0,7), e (0,6); ohne sich selbst und ohne Unsichtbare.
    expect(a.items[0].nachbarn).toEqual([2, 3, 4])
    expect(a.items[1].nachbarn).toEqual([])
  })
})
