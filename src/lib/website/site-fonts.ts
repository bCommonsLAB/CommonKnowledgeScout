/**
 * Registrierte Schriften des Design-Profils (Welle S2).
 *
 * Schriften muessen gebuendelt werden, deshalb stehen sie im Code; das Profil
 * waehlt sie per Name (`SITE_FONT_NAMES` in `@ks/contracts`). Dateien: die
 * Latin-Teilmengen der variablen Google-Fonts (OFL, siehe `fonts/OFL.txt`);
 * Umlaute und Italienisch liegen darin. Kein `preload` — die Schriften gehoeren
 * nur zur Landingpage, nicht zur App.
 *
 * Neue Schrift = ein Eintrag hier + der Name in `SITE_FONT_NAMES`.
 */

import localFont from 'next/font/local'
import { GeistSans } from 'geist/font/sans'
import type { SiteFontName } from '@ks/contracts'

const newsreader = localFont({
  src: [
    { path: './fonts/newsreader-latin.woff2', style: 'normal' },
    { path: './fonts/newsreader-latin-italic.woff2', style: 'italic' },
  ],
  weight: '200 800',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'serif'],
})

const plusJakarta = localFont({
  src: './fonts/plus-jakarta-sans-latin.woff2',
  weight: '200 800',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
})

/** Schriftfamilie je Profil-Name — Wert fuer `--site-font-heading` / `--site-font-body`. */
export const SITE_FONT_FAMILIES: Record<SiteFontName, string> = {
  geist: GeistSans.style.fontFamily,
  newsreader: newsreader.style.fontFamily,
  'plus-jakarta': plusJakarta.style.fontFamily,
}
