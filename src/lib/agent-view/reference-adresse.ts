/**
 * @fileoverview Verweis-Audit fuer Library-Adressen `[[@<slug>/<pfad>]]` (Wunschliste 8, G3) — pur.
 *
 * @description
 * Eine Adresse zeigt in eine ANDERE Library. Der Scan kennt deren Bestand
 * nicht und prueft ihn auch nicht (das waere ein Storage-Zugriff je Verweis).
 * Er prueft nur, was er beurteilen kann: Ist die Adresse lesbar, und steht
 * ihr Slug im Verzeichnis der Libraries (aktuell oder frueher)?
 *
 * Ohne Verzeichnis (`null`: der Scan hat keine Library-Liste, z. B. ohne
 * Archivpflege) bleibt die Adresse ungeprueft — sie ist dann nicht
 * beurteilbar, und ein `verweis_tot` waere geraten.
 *
 * @module agent-view
 */

import { zerlegeAdresse } from '@/lib/library-adresse/adresse'

/** Grund, warum die Adresse tot ist; null = in Ordnung oder nicht beurteilbar. */
export function pruefeLibraryAdresse(target: string, bekannteSlugs: ReadonlySet<string> | null | undefined): string | null {
  if (!bekannteSlugs) return null
  let slug: string
  try {
    slug = zerlegeAdresse(target).slug
  } catch (error) {
    return `Die Adresse „${target}" ist nicht lesbar: ${error instanceof Error ? error.message : String(error)}`
  }
  if (!bekannteSlugs.has(slug)) {
    return `Die Adresse „${target}" nennt eine unbekannte Library (@${slug}) — Slugs stehen in bibliotheken_auflisten`
  }
  return null
}
