/**
 * @fileoverview Suchlauf ueber die eigenen Libraries (Wunschliste 8, W8-2) — nur MongoDB.
 *
 * @description
 * Zwei Aufrufer, ein Weg:
 * - `quelle_suchen` (Werkzeug) sucht EINE Quelle und laedt die Treffer ganz
 *   (Erschliessung zaehlen); Pfade loest das Werkzeug danach im Speicher auf.
 * - der Coverage-Scan sucht fuer alle `quelle_verschwunden` einer Library auf
 *   einmal, nur Kopf-Felder, und haengt die Orte an den Befund
 *   (`moeglicherweiseIn`). Kein Storage-Zugriff: der Scan bleibt so teuer wie
 *   vorher, plus eine Abfrage je Library.
 *
 * Libraries kommen mit Slug herein (`library-adresse/slug.ts`), damit jede
 * Antwort die lesbare Form `@<slug>` traegt statt einer Id.
 *
 * @module shadow-twin
 */

import { baueBibliotheksKuerzel } from '@/lib/library-adresse/adresse'
import { bestimmeSlugs, type SlugQuelle } from '@/lib/library-adresse/slug'
import { findeQuellKandidaten, type QuellKandidat } from '@/lib/repositories/shadow-twin-suche'
import {
  MAX_ORTE_JE_QUELLE,
  bewerteTreffer,
  sortiereNachUebereinstimmung,
  type MoeglicherOrt,
  type OrteJeQuelle,
  type SuchQuelle,
  type Suchmerkmale,
  type Uebereinstimmung,
} from './quelle-suche'

export interface SuchLibrary {
  id: string
  name: string
  slug: string | null
}

/** Libraries mit ihrem Slug (Kollisionen ergeben `slug: null`). */
export function suchLibrariesAus(libraries: readonly SlugQuelle[]): SuchLibrary[] {
  return bestimmeSlugs(libraries).map((eintrag) => ({ id: eintrag.libraryId, name: eintrag.name, slug: eintrag.slug }))
}

export interface QuellTreffer extends QuellKandidat {
  libraryName: string
  slug: string | null
  uebereinstimmung: Uebereinstimmung
}

export interface QuellSuchErgebnis {
  treffer: QuellTreffer[]
  /** Gleicher Name, belegt anderer Inhalt — genannt, nicht gezaehlt. */
  verschieden: Array<{ libraryId: string; libraryName: string; sourceId: string; sourceName: string; grund: string }>
  durchsucht: number
}

/** Hoechstens so viele Kandidaten je Library laedt das Werkzeug ganz. */
export const MAX_KANDIDATEN_JE_LIBRARY = 20

/** Werkzeug-Weg: EINE Quelle ueber alle Libraries. */
export async function sucheQuelle(args: {
  libraries: readonly SuchLibrary[]
  such: Suchmerkmale
  /** Die gesuchte Quelle selbst nicht als Treffer melden. */
  ausser?: { libraryId: string; sourceId: string }
}): Promise<QuellSuchErgebnis> {
  const { libraries, such, ausser } = args
  const ergebnis: QuellSuchErgebnis = { treffer: [], verschieden: [], durchsucht: libraries.length }
  const jeLibrary = await Promise.all(
    libraries.map(async (lib) => ({
      lib,
      kandidaten: await findeQuellKandidaten({
        libraryId: lib.id,
        hashes: such.hash ? [such.hash] : [],
        namen: such.name ? [such.name] : [],
        mitErschliessung: true,
        limit: MAX_KANDIDATEN_JE_LIBRARY,
      }),
    })),
  )
  for (const { lib, kandidaten } of jeLibrary) {
    for (const kandidat of kandidaten) {
      if (ausser && ausser.libraryId === lib.id && ausser.sourceId === kandidat.sourceId) continue
      const bewertung = bewerteTreffer(such, kandidat)
      if (bewertung.art === 'kein_treffer') continue
      if (bewertung.art === 'verschieden') {
        ergebnis.verschieden.push({ libraryId: lib.id, libraryName: lib.name, sourceId: kandidat.sourceId, sourceName: kandidat.sourceName, grund: bewertung.grund })
        continue
      }
      ergebnis.treffer.push({ ...kandidat, libraryName: lib.name, slug: lib.slug, uebereinstimmung: bewertung.art })
    }
  }
  ergebnis.treffer = sortiereNachUebereinstimmung(ergebnis.treffer)
  return ergebnis
}

/** Obergrenze je Library im Scan-Weg (nur Kopf-Felder, also billig). */
const MAX_KANDIDATEN_SCAN = 500

/** Scan-Weg: alle verschwundenen Quellen einer Library auf einmal. */
export async function sucheVerschwundeneAnderswo(args: {
  libraries: readonly SuchLibrary[]
  eigeneLibraryId: string
  quellen: readonly SuchQuelle[]
}): Promise<Map<string, OrteJeQuelle>> {
  const { libraries, eigeneLibraryId, quellen } = args
  const ergebnis = new Map<string, OrteJeQuelle>()
  if (quellen.length === 0) return ergebnis
  const hashes = [...new Set(quellen.flatMap((q) => (q.sourceContentHash ? [q.sourceContentHash] : [])))]
  const namen = [...new Set(quellen.map((q) => q.sourceName))]
  const jeLibrary = await Promise.all(
    libraries.map(async (lib) => ({
      lib,
      kandidaten: await findeQuellKandidaten({ libraryId: lib.id, hashes, namen, mitErschliessung: false, limit: MAX_KANDIDATEN_SCAN }),
    })),
  )
  for (const quelle of quellen) {
    const such: Suchmerkmale = { name: quelle.sourceName, hash: quelle.sourceContentHash, groesse: quelle.sourceSize }
    const orte: MoeglicherOrt[] = []
    for (const { lib, kandidaten } of jeLibrary) {
      for (const kandidat of kandidaten) {
        if (lib.id === eigeneLibraryId && kandidat.sourceId === quelle.sourceId) continue
        const bewertung = bewerteTreffer(such, kandidat)
        if (bewertung.art === 'kein_treffer' || bewertung.art === 'verschieden') continue
        orte.push({
          libraryId: lib.id,
          libraryName: lib.name,
          bibliothek: lib.slug === null ? null : baueBibliotheksKuerzel(lib.slug),
          sourceId: kandidat.sourceId,
          sourceName: kandidat.sourceName,
          uebereinstimmung: bewertung.art,
        })
      }
    }
    const sortiert = sortiereNachUebereinstimmung(orte)
    ergebnis.set(quelle.sourceId, { orte: sortiert.slice(0, MAX_ORTE_JE_QUELLE), gesamt: sortiert.length })
  }
  return ergebnis
}
