// @vitest-environment node
/**
 * Waechter nach dem roten `ci-main` vom 10.09.2026 (Merge von #272): Im
 * Docker-Image gibt es nur die Abhaengigkeiten der App. Das Dockerfile kopiert
 * vor `pnpm install` nur `package.json` und `pnpm-lock.yaml` — keine
 * `pnpm-workspace.yaml`, keine `package.json` der Pakete. Deren eigene
 * `node_modules` fehlen im Image.
 *
 * `next build` prueft trotzdem die Typen jeder Datei, die die Root-
 * `tsconfig.json` erfasst, auch unter `packages/`. Importiert so eine Datei ein
 * Modul, das nur im `package.json` eines Pakets steht, bricht der Build im
 * Image — lokal nicht, weil dort jedes Paket seine `node_modules` hat. So
 * geschehen mit `packages/embed/tsup.config.ts` (`tsup`). Next meldet dabei
 * nur den ersten Fehler; dieser Test nennt alle.
 *
 * Die Dateiliste kommt von TypeScript selbst (include/exclude der Root-
 * `tsconfig.json`), die Importe liest `ts.preProcessFile` (Kommentare zaehlen
 * nicht). Im Image aufloesbar ist: eine Root-Abhaengigkeit, ein Eintrag in den
 * `paths` der Root-`tsconfig.json`, ein Node-Bordmittel, ein relativer Pfad.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, relative } from 'node:path'
import ts from 'typescript'

const REPO_ROOT = process.cwd()

interface RootPaket {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/** Was `pnpm install` im Image installiert: die Abhaengigkeiten der App. */
function rootAbhaengigkeiten(): Set<string> {
  const paket = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as RootPaket
  return new Set([
    ...Object.keys(paket.dependencies ?? {}),
    ...Object.keys(paket.devDependencies ?? {}),
    ...Object.keys(paket.optionalDependencies ?? {}),
  ])
}

/** Dateien und `paths`-Muster, so wie TypeScript die Root-`tsconfig.json` liest. */
function rootProgramm(): { dateien: string[]; paths: string[] } {
  const { config, error } = ts.readConfigFile(join(REPO_ROOT, 'tsconfig.json'), ts.sys.readFile)
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  const gelesen = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT)
  return { dateien: gelesen.fileNames, paths: Object.keys(gelesen.options.paths ?? {}) }
}

/** Paketname eines nackten Imports: `@scope/name/…` → `@scope/name`, `name/…` → `name`. */
function paketName(spezifizierer: string): string {
  const teile = spezifizierer.split('/')
  return spezifizierer.startsWith('@') ? teile.slice(0, 2).join('/') : teile[0]
}

function passtZuPaths(spezifizierer: string, paths: string[]): boolean {
  return paths.some((muster) =>
    muster.endsWith('/*') ? spezifizierer.startsWith(muster.slice(0, -1)) : spezifizierer === muster,
  )
}

function imImageAufloesbar(spezifizierer: string, abhaengigkeiten: Set<string>, paths: string[]): boolean {
  if (spezifizierer.startsWith('.') || spezifizierer.startsWith('/')) return true
  if (spezifizierer.startsWith('node:') || builtinModules.includes(spezifizierer)) return true
  if (passtZuPaths(spezifizierer, paths)) return true
  return abhaengigkeiten.has(paketName(spezifizierer))
}

function importe(quelltext: string): string[] {
  return ts.preProcessFile(quelltext, true, true).importedFiles.map((f) => f.fileName)
}

describe('Docker-Build: Paket-Dateien in der App-Typpruefung brauchen nur Root-Abhaengigkeiten', () => {
  it('jeder Import unter packages/ ist im Image aufloesbar', () => {
    const abhaengigkeiten = rootAbhaengigkeiten()
    const { dateien, paths } = rootProgramm()
    const paketDateien = dateien
      .map((datei) => relative(REPO_ROOT, datei).replace(/\\/g, '/'))
      .filter((rel) => rel.startsWith('packages/'))
    // Ohne Dateien waere der Test gruen, ohne etwas geprueft zu haben.
    expect(paketDateien.length).toBeGreaterThan(50)

    const offenders = paketDateien.flatMap((rel) =>
      importe(readFileSync(join(REPO_ROOT, rel), 'utf-8'))
        .filter((spezifizierer) => !imImageAufloesbar(spezifizierer, abhaengigkeiten, paths))
        .map((spezifizierer) => `${rel} → ${spezifizierer}`),
    )
    expect(
      offenders,
      `Im Docker-Image nicht aufloesbar:\n${offenders.join('\n')}\n` +
        'Das Image installiert nur die Root-Abhaengigkeiten. Entweder gehoert das Modul in die ' +
        'Root-`package.json`, oder die Datei raus aus der Root-`tsconfig.json` (wie ' +
        '`packages/*/*.config.ts`) und in die `tsconfig.json` ihres Pakets.',
    ).toEqual([])
  }, 30_000)

  it('Gegenprobe: tsup faellt auf; Root-Abhaengigkeit, paths, Bordmittel, relativer Pfad nicht', () => {
    const abhaengigkeiten = new Set(['react', '@radix-ui/react-dialog'])
    const paths = ['@ks/ui', '@ks/module-explorer/gallery/*']
    expect(imImageAufloesbar('tsup', abhaengigkeiten, paths)).toBe(false)
    expect(imImageAufloesbar('@ks/embed', abhaengigkeiten, paths)).toBe(false)

    expect(imImageAufloesbar('react', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('react/jsx-runtime', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('@radix-ui/react-dialog', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('@ks/ui', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('@ks/module-explorer/gallery/contexts/x', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('node:fs', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('path', abhaengigkeiten, paths)).toBe(true)
    expect(imImageAufloesbar('../../tailwind.config', abhaengigkeiten, paths)).toBe(true)

    expect(importe("// import x from 'tsup'\nimport { defineConfig } from 'tsup'")).toEqual(['tsup'])
    expect(importe("const m = await import('jotai')\nexport * from './a'").sort()).toEqual(['./a', 'jotai'])
  })
})
