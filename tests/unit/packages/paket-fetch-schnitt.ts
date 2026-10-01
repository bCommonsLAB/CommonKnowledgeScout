/**
 * Gemeinsame Helfer der Fetch-Schnitt-Tests (`module-explorer`, `module-story`).
 *
 * Regel (M5, Schritt Basis-URL): In einem Modul-Paket geht jeder Request ueber
 * die Instanz (`InstanceApi` aus `@ks/api-client`), keiner ueber ein nacktes
 * `fetch`. Im Embed laeuft das Paket in einer fremden Seite; ein `fetch('/api/…')`
 * loest dort gegen den fremden Server auf — kein Fehler im Build, nur eine
 * leere Oberflaeche beim Kunden.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** `fetch(` ohne Objekt davor — `instanz.fetch(` ist erlaubt, `prefetch(` kein Treffer. */
const NACKTES_FETCH = /(?<![\w.$])fetch\s*\(/
/** Auch nicht ueber das globale Objekt. */
const GLOBALES_FETCH = /\b(?:window|globalThis|self)\s*\.\s*fetch\b/

export function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectTsFiles(full, acc)
    else if (/\.tsx?$/.test(entry)) acc.push(full)
  }
  return acc
}

function istKommentar(zeile: string): boolean {
  const t = zeile.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/** Zeilen mit nacktem oder globalem `fetch`, als `Zeile: Inhalt`. */
export function fetchFundstellen(inhalt: string): string[] {
  return inhalt.split('\n').flatMap((zeile, i) =>
    !istKommentar(zeile) && (NACKTES_FETCH.test(zeile) || GLOBALES_FETCH.test(zeile))
      ? [`${i + 1}: ${zeile.trim()}`]
      : [],
  )
}

/** Alle Fundstellen eines Pakets, als `pfad:Zeile: Inhalt`. */
export function nacktesFetchImPaket(repoRoot: string, paketSrc: string): string[] {
  const offenders: string[] = []
  for (const file of collectTsFiles(join(repoRoot, paketSrc))) {
    const rel = relative(repoRoot, file).replace(/\\/g, '/')
    for (const treffer of fetchFundstellen(readFileSync(file, 'utf-8'))) offenders.push(`${rel}:${treffer}`)
  }
  return offenders
}
