/**
 * @ks/module-website — Regeln der Website-Startseite.
 *
 * Seit WE1 (Plan `startseite-als-embed`) liegen hier die reinen Regeln, die
 * Renderer, Bruecke (`seite_pruefen`, `dokument_publizieren`) und spaeter das
 * Startseiten-Embed teilen: Sektions-Parser, Design-Profil (ohne Schriften —
 * die bindet die App ueber `next/font`), Kachelziele, Banner, Story-Karten,
 * Seiten-Navigation und die Detail-Daten einer Seite samt Mapper.
 *
 * Dazu (WE2) die Navigation-Schnittstelle aller Wege der Startseite
 * (`navigation.ts`, in der App `app-navigation.ts`).
 *
 * Dieses Barrel ist React-frei und laeuft auf dem Server; die Bausteine
 * liegen unter `@ks/module-website/react`. Paketgrenze:
 * `tests/unit/packages/module-website/paket-schnitt.test.ts`.
 */

export * from './app-navigation'
export * from './banner'
export * from './eintrags-bezeichnung'
export * from './hero-bild-position'
export * from './kartenziel'
export * from './markdown-links'
export * from './navigation'
export * from './parse-section-attrs'
export * from './parse-section-blocks'
export * from './parse-website-sections'
export * from './site-navigation'
export * from './site-theme'
export * from './site-theme-schema'
export * from './story-filter'
export * from './story-frage-auftrag'
export * from './story-gespraech'
export * from './story-karten'
export * from './story-section'
export * from './story-sichtbares-paar'
export * from './surface-style'
export * from './types'
export * from './website-detail-daten'
