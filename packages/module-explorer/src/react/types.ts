/**
 * Die Datentypen des Explorer-Eintritts und der Props-Vertrag der montierbaren
 * Wurzelkomponente (ADR 0008 §4).
 *
 * Alles, was das Modul NICHT selbst kennen darf, steht unten als Slot: die
 * Anmelde-Aufforderung, die Galerie und ein optionaler Hinweis. Zusammen mit
 * `ExplorerViewer` — zwei Booleans statt eines Nutzer-Objekts — haengt das
 * Modul damit an keinem Auth-Anbieter und an keinem Next.js-Datei-Routing.
 */

import type { ReactNode } from 'react'

import type { Character, SocialContext, TargetLanguage } from '@ks/contracts'

/**
 * Was das Modul ueber den Betrachter wissen muss — mehr nicht.
 *
 * Bewusst zwei Booleans statt eines Nutzer-Objekts: Wer angemeldet IST,
 * entscheidet der Server bei jedem Request selbst (Cookie/Token). Das Modul
 * braucht nur zu wissen, ob es die Antwort schon kennt und wie sie lautet.
 */
export interface ExplorerViewer {
  /** `false`, solange der Anmeldezustand noch ermittelt wird. */
  isLoaded: boolean
  isSignedIn: boolean
}

/** Antwort von `GET /api/public/libraries/[slug]` bzw. `/api/library/explore-by-slug/[slug]`. */
export interface ExplorerLibraryPayload {
  id: string
  label: string
  slugName: string
  description?: string
  icon?: string
  requiresAuth?: boolean
  /** Nur bei Member-Explore: ob die Library öffentlich geschaltet ist */
  isPublic?: boolean
  siteEnabled?: boolean
  /** Website-Logo (Phase C2): oeffentliche URL fuer die TopNav im Site-Kontext */
  logoUrl?: string
  /** Galerie-Texte aus den Public-Settings (leer = Standard-Texte des detailViewType) */
  gallery?: {
    headline?: string
    subtitle?: string
    description?: string
    filterDescription?: string
    menuLabel?: string
    moreLinkLabel?: string
  }
  exploreContext?: ExplorerContext
  chat?: {
    gallery?: {
      detailViewType?: 'book' | 'session'
      facets?: Array<{
        metaKey: string
        label?: string
        type?: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
        multi?: boolean
        visible?: boolean
        buckets?: Array<{ label: string; min: number; max: number }>
      }>
    }
    placeholder?: string
    maxChars?: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    targetLanguage?: TargetLanguage
    character?: Character[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: TargetLanguage
      character?: Character[]
      socialContext?: SocialContext
      genderInclusive?: boolean
    }
  }
}

/**
 * Aus welcher Sicht die Library geladen wurde: `public` fuer anonyme und
 * fremde Besucher, `member` fuer angemeldete Owner/Co-Autoren (die sehen
 * zusaetzlich den Startseiten-Toggle und den Storage-Entwurf).
 */
export type ExplorerContext = 'public' | 'member'

/** Ergebnis von `GET /api/libraries/[id]/access-check`. */
export interface ExplorerAccessStatus {
  hasAccess: boolean
  status?: 'pending' | 'approved' | 'rejected'
  requiresAuth?: boolean
  message?: string
  rateLimited?: boolean
}

export interface ExplorerRootProps {
  /** Welche Library gezeigt wird. Kommt NICHT aus dem Datei-Routing. */
  slug: string
  viewer: ExplorerViewer
  /**
   * Die Galerie. Sie liegt bis zu ihrer eigenen Welle in der Anwendung
   * (1.319 Zeilen mit 38 App-Importen) und wird deshalb hereingereicht.
   */
  renderGallery: (opts: { libraryId: string; showSiteTab: boolean }) => ReactNode
  /**
   * Was zu zeigen ist, wenn Anmeldung noetig ist. Die Anwendung baut daraus
   * ihren Clerk-Button; das Modul kennt keinen Auth-Anbieter. Die Rueckkehr-URL
   * baut die Anwendung selbst — sie kennt ihre Routen.
   */
  renderSignInPrompt: (opts: { slug: string }) => ReactNode
  /** Optionaler Hinweis unter dem Kopf (heute: die Verifikations-Warnung). */
  renderNotice?: (opts: { libraryId: string }) => ReactNode
}
