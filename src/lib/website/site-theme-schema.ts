/**
 * zod-Schema des Design-Profils fuer die Bruecke (Welle S2, Nachtrag).
 *
 * Befund 27.09. (Cowork): `z.record(...).nullable()` wurde als `anyOf` im
 * JSON-Schema veroeffentlicht — der Client zeigte das Feld nicht und schickte
 * das Profil als Text. Deshalb ein explizites Objekt-Schema mit allen Feldern;
 * die inhaltliche Pruefung bleibt in `validiereSiteTheme` (eine Regelquelle
 * fuer Formular und Bruecke), das Schema dient der Sichtbarkeit beim Client.
 */

import { z } from 'zod'
import { SITE_BUTTON_SHAPES, SITE_FONT_NAMES } from '@ks/contracts'

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Farbe als #rrggbb')
const SURFACE = z.object({
  bg: HEX, text: HEX, heading: HEX.optional(), paragraph: HEX.optional(), kicker: HEX.optional(),
}).strict()

export const SITE_THEME_SCHEMA = z.object({
  fontHeading: z.enum(SITE_FONT_NAMES).optional().describe('Schrift der Ueberschriften'),
  fontBody: z.enum(SITE_FONT_NAMES).optional().describe('Schrift des Fliesstexts'),
  accent: HEX.optional().describe('Buttons, Links, Kennzeilen'),
  accentHover: HEX.optional(),
  accentText: HEX.optional().describe('Text auf dem Akzent'),
  buttonShape: z.enum(SITE_BUTTON_SHAPES).optional(),
  surfaces: z.object({
    default: SURFACE.optional(), light: SURFACE.optional(), dark: SURFACE.optional(), brand: SURFACE.optional(),
    linen: SURFACE.optional(), mint: SURFACE.optional(), 'dark-green': SURFACE.optional(), neutral: SURFACE.optional(),
  }).strict().optional().describe('Farben je Flaeche (bg= im Sektions-Marker); nur genannte weichen von der Vorlage ab'),
}).strict()
