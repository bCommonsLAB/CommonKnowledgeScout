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
import type { DocCardMeta } from "@ks/contracts"
import { OLDIES_THEME, type SiteThemeResolved } from "@/lib/website/site-theme"
import { surfaceStyle } from "@/lib/website/surface-style"
import { cn } from "@/lib/utils"

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
  /** Welle S2: Profil fuer Sektionen und Link-Zeile (Flaeche `dark-green`). */
  theme?: SiteThemeResolved
}

export function WebsiteSiteFooter({
  libraryId,
  footerDoc,
  footerLinkDocs,
  locale,
  fallbackLocale,
  onNavigate,
  theme = OLDIES_THEME,
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
  // Link-Zeile: Flaeche `dark-green` — Links in Absatzfarbe, Hover in Textfarbe (Vorlage: Mint/Weiss).
  const linkZeile = surfaceStyle("dark-green", theme)

  return (
    <footer>
      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} theme={theme} />
      ))}
      {footerLinkDocs.length > 0 && (
        <nav className={cn("px-6 py-4 text-sm", linkZeile.className)} style={linkZeile.style}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 text-[color:var(--site-paragraph)]">
            {footerLinkDocs.map((d) => {
              const param = getSiteParamForDoc(d)
              if (!param) return null
              return (
                <button
                  key={d.fileId ?? d.id}
                  type="button"
                  onClick={() => onNavigate(param)}
                  className="whitespace-nowrap hover:text-[color:var(--site-text)] hover:underline"
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
