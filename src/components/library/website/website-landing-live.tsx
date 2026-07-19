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
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import { WebsiteDetail } from "@/components/library/website-detail"
import { DocumentCard } from "@/components/library/gallery/document-card"
import { WebsiteSiteFooter } from "@/components/library/website/website-site-footer"
import { useWebsiteDocs, useWebsiteDetail, fetchDocs } from "@/components/library/website/use-website-landing-data"
import {
  selectMainMenuDocs,
  selectFooterLinkDocs,
  findFooterContentDoc,
  resolveSiteParamDoc,
  getSiteParamForDoc,
} from "@/lib/website/site-navigation"
import { useTranslation } from "@/lib/i18n/hooks"
import { getEffectiveDocumentNavigationSlug } from "@/utils/document-slug"
import type { DocCardMeta } from "@/lib/gallery/types"

interface WebsiteLandingLiveProps {
  libraryId: string
  /** Fallback-Locale aus library.config.translations.fallbackLocale (optional). */
  fallbackLocale?: string
  /** Site-Modus (Explore-Galerie): wechselt in den lokalen Galerie-Modus. */
  onShowGallery?: () => void
  /**
   * Root-Modus (`/`): Banner-/„mehr Inhalte"-Navigation zeigt auf diese
   * Explore-Basis-URL (z. B. `/explore/oldiesforfuture`), statt in den lokalen
   * Galerie-Modus zu wechseln. Banner-Karten oeffnen `…?doc=<slug>` dort.
   */
  exploreBaseHref?: string
}

// Zwei volle Reihen im 3-Spalten-Raster (md:grid-cols-3) -> 6 Karten.
const BANNER_LIMIT = 6

export function WebsiteLandingLive({
  libraryId,
  fallbackLocale,
  onShowGallery,
  exploreBaseHref,
}: WebsiteLandingLiveProps): React.ReactElement {
  const { t, locale } = useTranslation()
  const router = useRouter()
  // Galerie-Ziel im Root-Modus: `/explore/<slug>` defaultet jetzt auf die
  // Website (Site-Mode). Fuer „mehr Inhalte"/Banner-Karten muss daher explizit
  // `?view=gallery` gesetzt werden, sonst landet man wieder auf der Website.
  const galleryBaseHref = exploreBaseHref ? `${exploreBaseHref}?view=gallery` : null

  const { allDocs, loadingList, listError } = useWebsiteDocs(libraryId, locale)
  const [bannerDocs, setBannerDocs] = React.useState<DocCardMeta[]>([])
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

  const { detail, detailError } = useWebsiteDetail(libraryId, selectedFileId, locale, fallbackLocale)

  // Seitenwechsel: nach oben scrollen (Footer-Links stehen ganz unten).
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!selectedFileId) return
    containerRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [selectedFileId])

  // Side-Banner: hoechstbewertete Nicht-website-Dokumente (Teaser zur Galerie).
  React.useEffect(() => {
    let cancelled = false
    fetchDocs(libraryId, `sort=rating&limit=${BANNER_LIMIT + 5}`, locale)
      .then((items) => {
        if (cancelled) return
        setBannerDocs(items.filter((d) => d.detailViewType !== "website").slice(0, BANNER_LIMIT))
      })
      .catch(() => {
        // Banner ist optional — ein Fehler darf die Landingpage nicht blockieren.
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, locale])

  const navigateToDoc = React.useCallback(
    (doc: DocCardMeta) => {
      const param = getSiteParamForDoc(doc)
      if (param) void setSiteParam(param)
    },
    [setSiteParam],
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
    <div ref={containerRef} className={exploreBaseHref ? 'w-full' : 'h-full overflow-y-auto'}>
      {mainMenuDocs.length > 1 && (
        <nav className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 overflow-x-auto px-4 text-sm">
            {mainMenuDocs.map((d) => (
              <button
                key={d.fileId ?? d.id}
                type="button"
                onClick={() => navigateToDoc(d)}
                className={`whitespace-nowrap hover:underline ${d.fileId === selectedFileId ? "font-bold" : ""}`}
              >
                {d.title ?? d.fileName ?? "—"}
              </button>
            ))}
          </div>
        </nav>
      )}

      {detail && <WebsiteDetail data={detail} showBackLink={false} />}

      {bannerDocs.length > 0 && (
        <section className="bg-muted px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Mehr aus dieser Bibliothek</h2>
              <button
                type="button"
                onClick={() => (galleryBaseHref ? router.push(galleryBaseHref) : onShowGallery?.())}
                className="whitespace-nowrap text-sm font-medium text-emerald-700 hover:underline"
              >
                mehr Inhalte →
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {bannerDocs.map((d) =>
                galleryBaseHref ? (
                  // Root-Modus: Karte navigiert in die Explore-Galerie (Detail-Overlay dort).
                  // `view=gallery` ist noetig, damit die Galerie (nicht die Website) laedt.
                  <DocumentCard
                    key={d.fileId ?? d.id}
                    doc={d}
                    onClick={() =>
                      router.push(`${galleryBaseHref}&doc=${getEffectiveDocumentNavigationSlug(d) ?? ''}`)
                    }
                  />
                ) : (
                  <DocumentCard key={d.fileId ?? d.id} doc={d} libraryId={libraryId} />
                ),
              )}
            </div>
          </div>
        </section>
      )}

      <WebsiteSiteFooter
        libraryId={libraryId}
        footerDoc={footerDoc}
        footerLinkDocs={footerLinkDocs}
        locale={locale}
        fallbackLocale={fallbackLocale}
        onNavigate={(param) => void setSiteParam(param)}
      />
    </div>
  )
}

export default WebsiteLandingLive
