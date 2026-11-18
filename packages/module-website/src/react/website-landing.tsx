"use client"

/**
 * Die Live-Startseite einer Library (detailViewType `website`): Seite,
 * Banner, Fusszeile — ohne App-Bindung (Plan `startseite-als-embed`, WE2).
 *
 * Speist sich aus den oeffentlichen Docs-APIs der Instanz (anonym bei
 * oeffentlicher Library): `docs?detailViewType=website` fuer Menue und
 * Fusszeile (`menu_area`/`site_role`, `site-navigation.ts`), das Banner und
 * `doc-meta?fileId=…` fuer die gewaehlte Seite.
 *
 * Welche Seite gilt (`seite`, Slug oder fileId wie `?site=`), wohin die Wege
 * fuehren (`navigation`), welche Schriften das Profil nennt (`schriften`) und
 * was an einer Story-Sektion steht (`storySlot`), reicht der Gastgeber herein:
 * in der App `WebsiteLandingLive` (nuqs, Router, `next/font`, `next/dynamic`),
 * spaeter das Startseiten-Embed. Ohne `seite`: Main-Menue-Doc mit kleinstem
 * `menu_order`; eine unbekannte Kennung wird gemeldet und zeigt die Startseite.
 */

import * as React from "react"
import { useTranslation } from "@ks/i18n/react"
import type { InstanceApi } from "@ks/api-client"
import type { DocCardMeta, SiteFontName, SiteTheme } from "@ks/contracts"
import {
  selectMainMenuDocs,
  selectFooterLinkDocs,
  findFooterContentDoc,
  BANNER_LIMIT_DEFAULT,
  resolveSiteTheme,
  siteThemeCssVars,
  type HeadingCase,
  type SiteThemeResolved,
  type WebsiteNavigation,
  type WebsiteSection,
} from ".."
import { WebsiteDetail, hatBannerSektion } from "./website-detail"
import { WebsiteBannerGrid } from "./website-banner-grid"
import { WebsiteSiteFooter } from "./website-site-footer"
import { useWebsiteDocs, useWebsiteDetail } from "./use-website-landing-data"
import { useWebsiteSeite, type UnbekannteSeite } from "./use-website-seite"

/** Was ein Story-Slot ueber die Seite wissen muss. */
export interface WebsiteSlotKontext {
  headingCase?: HeadingCase
  theme: SiteThemeResolved
}

export interface WebsiteLandingProps {
  instanz: InstanceApi
  libraryId: string
  /** Fallback-Locale aus library.config.translations.fallbackLocale (optional). */
  fallbackLocale?: string
  /** Gewaehlte Website-Seite (Slug oder fileId, wie `?site=`); `null` = Startseite. */
  seite: string | null
  /** WE4: unbekannte `seite` — Startseite zeigen (App) oder Fehler im Rahmen (Embed). */
  unbekannteSeite: UnbekannteSeite
  /** WE4: Menuezeile ueber der Seite (Embed); bekommt die Main-Menue-Seiten und die aktive. */
  menue?: (p: { hauptmenue: DocCardMeta[]; aktivFileId: string | null }) => React.ReactNode
  /** WE4 (Entscheid A): Banner-Karte oeffnet die Detailansicht ueber der Seite statt des Wegs. */
  onDokument?: (doc: DocCardMeta) => void
  /** Wohin Kacheln, Handlungsaufrufe, Markdown-Links, Banner und Fusszeile fuehren. */
  navigation: WebsiteNavigation
  /** Schriftfamilie je Profil-Name (App: `next/font`); fehlt = Schriften erben. */
  schriften?: Record<SiteFontName, string>
  /** Design-Profil (`publicPublishing.siteTheme`); fehlt = Vorlage. */
  siteTheme?: SiteTheme
  /** Text des Galerie-Links am Banner (z. B. „mehr Aktionen"). */
  moreLinkLabel: string
  /** C3: Library-Slug fuer die oeffentliche Contact-API; `null` = Formular deaktiviert. */
  contactApiSlug: string | null
  /** Sterne und Kommentare an den Banner-Karten bedienbar (siehe `WebsiteBannerGrid`). */
  sterneAnKarten: boolean
  /** Eigener Scroll-Container (Site-Modus der App) statt natuerlichem Fluss der Seite. */
  eigenerScroll: boolean
  /** N1: was an der Stelle einer `story`- bzw. `topics`-Sektion steht; fehlt = Rahmen der Vorschau. */
  storySlot?: (section: WebsiteSection, kontext: WebsiteSlotKontext) => React.ReactNode
}

export function WebsiteLanding({
  instanz,
  libraryId,
  fallbackLocale,
  seite,
  unbekannteSeite,
  menue,
  onDokument,
  navigation,
  schriften,
  siteTheme,
  moreLinkLabel,
  contactApiSlug,
  sterneAnKarten,
  eigenerScroll,
  storySlot,
}: WebsiteLandingProps): React.ReactElement {
  const { t, locale } = useTranslation()

  // S2: Design-Profil aufloesen (ohne Profil: Vorlage) und als CSS-Variablen
  // plus Schriften auf den Wrapper legen — alle Bausteine lesen nur Variablen.
  const theme = React.useMemo(() => resolveSiteTheme(siteTheme), [siteTheme])
  const themeStyle = React.useMemo(
    () => ({ ...siteThemeCssVars(theme, schriften), fontFamily: "var(--site-font-body)" }) as React.CSSProperties,
    [theme, schriften],
  )

  const { allDocs, loadingList, listError } = useWebsiteDocs(instanz, libraryId, locale)
  const { fileId: selectedFileId, fehler: seitenFehler } = useWebsiteSeite(allDocs, seite, unbekannteSeite)

  const mainMenuDocs = React.useMemo(() => selectMainMenuDocs(allDocs), [allDocs])
  const footerLinkDocs = React.useMemo(() => selectFooterLinkDocs(allDocs), [allDocs])
  const footerDoc = React.useMemo(() => findFooterContentDoc(allDocs), [allDocs])

  const { detail, detailError } = useWebsiteDetail(instanz, libraryId, selectedFileId, locale, fallbackLocale)

  // Seitenwechsel: nach oben scrollen (Footer-Links stehen ganz unten).
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!selectedFileId) return
    containerRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [selectedFileId])

  // S1: Das Raster („Mehr aus dieser Bibliothek") steuert das Seiten-Doc; es steht
  // in einer `banner`-Sektion des Bodys oder — ohne Sektion — unter der Seite.
  const bannerInSektion = React.useMemo(() => hatBannerSektion(detail?.markdown), [detail?.markdown])
  // N4: `banner_hidden: true` nimmt das Galerie-Raster ganz von der Seite.
  const bannerHidden = detail?.bannerHidden ?? false
  const banner = detail && !bannerHidden ? (
    <WebsiteBannerGrid
      instanz={instanz}
      libraryId={libraryId}
      locale={locale}
      tag={detail.bannerTag}
      title={detail.bannerTitle}
      limit={detail.bannerLimit ?? BANNER_LIMIT_DEFAULT}
      sort={detail.bannerSort}
      navigation={navigation}
      sterneAnKarten={sterneAnKarten}
      onDokument={onDokument}
      moreLinkLabel={moreLinkLabel}
      theme={theme}
    />
  ) : null

  const headingCase = detail?.headingCase
  const detailStorySlot = React.useMemo(
    () => (storySlot ? (section: WebsiteSection) => storySlot(section, { headingCase, theme }) : undefined),
    [storySlot, headingCase, theme],
  )

  const error = listError ?? seitenFehler ?? detailError
  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>
  }
  if (loadingList && !detail) {
    return <div className="p-6 text-sm text-muted-foreground">{t("gallery.loading")}</div>
  }
  if (!loadingList && allDocs.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Noch keine Webseiten-Inhalte (detailViewType „website“) in dieser Library.
      </div>
    )
  }

  return (
    // Natuerlicher Fluss (Root-Modus, Embed) oder innerer Scroll-Container (Site-Modus der App).
    <div ref={containerRef} className={eigenerScroll ? 'h-full overflow-y-auto' : 'w-full'} style={themeStyle}>
      {menue?.({ hauptmenue: mainMenuDocs, aktivFileId: selectedFileId })}
      {detail && (
        <WebsiteDetail
          data={detail}
          showBackLink={false}
          contactApiSlug={contactApiSlug}
          bannerSlot={bannerInSektion && !bannerHidden ? banner : undefined}
          storySlot={detailStorySlot}
          navigation={navigation}
          instanz={instanz}
          theme={theme}
        />
      )}
      {!bannerInSektion && banner}

      <WebsiteSiteFooter
        instanz={instanz}
        libraryId={libraryId}
        footerDoc={footerDoc}
        footerLinkDocs={footerLinkDocs}
        locale={locale}
        fallbackLocale={fallbackLocale}
        navigation={navigation}
        theme={theme}
      />
    </div>
  )
}
