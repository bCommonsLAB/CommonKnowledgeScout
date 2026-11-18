/**
 * @ks/module-website/react — die Bausteine der Website-Startseite (WE2, Plan
 * `startseite-als-embed`): `WebsiteLanding` (Seite, Banner, Fusszeile),
 * `WebsiteDetail`, Kopf-Varianten, Sektionen, Kacheln, Kontaktformular,
 * Daten-Hooks und die Rahmen der Story- und Themen-Sektion.
 *
 * Paketgrenze wie das Wurzel-Barrel: kein `next/*`, kein Clerk, kein `@/`,
 * keine Adresszeile; jeder Abruf ueber die hereingereichte Instanz, jeder Weg
 * ueber `WebsiteNavigation`, Schriften als Prop
 * (`tests/unit/packages/module-website/paket-schnitt.test.ts`).
 */

export * from './hero-band'
export * from './hero-campaign'
export * from './hero-cover'
export * from './markdown-text'
export * from './section-cards'
export * from './section-content'
export * from './use-website-landing-data'
export * from './weg-link'
export * from './website-banner-grid'
export * from './website-contact-form'
export * from './website-detail'
export * from './website-landing'
export * from './website-landing-blocks'
export * from './website-site-footer'
export * from './website-story-sektion-rahmen'
export * from './website-themen-rahmen'
