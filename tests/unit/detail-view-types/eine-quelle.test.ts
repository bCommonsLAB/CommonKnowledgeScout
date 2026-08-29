/**
 * Beweis-Ziel der Welle G3: die Liste der Renderer-Typen existiert genau
 * EINMAL, und jeder Typ hat eine zugeordnete Ansicht.
 *
 * Vor dieser Welle stand die Werteliste elfmal hartkodiert im Repo
 * (Galerie-Audit, Befund 3c). Dieser Test laesst eine zwoelfte Kopie rot
 * werden, statt sie erst beim naechsten Drift auffallen zu lassen.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DETAIL_VIEW_TYPES, VIEW_TYPE_REGISTRY } from '@/lib/detail-view-types/registry'

const REPO_ROOT = process.cwd()
const SCAN_ROOTS = ['src', 'packages']

/** Die eine erlaubte Stelle, an der die Werteliste ausgeschrieben steht. */
const SOURCE_OF_TRUTH = 'packages/contracts/src/detail-view-type.ts'

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc)
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('detailViewType — eine Quelle', () => {
  it('jeder Typ hat einen Registry-Eintrag', () => {
    for (const viewType of DETAIL_VIEW_TYPES) {
      expect(VIEW_TYPE_REGISTRY[viewType], `kein Registry-Eintrag fuer "${viewType}"`).toBeDefined()
    }
  })

  it('die Registry enthaelt keine Typen, die die Liste nicht kennt', () => {
    const known = new Set<string>(DETAIL_VIEW_TYPES)
    for (const key of Object.keys(VIEW_TYPE_REGISTRY)) {
      expect(known.has(key), `Registry kennt "${key}", DETAIL_VIEW_TYPES nicht`).toBe(true)
    }
  })

  it('die Werteliste steht nur an einer Stelle ausgeschrieben', () => {
    // Eine Datei "schreibt die Liste aus", wenn ALLE neun Werte als
    // String-Literale darin vorkommen. Das trifft Kopien der Aufzaehlung.
    //
    // Nicht getroffen — und das ist Absicht:
    // - Verteilstellen, die die Typen als Objekt-Schluessel fuehren
    //   (`Record<DetailViewType, …>` mit unquotierten Keys). Sie sind durch
    //   den Typ bereits erschoepfend und koennen nicht auseinanderlaufen.
    // - Einzelne Vergleiche (`=== 'session'`) — Fachlogik, keine Werteliste.
    const offenders: string[] = []
    for (const root of SCAN_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/')
        if (relPath === SOURCE_OF_TRUTH) continue
        const content = readFileSync(file, 'utf-8')
        const hits = DETAIL_VIEW_TYPES.filter((t) => content.includes(`'${t}'`) || content.includes(`"${t}"`))
        if (hits.length === DETAIL_VIEW_TYPES.length) offenders.push(relPath)
      }
    }
    expect(offenders, `Kopie der Werteliste gefunden:\n${offenders.join('\n')}`).toEqual([])
  })
})
