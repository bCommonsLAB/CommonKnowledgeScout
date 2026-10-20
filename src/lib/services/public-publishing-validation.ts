/**
 * @fileoverview Veroeffentlichungs-Einstellungen: eine Validierung, ein Merge (B4).
 *
 * @description
 * Bis 27.09.2026 lagen Regeln und Merge nur in `PUT /api/libraries/[id]/public`.
 * Die Bruecke (`veroeffentlichung_setzen`) braucht dieselben Regeln — zwei
 * Implementierungen wuerden auseinanderlaufen. Deshalb hier: reine
 * Funktionen, die Route und Werkzeug beide rufen. Semantik des Merges:
 * `undefined` = unveraendert, `''` bei URL-/Icon-Feldern = loeschen,
 * `''` in den Text-Gruppen `gallery`, `story` und `mitreden` = Standardtext
 * bzw. leeres Feld (G5: ohne headline/href kein Band).
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
export type StoryTexte = NonNullable<PublicPublishing['story']>
export type MitredenTexte = NonNullable<PublicPublishing['mitreden']>

const GALLERY_KEYS: ReadonlyArray<keyof GalleryTexte> = ['headline', 'subtitle', 'description', 'filterDescription', 'menuLabel', 'moreLinkLabel']
const STORY_KEYS: ReadonlyArray<keyof StoryTexte> = ['headline', 'subtitle', 'intro', 'topicsTitle', 'topicsIntro']
const MITREDEN_KEYS: ReadonlyArray<keyof MitredenTexte> = ['headline', 'text', 'buttonLabel', 'href']
/** Ziel des Mitreden-Bands: relativer Pfad oder https-Adresse — alles andere wird abgewiesen. */
export const MITREDEN_HREF_RE = /^(\/|https:\/\/)/

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
  /** Story-Texte feldweise wie `gallery`; `''` = Standardtext. */
  story?: Partial<StoryTexte>
  /** G5: Mitreden-Band feldweise wie `gallery`; `''` = Feld leer (ohne headline/href kein Band). */
  mitreden?: Partial<MitredenTexte>
  siteEnabled?: boolean
  /** Welle S2: Design-Profil; `undefined` = unveraendert, `null` = loeschen (Vorlage). */
  siteTheme?: SiteTheme | null
  /** Fokus aus Sternen (ADR 0012): Sterne-Zahl anonym sichtbar; `undefined` = unveraendert. */
  starCountsPublic?: boolean
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
  gallery?: unknown
  story?: unknown
  mitreden?: unknown
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
  const galleryFehler = validiereTexte('gallery', p.gallery, GALLERY_KEYS)
  if (galleryFehler) return galleryFehler
  const storyFehler = validiereTexte('story', p.story, STORY_KEYS)
  if (storyFehler) return storyFehler
  const mitredenFehler = validiereTexte('mitreden', p.mitreden, MITREDEN_KEYS)
  if (mitredenFehler) return mitredenFehler
  const href = (p.mitreden as { href?: unknown } | undefined)?.href
  if (typeof href === 'string' && href.trim() !== '' && !MITREDEN_HREF_RE.test(href.trim())) {
    return 'mitreden.href muss mit "/" oder "https://" beginnen'
  }
  if (p.siteTheme) {
    try {
      validiereSiteTheme(p.siteTheme)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  return null
}

/**
 * Text-Gruppen (gallery, story): ein Objekt nur mit bekannten Schluesseln und
 * Text-Werten. Unbekannte Schluessel werden abgewiesen statt still verworfen.
 */
function validiereTexte(gruppe: string, wert: unknown, keys: ReadonlyArray<string>): string | null {
  if (wert === undefined || wert === null) return null
  if (typeof wert !== 'object' || Array.isArray(wert)) return `${gruppe} muss ein Objekt sein`
  for (const [key, text] of Object.entries(wert as Record<string, unknown>)) {
    if (!keys.includes(key)) return `${gruppe}: unbekanntes Feld "${key}" (erlaubt: ${keys.join(', ')})`
    if (text !== undefined && typeof text !== 'string') return `${gruppe}.${key} muss ein Text sein`
  }
  return null
}

/** Text-Gruppe feldweise mergen; `undefined` laesst den alten Wert stehen, `''` bleibt `''` (= Standardtext). */
function mergeTexte<T extends object>(alt: T | undefined, neu: Partial<T> | undefined, keys: ReadonlyArray<keyof T>): T | undefined {
  if (!neu) return alt
  const ergebnis = {} as T
  for (const key of keys) {
    const wert = neu[key] !== undefined ? neu[key] : alt?.[key]
    if (wert !== undefined) ergebnis[key] = wert as T[keyof T]
  }
  return ergebnis
}

function urlFeld(neu: string | undefined, alt: string | undefined): string | undefined {
  if (neu === undefined) return alt
  return neu === '' ? undefined : neu
}

/** Galerie-Texte feldweise mergen; `undefined` laesst den alten Wert stehen. */
export function mergeGalleryTexte(alt: GalleryTexte | undefined, neu: Partial<GalleryTexte> | undefined): GalleryTexte | undefined {
  return mergeTexte(alt, neu, GALLERY_KEYS)
}

/** Mitreden-Texte feldweise mergen (G5), gleiche Semantik wie die Galerie-Texte. */
export function mergeMitredenTexte(alt: MitredenTexte | undefined, neu: Partial<MitredenTexte> | undefined): MitredenTexte | undefined {
  return mergeTexte(alt, neu, MITREDEN_KEYS)
}

/** Story-Texte feldweise mergen, gleiche Semantik wie die Galerie-Texte. */
export function mergeStoryTexte(alt: StoryTexte | undefined, neu: Partial<StoryTexte> | undefined): StoryTexte | undefined {
  return mergeTexte(alt, neu, STORY_KEYS)
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
    story: mergeStoryTexte(alt?.story, neu.story),
    mitreden: mergeMitredenTexte(alt?.mitreden, neu.mitreden),
    siteEnabled: neu.siteEnabled !== undefined ? neu.siteEnabled : alt?.siteEnabled === true,
    // S2: `null` loescht das Profil (zurueck zur Vorlage); gueltige Profile werden normalisiert.
    siteTheme: neu.siteTheme === undefined ? alt?.siteTheme : (neu.siteTheme === null ? undefined : validiereSiteTheme(neu.siteTheme)),
    // ADR 0012: `undefined` bleibt `undefined` (Leser pruefen `=== true`), sonst
    // meldete `geaenderteFelder` bei jeder Bestands-Library ohne das Feld eine
    // Aenderung von null auf false.
    starCountsPublic: neu.starCountsPublic !== undefined ? neu.starCountsPublic : alt?.starCountsPublic,
  }
}

/** Welche Felder sich zwischen zwei Zustaenden unterscheiden (flach, gallery und story als Ganzes). */
export function geaenderteFelder(alt: PublicPublishing | undefined, neu: PublicPublishing): string[] {
  const keys: Array<keyof PublicPublishing> = [
    'slugName', 'publicName', 'description', 'icon', 'isPublic', 'showOnHomepage',
    'requiresAuth', 'backgroundImageUrl', 'logoUrl', 'gallery', 'story', 'mitreden', 'siteEnabled', 'siteTheme',
    'starCountsPublic',
  ]
  return keys.filter((key) => JSON.stringify(alt?.[key] ?? null) !== JSON.stringify(neu[key] ?? null))
}
