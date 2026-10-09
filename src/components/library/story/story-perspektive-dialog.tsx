'use client'

/**
 * @fileoverview Die Perspektiv-Wahl der App — ein Dialog statt einer Seite (09.10.2026).
 *
 * @description
 * Ersetzt `StoryPerspectiveRedirect`. Regel (Owner 09.10.2026): Wer den
 * Story-Modus (`?mode=story`) betritt und in diesem Browser noch keinen
 * Eintrag „Perspektive gewaehlt" hat, bekommt den Dialog. Speichern ODER
 * Wegklicken setzt den Eintrag — wer mit den Voreinstellungen arbeiten will,
 * wird nicht wieder gefragt. Ueber den Knopf im Story-Kopf geht der Dialog
 * jederzeit auf.
 *
 * Angemeldet gilt das Profil (`useProfilPerspektive`): Erst wenn feststeht,
 * ob es eine Perspektive mitbringt, entscheidet der Dialog; Speichern und
 * Wegklicken landen auch dort — der naechste Browser fragt dann nicht.
 *
 * Die alte Bedingung (M4h) fragte nur bei leerer oder `business`-Perspektive;
 * seit der Startwert `['undefined']` ist, griff sie nie mehr.
 *
 * Der Knopf „Perspektive anpassen" im Story-Kopf oeffnet denselben Dialog
 * ueber `storyPerspektiveDialogOffenAtom`. Sitzt im `StoryModeHeader`, also
 * nur dort, wo der Story-Modus wirklich montiert ist — nicht in der
 * Galerie-Huelle, die auch Teaser und Landingpage tragen.
 *
 * @module story
 */

import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { useSearchParams } from 'next/navigation'
import { readGalleryMode } from '@ks/module-explorer/react'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'
import { useProfilPerspektive } from '@/hooks/use-profil-perspektive'

/** localStorage-Schluessel: Perspektive wurde einmal gewaehlt, nicht mehr nachfragen. */
export const STORY_PERSPECTIVE_SET_FLAG = 'story-perspective-set'

/** Ob der Story-Modus beim Betreten nach der Perspektive fragen soll: nur ohne Eintrag im Browser. */
export function perspektiveErfragen(params: URLSearchParams, flag: string | null): boolean {
  // `story` gilt unabhaengig vom Default der Ansicht: nur `?mode=story` ohne `view=` (siehe `readGalleryMode`).
  if (readGalleryMode(params, 'gallery') !== 'story') return false
  return !flag
}

/** Merkt sich im Browser, dass gefragt wurde — auch wenn nur weggeklickt. Liefert, ob es neu war. */
function gefragtMerken(): boolean {
  try {
    const neu = localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG) !== 'true'
    localStorage.setItem(STORY_PERSPECTIVE_SET_FLAG, 'true')
    return neu
  } catch (e) {
    // Ohne Speicher fragt der Dialog beim naechsten Besuch wieder; das ist sichtbar, nicht still falsch.
    console.warn('[StoryPerspektiveDialog] Eintrag „Perspektive gewaehlt" nicht speicherbar', e)
    return false
  }
}

export function StoryPerspektiveDialog() {
  const [offen, setOffen] = useAtom(storyPerspektiveDialogOffenAtom)
  const searchParams = useSearchParams()
  const gefragt = useRef(false)
  const profil = useProfilPerspektive()

  useEffect(() => {
    // Angemeldet erst entscheiden, wenn das Profil geladen ist — es kann den Eintrag mitbringen.
    if (gefragt.current || profil.stand !== 'fertig') return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (!perspektiveErfragen(params, localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG))) return
    gefragt.current = true
    setOffen(true)
  }, [searchParams, setOffen, profil.stand])

  function offenSetzen(neu: boolean) {
    // Erstes Wegklicken: die Voreinstellung gilt als gewaehlt — auch im Profil.
    // Nach dem Speichern ist der Eintrag schon gesetzt, dann bleibt es beim einen Schreiben.
    if (!neu && gefragtMerken()) profil.aktuelleSpeichern()
    setOffen(neu)
  }

  return offen ? <PerspektiveDialogApp open={offen} onOpenChange={offenSetzen} onProfil={profil.speichern} /> : null
}
