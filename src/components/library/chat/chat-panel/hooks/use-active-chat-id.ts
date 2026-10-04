/**
 * Aktive Sitzung je Library — seit D6c ein duenner Mantel um
 * `useStorySitzungId` aus dem Story-Paket: Chat-Reiter, Chronik-Montage und
 * Adress-Bindung (`StoryAuswahlUrl`) sehen damit dieselbe Sitzung wie
 * `StoryRoot` (ein Atom, ein localStorage-Schluessel). Der alte Name bleibt
 * fuer die Aufrufer der App.
 */

import { useStorySitzungId } from '@ks/module-story/react'

interface UseActiveChatIdResult {
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
}

export function useActiveChatId(libraryId: string): UseActiveChatIdResult {
  const { chatId, setChatId } = useStorySitzungId(libraryId)
  return { activeChatId: chatId, setActiveChatId: setChatId }
}
