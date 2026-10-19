/**
 * @fileoverview Einladung zum Beitragen im geführten Galerie-Profil (Plan
 * galerie-buergeransicht, G4; Owner-Entscheid 1 vom 19.10.2026).
 *
 * @description
 * Alle sehen die Einladung, beitragen geht nur angemeldet: Anonyme bekommen
 * einen ruhigen Textknopf „Beitragen", der die Anmeldung öffnet (Clerk-Modal,
 * danach zur Wizard-Übersicht). Angemeldete sehen denselben Knopf nur, wenn
 * sie erfassen dürfen (`CaptureContentButton`, serverseitig geprüft).
 */

'use client'

import { SignInButton, useUser } from '@clerk/nextjs'
import { FilePlus2 } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { CaptureContentButton } from './capture-content-button'

export interface BeitragenEinladungProps {
  libraryId?: string
}

export function BeitragenEinladung({ libraryId }: BeitragenEinladungProps) {
  const { t } = useTranslation()
  const { isSignedIn, isLoaded } = useUser()
  if (!libraryId || !isLoaded) return null

  if (isSignedIn) return <CaptureContentButton libraryId={libraryId} variant="ruhig" />

  const label = t('gallery.beitragen', { defaultValue: 'Beitragen' })
  const hinweis = t('gallery.beitragenAnmelden', { defaultValue: 'Zum Beitragen anmelden' })
  return (
    <SignInButton mode="modal" fallbackRedirectUrl="/library/create?from=gallery">
      <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" title={hinweis} aria-label={hinweis}>
        <FilePlus2 className="h-3.5 w-3.5 lg:mr-1" aria-hidden />
        {/* Owner-Regel 08.10.2026: unter lg nur Symbol, Text im Tooltip */}
        <span className="hidden lg:inline">{label}</span>
      </Button>
    </SignInButton>
  )
}
