// @vitest-environment node
/**
 * Lage-Regel des Teppichs (Plan `teppich-der-dokumente`, T1): Zeit nach rechts,
 * Aehnliches beieinander, Randstreifen fuer fehlende Daten, stabile Plaetze.
 */
import { describe, it, expect } from 'vitest'
import { berechneTeppichLagen, TEPPICH_RAND, SCHRITTE_FORTSETZUNG, SCHRITTE_NEU, type TeppichEingabe } from '@/lib/graph/teppich-lage'

const doc = (fileId: string, p: Partial<TeppichEingabe> = {}): TeppichEingabe =>
  ({ fileId, zeit: null, nachbarn: [], umfang: null, vorher: null, ...p })

/** Zwei dichte Gruppen A und B, je 20 Dokumente, alle Nachbarn innerhalb der Gruppe. */
function zweiGruppen(): TeppichEingabe[] {
  const gruppe = (p: string) => Array.from({ length: 20 }, (_, i) => `${p}${i}`)
  const a = gruppe('a'), b = gruppe('b')
  const nachbarn = (ids: string[], i: number) => [1, 2, 3].map((d) => ({ fileId: ids[(i + d) % ids.length], weight: 0.9 }))
  // Zeit gemischt, damit die Gruppen nicht schon ueber die Zeit getrennt sind.
  return [
    ...a.map((id, i) => doc(id, { zeit: i * 2, nachbarn: nachbarn(a, i), umfang: 5 })),
    ...b.map((id, i) => doc(id, { zeit: i * 2 + 1, nachbarn: nachbarn(b, i), umfang: 5 })),
  ]
}

const lageVon = (e: ReturnType<typeof berechneTeppichLagen>) => new Map(e.lagen.map((l) => [l.fileId, l]))

describe('Teppich: Zeitachse', () => {
  it('ordnet datierte Dokumente nach der Zeit von links nach rechts', () => {
    const e = berechneTeppichLagen([doc('c', { zeit: 300 }), doc('a', { zeit: 100 }), doc('b', { zeit: 200 })])
    const l = lageVon(e)
    expect(l.get('a')!.x).toBeLessThan(l.get('b')!.x)
    expect(l.get('b')!.x).toBeLessThan(l.get('c')!.x)
    for (const p of e.lagen) expect(p.x).toBeGreaterThanOrEqual(TEPPICH_RAND)
  })

  it('legt undatierte Dokumente in den linken Randstreifen und zaehlt sie', () => {
    const e = berechneTeppichLagen([doc('a', { zeit: 1 }), doc('ohne')])
    expect(lageVon(e).get('ohne')!.x).toBeLessThan(TEPPICH_RAND)
    expect(e.ohneDatum).toBe(1)
  })
})

describe('Teppich: Aehnlichkeitsachse', () => {
  it('legt jede Gruppe in ein zusammenhaengendes Band', () => {
    const e = berechneTeppichLagen(zweiGruppen())
    const ys = (p: string) => e.lagen.filter((l) => l.fileId.startsWith(p)).map((l) => l.y)
    const a = ys('a'), b = ys('b')
    const getrennt = Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)
    expect(getrennt).toBe(true)
    expect(e.schritte).toBe(SCHRITTE_NEU)
  })

  it('trennt die Gruppen auch, wenn eine schwache Bruecke sie verbindet', () => {
    const docs = zweiGruppen()
    docs[0] = { ...docs[0], nachbarn: [...docs[0].nachbarn, { fileId: 'b0', weight: 0.3 }] }
    const e = berechneTeppichLagen(docs)
    const ys = (p: string) => e.lagen.filter((l) => l.fileId.startsWith(p)).map((l) => l.y)
    const a = ys('a'), b = ys('b')
    expect(Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)).toBe(true)
  })

  it('rechnet 20.000 Dokumente mit je sechs Nachbarn in vertretbarer Zeit', () => {
    const n = 20000
    const docs = Array.from({ length: n }, (_, i) => doc(`d${i}`, {
      zeit: i, umfang: i % 50,
      nachbarn: [1, 2, 3, 5, 8, 13].map((d) => ({ fileId: `d${(i + d * 7) % n}`, weight: 0.8 })),
    }))
    const t0 = Date.now()
    const e = berechneTeppichLagen(docs)
    expect(e.lagen).toHaveLength(n)
    expect(Date.now() - t0).toBeLessThan(15000)
  })

  it('legt Dokumente ohne Nachbarn in den oberen Randstreifen und zaehlt sie', () => {
    const e = berechneTeppichLagen([...zweiGruppen(), doc('allein', { zeit: 5 })])
    expect(lageVon(e).get('allein')!.y).toBeGreaterThanOrEqual(1 - TEPPICH_RAND)
    for (const l of e.lagen) if (l.fileId !== 'allein') expect(l.y).toBeLessThan(1 - TEPPICH_RAND)
    expect(e.ohneNachbarn).toBe(1)
  })

  it('ignoriert Nachbarn, die nicht im Bestand sind', () => {
    const e = berechneTeppichLagen([doc('a', { nachbarn: [{ fileId: 'fremd', weight: 1 }] })])
    expect(e.ohneNachbarn).toBe(1)
    expect(e.schritte).toBe(0)
  })
})

describe('Teppich: feste Plaetze', () => {
  it('liefert bei gleicher Eingabe dieselbe Lage', () => {
    expect(berechneTeppichLagen(zweiGruppen())).toEqual(berechneTeppichLagen(zweiGruppen()))
  })

  it('setzt mit frueherer Lage fort: wenige Schritte, ein neues Dokument verschiebt die anderen kaum', () => {
    const erst = berechneTeppichLagen(zweiGruppen())
    const vorher = lageVon(erst)
    const neu = doc('neu', { zeit: 999, nachbarn: [{ fileId: 'a0', weight: 0.9 }], umfang: 5 })
    const zweit = berechneTeppichLagen([
      ...zweiGruppen().map((d) => ({ ...d, vorher: { x: vorher.get(d.fileId)!.x, y: vorher.get(d.fileId)!.y } })),
      neu,
    ])
    expect(zweit.schritte).toBe(SCHRITTE_FORTSETZUNG)
    const l = lageVon(zweit)
    const verschiebungen = erst.lagen.map((p) => Math.abs(l.get(p.fileId)!.y - p.y))
    const mittel = verschiebungen.reduce((s, v) => s + v, 0) / verschiebungen.length
    expect(mittel).toBeLessThan(0.1)
    expect(l.get('neu')!.x).toBeGreaterThan(Math.max(...erst.lagen.map((p) => p.x)) - 0.03)
  })
})

describe('Teppich: Gewicht nach Umfang', () => {
  it('skaliert logarithmisch auf 0..1 und laesst fehlenden Umfang leer', () => {
    const e = berechneTeppichLagen([doc('klein', { umfang: 1 }), doc('gross', { umfang: 100 }), doc('null', { umfang: 0 }), doc('fehlt')])
    const l = lageVon(e)
    expect(l.get('gross')!.gewicht).toBe(1)
    expect(l.get('klein')!.gewicht).toBeGreaterThan(0)
    expect(l.get('klein')!.gewicht).toBeLessThan(0.2)
    expect(l.get('null')!.gewicht).toBe(0)
    expect(l.get('fehlt')!.gewicht).toBeNull()
    expect(e.ohneUmfang).toBe(1)
  })
})
