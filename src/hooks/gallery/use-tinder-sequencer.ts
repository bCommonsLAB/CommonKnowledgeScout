'use client'

import React from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface TinderSequencerInput {
  /** Vollstaendige Geschwister-Liste (gefilterte Galerie-Reihenfolge). */
  docs: DocCardMeta[]
  /** Aktuell offene fileId (oder leer wenn nichts offen). */
  currentFileId: string | undefined
  /** Liefert den eigenen Stern-Status zu einer fileId. */
  isFavorite: (fileId: string) => boolean
  /** Liefert "nicht wichtig"-Status zu einer fileId. */
  isNotImportant: (fileId: string) => boolean
  /**
   * Wenn true, wird die Sequenz auf "noch nicht bewertete" Docs reduziert
   * - der eigene aktuelle Doc bleibt enthalten, damit der Mode auch
   * funktioniert, wenn der gerade offene Doc schon bewertet ist.
   */
  onlyUnrated: boolean
}

export interface TinderSequencerResult {
  /** Naechster Kandidat (oder null wenn am Ende). */
  nextDoc: DocCardMeta | null
  /** Vorheriger Kandidat (oder null wenn am Anfang). */
  prevDoc: DocCardMeta | null
  /** Anzahl Docs in der reduzierten Sequenz. */
  total: number
  /** Index des aktuellen Docs in der Sequenz (0-basiert) oder -1. */
  index: number
  /** Anzahl Docs, die noch unrated sind (immer ueber `docs` gerechnet). */
  unratedCount: number
  /** Anzahl Docs mit `favorite`-State. */
  favoriteCount: number
  /** Anzahl Docs mit `not_important`-State. */
  notImportantCount: number
}

/**
 * Sequencer-Hook fuer den Tinder-Mode in der Detail-Overlay.
 *
 * Reduziert die Geschwister-Liste optional auf "noch nicht bewertete"
 * Quellen und liefert Vor-/Zurueck-Navigation. Im Default (`onlyUnrated`
 * = false) ist die Sequenz die volle Liste - so verhalten sich die
 * Pfeile gleich wie ohne Tinder-Mode.
 */
export function useTinderSequencer({
  docs,
  currentFileId,
  isFavorite,
  isNotImportant,
  onlyUnrated,
}: TinderSequencerInput): TinderSequencerResult {
  const stats = React.useMemo(() => {
    let unrated = 0
    let favs = 0
    let notImp = 0
    for (const d of docs) {
      const id = d.fileId
      if (!id) continue
      if (isFavorite(id)) {
        favs++
        continue
      }
      if (isNotImportant(id)) {
        notImp++
        continue
      }
      unrated++
    }
    return { unrated, favs, notImp }
  }, [docs, isFavorite, isNotImportant])

  const sequence = React.useMemo(() => {
    if (!onlyUnrated) return docs
    return docs.filter((d) => {
      const id = d.fileId
      if (!id) return false
      if (id === currentFileId) return true
      return !isFavorite(id) && !isNotImportant(id)
    })
  }, [docs, currentFileId, isFavorite, isNotImportant, onlyUnrated])

  const idx = React.useMemo(() => {
    if (!currentFileId) return -1
    return sequence.findIndex((d) => d.fileId === currentFileId)
  }, [sequence, currentFileId])

  return {
    nextDoc: idx >= 0 && idx < sequence.length - 1 ? sequence[idx + 1] : null,
    prevDoc: idx > 0 ? sequence[idx - 1] : null,
    total: sequence.length,
    index: idx,
    unratedCount: stats.unrated,
    favoriteCount: stats.favs,
    notImportantCount: stats.notImp,
  }
}
