'use client'

/**
 * Montagepunkt der Fragen-Chronik (D1) in der Voll-App.
 *
 * Reicht herein, was das Paket `@ks/module-story` nicht kennen darf: den
 * Anmeldezustand (Clerk), die Instanz (gleiche Herkunft) und die aktive
 * Sitzung des Chat-Panels (ueber `useActiveChatId`, geteilt per Atom). Im
 * Embed uebernimmt `@ks/embed` diese Rolle (D6).
 */

import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { StoryChronik } from '@ks/module-story/react'
import { useActiveChatId } from '@/components/library/chat/chat-panel/hooks/use-active-chat-id'

export function StoryChronikMount({ libraryId }: { libraryId: string }) {
  const { isSignedIn } = useUser()
  const { setActiveChatId } = useActiveChatId(libraryId)
  return (
    <StoryChronik
      libraryId={libraryId}
      instanz={SAME_ORIGIN_API}
      viewer={{ isSignedIn: isSignedIn === true }}
      onSitzungWaehlen={setActiveChatId}
      onNeueSitzung={() => setActiveChatId(null)}
    />
  )
}
