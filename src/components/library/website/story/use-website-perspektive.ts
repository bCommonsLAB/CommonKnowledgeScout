'use client'

/**
 * Perspektive der Website-Sektionen `story` und `topics` (18.11.2026 aus
 * `use-website-story.ts` ausgelagert): Beide Sektionen rechnen dieselbe, damit
 * die Themenuebersicht in derselben Sprache steht wie die Antwort darueber.
 *
 * Antwortsprache (Owner 09.11.2026): Die Startseite antwortet in der Sprache
 * der Oberflaeche ('global' loest der Server aus der Locale auf), nicht in
 * einer frueher im Browser gespeicherten Wahl. Erst wenn die Person im Dialog
 * „Antworten anpassen" eine Sprache waehlt, gilt diese fuer den Besuch.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { storyPerspektiveGespeichertAtom, type Perspektive } from '@ks/module-story/react'
import { useStoryContext } from '@/hooks/use-story-context'
import { getInitialGenderInclusive } from '@/components/library/chat/utils/chat-storage'
import type { TargetLanguage } from '@/lib/chat/constants'

export function useWebsitePerspektive(): Perspektive {
  const story = useStoryContext()
  const [genderInclusive] = useState(() => getInitialGenderInclusive())
  const startSprache = useRef(story.targetLanguage)
  const [spracheGewaehlt, setSpracheGewaehlt] = useState<TargetLanguage | null>(null)
  useEffect(() => {
    if (story.targetLanguage !== startSprache.current) setSpracheGewaehlt(story.targetLanguage)
  }, [story.targetLanguage])
  // Befund 10.11.2026: Der Vergleich mit der Startsprache allein merkt nicht, wenn die
  // Person im Dialog ZURUECK auf die Startsprache stellt (en → da → en bei Start „en"
  // blieb „da"). Nach einem Speichern im Dialog gilt deshalb immer dessen Sprache.
  const gespeichert = useAtomValue(storyPerspektiveGespeichertAtom)
  const targetLanguage: TargetLanguage = gespeichert > 0 ? story.targetLanguage : spracheGewaehlt ?? 'global'

  return useMemo<Perspektive>(
    () => ({
      targetLanguage,
      character: story.character,
      accessPerspective: story.accessPerspective,
      socialContext: story.socialContext,
      genderInclusive,
      llmModel: story.llmModel,
    }),
    [targetLanguage, story.character, story.accessPerspective, story.socialContext, story.llmModel, genderInclusive],
  )
}
