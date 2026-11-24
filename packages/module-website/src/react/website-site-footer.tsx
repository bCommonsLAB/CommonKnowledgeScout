"use client"

/**
 * Website-Fusszeile (Phase C1): rendert die Sektionen des Docs mit
 * `site_role: footer-content` unter JEDER Website-Seite plus eine Link-Zeile
 * fuer Docs mit `menu_area: footer` (Impressum/Datenschutz -> `?site=...`).
 *
 * Die Fusszeile ist optional: Ladefehler blockieren die Seite nicht, werden
 * aber laut in die Konsole geloggt (kein stiller Fallback).
 *
 * WE2: Die Links laufen ueber die Navigation (Ziel `seite`), der Abruf ueber
 * die Instanz.
 */

import * as React from "react"
import {
  parseWebsiteSections,
  getSiteParamForDoc,
  OLDIES_THEME,
  type SiteThemeResolved,
  surfaceStyle,
  SECTION_WIDTH,
  wegFehltMelden,
  type WebsiteNavigation,
} from ".."
import { SectionBlock } from "./website-landing-blocks"
import { useWebsiteDetail } from "./use-website-landing-data"
import { WegLink } from "./weg-link"
import type { InstanceApi } from "@ks/api-client"
import type { DocCardMeta } from "@ks/contracts"
import { cn } from "@ks/util"

interface WebsiteSiteFooterProps {
  instanz: InstanceApi
  libraryId: string
  /** Doc mit `site_role: footer-content` (null = keine Inhalts-Sektionen). */
  footerDoc: DocCardMeta | null
  /** Docs mit `menu_area: footer` — als Links (`?site=...`) verlinkt. */
  footerLinkDocs: DocCardMeta[]
  locale: string
  fallbackLocale?: string
  /** Wohin die Links und die Sektionen der Fusszeile fuehren. */
  navigation: WebsiteNavigation
  /** Welle S2: Profil fuer Sektionen und Link-Zeile (Flaeche `dark-green`). */
  theme?: SiteThemeResolved
}

export function WebsiteSiteFooter({
  instanz,
  libraryId,
  footerDoc,
  footerLinkDocs,
  locale,
  fallbackLocale,
  navigation,
  theme = OLDIES_THEME,
}: WebsiteSiteFooterProps): React.ReactElement | null {
  const { detail, detailError } = useWebsiteDetail(
    instanz,
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
        <SectionBlock key={i} section={s} theme={theme} navigation={navigation} />
      ))}
      {footerLinkDocs.length > 0 && (
        <nav className={cn("px-6 py-4 text-sm", linkZeile.className)} style={linkZeile.style}>
          <div className={cn(SECTION_WIDTH, "flex flex-wrap items-center gap-x-6 gap-y-2 text-[color:var(--site-paragraph)]")}>
            {footerLinkDocs.map((d) => {
              const param = getSiteParamForDoc(d)
              if (!param) return null
              const weg = navigation.weg({ art: "seite", seite: param })
              if (weg === null) {
                wegFehltMelden(`Website-Seite "${param}" hat in dieser Seite keine Adresse — Fusszeilen-Link entfaellt`)
                return null
              }
              return (
                <WegLink
                  key={d.fileId ?? d.id}
                  weg={weg}
                  className="whitespace-nowrap hover:text-[color:var(--site-text)] hover:underline"
                >
                  {d.title ?? d.fileName ?? "—"}
                </WegLink>
              )
            })}
          </div>
        </nav>
      )}
    </footer>
  )
}
