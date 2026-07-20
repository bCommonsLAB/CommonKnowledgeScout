"use client"

/**
 * Daten-Hooks der Live-Landingpage (detailViewType `website`).
 *
 * Kapselt die Fetches gegen die oeffentlichen Docs-APIs (anonym nutzbar bei
 * oeffentlicher Library), damit `website-landing-live.tsx` und der
 * Website-Footer dieselben Ladepfade teilen:
 *  - `useWebsiteDocs`: alle website-Docs (Menue + Footer-Zuordnung)
 *  - `useWebsiteDetail`: Detail eines Docs (`doc-meta`) -> WebsiteDetailData
 */

import * as React from "react"
import { mapToWebsiteDetail } from "@/lib/mappers/doc-meta-mappers"
import { localizeDocMetaJson } from "@/lib/i18n/get-localized"
import type { WebsiteDetailData } from "@/components/library/website-detail"
import type { DocCardMeta } from "@/lib/gallery/types"

export async function fetchDocs(
  libraryId: string,
  query: string,
  locale: string,
): Promise<DocCardMeta[]> {
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

interface WebsiteDocsState {
  allDocs: DocCardMeta[]
  loadingList: boolean
  listError: string | null
}

/** Laedt alle website-Docs der Library (Menue, Footer-Links, Footer-Content). */
export function useWebsiteDocs(libraryId: string, locale: string): WebsiteDocsState {
  const [allDocs, setAllDocs] = React.useState<DocCardMeta[]>([])
  const [loadingList, setLoadingList] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    setListError(null)
    fetchDocs(libraryId, "detailViewType=website&limit=50", locale)
      .then((items) => {
        if (!cancelled) setAllDocs(items)
      })
      .catch((e) => {
        if (!cancelled) setListError(e instanceof Error ? e.message : "Unbekannter Fehler")
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, locale])

  return { allDocs, loadingList, listError }
}

interface WebsiteDetailState {
  detail: WebsiteDetailData | null
  detailError: string | null
}

/**
 * Laedt das Detail (`doc-meta`) eines website-Docs und lokalisiert es.
 * `fileId = null` laedt nichts; das zuletzt geladene Detail bleibt beim
 * Seitenwechsel sichtbar, bis das neue da ist (kein Flackern).
 */
export function useWebsiteDetail(
  libraryId: string,
  fileId: string | null,
  locale: string,
  fallbackLocale?: string,
): WebsiteDetailState {
  const [detail, setDetail] = React.useState<WebsiteDetailData | null>(null)
  const [detailError, setDetailError] = React.useState<string | null>(null)

  React.useEffect(() => {
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
        if (!cancelled) {
          setDetail(mapToWebsiteDetail({ ...json, docMetaJson: localized }))
          setDetailError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : "Unbekannter Fehler")
      })
    return () => {
      cancelled = true
    }
  }, [fileId, libraryId, locale, fallbackLocale])

  return { detail, detailError }
}
