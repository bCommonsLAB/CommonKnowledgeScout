"use client"

/**
 * Huelle der Live-Startseite in der App (Plan `startseite-als-embed`, WE2).
 *
 * Seite, Banner und Fusszeile rendert `WebsiteLanding` aus
 * `@ks/module-website/react`; hier bleibt, was nur die App hat:
 *  - die gewaehlte Seite im URL-Param `?site=<slug>` (nuqs, Phase C1) — jede
 *    Website-Seite ist verlinkbar und funktioniert identisch auf
 *    `/explore/<slug>` und der Domain-Root,
 *  - die Navigation der zwei Modi (`appNavigation`: Site-Modus mit
 *    Rueckrufen, Root-Modus mit Explore-Adressen und `router.push`),
 *  - die Schriften aus `next/font` (`site-fonts.ts`),
 *  - die Fragen- und Themen-Sektion mit dem Gastgeber der App
 *    (`story/website-story-app.tsx`), faul geladen ueber `next/dynamic`,
 *  - Galerie-Texte und Design-Profil aus der Library im Atom.
 */

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { useQueryState } from "nuqs"
import { useLibraries } from "@ks/shell/react"
import { SAME_ORIGIN_API } from "@ks/api-client"
import type { SiteTheme } from "@ks/contracts"
import { appNavigation, type WebsiteSection } from "@ks/module-website"
import { WebsiteLanding, type WebsiteSlotKontext } from "@ks/module-website/react"
import { SITE_FONT_FAMILIES } from "@/lib/website/site-fonts"

// N1: Der Chat der Story-Sektion zieht Story-Paket und Clerk — faul laden, nur
// Seiten mit `layout=story` zahlen dafuer. Ohne SSR: Sitzung und Perspektive
// leben im Browser.
const WebsiteStorySektion = dynamic(
  () => import("@/components/library/website/story/website-story-app").then((m) => ({ default: m.WebsiteStorySektionApp })),
  { ssr: false, loading: () => <div className="px-6 py-14 text-sm text-muted-foreground">Lade den Scout …</div> },
)
// 18.11.2026: Themenuebersicht (`layout=topics`) — dieselben Gruende wie oben.
const WebsiteThemenSektion = dynamic(
  () => import("@/components/library/website/story/website-story-app").then((m) => ({ default: m.WebsiteThemenSektionApp })),
  { ssr: false, loading: () => <div className="px-6 py-14 text-sm text-muted-foreground">Lade die Inhalte …</div> },
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
  /**
   * Site-Modus im Explorer: Die Seite scrollt mit dem Fenster statt im eigenen Kasten
   * (`packages/module-explorer/src/react/seiten-scroll.tsx`, Owner 22.11.2026).
   */
  fensterScroll?: boolean
}

export function WebsiteLandingLive({
  libraryId,
  fallbackLocale,
  onShowGallery,
  onShowStory,
  exploreBaseHref,
  librarySlug,
  siteTheme,
  fensterScroll = false,
}: WebsiteLandingLiveProps): React.ReactElement {
  const pathname = usePathname()
  const router = useRouter()
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

  // Seitenwechsel via URL (`?site=<slug>`), history: push -> Browser-Back
  // wechselt zwischen Website-Seiten.
  const [siteParam, setSiteParam] = useQueryState("site", { history: "push" })

  // Alle Wege der Seite: Site-Modus ueber Rueckrufe ohne Neuladen, Root-Modus
  // ueber die Adressen der Explore-Seite (`router.push`); `?site=` in beiden ueber nuqs.
  const navigation = React.useMemo(
    () => appNavigation({
      onShowGallery,
      onShowStory,
      onShowSite: (seite) => void setSiteParam(seite),
      galleryBaseHref,
      storyBaseHref,
      geheZu: (href) => router.push(href),
    }),
    [onShowGallery, onShowStory, setSiteParam, galleryBaseHref, storyBaseHref, router],
  )

  // N1: Story-Sektion mit dem Chat der Library; Belege, Katalog und „fruehere
  // Fragen" gehen ueber dieselbe Navigation wie die Banner-Karten (WE3).
  const storySlot = React.useCallback(
    (section: WebsiteSection, { headingCase, theme }: WebsiteSlotKontext) => section.layout === "topics" ? (
      <WebsiteThemenSektion libraryId={libraryId} section={section} headingCase={headingCase} theme={theme} />
    ) : (
      <WebsiteStorySektion
        libraryId={libraryId}
        section={section}
        headingCase={headingCase}
        theme={theme}
        navigation={navigation}
        galleryTexte={publicPublishing?.gallery}
      />
    ),
    [libraryId, navigation, publicPublishing?.gallery],
  )

  return (
    // C1b: Die fruehere zweite Menue-Leiste entfaellt — die Website-Seiten
    // liegen als NavItems in der TopNav (useSiteMenuItems).
    <WebsiteLanding
      instanz={SAME_ORIGIN_API}
      libraryId={libraryId}
      fallbackLocale={fallbackLocale}
      seite={siteParam}
      // `?site=` aus der Adresse: eine unbekannte Kennung meldet sich und zeigt die Startseite (wie bisher).
      unbekannteSeite="startseite"
      navigation={navigation}
      schriften={SITE_FONT_FAMILIES}
      siteTheme={siteTheme ?? publicPublishing?.siteTheme}
      moreLinkLabel={moreLinkLabel}
      contactApiSlug={contactApiSlug}
      // Sterne und Kommentare an Banner-Karten nur im Site-Modus bedienbar (wie bisher).
      sterneAnKarten={!galleryBaseHref}
      // Root-Modus (`/`): natuerlicher Fluss (Window-Scroll). Site-Modus: innerer Scroll-Container.
      eigenerScroll={!exploreBaseHref && !fensterScroll}
      storySlot={storySlot}
    />
  )
}

export default WebsiteLandingLive
