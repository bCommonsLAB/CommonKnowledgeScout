/**
 * @fileoverview Eingabe-Schema von `datei_patchen` (ST3, erweitert in W1/W2/W4).
 *
 * @description
 * Aus `tools-patch.ts` ausgelagert (200-Zeilen-Regel), als die Einfuege-Modi
 * und der Stapel dazukamen.
 *
 * Ein Schema fuer fuenf Modi heisst: viele optionale Felder. Deshalb uebersetzt
 * {@link leseModus} die flache Eingabe in die unterschiedene Union — und wirft,
 * wenn ein Modus sein Pflichtfeld nicht mitbringt, statt es zu raten. Was
 * `art` verlangt, steht in der Fehlermeldung, nicht nur in der Beschreibung.
 *
 * @module mcp/storage
 */

import { z } from 'zod'
import type { PatchModus } from './patch'
import type { Aktion } from './schreibschutz'

export const MODUS_SCHEMA = z.object({
  art: z.enum([
    'ersetze',
    'abschnitt_ersetzen',
    'frontmatter_setzen',
    'abschnitt_einfuegen',
    'tabelle_zeile_einfuegen',
  ]),
  altText: z.string().optional().describe('art="ersetze": muss GENAU EINMAL in der Datei vorkommen'),
  neuText: z.string().optional().describe('art="ersetze": was an die Stelle tritt'),
  ueberschrift: z.string().optional()
    .describe('art="abschnitt_ersetzen"/"abschnitt_einfuegen": z. B. "## Befunde". Bei "tabelle_zeile_einfuegen" optional: grenzt auf diesen Abschnitt ein.'),
  neuerInhalt: z.string().optional().describe('art="abschnitt_ersetzen": inkl. der Ueberschriftszeile'),
  felder: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
    .describe('art="frontmatter_setzen": flache snake_case-Keys, Skalare. Keine Listen/Objekte.'),
  inhalt: z.string().optional().describe('art="abschnitt_einfuegen": der einzufuegende Block, inkl. eigener Ueberschrift'),
  position: z.enum(['vor', 'nach', 'anfang', 'ende']).optional()
    .describe('art="abschnitt_einfuegen": vor|nach (nach = hinter dem GANZEN Abschnitt). art="tabelle_zeile_einfuegen": anfang|ende (Vorgabe ende).'),
  zeile: z.string().optional().describe('art="tabelle_zeile_einfuegen": vollstaendige Markdown-Zeile, beginnt mit "|"'),
})

export type ModusEingabe = z.infer<typeof MODUS_SCHEMA>

/** Uebersetzt die Eingabe in einen {@link PatchModus} — ohne fehlende Felder zu raten. */
export function leseModus(eingabe: ModusEingabe): PatchModus {
  if (eingabe.art === 'ersetze') {
    if (eingabe.altText === undefined || eingabe.neuText === undefined) {
      throw new Error('art="ersetze" braucht `altText` und `neuText`')
    }
    return { art: 'ersetze', altText: eingabe.altText, neuText: eingabe.neuText }
  }

  if (eingabe.art === 'abschnitt_ersetzen') {
    if (!eingabe.ueberschrift || eingabe.neuerInhalt === undefined) {
      throw new Error('art="abschnitt_ersetzen" braucht `ueberschrift` und `neuerInhalt`')
    }
    return { art: 'abschnitt_ersetzen', ueberschrift: eingabe.ueberschrift, neuerInhalt: eingabe.neuerInhalt }
  }

  if (eingabe.art === 'abschnitt_einfuegen') {
    if (!eingabe.ueberschrift || eingabe.inhalt === undefined) {
      throw new Error('art="abschnitt_einfuegen" braucht `ueberschrift` und `inhalt`')
    }
    if (eingabe.position !== 'vor' && eingabe.position !== 'nach') {
      throw new Error('art="abschnitt_einfuegen" braucht position="vor" oder position="nach"')
    }
    return {
      art: 'abschnitt_einfuegen',
      ueberschrift: eingabe.ueberschrift,
      position: eingabe.position,
      inhalt: eingabe.inhalt,
    }
  }

  if (eingabe.art === 'tabelle_zeile_einfuegen') {
    if (eingabe.zeile === undefined) throw new Error('art="tabelle_zeile_einfuegen" braucht `zeile`')
    if (eingabe.position === 'vor' || eingabe.position === 'nach') {
      throw new Error('art="tabelle_zeile_einfuegen" kennt nur position="anfang" oder "ende"')
    }
    return {
      art: 'tabelle_zeile_einfuegen',
      zeile: eingabe.zeile,
      ...(eingabe.ueberschrift ? { ueberschrift: eingabe.ueberschrift } : {}),
      position: eingabe.position ?? 'ende',
    }
  }

  if (!eingabe.felder || Object.keys(eingabe.felder).length === 0) {
    throw new Error('art="frontmatter_setzen" braucht `felder` mit mindestens einem Eintrag')
  }
  return { art: 'frontmatter_setzen', felder: eingabe.felder }
}

/**
 * Welche Schreibschutz-Aktion dieser Modus darstellt (ST5).
 *
 * Nur `frontmatter_setzen` trifft den Feldkern einer `_INDEX.md`; alles
 * andere ist Fliesstext. Bewusst als vollstaendige Fallunterscheidung ohne
 * `default`-Zweig: Ein neuer Modus soll hier einen Typfehler ausloesen, statt
 * stillschweigend als Fliesstext durchzugehen.
 */
export function aktionZuModus(modus: PatchModus): Aktion {
  switch (modus.art) {
    case 'frontmatter_setzen':
      return 'frontmatter'
    case 'ersetze':
    case 'abschnitt_ersetzen':
    case 'abschnitt_einfuegen':
    case 'tabelle_zeile_einfuegen':
      return 'fliesstext'
  }
}
