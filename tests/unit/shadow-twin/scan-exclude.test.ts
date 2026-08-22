/**
 * @fileoverview Unit-Tests: Ausschluss-Muster fuer den Storage-Scan (Welle 0b)
 *
 * Motivation: Bruchstelle B8 — `temp/` mit 1.610 Dateien wuerde jeden
 * Library-Scan fluten. Uebersprungenes wird gezaehlt, nie still ausgelassen.
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_SCAN_EXCLUDE_GLOBS, compileExcludeGlobs, effectiveScanExcludeGlobs, isExcludedPath } from '@/lib/shadow-twin/sync-engine/scan-exclude'

const compiled = (globs: string[]) => compileExcludeGlobs(globs)

describe('isExcludedPath — Segment-Muster (ohne /)', () => {
  it('trifft den Ordnernamen in jeder Tiefe', () => {
    const c = compiled(['temp'])
    expect(isExcludedPath('temp', c)).toBe(true)
    expect(isExcludedPath('a/b/temp', c)).toBe(true)
    expect(isExcludedPath('a/temp/datei.md', c)).toBe(true)
    expect(isExcludedPath('a/temperatur/datei.md', c)).toBe(false) // kein Teilstring-Treffer
  })

  it('unterstuetzt * und ? innerhalb eines Abschnitts', () => {
    const c = compiled(['*.tmp', 'kapitel-?'])
    expect(isExcludedPath('a/b/entwurf.tmp', c)).toBe(true)
    expect(isExcludedPath('a/kapitel-1', c)).toBe(true)
    expect(isExcludedPath('a/kapitel-12', c)).toBe(false)
    expect(isExcludedPath('a/b/entwurf.tmp.md', c)).toBe(false)
  })

  it('vergleicht case-insensitiv (OneDrive/Windows)', () => {
    expect(isExcludedPath('a/TEMP/x.md', compiled(['temp']))).toBe(true)
  })
})

describe('isExcludedPath — Pfad-Muster (mit /)', () => {
  it('trifft den Teilbaum unterhalb des Musters', () => {
    const c = compiled(['alt/archiv'])
    expect(isExcludedPath('alt/archiv', c)).toBe(true)
    expect(isExcludedPath('alt/archiv/tief/datei.md', c)).toBe(true)
    expect(isExcludedPath('archiv/alt', c)).toBe(false)
    expect(isExcludedPath('x/alt/archiv', c)).toBe(false) // Pfad-Muster ankern an der Wurzel
  })

  it('** geht ueber Abschnitte, * bleibt im Abschnitt', () => {
    const c = compiled(['projekte/*/exporte', 'mirror/**'])
    expect(isExcludedPath('projekte/p1/exporte/x.pdf', c)).toBe(true)
    expect(isExcludedPath('projekte/p1/p2/exporte', c)).toBe(false)
    expect(isExcludedPath('mirror/a/b/c.html', c)).toBe(true)
  })
})

describe('compileExcludeGlobs — Randfaelle', () => {
  it('leer/undefined/Leerzeilen: nichts wird ausgeschlossen', () => {
    expect(isExcludedPath('temp/x', compiled([]))).toBe(false)
    expect(isExcludedPath('temp/x', compileExcludeGlobs(undefined))).toBe(false)
    expect(compiled(['', '  ']).count).toBe(0)
  })

  it('fuehrende/nachlaufende Schraegstriche werden normalisiert', () => {
    const c = compiled(['/alt/archiv/'])
    expect(isExcludedPath('alt/archiv/x.md', c)).toBe(true)
  })

  it('Regex-Sonderzeichen in Namen sind harmlos', () => {
    const c = compiled(['a+b (alt)'])
    expect(isExcludedPath('x/a+b (alt)/y.md', c)).toBe(true)
    expect(isExcludedPath('x/aab (alt)/y.md', c)).toBe(false)
  })
})

describe('effectiveScanExcludeGlobs (D3)', () => {
  it('leer/fehlend -> Plattform-Default; eigene Muster ersetzen die Liste komplett', () => {
    expect(effectiveScanExcludeGlobs(undefined)).toBe(DEFAULT_SCAN_EXCLUDE_GLOBS)
    expect(effectiveScanExcludeGlobs([])).toBe(DEFAULT_SCAN_EXCLUDE_GLOBS)
    expect(effectiveScanExcludeGlobs(['  ', ''])).toBe(DEFAULT_SCAN_EXCLUDE_GLOBS)
    expect(effectiveScanExcludeGlobs(['nur-dies'])).toEqual(['nur-dies'])
  })

  it('der Default schliesst die bekannten Werkzeug-Ordner aus, media/ aber nicht', () => {
    const compiled = compileExcludeGlobs(DEFAULT_SCAN_EXCLUDE_GLOBS)
    expect(isExcludedPath('.obsidian/workspace.json', compiled)).toBe(true)
    expect(isExcludedPath('Vorhaben/.trash/alt.md', compiled)).toBe(true)
    expect(isExcludedPath('Vorhaben/media/bild.png', compiled)).toBe(false)
  })
})
