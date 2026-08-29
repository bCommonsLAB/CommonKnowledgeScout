/**
 * Beweis-Ziel der Welle Galerie-Vertrag: Server-Code kennt die Galerie nicht mehr.
 *
 * Vor dieser Welle importierten `vector-repo`, `doc-meta-formatter`, drei
 * `external-jobs`-Phasen und die Website-Navigation aus `src/lib/gallery/` —
 * einem Ordner, dessen `types.ts` sogar `'use client'` traegt. Damit war der
 * Galerie-Ordner nicht bewegbar, ohne Server-Code mitzureissen oder zu
 * brechen (Galerie-Audit, Befund 1).
 *
 * Dieser Test haelt den Schnitt fest: Wer serverseitigen Code schreibt, der
 * Dokument-Fachlogik braucht, nimmt `@ks/contracts` oder `src/lib/documents/`
 * — nicht die Galerie.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = process.cwd()

/** Bereiche, die serverseitig laufen oder von beiden Seiten genutzt werden. */
const SERVER_ROOTS = [
  'src/lib/repositories',
  'src/lib/external-jobs',
  'src/lib/website',
  'src/lib/mappers',
  'src/lib/chat',
  'src/app/api',
  'src/utils',
]

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
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

describe('Galerie-Schnitt', () => {
  it('kein Server-Bereich importiert aus src/lib/gallery', () => {
    const offenders: string[] = []
    for (const root of SERVER_ROOTS) {
      for (const file of collectSourceFiles(join(REPO_ROOT, root))) {
        const content = readFileSync(file, 'utf-8')
        if (/from ['"]@\/lib\/gallery\//.test(content)) {
          offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
        }
      }
    }
    expect(
      offenders,
      `Server-Code importiert aus der Galerie:\n${offenders.join('\n')}\n` +
        'Gemeinsame Dokument-Fachlogik gehoert nach src/lib/documents/, ' +
        'gemeinsame Typen nach @ks/contracts.'
    ).toEqual([])
  })

  it('src/lib/documents traegt kein "use client"', () => {
    // Der Ordner ist bewusst rahmenneutral: beide Seiten nutzen ihn.
    const offenders: string[] = []
    for (const file of collectSourceFiles(join(REPO_ROOT, 'src/lib/documents'))) {
      const content = readFileSync(file, 'utf-8')
      if (/^\s*['"]use client['"]/m.test(content)) {
        offenders.push(relative(REPO_ROOT, file).replace(/\\/g, '/'))
      }
    }
    expect(offenders, `'use client' in geteilter Fachlogik:\n${offenders.join('\n')}`).toEqual([])
  })
})
