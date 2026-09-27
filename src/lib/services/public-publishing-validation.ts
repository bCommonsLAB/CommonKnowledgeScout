/**
 * @fileoverview Veroeffentlichungs-Einstellungen: eine Validierung, ein Merge (B4).
 *
 * @description
 * Bis 27.09.2026 lagen Regeln und Merge nur in `PUT /api/libraries/[id]/public`.
 * Die Bruecke (`veroeffentlichung_setzen`) braucht dieselben Regeln — zwei
 * Implementierungen wuerden auseinanderlaufen. Deshalb hier: reine
 * Funktionen, die Route und Werkzeug beide rufen. Semantik des Merges:
 * `undefined` = unveraendert, `''` bei URL-/Icon-Feldern = loeschen.
 * `apiKey` bleibt bewusst aussen vor: die Route behandelt ihn selbst, die
 * Bruecke setzt ihn nie.
 *
 * @module services
 */

import type { Library } from '@/types/library'
import type { SiteTheme } from '@ks/contracts'
import { validiereSiteTheme } from '@/lib/website/site-theme'

export type PublicPublishing = NonNullable<NonNullable<Library['config']>['publicPublishing']>
export type GalleryTexte = NonNullable<PublicPublishing['gallery']>

export interface PublicPublishingEingabe {
  slugName?: string
  publicName?: string
  description?: string
  icon?: string
  isPublic?: boolean
  showOnHomepage?: boolean
  requiresAuth?: boolean
  backgroundImageUrl?: string
  logoUrl?: string
  gallery?: Partial<GalleryTexte>
  siteEnabled?: boolean
  /** Welle S2: Design-Profil; `undefined` = unveraendert, `null` = loeschen (Vorlage). */
  siteTheme?: SiteTheme | null
}

export const SLUG_RE = /^[a-z0-9-]+$/

/**
 * Prueft einen WIRKSAMEN Zustand (nach dem Merge). Liefert die erste
 * Verletzung als Text, sonst `null`. Wortlaut wie im Formular.
 */
export function validierePublicPublishing(p: {
  slugName?: string
  publicName?: string
  description?: string
  isPublic?: boolean
  requiresAuth?: boolean
  showOnHomepage?: boolean
  siteTheme?: SiteTheme | null
}): string | null {
  if (p.isPublic === true) {
    if (!p.slugName || p.slugName.length < 3) return 'Slug-Name ist erforderlich und muss mindestens 3 Zeichen lang sein'
    if (!SLUG_RE.test(p.slugName)) return 'Slug-Name darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten'
    if (!p.publicName || p.publicName.length < 3) return 'Öffentlicher Name ist erforderlich und muss mindestens 3 Zeichen lang sein'
    if (!p.description || p.description.length < 10) return 'Beschreibung ist erforderlich und muss mindestens 10 Zeichen lang sein'
  }
  if (p.requiresAuth === true && p.isPublic !== true) return 'requiresAuth kann nur aktiviert werden, wenn die Library öffentlich ist'
  if (p.showOnHomepage === false && p.isPublic !== true) return 'Show-on-Homepage kann nur gesetzt werden, wenn die Library öffentlich ist'
  if (p.siteTheme) {
    try {
      validiereSiteTheme(p.siteTheme)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  return null
}

function urlFeld(neu: string | undefined, alt: string | undefined): string | undefined {
  if (neu === undefined) return alt
  return neu === '' ? undefined : neu
}

/** Galerie-Texte feldweise mergen; `undefined` laesst den alten Wert stehen. */
export function mergeGalleryTexte(alt: GalleryTexte | undefined, neu: Partial<GalleryTexte> | undefined): GalleryTexte | undefined {
  if (!neu) return alt
  const keys: Array<keyof GalleryTexte> = ['headline', 'subtitle', 'description', 'filterDescription', 'menuLabel', 'moreLinkLabel']
  const ergebnis: GalleryTexte = {}
  for (const key of keys) {
    const wert = neu[key] !== undefined ? neu[key] : alt?.[key]
    if (wert !== undefined) ergebnis[key] = wert
  }
  return ergebnis
}

/**
 * Neuer Zustand aus altem Zustand und Eingabe. `apiKey` wird unveraendert
 * uebernommen (Route ueberschreibt ihn danach, wenn sie einen neuen bekam).
 */
export function mergePublicPublishing(
  alt: PublicPublishing | undefined,
  neu: PublicPublishingEingabe,
  libraryLabel: string,
): PublicPublishing {
  return {
    slugName: neu.slugName || alt?.slugName || '',
    publicName: neu.publicName || alt?.publicName || libraryLabel,
    description: neu.description || alt?.description || '',
    icon: neu.icon !== undefined ? (neu.icon === 'none' || neu.icon === '' ? undefined : neu.icon) : alt?.icon,
    apiKey: alt?.apiKey,
    isPublic: neu.isPublic !== undefined ? neu.isPublic : alt?.isPublic === true,
    showOnHomepage: neu.showOnHomepage !== undefined ? neu.showOnHomepage : (alt?.showOnHomepage ?? true),
    requiresAuth: neu.requiresAuth !== undefined ? neu.requiresAuth : (alt?.requiresAuth || false),
    backgroundImageUrl: urlFeld(neu.backgroundImageUrl, alt?.backgroundImageUrl),
    logoUrl: urlFeld(neu.logoUrl, alt?.logoUrl),
    gallery: mergeGalleryTexte(alt?.gallery, neu.gallery),
    story: alt?.story,
    siteEnabled: neu.siteEnabled !== undefined ? neu.siteEnabled : alt?.siteEnabled === true,
    // S2: `null` loescht das Profil (zurueck zur Vorlage); gueltige Profile werden normalisiert.
    siteTheme: neu.siteTheme === undefined ? alt?.siteTheme : (neu.siteTheme === null ? undefined : validiereSiteTheme(neu.siteTheme)),
  }
}

/** Welche Felder sich zwischen zwei Zustaenden unterscheiden (flach, gallery als Ganzes). */
export function geaenderteFelder(alt: PublicPublishing | undefined, neu: PublicPublishing): string[] {
  const keys: Array<keyof PublicPublishing> = [
    'slugName', 'publicName', 'description', 'icon', 'isPublic', 'showOnHomepage',
    'requiresAuth', 'backgroundImageUrl', 'logoUrl', 'gallery', 'siteEnabled', 'siteTheme',
  ]
  return keys.filter((key) => JSON.stringify(alt?.[key] ?? null) !== JSON.stringify(neu[key] ?? null))
}
