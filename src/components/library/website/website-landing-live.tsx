"use client"

/**
 * Live-Landingpage (Phase 3) fuer den „Startseite"-Mode der Explore-Ansicht.
 *
 * Speist sich ausschliesslich aus den oeffentlichen Docs-APIs (anonym nutzbar
 * bei oeffentlicher Library, Fetches in `use-website-landing-data.ts`):
 *  - Menue/Footer: `docs?detailViewType=website` — Zuordnung ueber die flachen
 *    Frontmatter-Felder `menu_area`/`site_role` (siehe `site-navigation.ts`)
 *  - Side-Banner: `docs?sort=rating` (E5, nach prioritaets_index)
 *  - Detail des gewaehlten Dokuments: `doc-meta?fileId=…` -> WebsiteDetail
 *
 * Phase C1: Der aktive Seiten-Zustand liegt im URL-Param `?site=<slug>` (nuqs)
 * — jede Website-Seite ist verlinkbar (CTA -> Kontakt, Footer -> Impressum)
 * und funktioniert identisch auf `/explore/<slug>` und der Domain-Root.
 * Interim-E2: Start-Dokument = Main-Menue-Doc mit kleinstem menu_order.
 */

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useQueryState } from "nuqs"
import { useLibraries } from '@ks/shell/react'
import { WebsiteDetail, hatBannerSektion } from "@/components/library/website-detail"
import { WebsiteBannerGrid } from "@/components/library/website/website-banner-grid"
import { WebsiteSiteFooter } from "@/components/library/website/website-site-footer"
import { useWebsiteDocs, useWebsiteDetail } from "@/components/library/website/use-website-landing-data"
import {
  selectMainMenuDocs,
  selectFooterLinkDocs,
  findFooterContentDoc,
  resolveSiteParamDoc,
} from "@/lib/website/site-navigation"
import { useTranslation } from "@ks/i18n/react"
import { BANNER_LIMIT_DEFAULT } from "@/lib/website/banner"
import type { SiteTheme } from "@ks/contracts"
import { resolveSiteTheme, siteThemeCssVars } from "@/lib/website/site-theme"
import { SITE_FONT_FAMILIES } from "@/lib/website/site-fonts"
import type { WebsiteSection } from "@/lib/website/types"
import type { KartenNavigation } from "@/lib/website/kartenziel"

// N1: Der Chat der Story-Sektion zieht Story-Paket und Clerk — faul laden, nur
// Seiten mit `layout=story` zahlen dafuer. Ohne SSR: Sitzung und Perspektive
// leben im Browser.
const WebsiteStorySektion = dynamic(
  () => import("@/components/library/website/story/website-story-sektion").then((m) => ({ default: m.WebsiteStorySektion })),
  { ssr: false, loading: () => <div className="px-6 py-14 text-sm text-muted-foreground">Lade den Scout …</div> },
)

interface WebsiteLandingLiveProps {
  libraryId: string
  /** Fallback-Locale aus library.config.translations.fallbackLocale (optional). */
  fallbackLocale?: string
  /** Site-Modus (Explore-Galerie): wechselt in den lokalen Galerie-Modus; `extra` = Adress-Parameter, die mitgehen (F3). */
  onShowGallery?: (extra?: Record<string, string>) => void
  /** Welle N2, Site-Modus: wechselt in den Story-Modus (Kachel `?mode=story`); `extra` = Adress-Parameter, die mitgehen (z. B. `q`). */
  onShowStory?: (extra?: Record<string, string>) => void
  /**
   * Root-Modus (`/`): Banner-/„mehr Inhalte"-Navigation zeigt auf diese
   * Explore-Basis-URL (z. B. `/explore/oldiesforfuture`), statt in den lokalen
   * Galerie-Modus zu wechseln. Banner-Karten oeffnen `…?doc=<slug>` dort.
   */
  exploreBaseHref?: string
  /**
   * C3: Library-Slug fuer die oeffentliche Contact-API (Root-Modus; im
   * Site-Modus wird er aus dem `/explore/<slug>`-Pfad abgeleitet).
   */
  librarySlug?: string
  /**
   * Welle S2: Design-Profil im Root-Modus (`/`), wo das Library-Atom leer sein
   * kann; im Site-Modus kommt es aus der Library im Atom.
   */
  siteTheme?: SiteTheme
}

export function WebsiteLandingLive({
  libraryId,
  fallbackLocale,
  onShowGallery,
  onShowStory,
  exploreBaseHref,
  librarySlug,
  siteTheme,
}: WebsiteLandingLiveProps): React.ReactElement {
  const { t, locale } = useTranslation()
  const pathname = usePathname()
  // Slug fuer die Contact-API (C3): explizite Prop (Root-Modus) oder aus dem
  // Explore-Pfad. null = kein Library-Kontext -> Formular zeigt Hinweis.
  const exploreSlugMatch = pathname?.match(/^\/explore\/([^/]+)/)
  const contactApiSlug =
    librarySlug ?? (exploreSlugMatch ? decodeURIComponent(exploreSlugMatch[1]) : null)
  // Galerie-Ziel im Root-Modus: `/explore/<slug>` defaultet jetzt auf die
  // Website (Site-Mode). Fuer „mehr Inhalte"/Banner-Karten muss daher explizit
  // `?view=gallery` gesetzt werden, sonst landet man wieder auf der Website.
  const galleryBaseHref = exploreBaseHref ? `${exploreBaseHref}?view=gallery` : null
  const storyBaseHref = exploreBaseHref ? `${exploreBaseHref}?mode=story` : null

  // Per-Library-Text des Galerie-Links (z. B. „mehr Aktionen"). Quelle: Atom
  // (Explore-Seite laedt die Library dorthin). Auf der anonymen Domain-Root
  // kann das Atom leer sein — dann greift der Standard-Text „mehr Inhalte".
  const libraries = useLibraries()
  const publicPublishing = libraries.find((lib) => lib.id === libraryId)?.config?.publicPublishing
  const moreLinkLabel = publicPublishing?.gallery?.moreLinkLabel || "mehr Inhalte"

  // S2: Design-Profil aufloesen (ohne Profil: Vorlage) und als CSS-Variablen
  // plus Schriften auf den Wrapper legen — alle Bausteine lesen nur Variablen.
  const themeConfig = siteTheme ?? publicPublishing?.siteTheme
  const theme = React.useMemo(() => resolveSiteTheme(themeConfig), [themeConfig])
  const themeStyle = React.useMemo(
    () => ({ ...siteThemeCssVars(theme, SITE_FONT_FAMILIES), fontFamily: "var(--site-font-body)" }) as React.CSSProperties,
    [theme],
  )

  const { allDocs, loadingList, listError } = useWebsiteDocs(libraryId, locale)
  // Seitenwechsel via URL (`?site=<slug>`), history: push -> Browser-Back
  // wechselt zwischen Website-Seiten.
  const [siteParam, setSiteParam] = useQueryState("site", { history: "push" })
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null)

  const mainMenuDocs = React.useMemo(() => selectMainMenuDocs(allDocs), [allDocs])
  const footerLinkDocs = React.useMemo(() => selectFooterLinkDocs(allDocs), [allDocs])
  const footerDoc = React.useMemo(() => findFooterContentDoc(allDocs), [allDocs])

  // `?site=` aufloesen (Slug oder fileId); ohne/mit unbekanntem Param -> Homepage
  // (Main-Menue-Doc mit kleinstem menu_order). Nicht aufloesbare Params werden
  // geloggt statt still verschluckt.
  React.useEffect(() => {
    if (allDocs.length === 0) return
    if (siteParam) {
      const resolved = resolveSiteParamDoc(allDocs, siteParam)
      if (resolved?.fileId) {
        setSelectedFileId(resolved.fileId)
        return
      }
      console.warn(`[website] ?site=${siteParam} passt zu keinem website-Doc — zeige Startseite`)
    }
    setSelectedFileId(mainMenuDocs[0]?.fileId ?? allDocs[0]?.fileId ?? null)
  }, [allDocs, mainMenuDocs, siteParam])

  // N2: Kachel-Links (`<!-- cards -->`): Site-Modus wechselt ueber Rueckrufe ohne Neuladen,
  // Root-Modus faellt auf Adressen der Explore-Seite zurueck; `?site=` geht in beiden ueber nuqs.
  const kartenNavigation = React.useMemo<KartenNavigation>(
    () => ({ onShowGallery, onShowStory, onShowSite: (slug) => void setSiteParam(slug), galleryBaseHref, storyBaseHref }),
    [onShowGallery, onShowStory, setSiteParam, galleryBaseHref, storyBaseHref],
  )

  const { detail, detailError } = useWebsiteDetail(libraryId, selectedFileId, locale, fallbackLocale)

  // Seitenwechsel: nach oben scrollen (Footer-Links stehen ganz unten).
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!selectedFileId) return
    containerRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [selectedFileId])

  // S1: Das Raster („Mehr aus dieser Bibliothek") wird vom Seiten-Doc gesteuert
  // (banner_tag, banner_title, banner_limit) und steht entweder in einer
  // `banner`-Sektion des Bodys oder — ohne Sektion — unter der Seite.
  const bannerInSektion = React.useMemo(() => hatBannerSektion(detail?.markdown), [detail?.markdown])
  // N4: `banner_hidden: true` nimmt das Galerie-Raster ganz von der Seite — fuer
  // Startseiten, bei denen es nur um die Frage geht (nicht um die Galerie).
  const bannerHidden = detail?.bannerHidden ?? false
  const banner = detail && !bannerHidden ? (
    <WebsiteBannerGrid
      libraryId={libraryId}
      locale={locale}
      tag={detail.bannerTag}
      title={detail.bannerTitle}
      limit={detail.bannerLimit ?? BANNER_LIMIT_DEFAULT}
      sort={detail.bannerSort}
      galleryBaseHref={galleryBaseHref}
      onShowGallery={onShowGallery}
      moreLinkLabel={moreLinkLabel}
      theme={theme}
    />
  ) : null

  // N1: Story-Sektion mit dem Chat der Library; Belege und Katalog fuehren in
  // die Galerie wie die Banner-Karten (Site-Modus Rueckruf, Root-Modus Adresse).
  const storySlot = React.useCallback(
    (section: WebsiteSection) => (
      <WebsiteStorySektion
        libraryId={libraryId}
        section={section}
        headingCase={detail?.headingCase}
        theme={theme}
        navigation={{ onShowGallery, galleryBaseHref, onShowStory, storyBaseHref }}
      />
    ),
    [libraryId, detail?.headingCase, theme, onShowGallery, galleryBaseHref, onShowStory, storyBaseHref],
  )

  const error = listError ?? detailError
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
    // Root-Modus (`/`): natuerlicher Fluss (Window-Scroll). Site-Modus: innerer Scroll-Container.
    // C1b: Die fruehere zweite Menue-Leiste (mainMenuDocs) entfaellt — die
    // Website-Seiten liegen jetzt als NavItems in der TopNav (useSiteMenuItems).
    <div ref={containerRef} className={exploreBaseHref ? 'w-full' : 'h-full overflow-y-auto'} style={themeStyle}>
      {detail && (
        <WebsiteDetail
          data={detail}
          showBackLink={false}
          contactApiSlug={contactApiSlug}
          bannerSlot={bannerInSektion && !bannerHidden ? banner : undefined}
          storySlot={storySlot}
          kartenNavigation={kartenNavigation}
          theme={theme}
        />
      )}
      {!bannerInSektion && banner}

      <WebsiteSiteFooter
        libraryId={libraryId}
        footerDoc={footerDoc}
        footerLinkDocs={footerLinkDocs}
        locale={locale}
        fallbackLocale={fallbackLocale}
        onNavigate={(param) => void setSiteParam(param)}
        theme={theme}
      />
    </div>
  )
}

export default WebsiteLandingLive
