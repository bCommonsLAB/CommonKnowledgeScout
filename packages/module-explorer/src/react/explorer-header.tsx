'use client'

/**
 * Kopfzeile der Explorer-Wurzel: Titel bzw. Logo-Platzhalter plus der
 * Hinweis-Slot der Anwendung.
 */

import * as React from 'react'
import { useTranslation } from '@ks/i18n/react'
import type { ExplorerLibraryPayload } from './types'

interface ExplorerHeaderProps {
  library: ExplorerLibraryPayload
  renderNotice?: (opts: { libraryId: string }) => React.ReactNode
}

export function ExplorerHeader({ library, renderNotice }: ExplorerHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="border-b bg-background flex-shrink-0">
      {library.logoUrl ? (
        <>
          {/* Website-Logo uebernimmt ab sm+ die Markenrolle (TopNav, ueberlappend) —
             Text-Titel dort ausblenden. Der schmale Spacer gibt nur dem Logo-
             Ueberhang Luft (kein voller Header-Block, sonst wird Platz verschwendet).
             Mobil rendert die TopNav kein Logo, darum bleibt der Titel dort. */}
          <h1 className="px-3 py-2 text-lg font-bold truncate sm:hidden">{library.label}</h1>
          <div className="hidden sm:block sm:h-10" aria-hidden="true" />
        </>
      ) : (
        <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {t('explore.publicLibrary')}
            </p>
          </div>
        </div>
      )}
      {/* A1: Nicht-blockierende Warnung beim Öffnen, falls die Library nicht geprüft ist. */}
      <div className="px-3 pb-2 sm:px-4 sm:pb-3">
        {renderNotice?.({ libraryId: library.id })}
      </div>
    </div>
  )
}
