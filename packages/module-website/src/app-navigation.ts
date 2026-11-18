/**
 * Die Navigation der Startseite in der KnowledgeScout-App (WE2): ihre zwei
 * Modi als `WebsiteNavigation`.
 *
 * - Site-Modus (`/explore/<slug>`): Galerie und Story-Modus wechseln ueber
 *   Rueckrufe ohne Neuladen; die Adresse bleibt fuer Mittelklick und
 *   Kontextmenue relativ (`?view=gallery`, `?mode=story`).
 * - Root-Modus (`/` einer gekoppelten Domain): Galerie und Story-Modus liegen
 *   unter der Explore-Adresse (`galleryBaseHref`, `storyBaseHref`); `geheZu`
 *   wechselt dorthin ohne Neuladen (App: `router.push`).
 * - In beiden Modi wechselt `?site=` die Website-Seite (`onShowSite`).
 *
 * Bis WE2 stand dasselbe verteilt in `kartenaktion` (Kacheln), im Banner
 * (`router.push`, `onShowGallery`) und in der Fusszeile (`onNavigate`).
 * Relative Fremd-Adressen bleiben in der App gewoehnliche Links (`fremd`).
 */

import { listeAlsParameter, type WebsiteNavigation, type WebsiteWeg, type WebsiteZiel } from './navigation'

export interface AppNavigationModus {
  /** Site-Modus: wechselt in die Galerie; `extra` = Adress-Parameter, die mitgehen. */
  onShowGallery?: (extra?: Record<string, string>) => void
  /** Site-Modus: wechselt in den Story-Modus; `extra` = Adress-Parameter (z. B. `q`). */
  onShowStory?: (extra?: Record<string, string>) => void
  /** Wechselt die Website-Seite (`?site=`). */
  onShowSite?: (seite: string) => void
  /** Root-Modus: Adresse der Galerie, traegt schon `?view=gallery`. */
  galleryBaseHref?: string | null
  /** Root-Modus: Adresse des Story-Modus, traegt schon `?mode=story`. */
  storyBaseHref?: string | null
  /** Root-Modus: Wechsel auf eine Adresse ohne Neuladen; fehlt er, folgt der Browser dem Link. */
  geheZu?: (href: string) => void
}

/** Die App hat fuer jedes Ziel eine Adresse: `weg` liefert nie `null`. */
export interface AppNavigation extends WebsiteNavigation {
  weg(ziel: WebsiteZiel): WebsiteWeg
  fremd(href: string): string
}

function mitParametern(basis: string, params: Record<string, string> | undefined): string {
  const query = params ? new URLSearchParams(params).toString() : ''
  if (query === '') return basis
  return `${basis}${basis.includes('?') ? '&' : '?'}${query}`
}

function nichtLeer(params: Record<string, string>): Record<string, string> | undefined {
  return Object.keys(params).length > 0 ? params : undefined
}

export function appNavigation(modus: AppNavigationModus = {}): AppNavigation {
  const { onShowGallery, onShowStory, onShowSite, galleryBaseHref, storyBaseHref, geheZu } = modus

  const unterAdresse = (href: string): WebsiteWeg => ({ href, ausfuehren: geheZu ? () => geheZu(href) : undefined })

  const galerie = (params: Record<string, string> | undefined): WebsiteWeg => {
    if (onShowGallery) return { href: mitParametern('?view=gallery', params), ausfuehren: () => onShowGallery(params) }
    if (galleryBaseHref) return unterAdresse(mitParametern(galleryBaseHref, params))
    return { href: mitParametern('?view=gallery', params) }
  }

  const story = (params: Record<string, string> | undefined): WebsiteWeg => {
    if (onShowStory) return { href: mitParametern('?mode=story', params), ausfuehren: () => onShowStory(params) }
    if (storyBaseHref) return unterAdresse(mitParametern(storyBaseHref, params))
    return { href: mitParametern('?mode=story', params) }
  }

  return {
    weg(ziel: WebsiteZiel): WebsiteWeg {
      switch (ziel.art) {
        case 'galerie':
          return galerie(nichtLeer(listeAlsParameter(ziel.liste)))
        case 'dokument': {
          const params = { ...listeAlsParameter(ziel.liste), doc: ziel.slug }
          return galerie(ziel.seitenzahl !== undefined ? { ...params, page: String(ziel.seitenzahl) } : params)
        }
        case 'story':
          return story(ziel.frage !== undefined ? { q: ziel.frage } : undefined)
        case 'seite':
          return {
            href: `?site=${encodeURIComponent(ziel.seite)}`,
            ausfuehren: onShowSite ? () => onShowSite(ziel.seite) : undefined,
          }
        default: {
          const unbekannt: never = ziel
          throw new Error(`Unbekanntes Ziel: ${JSON.stringify(unbekannt)}`)
        }
      }
    },
    // In der App bleiben eigene relative Adressen der Autoren gewoehnliche Links.
    fremd: (href) => href,
  }
}
