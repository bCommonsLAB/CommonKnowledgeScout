/**
 * Welle ST9 — Stapel-Umzug.
 *
 * Praxisbilanz 28.08.2026: „besprechungen/ zu zerlegen kostete 26 Aufrufe,
 * jeder mit OneDrive-Latenz. Es gibt kein sourceIds fuer Umzuege." Der
 * groesste Zeitfresser und der einfachste Fix — nach demselben Muster wie
 * die Jobs: Fehler einer Quelle brechen den Stapel nicht ab.
 */
import { describe, expect, it, vi } from 'vitest'
import { MAX_UMZUEGE, fuehreStapelUmzugAus } from '@/lib/mcp/umzug-stapel'

describe('fuehreStapelUmzugAus', () => {
  it('zieht alle Quellen um und zaehlt ehrlich', async () => {
    const bewege = vi.fn(async () => undefined)
    const ergebnis = await fuehreStapelUmzugAus({
      sourceIds: ['a', 'b', 'c'],
      name: async (id) => `Datei-${id}.md`,
      bewege,
    })
    expect(ergebnis.verschoben).toBe(3)
    expect(ergebnis.gescheitert).toBe(0)
    expect(ergebnis.zeilen).toEqual([
      { quelle: 'Datei-a.md', verschoben: true },
      { quelle: 'Datei-b.md', verschoben: true },
      { quelle: 'Datei-c.md', verschoben: true },
    ])
    expect(bewege).toHaveBeenCalledTimes(3)
  })

  it('bricht bei EINEM Fehlschlag NICHT ab — jede Zeile traegt ihr Ergebnis', async () => {
    const ergebnis = await fuehreStapelUmzugAus({
      sourceIds: ['a', 'kaputt', 'c'],
      name: async (id) => id,
      bewege: async (id) => {
        if (id === 'kaputt') throw new Error('Ziel existiert bereits')
      },
    })
    expect(ergebnis.verschoben).toBe(2)
    expect(ergebnis.gescheitert).toBe(1)
    expect(ergebnis.zeilen[1]).toEqual({ quelle: 'kaputt', fehler: 'Ziel existiert bereits' })
    // Die dritte Quelle wurde trotzdem umgezogen.
    expect(ergebnis.zeilen[2]).toEqual({ quelle: 'c', verschoben: true })
  })

  it('versucht den Umzug auch, wenn der Namens-Lookup scheitert', async () => {
    // Der Name dient nur der Antwort — die Id ist dann die beste Aussage.
    const ergebnis = await fuehreStapelUmzugAus({
      sourceIds: ['id-ohne-namen'],
      name: async () => { throw new Error('NOT_FOUND') },
      bewege: async () => undefined,
    })
    expect(ergebnis.zeilen).toEqual([{ quelle: 'id-ohne-namen', verschoben: true }])
  })

  it('lehnt zu grosse und leere Stapel ab', async () => {
    const zuViele = Array.from({ length: MAX_UMZUEGE + 1 }, (_, i) => `id${i}`)
    await expect(fuehreStapelUmzugAus({ sourceIds: zuViele, name: async (x) => x, bewege: async () => undefined }))
      .rejects.toThrow(new RegExp(`Hoechstens ${MAX_UMZUEGE}`))
    await expect(fuehreStapelUmzugAus({ sourceIds: [], name: async (x) => x, bewege: async () => undefined }))
      .rejects.toThrow(/leer/)
  })
})
