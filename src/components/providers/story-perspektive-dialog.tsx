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
 * Die alte Bedingung (M4h) fragte nur bei leerer oder `business`-Perspektive;
 * seit der Startwert `['undefined']` ist, griff sie nie mehr.
 *
 * Der Knopf „Perspektive anpassen" im Story-Kopf oeffnet denselben Dialog
 * ueber `storyPerspektiveDialogOffenAtom`. Sitzt in `GalleryAppProviders`,
 * also einmal an jedem Montagepunkt der Galerie.
 *
 * @module providers
 */

import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { useSearchParams } from 'next/navigation'
import { readGalleryMode } from '@ks/module-explorer/react'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'

/** localStorage-Schluessel: Perspektive wurde einmal gewaehlt, nicht mehr nachfragen. */
export const STORY_PERSPECTIVE_SET_FLAG = 'story-perspective-set'

/** Ob der Story-Modus beim Betreten nach der Perspektive fragen soll: nur ohne Eintrag im Browser. */
export function perspektiveErfragen(params: URLSearchParams, flag: string | null): boolean {
  // `story` gilt unabhaengig vom Default der Ansicht: nur `?mode=story` ohne `view=` (siehe `readGalleryMode`).
  if (readGalleryMode(params, 'gallery') !== 'story') return false
  return !flag
}

/** Merkt sich im Browser, dass gefragt wurde — auch wenn nur weggeklickt. */
function gefragtMerken() {
  try {
    localStorage.setItem(STORY_PERSPECTIVE_SET_FLAG, 'true')
  } catch (e) {
    // Ohne Speicher fragt der Dialog beim naechsten Besuch wieder; das ist sichtbar, nicht still falsch.
    console.warn('[StoryPerspektiveDialog] Eintrag „Perspektive gewaehlt" nicht speicherbar', e)
  }
}

export function StoryPerspektiveDialog() {
  const [offen, setOffen] = useAtom(storyPerspektiveDialogOffenAtom)
  const searchParams = useSearchParams()
  const gefragt = useRef(false)

  useEffect(() => {
    if (gefragt.current) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (!perspektiveErfragen(params, localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG))) return
    gefragt.current = true
    setOffen(true)
  }, [searchParams, setOffen])

  function offenSetzen(neu: boolean) {
    if (!neu) gefragtMerken()
    setOffen(neu)
  }

  return offen ? <PerspektiveDialogApp open={offen} onOpenChange={offenSetzen} /> : null
}
