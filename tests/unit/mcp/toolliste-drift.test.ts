/**
 * @fileoverview Riegel: Die Soll-Liste der Bruecke muss zu den registrierten
 * Werkzeugen passen.
 *
 * Befund 27.08.2026 (Cowork): `protokoll_lesen` war beim Server registriert,
 * fehlte aber in `TOOL_NAMES`. Damit meldete `bruecke_info` 19 statt 20
 * Werkzeuge — und der eingebaute Selbsttest („weicht deine Sicht von der
 * Soll-Liste ab, schalte die Erweiterung aus und ein") war blind: Client-Cache
 * und Soll-Liste waren gleichermassen veraltet, stimmten also ueberein.
 *
 * Die Soll-Liste bleibt handgepflegt (sie ist auch Reihenfolge und
 * Dokumentation), aber sie darf nicht mehr still abweichen.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { TOOL_NAMES } from '@/lib/mcp/tools-info'

const MCP_VERZEICHNIS = join(process.cwd(), 'src', 'lib', 'mcp')

/** Werkzeugnamen, die im Quelltext tatsaechlich registriert werden. */
function registrierteWerkzeuge(): string[] {
  const namen = new Set<string>()
  for (const datei of readdirSync(MCP_VERZEICHNIS)) {
    if (!datei.endsWith('.ts')) continue
    const inhalt = readFileSync(join(MCP_VERZEICHNIS, datei), 'utf-8')
    for (const treffer of inhalt.matchAll(/registerTool\(\s*'([a-z_]+)'/g)) {
      namen.add(treffer[1])
    }
  }
  return [...namen].sort()
}

describe('TOOL_NAMES (Soll-Liste von bruecke_info)', () => {
  it('enthaelt genau die registrierten Werkzeuge — kein stiller Drift', () => {
    const registriert = registrierteWerkzeuge()
    const soll = [...TOOL_NAMES].sort()

    const fehlenInSoll = registriert.filter((name) => !soll.includes(name))
    const zuvielInSoll = soll.filter((name) => !registriert.includes(name))

    expect(fehlenInSoll, 'registriert, aber nicht in TOOL_NAMES').toEqual([])
    expect(zuvielInSoll, 'in TOOL_NAMES, aber nicht registriert').toEqual([])
  })

  it('findet ueberhaupt Werkzeuge — sonst prueft der Riegel nichts', () => {
    expect(registrierteWerkzeuge().length).toBeGreaterThan(15)
  })
})
