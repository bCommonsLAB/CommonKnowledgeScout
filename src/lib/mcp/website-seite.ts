/**
 * @fileoverview Bericht ueber die Website einer Library (B5) — reine Funktion.
 *
 * @description
 * Die Vorschau ohne Browser: Was hier sauber ist, rendert die Landingpage.
 * Nutzt dieselben Regeln wie der Renderer (`site-navigation.ts`,
 * `parse-website-sections.ts`), keine zweite Implementierung.
 *
 * @module mcp
 */

import type { DocCardMeta } from '@ks/contracts'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import {
  findFooterContentDoc,
  resolveSiteParamDoc,
  selectFooterLinkDocs,
  selectMainMenuDocs,
} from '@/lib/website/site-navigation'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import { bildUrls } from './website-pruefung'
import { bannerSortAus } from '@/lib/website/banner'

/** Was der Bericht ueber die Library hinaus braucht (F3, ADR 0012). */
export interface SeitenBerichtKontext {
  /** `publicPublishing.starCountsPublic` — ohne ihn liefert `banner_sort: stars` anonym 403. */
  starCountsPublic: boolean
  /** `banner_sort` je Seite aus dem Meta-Dokument (`docMetaJson.banner_sort`). */
  bannerSortJeFileId: Map<string, unknown>
}

/** Befunde zu `banner_sort` einer Seite: unbekannter Wert, oder `stars` ohne Schalter. */
export function bannerSortBefunde(wert: unknown, starCountsPublic: boolean): string[] {
  try {
    const sort = bannerSortAus(wert)
    if (sort === 'stars' && !starCountsPublic) {
      return ['banner_sort stars, aber starCountsPublic ist aus — das Banner bleibt leer (die Docs-Route antwortet anonym 403); Schalter mit veroeffentlichung_setzen einschalten']
    }
    return []
  } catch (error) {
    return [`${error instanceof Error ? error.message : String(error)} — das Banner reiht nach rating`]
  }
}

export interface SeitenEintrag {
  fileId: string
  titel: string
  navigationSlug: string | null
  menu_order?: number
  menu_area?: string
  site_role?: string
  sektionen: Array<{ layout: string; bg: string; bild: boolean; bildBreite?: string; bildAusrichtung?: string }>
  fehler: string[]
  warnungen: string[]
}

export interface SeitenBericht {
  startseite: string | null
  menue: string[]
  footerLinks: string[]
  footerDoc: string | null
  seiten: SeitenEintrag[]
  hinweise: string[]
}

const SITE_LINK_RE = /\(\?site=([^)&\s]+)\)/g
const ANONYM_LESBAR = /^https?:\/\//i

function titel(doc: DocCardMeta): string {
  return doc.title ?? doc.fileName ?? doc.fileId ?? '(ohne Titel)'
}

/**
 * Baut den Bericht aus den website-Docs und ihrem Markdown (`docMetaJson.markdown`).
 * Fehlt das Markdown eines Docs, ist das ein Befund am Doc, kein Abbruch.
 */
export function baueSeitenBericht(
  docs: DocCardMeta[],
  markdownJeFileId: Map<string, string | undefined>,
  kontext?: SeitenBerichtKontext,
): SeitenBericht {
  const hauptmenue = selectMainMenuDocs(docs)
  const hinweise: string[] = []
  if (docs.length === 0) hinweise.push('Keine website-Docs publiziert — die Landingpage bleibt leer')
  if (docs.length > 0 && hauptmenue.length === 0) {
    hinweise.push('Kein Doc im Hauptmenue (menu_area main) — es gibt keine Startseite')
  }

  const seiten: SeitenEintrag[] = docs.map((doc) => {
    const fileId = doc.fileId ?? ''
    const fehler: string[] = []
    const warnungen: string[] = []
    const markdown = markdownJeFileId.get(fileId)
    let sektionen: SeitenEintrag['sektionen'] = []
    if (typeof markdown !== 'string' || !markdown.trim()) {
      fehler.push('Kein Markdown im Meta-Dokument — Seite rendert leer')
    } else {
      try {
        // Bild-Attribute nur, wenn der Marker sie nennt — sonst bleibt die Zeile wie bisher.
        sektionen = parseWebsiteSections(markdown).map((s) => ({
          layout: s.layout, bg: s.bg, bild: Boolean(s.imageUrl),
          ...(s.imageWidth ? { bildBreite: s.imageWidth } : {}),
          ...(s.imageAlign ? { bildAusrichtung: s.imageAlign } : {}),
        }))
      } catch (error) {
        fehler.push(`Sektions-Marker: ${error instanceof Error ? error.message : String(error)}`)
      }
      for (const url of bildUrls(markdown)) {
        if (!ANONYM_LESBAR.test(url)) warnungen.push(`Bild "${url}" ist nicht anonym ladbar`)
      }
      for (const treffer of markdown.matchAll(SITE_LINK_RE)) {
        const ziel = decodeURIComponent(treffer[1])
        if (!resolveSiteParamDoc(docs, ziel)) fehler.push(`Link ?site=${ziel} trifft kein website-Doc`)
      }
    }
    if (doc.menu_order === undefined) warnungen.push('menu_order fehlt — Doc steht am Ende des Menues')
    // F3: banner_sort stars braucht den Library-Schalter; ohne Kontext (Tests ohne Library) keine Pruefung.
    if (kontext) fehler.push(...bannerSortBefunde(kontext.bannerSortJeFileId.get(fileId), kontext.starCountsPublic))
    return {
      fileId,
      titel: titel(doc),
      navigationSlug: getEffectiveDocumentNavigationSlug(doc),
      menu_order: doc.menu_order,
      menu_area: doc.menu_area,
      site_role: doc.site_role,
      sektionen,
      fehler,
      warnungen,
    }
  })

  const footerDoc = findFooterContentDoc(docs)
  return {
    startseite: hauptmenue[0] ? titel(hauptmenue[0]) : null,
    menue: hauptmenue.map(titel),
    footerLinks: selectFooterLinkDocs(docs).map(titel),
    footerDoc: footerDoc ? titel(footerDoc) : null,
    seiten,
    hinweise,
  }
}
