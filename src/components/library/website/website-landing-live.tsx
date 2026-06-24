"use client"

/**
 * Live-Landingpage (Phase 3) fuer den „Startseite"-Mode der Explore-Ansicht.
 *
 * Ersetzt den alten web/-Snapshot-iframe. Speist sich ausschliesslich aus den
 * oeffentlichen Docs-APIs (anonym nutzbar bei oeffentlicher Library):
 *  - Start-/Menue-Dokumente: `docs?detailViewType=website` (E6, sortiert nach menu_order)
 *  - Side-Banner: `docs?sort=rating` (E5, nach prioritaets_index)
 *  - Detail des gewaehlten Dokuments: `doc-meta?fileId=…` -> produktiver WebsiteDetail
 *
 * Interim-E2: Start-Dokument = website-Doc mit kleinstem menu_order. Das echte
 * Library-Config-Feld („Startseiten-Dokument") folgt in einem eigenen Schritt.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { WebsiteDetail, type WebsiteDetailData } from "@/components/library/website-detail"
import { mapToWebsiteDetail } from "@/lib/mappers/doc-meta-mappers"
import { localizeDocMetaJson } from "@/lib/i18n/get-localized"
import { useTranslation } from "@/lib/i18n/hooks"
import { DocumentCard } from "@/components/library/gallery/document-card"
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

const BANNER_LIMIT = 5

/** Sortiert website-Docs nach menu_order (fehlend ans Ende), dann nach Titel. */
function sortByMenuOrder(a: DocCardMeta, b: DocCardMeta): number {
  const av = typeof a.menu_order === "number" ? a.menu_order : Number.POSITIVE_INFINITY
  const bv = typeof b.menu_order === "number" ? b.menu_order : Number.POSITIVE_INFINITY
  if (av !== bv) return av - bv
  return (a.title ?? "").localeCompare(b.title ?? "")
}

async function fetchDocs(libraryId: string, query: string, locale: string): Promise<DocCardMeta[]> {
  const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs?${query}`, {
    cache: "no-store",
    headers: { "x-locale": locale },
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Dokumente konnten nicht geladen werden")
  }
  return Array.isArray(json.items) ? (json.items as DocCardMeta[]) : []
}

export function WebsiteLandingLive({
  libraryId,
  fallbackLocale,
  onShowGallery,
  exploreBaseHref,
}: WebsiteLandingLiveProps): React.ReactElement {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [menuDocs, setMenuDocs] = React.useState<DocCardMeta[]>([])
  const [bannerDocs, setBannerDocs] = React.useState<DocCardMeta[]>([])
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<WebsiteDetailData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loadingList, setLoadingList] = React.useState(true)

  // 1. Alle website-Dokumente (Menue) + Start-Dokument (kleinster menu_order).
  React.useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    setError(null)
    fetchDocs(libraryId, "detailViewType=website&limit=50", locale)
      .then((items) => {
        if (cancelled) return
        const sorted = [...items].sort(sortByMenuOrder)
        setMenuDocs(sorted)
        setSelectedFileId((prev) => prev ?? sorted[0]?.fileId ?? null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unbekannter Fehler")
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, locale])

  // 2. Side-Banner: hoechstbewertete Nicht-website-Dokumente (Teaser zur Galerie).
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

  // 3. Detail des gewaehlten Dokuments -> WebsiteDetail.
  React.useEffect(() => {
    const fileId = selectedFileId
    if (!fileId) return
    let cancelled = false
    const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(fileId)}`
    fetch(url, { cache: "no-store", headers: { "x-locale": locale } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          throw new Error(typeof json?.error === "string" ? json.error : "Detail konnte nicht geladen werden")
        }
        const localized = localizeDocMetaJson(
          json?.docMetaJson as Record<string, unknown> | undefined,
          locale,
          fallbackLocale,
        )
        if (!cancelled) setDetail(mapToWebsiteDetail({ ...json, docMetaJson: localized }))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unbekannter Fehler")
      })
    return () => {
      cancelled = true
    }
  }, [selectedFileId, libraryId, locale, fallbackLocale])

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>
  }
  if (loadingList && !detail) {
    return <div className="p-6 text-sm text-muted-foreground">{t("gallery.loading")}</div>
  }
  if (!loadingList && menuDocs.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Noch keine Webseiten-Inhalte (detailViewType „website") in dieser Library.
      </div>
    )
  }

  return (
    // Root-Modus (`/`): natuerlicher Fluss (Window-Scroll). Site-Modus: innerer Scroll-Container.
    <div className={exploreBaseHref ? 'w-full' : 'h-full overflow-y-auto'}>
      {menuDocs.length > 1 && (
        <nav className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 overflow-x-auto px-4 text-sm">
            {menuDocs.map((d) => (
              <button
                key={d.fileId ?? d.id}
                type="button"
                onClick={() => setSelectedFileId(d.fileId ?? null)}
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
                onClick={() => (exploreBaseHref ? router.push(exploreBaseHref) : onShowGallery?.())}
                className="whitespace-nowrap text-sm font-medium text-emerald-700 hover:underline"
              >
                mehr Inhalte →
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {bannerDocs.map((d) =>
                exploreBaseHref ? (
                  // Root-Modus: Karte navigiert in die Explore-Galerie (Detail-Overlay dort).
                  <DocumentCard
                    key={d.fileId ?? d.id}
                    doc={d}
                    onClick={() =>
                      router.push(`${exploreBaseHref}?doc=${getEffectiveDocumentNavigationSlug(d) ?? ''}`)
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
    </div>
  )
}

export default WebsiteLandingLive
