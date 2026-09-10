/**
 * Beweis-Ziel M5, Schritt Basis-URL: Im Explorer-Modul geht jeder Request
 * ueber die Instanz (`InstanceApi` aus `@ks/api-client`), keiner ueber ein
 * nacktes `fetch`.
 *
 * Warum das zaehlt: Im Embed laeuft die Galerie in einer fremden Seite. Ein
 * `fetch('/api/…')` loest dort gegen den Server der fremden Seite auf — kein
 * Fehler im Build, keiner in den Tests der Voll-App, nur eine leere Galerie
 * beim Kunden. `instanz.fetch(…)` setzt die Basis-URL davor; in der Voll-App
 * ist sie leer (`SAME_ORIGIN_API`), dort aendert sich nichts.
 *
 * Welche der Requests das anonyme Embed wirklich braucht und welche nur
 * angemeldet Sinn ergeben: `docs/refactor/modularisierung/03-audit-embed-fetches.md`.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = process.cwd()
const PAKET = 'packages/module-explorer/src'

/** `fetch(` ohne Objekt davor — `instanz.fetch(` ist erlaubt, `prefetch(` kein Treffer. */
const NACKTES_FETCH = /(?<![\w.$])fetch\s*\(/
/** Auch nicht ueber das globale Objekt. */
const GLOBALES_FETCH = /\b(?:window|globalThis|self)\s*\.\s*fetch\b/

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collect(full, acc)
    else if (/\.tsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

function istKommentar(zeile: string): boolean {
  const t = zeile.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/** Zeilen mit nacktem oder globalem `fetch`, als `Zeile: Inhalt`. */
function fundstellen(inhalt: string): string[] {
  return inhalt.split('\n').flatMap((zeile, i) =>
    !istKommentar(zeile) && (NACKTES_FETCH.test(zeile) || GLOBALES_FETCH.test(zeile))
      ? [`${i + 1}: ${zeile.trim()}`]
      : [],
  )
}

describe('Explorer-Modul spricht nur ueber die Instanz', () => {
  it('kein nacktes fetch im Paket', () => {
    const offenders: string[] = []
    for (const file of collect(join(REPO_ROOT, PAKET))) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
      for (const treffer of fundstellen(readFileSync(file, 'utf-8'))) offenders.push(`${rel}:${treffer}`)
    }
    expect(
      offenders,
      `Nacktes fetch im Explorer-Modul:\n${offenders.join('\n')}\n` +
        'Requests laufen ueber die Instanz: in der Galerie `useInstanz().fetch(…)`, ' +
        'im Explorer-Eintritt die hereingereichte `instanz`. Sonst verliert das Embed die Basis-URL.',
    ).toEqual([])
  })

  it('Gegenprobe: das Muster faengt nacktes fetch und laesst instanz.fetch durch', () => {
    expect(fundstellen("const res = await fetch('/api/chat/lib/docs')")).toHaveLength(1)
    expect(fundstellen('const res = await fetch(')).toHaveLength(1)
    expect(fundstellen('const res = await window.fetch(url)')).toHaveLength(1)
    expect(fundstellen('const res = await globalThis.fetch(url)')).toHaveLength(1)

    expect(fundstellen("const res = await instanz.fetch('/api/chat/lib/docs')")).toEqual([])
    expect(fundstellen('router.prefetch(href)')).toEqual([])
    expect(fundstellen("// frueher: fetch('/api/…')")).toEqual([])
    expect(fundstellen(" * Warum `instanz.fetch` statt fetch(…)")).toEqual([])
  })
})
