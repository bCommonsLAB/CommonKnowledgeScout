'use client'

/**
 * @fileoverview Seite „Agentensicht" (Welle 2) — eigener Bereich neben Archiv.
 *
 * @description
 * Duenner Rahmen: waehlt die aktive Library aus dem Jotai-Atom und uebergibt
 * ihre Id an das Panel. Alle Daten kommen aus der Coverage-API; die Seite
 * kennt kein Storage-Backend (Akzeptanzkriterium 5).
 *
 * @see docs/concepts/projektauftrag-agentensicht.md (F1, F1b)
 */

import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { AgentViewPanel } from '@/components/library/agent-view/agent-view-panel'

export default function AgentViewPage() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-6 pb-6 pt-0 lg:px-4">
      <AgentViewPanel libraryId={activeLibraryId ?? undefined} />
    </div>
  )
}
