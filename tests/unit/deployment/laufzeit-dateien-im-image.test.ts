/**
 * @fileoverview Riegel: Was zur Laufzeit von der Platte gelesen wird, muss
 * auch im Laufzeit-Image liegen.
 *
 * Live-Befund 28.08.2026: `/api/account/mcp-extension` liest `manifest.json`
 * und `server/proxy.js` aus `extensions/` und baut daraus das .mcpb-Bundle.
 * Im Repo lagen die Dateien, im Builder-Stage auch — nur das Laufzeit-Image
 * kopierte den Ordner nicht. Der Fehler fiel deshalb NICHT beim Bauen auf,
 * sondern erst beim Nutzer, als er auf „Erweiterung herunterladen" klickte:
 * `ENOENT: /app/extensions/knowledgescout/manifest.json`.
 *
 * Diese Fehlerklasse kann kein Unit-Test des Codes finden — der Code ist
 * richtig, die Verpackung war falsch. Also prueft dieser Test die Verpackung:
 * Jedes Verzeichnis, das im Quelltext ueber `process.cwd()` gelesen wird,
 * muss im Dockerfile ins Laufzeit-Image kopiert werden.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = process.cwd()

/** Erstes Pfadsegment jedes `process.cwd()`-Zugriffs im Quelltext. */
function laufzeitVerzeichnisse(verzeichnis = join(WURZEL, 'src')): Set<string> {
  const gefunden = new Set<string>()
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag)
    if (statSync(pfad).isDirectory()) {
      for (const d of laufzeitVerzeichnisse(pfad)) gefunden.add(d)
      continue
    }
    if (!/\.tsx?$/.test(eintrag)) continue
    const inhalt = readFileSync(pfad, 'utf-8')
    // join(process.cwd(), 'x', …) und resolve(process.cwd(), 'x', …)
    for (const treffer of inhalt.matchAll(/process\.cwd\(\)\s*,\s*'([^']+)'/g)) {
      gefunden.add(treffer[1])
    }
  }
  return gefunden
}

describe('Laufzeit-Dateien im Docker-Image', () => {
  const dockerfile = readFileSync(join(WURZEL, 'Dockerfile'), 'utf-8')
  // Nur die Zeilen der Laufzeit-Stage: alles ab dem letzten FROM.
  const laufzeitStage = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '))

  it('kopiert jedes Verzeichnis, das der Code zur Laufzeit liest', () => {
    const fehlend = [...laufzeitVerzeichnisse()].filter((dir) => {
      const kopiert = new RegExp(`^COPY[^\\n]*\\s\\./${dir}(\\s|$)`, 'm').test(laufzeitStage)
      return !kopiert
    })

    expect(
      fehlend,
      `Diese Verzeichnisse werden ueber process.cwd() gelesen, aber im Dockerfile ` +
      `nicht ins Laufzeit-Image kopiert — der Fehler faellt erst beim Nutzer auf ` +
      `(ENOENT). Entweder COPY ergaenzen oder den Lesezugriff entfernen.`,
    ).toEqual([])
  })

  it('findet ueberhaupt Zugriffe — sonst prueft der Riegel nichts', () => {
    const gefunden = laufzeitVerzeichnisse()
    expect(gefunden.size).toBeGreaterThan(0)
    // Der Ausloeser dieses Riegels muss dabei sein.
    expect(gefunden).toContain('extensions')
  })
})
