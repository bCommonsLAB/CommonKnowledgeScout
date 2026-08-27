/**
 * Welle ST2 — Schreibschutz auf Pfadmustern.
 *
 * Antwort auf „Wer darf schreiben?" (Anforderungen §6): Wenn die generische
 * Schicht alles schreiben kann, kann ein Agent an `stand_setzen` vorbei den
 * `bearbeitungsstand` setzen — und die Schutzstufen greifen nicht mehr.
 */
import { describe, expect, it } from 'vitest'
import { SchreibschutzError, pruefeSchreibschutz } from '@/lib/mcp/storage/schreibschutz'

describe('pruefeSchreibschutz', () => {
  it('sperrt die _INDEX.md und nennt das zustaendige Werkzeug', () => {
    expect(() => pruefeSchreibschutz('26.01 Klima/_INDEX.md')).toThrow(SchreibschutzError)
    expect(() => pruefeSchreibschutz('26.01 Klima/_INDEX.md')).toThrow(/stand_setzen/)
  })

  it('sperrt Artefakte unterhalb eines "_"-Twin-Ordners', () => {
    expect(() => pruefeSchreibschutz('26.01 Klima/_Aufnahme/transkript.md')).toThrow(/twins_synchronisieren/)
  })

  it('laesst gewoehnliche Dateien durch — auch mit "_" im Namen', () => {
    expect(() => pruefeSchreibschutz('26.01 Klima/BERICHT.md')).not.toThrow()
    expect(() => pruefeSchreibschutz('26.01 Klima/mein_bericht.md')).not.toThrow()
    // Der "_"-Ordner selbst ist nicht das letzte Segment → das ist ein Umzug,
    // kein Schreiben, und gehoert nicht dieser Regel.
    expect(() => pruefeSchreibschutz('26.01 Klima/_Aufnahme')).not.toThrow()
  })

  it('greift unabhaengig von fuehrenden Slashes', () => {
    expect(() => pruefeSchreibschutz('/26.01 Klima/_INDEX.md')).toThrow(SchreibschutzError)
  })

  it('meldet nicht_unterstuetzt als Code (Q5)', () => {
    try {
      pruefeSchreibschutz('a/_INDEX.md')
      throw new Error('haette werfen muessen')
    } catch (fehler) {
      expect((fehler as SchreibschutzError).code).toBe('nicht_unterstuetzt')
    }
  })
})
