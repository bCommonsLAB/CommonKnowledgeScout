/**
 * Bewertungsmodus der Detailansicht (D6b aus `detail-overlay.tsx` gezogen,
 * Verhalten 1:1): Stern, „Wichtig & weiter", „Nicht wichtig & weiter" und
 * die Geschwister-Sequenz (Tinder-Sequencer). Lokaler State, kein URL-Param:
 * Die Detailansicht haengt an `?doc=` und ueberlebt den Modus ohnehin nicht.
 */

import { useCallback, useMemo, useState } from 'react'
import { useUserStates } from '../../hooks/use-user-states'
import { useTinderSequencer } from '../../hooks/use-tinder-sequencer'
import { findDocMetaByFileId } from '../../lib/apply-favorite-optimistic'
import type { DocCardMeta } from '../../lib/types'
import type { DetailOverlayProps } from './types'

export type UseBewertungParams = Pick<
  DetailOverlayProps,
  'libraryId' | 'fileId' | 'doc' | 'siblingDocs' | 'prevDoc' | 'nextDoc' | 'onNavigateToDoc' | 'onToggleFavorite'
>

export function useBewertung({ libraryId, fileId, doc, siblingDocs, prevDoc, nextDoc, onNavigateToDoc, onToggleFavorite }: UseBewertungParams) {
  // Sichtbare/relevante fileIds: aktuelle Quelle + Geschwister fuer den
  // Tinder-Modus (sonst kann der Sequencer nicht filtern, was bewertet wurde).
  const visibleFileIds = useMemo(() => {
    const ids = new Set<string>()
    if (fileId) ids.add(fileId)
    if (Array.isArray(siblingDocs)) {
      for (const d of siblingDocs) {
        if (d.fileId) ids.add(d.fileId)
      }
    }
    return Array.from(ids)
  }, [fileId, siblingDocs])
  const { isNotImportant, setState: setUserState } = useUserStates(libraryId, visibleFileIds)

  const isFavoriteForSequencer = useCallback(
    (id: string) => findDocMetaByFileId(doc, id, siblingDocs)?.isFavorite === true,
    [doc, siblingDocs],
  )

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      if (onToggleFavorite) {
        await onToggleFavorite(id)
        return
      }
      const meta = findDocMetaByFileId(doc, id, siblingDocs)
      const next = !(meta?.isFavorite === true)
      await setUserState(id, next ? 'favorite' : null)
    },
    [onToggleFavorite, doc, siblingDocs, setUserState],
  )

  const starMeta = findDocMetaByFileId(doc, fileId, siblingDocs)

  const [ratingActive, setRatingActive] = useState(false)
  const [onlyUnrated, setOnlyUnrated] = useState(true)
  const sequencer = useTinderSequencer({
    docs: siblingDocs ?? [],
    currentFileId: fileId,
    isFavorite: isFavoriteForSequencer,
    isNotImportant,
    onlyUnrated: ratingActive && onlyUnrated,
  })

  // "Wichtig & weiter": favorisiert die aktuelle Quelle (sofern noch nicht)
  // und springt zur naechsten Quelle der Sequenz.
  const handleRateImportant = useCallback(async () => {
    if (!fileId) return
    const meta = findDocMetaByFileId(doc, fileId, siblingDocs)
    if (meta?.isFavorite !== true) {
      if (onToggleFavorite) await onToggleFavorite(fileId)
      else await setUserState(fileId, 'favorite')
    }
    if (sequencer.nextDoc && onNavigateToDoc) onNavigateToDoc(sequencer.nextDoc)
  }, [fileId, doc, siblingDocs, onToggleFavorite, setUserState, sequencer.nextDoc, onNavigateToDoc])

  // "Nicht wichtig & weiter": markiert privat als nicht wichtig und springt weiter.
  const handleRateNotImportant = useCallback(async () => {
    if (!fileId) return
    await setUserState(fileId, 'not_important')
    if (sequencer.nextDoc && onNavigateToDoc) onNavigateToDoc(sequencer.nextDoc)
  }, [fileId, setUserState, sequencer.nextDoc, onNavigateToDoc])

  // Pfeile im Bewertungsmodus folgen der gefilterten Sequenz, sonst der vom
  // Aufrufer durchgereichten Liste.
  const effectivePrevDoc: DocCardMeta | null = ratingActive ? sequencer.prevDoc : prevDoc ?? null
  const effectiveNextDoc: DocCardMeta | null = ratingActive ? sequencer.nextDoc : nextDoc ?? null

  return {
    ratingActive,
    setRatingActive,
    onlyUnrated,
    setOnlyUnrated,
    sequencer,
    starMeta,
    isNotImportant,
    handleToggleFavorite,
    handleRateImportant,
    handleRateNotImportant,
    effectivePrevDoc,
    effectiveNextDoc,
  }
}
