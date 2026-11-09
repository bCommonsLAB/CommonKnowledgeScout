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
 * `story` (Welle N1, Plan website-story-sektion): der Chat der Library auf
 * der Startseite — Markdown vor dem Block `<!-- questions -->` steht ueber
 * der Eingabe, die Liste des Blocks sind die Beispielfragen, Markdown danach
 * steht unter der Eingabe. Hoechstens eine je Seite (Parser).
 */
export type SectionLayout =
  | 'image-left'
  | 'image-right'
  | 'full-image'
  | 'text-only'
  | 'video'
  | 'contact-form'
  | 'banner'
  | 'story'

/**
 * Bildspalte der Sektionen image-left/image-right (Marker-Attribut
 * `image_width`): `1/2` = zwei gleiche Spalten (Vorgabe), `1/3` = ein Drittel
 * Bild, zwei Drittel Text — fuer Portraets und Bilder mit geringer Aufloesung.
 */
export type SectionImageWidth = '1/2' | '1/3'
export const SECTION_IMAGE_WIDTHS: readonly SectionImageWidth[] = ['1/2', '1/3']

/** Ausrichtung des Sektions-Bilds zum Text (`image_align`): `center` (Vorgabe) oder `top` (obenbuendig). */
export type SectionImageAlign = 'center' | 'top'
export const SECTION_IMAGE_ALIGNS: readonly SectionImageAlign[] = ['center', 'top']

/**
 * Darstellung der zitierten Dokumente in einer Story-Sektion (Marker-Attribut
 * `cards`, Owner 09.11.2026): `hidden` = heutige Antwort mit Belege-Blatt
 * (Vorgabe), `column` = Bildkarten in einer Spalte rechts neben der Antwort,
 * `inline` = Antwort zweispaltig je Absatz (Karte links, Absatz rechts). Nur
 * in der Website-Sektion; Story-Modus und Galerie-Chat kennen das nicht.
 */
export type StoryCards = 'hidden' | 'column' | 'inline'
export const STORY_CARDS: readonly StoryCards[] = ['hidden', 'column', 'inline']

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
  /** Bildspalte bei image-left/image-right; fehlt = `1/2`. Nur gesetzt, wenn der Marker es nennt. */
  imageWidth?: SectionImageWidth
  /** Bildausrichtung bei image-left/image-right; fehlt = `center`. Nur gesetzt, wenn der Marker es nennt. */
  imageAlign?: SectionImageAlign
  /** Welle N1, nur `layout=story`: Platzhalter des Eingabefelds (Marker-Attribut `placeholder="…"`). */
  placeholder?: string
  /**
   * Nur `layout=story` (09.11.2026, SFSCON): Facettenfilter fuer Chat und Belege,
   * Marker-Attribut `filter="year=2026"` (`story-filter.ts`); Form der Galerie-Filter.
   */
  filter?: Record<string, string[]>
  /**
   * Nur `layout=story` (09.11.2026, SFSCON): Zitatmarken im Antworttext von Anfang an
   * zeigen (`citations=visible`); Vorgabe ist N5 — verborgen bis „Quellen anzeigen".
   */
  citationsVisible?: boolean
  /**
   * Nur `layout=story` (Owner 09.11.2026): Darstellung der zitierten Dokumente
   * als Galerie-Bildkarten (`cards=column|inline`); fehlt = `hidden`.
   */
  cards?: StoryCards
  /**
   * Nur `layout=story`: Name eines benannten Regelsatzes der Library
   * (`config.chat.antwortregelnVarianten`), der statt `antwortregeln` gilt
   * (`rules=einladung`); geht als Adress-Parameter `rules` an den Chat-Stream.
   */
  rules?: string
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
