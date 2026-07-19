"use client"

/**
 * Website-Fusszeile (Phase C1): rendert die Sektionen des Docs mit
 * `site_role: footer-content` unter JEDER Website-Seite plus eine Link-Zeile
 * fuer Docs mit `menu_area: footer` (Impressum/Datenschutz -> `?site=...`).
 *
 * Die Fusszeile ist optional: Ladefehler blockieren die Seite nicht, werden
 * aber laut in die Konsole geloggt (kein stiller Fallback).
 */

import * as React from "react"
import { parseWebsiteSections } from "@/lib/website/parse-website-sections"
import { SectionBlock } from "@/components/library/website/website-landing-blocks"
import { useWebsiteDetail } from "@/components/library/website/use-website-landing-data"
import { getSiteParamForDoc } from "@/lib/website/site-navigation"
import type { DocCardMeta } from "@/lib/gallery/types"

interface WebsiteSiteFooterProps {
  libraryId: string
  /** Doc mit `site_role: footer-content` (null = keine Inhalts-Sektionen). */
  footerDoc: DocCardMeta | null
  /** Docs mit `menu_area: footer` — als Links (`?site=...`) verlinkt. */
  footerLinkDocs: DocCardMeta[]
  locale: string
  fallbackLocale?: string
  /** Navigiert zur Website-Seite (setzt den `?site=`-Param). */
  onNavigate: (siteParam: string) => void
}

export function WebsiteSiteFooter({
  libraryId,
  footerDoc,
  footerLinkDocs,
  locale,
  fallbackLocale,
  onNavigate,
}: WebsiteSiteFooterProps): React.ReactElement | null {
  const { detail, detailError } = useWebsiteDetail(
    libraryId,
    footerDoc?.fileId ?? null,
    locale,
    fallbackLocale,
  )

  React.useEffect(() => {
    if (detailError) {
      console.error(`[website-footer] Footer-Doc konnte nicht geladen werden: ${detailError}`)
    }
  }, [detailError])

  const sections = React.useMemo(
    () => (detail?.markdown ? parseWebsiteSections(detail.markdown) : []),
    [detail?.markdown],
  )

  if (!footerDoc && footerLinkDocs.length === 0) return null

  return (
    <footer>
      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} />
      ))}
      {footerLinkDocs.length > 0 && (
        <nav className="bg-[#005140] px-6 py-4 text-sm text-[#6fc5ae]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinkDocs.map((d) => {
              const param = getSiteParamForDoc(d)
              if (!param) return null
              return (
                <button
                  key={d.fileId ?? d.id}
                  type="button"
                  onClick={() => onNavigate(param)}
                  className="whitespace-nowrap hover:text-white hover:underline"
                >
                  {d.title ?? d.fileName ?? "—"}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </footer>
  )
}
