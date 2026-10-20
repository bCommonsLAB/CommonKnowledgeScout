'use client'

import { useCallback, useMemo } from 'react'
import { useLibraries } from '@ks/shell/react'
import { useGalleryNavigation } from '../contexts/gallery-navigation-context'
import {
  ANSICHT_PARAM,
  profilAus,
  profilParams,
  type GalerieProfil,
  type ProfilErgebnis,
} from '../lib/galerie-profil'

export interface UseGalerieProfilResult extends ProfilErgebnis {
  /** Profil wechseln: schreibt `?ansicht=` mit Verlaufseintrag. */
  setzen: (profil: GalerieProfil) => void
}

/**
 * Welches Galerie-Profil gerade gilt (Plan galerie-buergeransicht, G1):
 * Adresse `?ansicht=` vor `chat.gallery.standardProfil` der Library vor der
 * Vorgabe `experte`. Keine Rollenlogik — der Umschalter ist für alle
 * sichtbar (Owner 19.10.2026); Beitragen bleibt Angemeldeten vorbehalten.
 */
export function useGalerieProfil(libraryId?: string): UseGalerieProfilResult {
  const { params, pushParams } = useGalleryNavigation()
  const libraries = useLibraries()
  const adresse = params.get(ANSICHT_PARAM)
  const galerieConfig = libraries.find((lib) => lib.id === libraryId)?.config?.chat?.gallery
  const config = galerieConfig?.standardProfil
  const startAnsicht = galerieConfig?.startAnsicht
  const ergebnis = useMemo(() => profilAus(adresse, config), [adresse, config])
  // Wechsel zu Experte räumt den Fokus, Wechsel zu Einfach setzt die Start-Vorgabe (Owner 20.10.).
  const setzen = useCallback(
    (profil: GalerieProfil) => pushParams(profilParams(params, profil, startAnsicht)),
    [params, pushParams, startAnsicht],
  )
  return { ...ergebnis, setzen }
}
