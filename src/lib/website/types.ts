import type { SiteSurfaceName } from '@ks/contracts'
import type { SectionContentBlock } from './parse-section-blocks'

/**
 * Typen fuer den Webseiten-/Landingpage-Renderer (detailViewType: website).
 *
 * Hinweis: Diese Typen dienen aktuell dem Phase-0-Pilot (hardcodiert). Das
 * Frontmatter bleibt flach; die Sektionen leben im Markdown-Body und werden
 * ueber HTML-Kommentar-Marker abgegrenzt (siehe parse-website-sections.ts).
 */

/**
 * Layout einer Inhalts-Sektion.
 * `contact-form` (Phase C3): rendert unter dem Sektions-Markdown das
 * Kontakt-Formular (Versand ueber die oeffentliche Contact-API).
 * `banner` (Welle S1): setzt das Dokument-Raster („Mehr aus dieser
 * Bibliothek") an diese Stelle der Seite; das Sektions-Markdown steht als
 * Einleitung darueber. Ohne banner-Sektion bleibt das Raster unter der Seite.
 */
export type SectionLayout =
  | 'image-left'
  | 'image-right'
  | 'full-image'
  | 'text-only'
  | 'video'
  | 'contact-form'
  | 'banner'

/** Schreibweise der Sektions-Ueberschriften (Frontmatter `heading_case`). */
export type HeadingCase = 'capitalize' | 'none'
export const HEADING_CASES: readonly HeadingCase[] = ['capitalize', 'none']

/**
 * Hintergrund-Flaeche einer Inhalts-Sektion. Die Namen stehen in
 * `SITE_SURFACES` (`@ks/contracts`); welche Farbe dahinter liegt, entscheidet
 * seit Welle S2 das Design-Profil der Library (`site-theme.ts`), Vorgabe ist
 * die Vorlage „Oldies for Future".
 */
export type SectionBg = SiteSurfaceName

/** Eine aus dem Body geparste Inhalts-Sektion. */
export interface WebsiteSection {
  layout: SectionLayout
  bg: SectionBg
  /** Markdown-Text der Sektion (ohne das ausgeloeste Sektions-Bild). */
  markdown: string
  /** Optionales Sektions-Bild (erstes Bild im Sektions-Markdown). */
  imageUrl?: string
  imageAlt?: string
  /** Optionale Video-Embed-URL (nur bei layout=video; erste URL im Sektions-Markdown). */
  videoUrl?: string
  /** Welle S2: Kennzeile (Versalzeile ueber der Ueberschrift), Marker-Attribut `kicker="…"`. */
  kicker?: string
  /**
   * Welle S3: `markdown` zerlegt in Text und Sonderbloecke (Kacheln, Chips,
   * Kasten; `parse-section-blocks.ts`). Der Renderer liest DIESE Folge;
   * `markdown` bleibt der Volltext fuer Pruefung und Bestandsnutzer.
   */
  blocks: SectionContentBlock[]
}

/** Eintrag im dynamischen Menue (spaeter: alle website-Dokumente). */
export interface WebsiteMenuItem {
  label: string
  href: string
}

/** Teaser-Karte im Side-Banner (spaeter: wichtigste Dokumente, sort=rating). */
export interface WebsiteBannerItem {
  title: string
  href: string
  imageUrl?: string
}

/** Komplette Datenstruktur fuer den Landingpage-Renderer. */
export interface WebsiteLandingData {
  title: string
  heroSubtitle: string
  heroImageUrl: string
  heroImageAlt?: string
  videoUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Markdown-Body mit Sektions-Markern. */
  body: string
  menu: WebsiteMenuItem[]
  bannerTitle: string
  bannerItems: WebsiteBannerItem[]
  galleryHref: string
}
