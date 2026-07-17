/**
 * Typen fuer den Webseiten-/Landingpage-Renderer (detailViewType: website).
 *
 * Hinweis: Diese Typen dienen aktuell dem Phase-0-Pilot (hardcodiert). Das
 * Frontmatter bleibt flach; die Sektionen leben im Markdown-Body und werden
 * ueber HTML-Kommentar-Marker abgegrenzt (siehe parse-website-sections.ts).
 */

/** Layout einer Inhalts-Sektion. */
export type SectionLayout = 'image-left' | 'image-right' | 'full-image' | 'text-only'

/** Hintergrund-Variante einer Inhalts-Sektion. */
export type SectionBg = 'default' | 'light' | 'dark' | 'brand'

/** Eine aus dem Body geparste Inhalts-Sektion. */
export interface WebsiteSection {
  layout: SectionLayout
  bg: SectionBg
  /** Markdown-Text der Sektion (ohne das ausgeloeste Sektions-Bild). */
  markdown: string
  /** Optionales Sektions-Bild (erstes Bild im Sektions-Markdown). */
  imageUrl?: string
  imageAlt?: string
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
