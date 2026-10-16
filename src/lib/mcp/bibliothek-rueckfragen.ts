/**
 * @fileoverview Rueckfragen der Bruecke bei der Library-Anlage
 * (Plan speicher-verbindungen-und-library-anlage, C3; Owner-Entscheid E7:
 * Fragenkatalog in der Antwort, MCP-Elicitation erst spaeter).
 *
 * @description
 * `bibliothek_anlegen` legt nur an, wenn alle Pflicht- und empfohlenen
 * Entscheidungen des Katalogs (`src/lib/library-setup/`) beantwortet oder
 * bewusst uebersprungen sind. Sonst antwortet es ohne Anlage mit
 * `offeneEntscheidungen`; der Agent fragt den Menschen und ruft erneut mit
 * `entscheidungen` bzw. `ueberspringen`. Hier liegt die reine Aufbereitung.
 *
 * @module mcp
 */

import { pruefeEinrichtung } from '@/lib/library-setup/pruefung'
import type { EinrichtungsKontext, EinrichtungsPruefung, EntscheidungsStand } from '@/lib/library-setup/typen'
import type { Library } from '@/types/library'

/** Eine offene Frage, wie der Agent sie dem Menschen stellt. */
export interface OffeneFrage {
  schluessel: string
  gewicht: EntscheidungsStand['gewicht']
  frage: string
  optionen?: EntscheidungsStand['optionen']
  vorgabe: string | null
  /** Wie man antwortet: `entscheidungen`, eigener Parameter oder nur ueberspringen. */
  antwortweg: string
}

function antwortweg(stand: EntscheidungsStand, verbindungenUrl: string): string {
  switch (stand.schluessel) {
    case 'name':
      return 'Parameter name'
    case 'inhaltstyp':
      return 'Parameter inhaltstyp'
    case 'speicher':
      return `Parameter speicherVerbindung (speicher_verbindungen_auflisten) + verzeichnis, oder speicherTyp local + verzeichnis; ` +
        `fehlt eine Verbindung, legt der Mensch sie unter ${verbindungenUrl} an`
    case 'vorlageVon':
      return 'Parameter vorlageVon (libraryId, bibliotheken_auflisten) oder ueberspringen'
    default:
      return stand.beantwortbar
        ? `entscheidungen.${stand.schluessel} oder ueberspringen`
        : 'ueberspringen; danach in den Settings setzen'
  }
}

/** Offene Pflicht- und empfohlene Entscheidungen als Fragen fuer den Agenten. */
export function alsFragen(pruefung: EinrichtungsPruefung, verbindungenUrl: string): OffeneFrage[] {
  return pruefung.offen.map((s) => ({
    schluessel: s.schluessel,
    gewicht: s.gewicht,
    frage: s.frage,
    ...(s.optionen ? { optionen: s.optionen } : {}),
    vorgabe: s.vorgabe,
    antwortweg: antwortweg(s, verbindungenUrl),
  }))
}

/** Kompakte Sicht fuer `bibliothek_pruefen`: Stand, offene Fragen, uebrige Entscheidungen in einer Zeile. */
export function einrichtungsSicht(library: Library, kontext: EinrichtungsKontext, verbindungenUrl: string) {
  const pruefung = pruefeEinrichtung(library, kontext)
  return {
    einrichtung: `${pruefung.erledigt} von ${pruefung.gesamt}`,
    vollstaendig: pruefung.vollstaendig,
    pflichtOffen: pruefung.pflichtOffen,
    offeneEntscheidungen: alsFragen(pruefung, verbindungenUrl),
    entscheidungen: pruefung.alle.map((s) => ({ schluessel: s.schluessel, gewicht: s.gewicht, status: s.status })),
  }
}
