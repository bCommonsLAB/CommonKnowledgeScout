/**
 * Paketgrenze des Story-Moduls (Plan `story-dreiteilung-fragenchronik`,
 * Abschnitt Paketierung; Regeln aus M4f bis M4i uebernommen):
 *
 * - kein `next/*` (das Paket laeuft im Embed ohne Next),
 * - kein Clerk (die Anmeldung kommt als Prop oder Slot),
 * - kein `@/` und kein `src/lib/chat` (Server-Stack bleibt in der App;
 *   Chat-Vokabular nur ueber `@ks/contracts`),
 * - keine Adresszeile (`window.location`, `history`) — die Auswahl lebt in
 *   Atomen, die App bindet sie an die URL (D2).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { collectTsFiles } from '../paket-fetch-schnitt'

const REPO_ROOT = process.cwd()
const PAKET = 'packages/module-story/src'

interface Verbot {
  name: string
  muster: RegExp
}

const VERBOTE: Verbot[] = [
  { name: 'next/*', muster: /from\s+['"]next(\/|['"])/ },
  { name: '@clerk/*', muster: /from\s+['"]@clerk\// },
  { name: '@/ (App-Code)', muster: /from\s+['"]@\// },
  { name: 'src/lib/chat (Server-Stack)', muster: /from\s+['"][^'"]*src\/lib\/chat/ },
  { name: 'Adresszeile', muster: /\b(window\.location|location\.(href|assign|replace|search|hash)|history\.(pushState|replaceState))\b/ },
]

function fundstellen(inhalt: string, muster: RegExp): string[] {
  return inhalt.split('\n').flatMap((zeile, i) => (muster.test(zeile) ? [`${i + 1}: ${zeile.trim()}`] : []))
}

describe('Story-Modul: Paketgrenze', () => {
  for (const verbot of VERBOTE) {
    it(`importiert kein ${verbot.name}`, () => {
      const offenders: string[] = []
      for (const file of collectTsFiles(join(REPO_ROOT, PAKET))) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
        for (const treffer of fundstellen(readFileSync(file, 'utf-8'), verbot.muster)) {
          offenders.push(`${rel}:${treffer}`)
        }
      }
      expect(offenders, `${verbot.name} im Story-Modul:\n${offenders.join('\n')}`).toEqual([])
    })
  }

  it('das Wurzel-Barrel ist React-frei (API-Routen holen dort das Gate)', () => {
    const barrel = readFileSync(join(REPO_ROOT, PAKET, 'index.ts'), 'utf-8')
    expect(barrel).not.toMatch(/from\s+['"]react['"]/)
    expect(barrel).not.toMatch(/\.\/react/)
  })
})
