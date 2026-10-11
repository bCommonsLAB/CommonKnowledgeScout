/**
 * @fileoverview Ingest als bewusster Schritt (Welle I1, Owner 11.10.2026).
 *
 * @description
 * Befund des Live-Pruefalls (08.–11.10.): `transformation_starten` ingestierte
 * IMMER mit — die Seite stand in der Galerie, bevor der Mensch die
 * Transformation gesehen hatte („Uebergehung von Keep the Human in the Loop").
 * Die Oberflaeche kann es laengst anders (Ingest-Haken im Pipeline-Sheet,
 * Vorgabe aus).
 *
 * Regel: Transformieren legt die Transformation am Twin ab; der Mensch prueft
 * in der KS-Oberflaeche; erst `index_aktualisieren` bringt die Seite in die
 * Galerie. `ingest` ist per Vorgabe `false`, und die Antwort nennt Wert,
 * Herkunft (`aufruf` | `vorgabe`) und den naechsten Schritt — kein stiller
 * Default (Muster `nurPublizierte`, 2.45.0). Kein Sonderfall fuer `test/`:
 * wer `ingest: true` sagt, hat es so gewollt.
 *
 * @module mcp
 */

import { z } from 'zod'

export const INGEST_INPUT = {
  ingest: z.boolean().optional().describe(
    'Welle I: true = nach der Transformation auch in Galerie und Suche aufnehmen (wie der Ingest-Haken im ' +
    'Pipeline-Sheet). WEGLASSEN = false: Die Transformation liegt am Twin, der Mensch prueft sie in der ' +
    'KS-Oberflaeche, danach bringt index_aktualisieren mit den geprueften sourceIds die Seite in die Galerie. ' +
    'Die Antwort nennt ingest mit Herkunft (aufruf | vorgabe) und den naechsten Schritt.'),
}

export type IngestHerkunft = 'aufruf' | 'vorgabe'

export interface IngestEntscheidung {
  ingest: boolean
  herkunft: IngestHerkunft
  naechsterSchritt: string
}

export const NAECHSTER_SCHRITT_OHNE_INGEST =
  'Transformation liegt am Twin (kein Galerie-Eintrag). In der KS-Oberflaeche pruefen (Markdown und ' +
  'Frontmatter der Transformation); dann index_aktualisieren mit den geprueften sourceIds.'

export const NAECHSTER_SCHRITT_MIT_INGEST =
  'Der Job ingestiert nach der Transformation selbst: Galerie-Eintrag entsteht ohne Pruefung durch den ' +
  'Menschen. Danach seite_pruefen und bestand_pruefen.'

/** Weglassen = false, sichtbar als Vorgabe; nur ein expliziter Wert gilt als Aufruf. */
export function entscheideIngest(angefordert: boolean | undefined): IngestEntscheidung {
  const ingest = angefordert === true
  return {
    ingest,
    herkunft: angefordert === undefined ? 'vorgabe' : 'aufruf',
    naechsterSchritt: ingest ? NAECHSTER_SCHRITT_MIT_INGEST : NAECHSTER_SCHRITT_OHNE_INGEST,
  }
}

/**
 * `quelle_erschliessen` ohne Vorlage (`nur_transkript`) hat nichts zu
 * ingestieren — `ingest: true` ist dann ein Widerspruch, den der Aufrufer
 * erfahren muss, statt dass der Wert still verfaellt.
 */
export function pruefeIngestMitVorlage(args: { ingest: boolean; template: string | undefined }): void {
  if (args.ingest && !args.template) {
    throw new Error('ingest: true zusammen mit template "nur_transkript" — ohne Transformation gibt es nichts zu ingestieren. Entweder eine Vorlage nennen oder ingest weglassen.')
  }
}
