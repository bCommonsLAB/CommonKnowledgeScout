import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import tailwindConfig from '../../tailwind.config'

/**
 * Waechter fuer eine Fehlerklasse, die KEIN anderes Gate faengt.
 *
 * Nach Welle M4b lagen die shadcn-Primitives in `packages/ui/`, aber die
 * `content`-Globs von Tailwind zeigten weiterhin nur auf `./src` und `./app`.
 * Folge: Tailwind erzeugte die Klassen dieser Komponenten nicht mehr. Das
 * mobile Menue rendete als weisse Flaeche, Dropdowns verloren ihr `z-50` und
 * verschwanden hinter dem Inhalt.
 *
 * Weder `pnpm test` noch `pnpm lint`, `typecheck:packages` oder `pnpm build`
 * schlagen dabei an — der Fehler ist rein visuell und faellt erst im Browser
 * auf. Deshalb dieser Test: Er prueft, dass JEDES Workspace-Paket mit
 * .tsx-Dateien von mindestens einem content-Glob erfasst wird.
 */

const REPO_ROOT = process.cwd()
const PACKAGES_DIR = join(REPO_ROOT, 'packages')

/** Uebersetzt einen Tailwind-content-Glob in einen Regex (nur die hier genutzten Formen). */
function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/^\.\//, '')
  let out = ''
  let i = 0
  while (i < normalized.length) {
    const rest = normalized.slice(i)
    if (rest.startsWith('**/')) {
      out += '(?:[^/]+/)*'
      i += 3
    } else if (rest.startsWith('**')) {
      out += '.*'
      i += 2
    } else if (rest.startsWith('*')) {
      out += '[^/]*'
      i += 1
    } else if (rest.startsWith('{')) {
      const end = normalized.indexOf('}', i)
      if (end === -1) throw new Error(`Unbalancierte Klammer im Glob: ${glob}`)
      const alts = normalized.slice(i + 1, end).split(',').map((a) => a.trim())
      out += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
      i = end + 1
    } else {
      out += normalized[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${out}$`)
}

/** Alle .ts/.tsx-Dateien eines Pakets, ohne node_modules. */
function collectSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectSources(full, found)
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) found.push(full)
  }
  return found
}

const contentGlobs = (tailwindConfig.content as string[]).map((g) => ({
  glob: g,
  re: globToRegExp(g),
}))

const packagesWithComponents = readdirSync(PACKAGES_DIR)
  .filter((name) => statSync(join(PACKAGES_DIR, name)).isDirectory())
  .map((name) => ({ name, files: collectSources(join(PACKAGES_DIR, name)) }))
  .filter((p) => p.files.some((f) => f.endsWith('.tsx')))

describe('globToRegExp — der Uebersetzer selbst', () => {
  it('versteht **, * und {a,b}', () => {
    const re = globToRegExp('./packages/*/src/**/*.{ts,tsx}')
    expect(re.test('packages/ui/src/button.tsx')).toBe(true)
    expect(re.test('packages/i18n/src/react/hooks.ts')).toBe(true)
    expect(re.test('packages/ui/src/button.css')).toBe(false)
    // node_modules eines Pakets darf NICHT erfasst werden (Scan-Dauer).
    expect(re.test('packages/ui/node_modules/x/src/a.tsx')).toBe(false)
  })
})

describe('Tailwind content-Globs decken die Workspace-Pakete ab', () => {
  it('findet ueberhaupt Pakete mit Komponenten', () => {
    expect(packagesWithComponents.length).toBeGreaterThan(0)
  })

  it.each(packagesWithComponents.map((p) => p.name))(
    'packages/%s wird von mindestens einem content-Glob erfasst',
    (name) => {
      const pkg = packagesWithComponents.find((p) => p.name === name)!
      const tsxFiles = pkg.files.filter((f) => f.endsWith('.tsx'))
      const uncovered = tsxFiles
        .map((f) => relative(REPO_ROOT, f).split(sep).join('/'))
        .filter((rel) => !contentGlobs.some(({ re }) => re.test(rel)))

      expect(
        uncovered,
        `Tailwind scannt diese Dateien nicht — ihre Klassen landen NICHT im CSS. ` +
          `content-Glob in tailwind.config.ts ergaenzen. Aktuell: ` +
          contentGlobs.map((g) => g.glob).join(', '),
      ).toEqual([])
    },
  )
})
