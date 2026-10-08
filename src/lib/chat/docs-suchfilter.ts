/**
 * @fileoverview Freitextsuche ueber Titel und Facetten eines Meta-Dokuments.
 *
 * @description
 * Die Galerie-Route (`api/chat/[libraryId]/docs`) und die Bruecke
 * (`dokumente_auflisten`) suchen mit DEMSELBEN Filter — sonst findet der
 * Agent andere Dokumente als der Mensch im Browser (ADR 0007: ein Weg, keine
 * zweite Logik). Zahl-Facetten werden per `$toString` durchsuchbar, weil ein
 * Regex auf einem Number-Feld nie greift (Befund Massnahmen-Nummer).
 *
 * @module chat
 */

import type { FacetDef } from './dynamic-facets'

/** `$or`-Zweige fuer eine Teilstring-Suche (case-insensitiv). */
export function baueSuchFilter(
  defs: ReadonlyArray<Pick<FacetDef, 'metaKey' | 'type'>>,
  suche: string,
): Array<Record<string, unknown>> {
  const suchRegex = { $regex: suche, $options: 'i' }
  const felder: Array<Record<string, unknown>> = [
    { title: suchRegex },
    { shortTitle: suchRegex },
    { 'docMetaJson.title': suchRegex },
    { 'docMetaJson.shortTitle': suchRegex },
  ]
  for (const def of defs) {
    if (def.type === 'string' || def.type === 'string[]') {
      felder.push({ [def.metaKey]: suchRegex })
      felder.push({ [`docMetaJson.${def.metaKey}`]: suchRegex })
    } else if (def.type === 'number' || def.type === 'integer-range') {
      felder.push({
        $expr: {
          $regexMatch: {
            input: { $toString: { $ifNull: [`$docMetaJson.${def.metaKey}`, ''] } },
            regex: suche,
            options: 'i',
          },
        },
      })
    }
  }
  return felder
}
