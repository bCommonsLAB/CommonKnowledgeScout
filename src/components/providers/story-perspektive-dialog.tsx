'use client'

/**
 * @fileoverview Die Perspektiv-Wahl der App — ein Dialog statt einer Seite (09.10.2026).
 *
 * @description
 * Ersetzt `StoryPerspectiveRedirect`: Wer den Story-Modus ohne (oder nur mit
 * der Default-)Perspektive betritt, bekam bisher einmal die Perspektiv-Seite;
 * jetzt oeffnet sich einmal der Dialog, an Ort und Stelle. Die Bedingung ist
 * die alte (M4h): `?mode=story`, keine bzw. nur die Default-Perspektive
 * (`business`), kein Flag „Perspektive gewaehlt" im localStorage. Dazu nur
 * einmal je Montage — wer den Dialog schliesst, wird nicht gleich wieder
 * gefragt; beim naechsten Besuch schon, bis er speichert.
 *
 * Der Knopf „Perspektive anpassen" im Story-Kopf oeffnet denselben Dialog
 * ueber `storyPerspektiveDialogOffenAtom`. Sitzt in `GalleryAppProviders`,
 * also einmal an jedem Montagepunkt der Galerie.
 *
 * @module providers
 */

import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useSearchParams } from 'next/navigation'
import { readGalleryMode } from '@ks/module-explorer/react'
import { storyCharacterAtom } from '@/atoms/story-context-atom'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'

/** localStorage-Schluessel: Perspektive wurde einmal gewaehlt, nicht mehr nachfragen. */
export const STORY_PERSPECTIVE_SET_FLAG = 'story-perspective-set'

/** Ob der Story-Modus beim Betreten nach der Perspektive fragen soll. */
export function perspektiveErfragen(params: URLSearchParams, character: readonly string[], flag: string | null): boolean {
  // `story` gilt unabhaengig vom Default der Ansicht: nur `?mode=story` ohne `view=` (siehe `readGalleryMode`).
  if (readGalleryMode(params, 'gallery') !== 'story') return false
  const ohne = character.length === 0
  const nurDefault = character.length === 1 && character[0] === 'business'
  return (ohne || nurDefault) && !flag
}

export function StoryPerspektiveDialog() {
  const [offen, setOffen] = useAtom(storyPerspektiveDialogOffenAtom)
  const character = useAtomValue(storyCharacterAtom)
  const searchParams = useSearchParams()
  const gefragt = useRef(false)

  useEffect(() => {
    if (gefragt.current) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (!perspektiveErfragen(params, character, localStorage.getItem(STORY_PERSPECTIVE_SET_FLAG))) return
    gefragt.current = true
    setOffen(true)
  }, [character, searchParams, setOffen])

  return offen ? <PerspektiveDialogApp open={offen} onOpenChange={setOffen} /> : null
}
