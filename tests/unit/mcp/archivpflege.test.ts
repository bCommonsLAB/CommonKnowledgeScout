/**
 * @fileoverview Tests: Server-Sperre der Archivpflege-Werkzeuge.
 *
 * Die Bruecke gilt fuer alle Libraries eines Kontos; Werkzeuge, die die
 * Archiv-Struktur (_INDEX.md, BERICHT.md, Organisation/) schreiben, duerfen nur
 * in Libraries laufen, die die Agentensicht ausdruecklich aktiviert haben.
 */

import { describe, it, expect } from 'vitest'
import {
  ARCHIVPFLEGE_WERKZEUGE,
  ArchivpflegeGesperrtError,
  archivpflegeAktiv,
  pruefeArchivpflege,
} from '@/lib/mcp/archivpflege'
import { TOOL_NAMES } from '@/lib/mcp/tools-info'

describe('archivpflegeAktiv', () => {
  it('nur agentView.enabled === true gibt frei', () => {
    expect(archivpflegeAktiv({ config: { agentView: { enabled: true } } } as never)).toBe(true)
  })

  it('fehlende Config, fehlende Agentensicht oder enabled=false sperren', () => {
    expect(archivpflegeAktiv({ config: undefined } as never)).toBe(false)
    expect(archivpflegeAktiv({ config: {} } as never)).toBe(false)
    expect(archivpflegeAktiv({ config: { agentView: {} } } as never)).toBe(false)
    expect(archivpflegeAktiv({ config: { agentView: { enabled: false } } } as never)).toBe(false)
  })
})

describe('pruefeArchivpflege', () => {
  it('wirft laut mit Werkzeug- und Library-Namen', () => {
    const aufruf = () => pruefeArchivpflege({ label: 'Fremd', config: {} } as never, 'sichten_regenerieren')
    expect(aufruf).toThrow(ArchivpflegeGesperrtError)
    expect(aufruf).toThrow(/sichten_regenerieren.*"Fremd".*gesperrt/)
  })

  it('laesst eine freigegebene Library durch', () => {
    expect(() =>
      pruefeArchivpflege({ label: 'Archiv', config: { agentView: { enabled: true } } } as never, 'stand_setzen'),
    ).not.toThrow()
  })

  it('jedes gesperrte Werkzeug ist ein registriertes Bruecken-Werkzeug', () => {
    for (const werkzeug of ARCHIVPFLEGE_WERKZEUGE) expect(TOOL_NAMES).toContain(werkzeug)
  })
})
