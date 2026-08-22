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
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { AgentViewPanel } from '@/components/library/agent-view/agent-view-panel'

export default function AgentViewPage() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find((library) => library.id === activeLibraryId)

  // Opt-in pro Library (Default aus): Direktaufrufe der URL bekommen einen
  // Hinweis statt der Sicht — kein stilles Rendern einer deaktivierten Seite.
  if (activeLibrary && activeLibrary.config?.agentView?.enabled !== true) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
        <p>
          Die Agentensicht ist für &bdquo;{activeLibrary.label}&ldquo; deaktiviert.
          <br />
          Aktivieren: Einstellungen &rarr; Erweitert &rarr; Agentensicht.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-6 pb-6 pt-0 lg:px-4">
      <AgentViewPanel
        libraryId={activeLibraryId ?? undefined}
        libraryLabel={activeLibrary?.label}
        localRootPath={activeLibrary?.config?.agentView?.localRootPath ?? null}
      />
    </div>
  )
}
