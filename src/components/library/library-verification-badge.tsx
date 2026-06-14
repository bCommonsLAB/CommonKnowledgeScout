'use client'

/**
 * Verifikations-Status-Abzeichen beim Oeffnen einer Library (Welle A2).
 *
 * `LibraryVerificationBadgeView` ist rein (nur Status → Badge) und damit
 * testbar. `LibraryVerificationBadge` verdrahtet aktive Library + Rolle + Status
 * und zeigt das Abzeichen NUR Mitgliedern (Owner/Co-Creator). Die UI kennt kein
 * Storage-Backend — sie liest nur den Status ueber die API.
 */

import { useAtomValue } from 'jotai'
import { Badge } from '@/components/ui/badge'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { useLibraryRole } from '@/hooks/gallery/use-library-role'
import { useLibraryVerificationStatus } from '@/hooks/library-verification/use-library-verification-status'
import { getVerificationStatusDisplay } from '@/lib/library-verification/status-display'
import type { LibraryVerificationStatus } from '@/lib/library-verification/types'

export function LibraryVerificationBadgeView({ status }: { status: LibraryVerificationStatus }) {
  const display = getVerificationStatusDisplay(status)
  return (
    <Badge variant={display.variant} className={display.className} title={display.description}>
      {display.label}
    </Badge>
  )
}

export interface LibraryVerificationBadgeProps {
  /** Optional explizit; sonst aktive Library aus dem Atom. */
  libraryId?: string
}

export function LibraryVerificationBadge({ libraryId: libraryIdProp }: LibraryVerificationBadgeProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraryId = libraryIdProp || activeLibraryId
  const { isMember, isLoading: roleLoading } = useLibraryRole(libraryId)
  const { status } = useLibraryVerificationStatus(libraryId, isMember && !roleLoading)

  if (!libraryId || !isMember || !status) return null
  return <LibraryVerificationBadgeView status={status} />
}
