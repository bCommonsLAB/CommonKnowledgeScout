/**
 * Detail-Daten einer Website-Seite (`detailViewType: website`) und ihr Mapper
 * aus der Antwort von `/api/chat/<libraryId>/doc-meta`.
 *
 * Bis WE1 (Plan `startseite-als-embed`) lagen Typ und Mapper in der App
 * (`website-detail.tsx`, `doc-meta-mappers.ts`). Im Paket, weil App und Embed
 * dieselbe Seite aus denselben Feldern lesen; die App reicht beides von den
 * alten Orten weiter.
 */

import { bannerLimitAus, bannerSortAus, type BannerSort } from './banner'
import { heroBildPositionGeprueft } from './hero-bild-position'
import { heroTonGeprueft, type HeroTon } from './hero-ton'
import { HEADING_CASES, type HeadingCase } from './types'

/** Detail-Daten fuer detailViewType `website` (Landingpage als Dokument). */
export interface WebsiteDetailData {
  title: string
  heroSubtitle?: string
  heroImageUrl?: string
  heroImageAlt?: string
  /** 18.11.2026: CSS-`object-position` des Kopfbilds aus `hero_image_position` (`hero-bild-position.ts`); fehlt = Mitte. */
  heroImagePosition?: string
  /** 26.11.2026: `hero_tone` (`hero-ton.ts`) — `light` = Standard-Kopf ohne Schleier, Text links in Profilfarben; fehlt = `dark`. */
  heroTone?: HeroTon
  /**
   * Hero-Variante (Frontmatter `hero_layout`):
   * - `overlay` (Default): Bild full-bleed mit dunklem Overlay + zentriertem Text.
   * - `cover`: helle Flaeche, grosser gestapelter Titel, kleineres ueberlagertes Bild.
   * - `campaign` (S2): Bild oben mit Kennzeile, darunter Titel, Zweitzeile, zwei Buttons.
   * - `band` (N4): schlankes farbiges Band mit Kennzeile, Titel, Unterzeile — ohne Bild.
   */
  heroLayout?: string // overlay (Vorgabe) | cover | campaign | band | none (kein Kopf, erste Sektion beginnt oben)
  videoUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Welle S2, Hero `campaign`: `hero_kicker`, `hero_title2`, `cta2_label`, `cta2_url`. */
  heroKicker?: string
  /** `hero_title`: Ueberschrift des Heros, wenn sie vom Dokument-Titel (Menuepunkt) abweichen soll. */
  heroTitle?: string
  heroTitle2?: string
  cta2Label?: string
  cta2Url?: string
  /** Markdown-Body mit Sektions-Markern (siehe parse-website-sections). */
  markdown?: string
  /**
   * C3: Empfaenger-Adresse des Kontakt-Formulars (Frontmatter `contact_email`).
   * Nur fuer die Aktiv/Inaktiv-Anzeige — der Versand liest sie serverseitig.
   */
  contactEmail?: string
  /** Welle S1: Banner-Steuerung (Frontmatter `banner_tag`, `banner_title`, `banner_limit`). */
  bannerTag?: string
  bannerTitle?: string
  bannerLimit?: number
  /** Welle F3 (ADR 0012): Reihung des Banners (Frontmatter `banner_sort`); fehlt = `rating`. */
  bannerSort?: BannerSort
  /** Welle N4: `banner_hidden: true` unterdrueckt das Galerie-Raster ganz (kein Banner in der Sektion, keines angehaengt). */
  bannerHidden?: boolean
  /** Welle S1: Schreibweise der Sektions-Ueberschriften (Frontmatter `heading_case`). */
  headingCase?: HeadingCase
  fileId?: string
  fileName?: string
  upsertedAt?: string
}

/**
 * Mapper: API-Response → WebsiteDetailData
 * Extrahiert Hero-/CTA-Felder und den Markdown-Body fuer detailViewType `website`.
 */
export function mapToWebsiteDetail(input: unknown): WebsiteDetailData {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const docMetaJson = (root.docMetaJson && typeof root.docMetaJson === 'object')
    ? root.docMetaJson as Record<string, unknown>
    : {};

  const toStr = (v: unknown): string | undefined => {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    return undefined;
  };

  return {
    title: toStr(docMetaJson.title) || '—',
    heroSubtitle: toStr(docMetaJson.hero_subtitle),
    heroImageUrl: toStr(docMetaJson.hero_image) || toStr(docMetaJson.coverImageUrl),
    heroImageAlt: toStr(docMetaJson.hero_image_alt),
    // 18.11.2026: Ausschnitt des Kopfbilds in der Hoehe; ungueltig wird laut gemeldet, Vorgabe Mitte.
    heroImagePosition: heroBildPositionGeprueft(docMetaJson.hero_image_position),
    // 26.11.2026: heller Kopf ohne Schleier; ungueltig wird laut gemeldet, Vorgabe dunkel.
    heroTone: heroTonGeprueft(docMetaJson.hero_tone),
    heroTitle: toStr(docMetaJson.hero_title),
    heroLayout: toStr(docMetaJson.hero_layout),
    videoUrl: toStr(docMetaJson.video_url),
    ctaLabel: toStr(docMetaJson.cta_label),
    ctaUrl: toStr(docMetaJson.cta_url),
    // S2: Hero `campaign` — Kennzeile im Bild, kursive Zweitzeile, zweiter Handlungsaufruf.
    heroKicker: toStr(docMetaJson.hero_kicker),
    heroTitle2: toStr(docMetaJson.hero_title2),
    cta2Label: toStr(docMetaJson.cta2_label),
    cta2Url: toStr(docMetaJson.cta2_url),
    markdown: toStr(docMetaJson.markdown),
    // C3: Empfaenger-Adresse des Kontakt-Formulars (dokumentgetrieben, oeffentlich
    // sichtbar wie eine Impressums-Adresse — bewusst kein Settings-Feld).
    contactEmail: toStr(docMetaJson.contact_email),
    // S1: Banner-Steuerung und Ueberschriften-Schreibweise (flache Felder).
    bannerTag: toStr(docMetaJson.banner_tag),
    bannerTitle: toStr(docMetaJson.banner_title),
    bannerLimit: bannerLimitGeprueft(docMetaJson.banner_limit),
    // F3 (ADR 0012): Reihung des Banners; ungueltig wird laut gemeldet, Vorgabe rating.
    bannerSort: bannerSortGeprueft(docMetaJson.banner_sort),
    // N4: Galerie-Raster ganz unterdruecken (Startseiten, die nur die Frage zeigen).
    bannerHidden: docMetaJson.banner_hidden === true || docMetaJson.banner_hidden === 'true',
    headingCase: headingCaseAus(docMetaJson.heading_case),
    fileId: toStr(root.fileId),
    fileName: toStr(root.fileName),
    upsertedAt: toStr(root.upsertedAt),
  };
}

/** `banner_sort` lesen; ein ungueltiger Wert wird laut gemeldet, die Seite rendert mit der Vorgabe (rating). */
function bannerSortGeprueft(wert: unknown): BannerSort | undefined {
  try {
    return bannerSortAus(wert);
  } catch (error) {
    console.error(`[website] ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/** `banner_limit` lesen; ein ungueltiger Wert wird laut gemeldet, die Seite rendert mit der Vorgabe. */
function bannerLimitGeprueft(wert: unknown): number | undefined {
  try {
    return bannerLimitAus(wert);
  } catch (error) {
    console.error(`[website] ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * `heading_case` lesen: fehlend = Vorlage (`capitalize`); unbekannter Wert wird
 * laut gemeldet und wie fehlend behandelt (no-silent-fallbacks: geloggt, nicht still).
 */
function headingCaseAus(wert: unknown): HeadingCase | undefined {
  if (wert === undefined || wert === null || wert === '') return undefined;
  if (typeof wert === 'string' && (HEADING_CASES as readonly string[]).includes(wert)) return wert as HeadingCase;
  console.error(`[website] Unbekannter heading_case "${String(wert)}" — erlaubt: ${HEADING_CASES.join(', ')}`);
  return undefined;
}
