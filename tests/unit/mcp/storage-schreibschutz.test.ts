/**
 * Welle ST2/ST5 — Schreibschutz auf Pfadmustern.
 *
 * Antwort auf „Wer darf schreiben?" (Anforderungen §6): Wenn die generische
 * Schicht alles schreiben kann, kann ein Agent an `stand_setzen` vorbei den
 * `bearbeitungsstand` setzen — und die Schutzstufen greifen nicht mehr.
 *
 * ST5 verfeinert das nach zwei Live-Befunden (28.08.2026): Die erste Fassung
 * sperrte die _INDEX.md fuer ALLES und war damit breiter als ihr Zweck —
 * ein neuer Ordner konnte seinen Contract nie bekommen. Geschuetzt gehoert
 * der FELDKERN, nicht die Datei.
 */
import { describe, expect, it } from 'vitest'
import { SchreibschutzError, pruefeSchreibschutz } from '@/lib/mcp/storage/schreibschutz'

const INDEX = '26.01 Klima/_INDEX.md'

describe('pruefeSchreibschutz: _INDEX.md — der Feldkern ist geschuetzt', () => {
  it('sperrt Frontmatter und Voll-Ersatz und nennt das Fachwerkzeug', () => {
    expect(() => pruefeSchreibschutz(INDEX, 'frontmatter')).toThrow(/stand_setzen/)
    expect(() => pruefeSchreibschutz(INDEX, 'ganz_ersetzen')).toThrow(SchreibschutzError)
  })

  it('sperrt Loeschen und das Verschieben AN diese Stelle', () => {
    expect(() => pruefeSchreibschutz(INDEX, 'loeschen')).toThrow(SchreibschutzError)
    // Die Luecke von ST2: ueber `verschieben` liess sich die Sperre umgehen.
    expect(() => pruefeSchreibschutz(INDEX, 'verschieben_ziel')).toThrow(SchreibschutzError)
  })

  it('ERLAUBT Fliesstext — sonst ist eine _INDEX.md nie korrigierbar', () => {
    expect(() => pruefeSchreibschutz(INDEX, 'fliesstext')).not.toThrow()
  })

  it('ERLAUBT Anlegen — sonst bekommt ein neuer Ordner nie seinen Contract', () => {
    expect(() => pruefeSchreibschutz(INDEX, 'anlegen')).not.toThrow()
  })
})

describe('pruefeSchreibschutz: Twin-Ordner', () => {
  it('sperrt Artefakte unterhalb eines "_"-Ordners fuer JEDE Aktion', () => {
    const artefakt = '26.01 Klima/_Aufnahme/transkript.md'
    for (const aktion of ['fliesstext', 'frontmatter', 'anlegen', 'ganz_ersetzen', 'loeschen'] as const) {
      expect(() => pruefeSchreibschutz(artefakt, aktion), aktion).toThrow(/twins_synchronisieren/)
    }
  })
})

describe('pruefeSchreibschutz: alles andere', () => {
  it('laesst gewoehnliche Dateien durch — auch mit "_" im Namen', () => {
    expect(() => pruefeSchreibschutz('26.01 Klima/BERICHT.md', 'ganz_ersetzen')).not.toThrow()
    expect(() => pruefeSchreibschutz('26.01 Klima/mein_bericht.md', 'frontmatter')).not.toThrow()
    // Der "_"-Ordner selbst ist nicht sein eigener Inhalt.
    expect(() => pruefeSchreibschutz('26.01 Klima/_Aufnahme', 'verschieben_ziel')).not.toThrow()
  })

  it('greift unabhaengig von fuehrenden Slashes', () => {
    expect(() => pruefeSchreibschutz('/26.01 Klima/_INDEX.md', 'frontmatter')).toThrow(SchreibschutzError)
  })

  it('meldet nicht_unterstuetzt als Code (Q5)', () => {
    try {
      pruefeSchreibschutz(INDEX, 'frontmatter')
      throw new Error('haette werfen muessen')
    } catch (fehler) {
      expect((fehler as SchreibschutzError).code).toBe('nicht_unterstuetzt')
    }
  })
})
