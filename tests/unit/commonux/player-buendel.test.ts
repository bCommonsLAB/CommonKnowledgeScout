// @vitest-environment node
/**
 * Das Buendel `@commonux/player` (vendor/commonux-player-*.tgz, gebaut im Repo commoning-methods)
 * loest sich in dieser Anwendung auf und bringt mit, was der Plan
 * `commonux-buehne-fragen-sektion` braucht: den Leser des Formats und das Gespraech ohne React.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readSceneFromJson, gespraechDarstellerId, uebersetzeGespraech, farbeFuerDokument } from '@commonux/player/format'

interface Paket {
  version: string
  dependencies?: Record<string, string>
}

describe('Buendel @commonux/player', () => {
  it('die installierte Version ist die der Datei unter vendor/', () => {
    const app = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as Paket
    const spec = app.dependencies?.['@commonux/player'] ?? ''
    const ausDatei = /commonux-player-(\d+\.\d+\.\d+)\.tgz$/.exec(spec)?.[1]
    // Das Paket gibt seine `package.json` nicht ueber `exports` frei, deshalb der Weg ueber die Datei.
    const installiert = (JSON.parse(readFileSync(join(process.cwd(), 'node_modules/@commonux/player/package.json'), 'utf-8')) as Paket).version
    expect(ausDatei).toBeDefined()
    expect(installiert).toBe(ausDatei)
  })

  it('der Leser liest eine Auffuehrung mit einer leeren Buehne', () => {
    const doc = readSceneFromJson({
      application: { humanuxVersion: 2, id: 'probe', name: 'Probe', entities: {}, views: [{ id: 'buehne', name: 'Bühne', interaction: true, entityStates: {} }] },
    })
    expect(doc.application.pages.map((p) => p.id)).toEqual(['buehne'])
  })

  it('das Gespraech und sein Uebersetzer liegen im Format-Einstieg, ohne React', () => {
    expect(gespraechDarstellerId('beleg', 'dok-7')).toBe('gespraech__beleg__dok-7')
    expect(typeof uebersetzeGespraech).toBe('function')
    expect(farbeFuerDokument('dok-7')).toBe(farbeFuerDokument('dok-7'))
    expect(farbeFuerDokument('dok-7')).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})
