/**
 * @fileoverview Das Adress-Vokabular der Galerie-Ansichten — ohne React, ohne Router.
 *
 * @description
 * Die Galerie kennt drei Ansichten: `site` (Website-Landingpage), `gallery`
 * (Inhalte) und `story`. Welche gerade gilt, steht in den Adress-Parametern
 * `view` und `mode`; ein Wechsel raeumt konkurrierende Parameter weg, damit
 * die Adresse eindeutig bleibt.
 *
 * Diese Regeln lagen bisher in `use-gallery-mode.ts`, verwoben mit
 * `next/navigation`. Welle M4f zieht sie hierher: Sie sind das WAS — das
 * Vokabular gehoert der Galerie. Das WIE (Adresszeile oder Modulzustand)
 * entscheidet, wer die Galerie montiert (`GalleryNavigation`).
 *
 * Abgelesen, nicht ausgedacht; `mode-params.test.ts` haelt das heutige
 * Verhalten fest.
 *
 * @module lib/gallery
 */

export type GalleryMode = 'site' | 'gallery' | 'story'

/**
 * Welche Ansicht die Adresse meint.
 *
 * `view=gallery` ist explizit noetig, damit man aus einem Site-Default heraus
 * in die Galerie wechseln und dort bleiben kann — sonst fiele die leere
 * Adresse wieder auf den Site-Default zurueck.
 */
export function readGalleryMode(params: URLSearchParams, defaultMode: GalleryMode): GalleryMode {
  const view = params.get('view')
  const mode = params.get('mode')
  if (view === 'site') return 'site'
  if (view === 'gallery') return 'gallery'
  if (mode === 'story') return 'story'
  return defaultMode
}

/**
 * Die Adress-Parameter nach einem Ansichtswechsel.
 *
 * Ist der Ziel-Modus zugleich der Default, wird `view` entfernt (saubere
 * Adresse); sonst explizit gesetzt. `doc` faellt beim Wechsel zu `site` und
 * `story` weg — die Detailansicht gehoert zur Galerie. Beim Wechsel zu
 * `gallery` bleibt `doc` bewusst stehen: So kommt man aus der Story mit einem
 * offenen Dokument zurueck.
 */
export function nextParamsForMode(
  current: URLSearchParams,
  newMode: GalleryMode,
  defaultMode: GalleryMode,
): URLSearchParams {
  const params = new URLSearchParams(current.toString())
  if (newMode === 'site') {
    params.delete('doc')
    params.delete('mode')
    if (defaultMode === 'site') params.delete('view')
    else params.set('view', 'site')
    return params
  }
  if (newMode === 'story') {
    params.delete('doc')
    params.delete('view')
    params.set('mode', 'story')
    return params
  }
  params.delete('mode')
  if (defaultMode === 'gallery') params.delete('view')
  else params.set('view', 'gallery')
  return params
}
